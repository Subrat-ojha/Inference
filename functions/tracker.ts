import { attachDatabasePool } from "@neon/functions";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";
import {
  englishPracticeStates,
  personalNotes,
  trackerStates,
  type StoredEnglishPracticeState,
  type StoredNoteType,
  type StoredTrackerState,
  type StoredTrackState,
} from "./db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!process.env.NEON_AUTH_BASE_URL) throw new Error("NEON_AUTH_BASE_URL is required.");
if (!process.env.NEON_AUTH_JWKS_URL) throw new Error("NEON_AUTH_JWKS_URL is required.");
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: databaseUrl.toString(), max: 5 });
attachDatabasePool(pool);
const db = drizzle(pool);
const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL).origin;

type AppEnv = { Variables: { userId: string } };

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

const requireAuth = async (context: Context<AppEnv>, next: Next) => {
  const authorization = context.req.header("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return context.json({ error: "Sign in is required." }, 401);
  }

  try {
    const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer });
    if (!payload.sub) return context.json({ error: "The session is invalid." }, 401);
    context.set("userId", payload.sub);
    await next();
  } catch {
    return context.json({ error: "The session has expired. Sign in again." }, 401);
  }
};

app.use("/state", requireAuth);
app.use("/notes", requireAuth);
app.use("/notes/*", requireAuth);
app.use("/speech", requireAuth);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

const noteTypes = new Set<StoredNoteType>(["github", "prompt", "project", "text"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const speechTaskPattern = /^day-(?:[1-9]|[12]\d|30)-(?:listen|mechanics|shadow|workplace)$/;

const emptySpeechState: StoredEnglishPracticeState = {
  accent: null,
  completed: [],
  notes: {},
  clips: {},
};

function cleanSpeechState(value: unknown): StoredEnglishPracticeState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const completed = Array.isArray(input.completed)
    ? [...new Set(input.completed
      .filter((id): id is string => typeof id === "string" && speechTaskPattern.test(id)))]
      .slice(0, 120)
    : [];

  const notes: Record<string, string> = {};
  if (input.notes && typeof input.notes === "object" && !Array.isArray(input.notes)) {
    for (const [key, note] of Object.entries(input.notes as Record<string, unknown>)) {
      const day = Number(key);
      if (Number.isInteger(day) && day >= 1 && day <= 30 && typeof note === "string") {
        notes[String(day)] = cleanText(note, 1_000);
      }
    }
  }

  const clips: Record<string, string> = {};
  if (input.clips && typeof input.clips === "object" && !Array.isArray(input.clips)) {
    for (const [key, rawUrl] of Object.entries(input.clips as Record<string, unknown>)) {
      const block = Number(key);
      if (!Number.isInteger(block) || block < 1 || block > 6 || typeof rawUrl !== "string") continue;
      const candidate = rawUrl.trim().slice(0, 2_048);
      if (!candidate) continue;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") clips[String(block)] = parsed.toString();
      } catch {
        return null;
      }
    }
  }

  return {
    accent: input.accent === "us" || input.accent === "uk" ? input.accent : null,
    completed,
    notes,
    clips,
  };
}

function cleanNoteInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const type = noteTypes.has(input.type as StoredNoteType)
    ? input.type as StoredNoteType
    : null;
  const title = cleanText(input.title, 160).trim();
  const body = cleanText(input.body, 10_000).trim();
  const rawUrl = cleanText(input.url, 2_048).trim();
  let url: string | null = null;

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      url = parsed.toString();
    } catch {
      return null;
    }
  }

  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().toLowerCase().replace(/^#/, "").slice(0, 32))
      .filter(Boolean))].slice(0, 10)
    : [];

  if (!type || !title || !body) return null;
  if (type === "github" && !url) return null;

  return {
    type,
    title,
    body,
    url,
    tags,
    pinned: input.pinned === true,
  };
}

function emptyTrack(stageCount: number): StoredTrackState {
  return Object.fromEntries(
    Array.from({ length: stageCount }, (_, index) => [
      String(index + 1),
      { completed: [], hours: 0, notes: "" },
    ]),
  );
}

function cleanTrack(
  value: unknown,
  stageCount: number,
  maxCompleted = 2,
): StoredTrackState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  const result: StoredTrackState = {};

  for (let stage = 1; stage <= stageCount; stage += 1) {
    const raw = input[String(stage)];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const completed = Array.isArray(item.completed)
      ? [...new Set(item.completed.filter((id): id is string => typeof id === "string"))].slice(0, maxCompleted)
      : [];

    result[String(stage)] = {
      completed,
      hours:
        typeof item.hours === "number" && Number.isFinite(item.hours)
          ? Math.min(Math.max(Math.round(item.hours * 4) / 4, 0), 1)
          : 0,
      notes: cleanText(item.notes, 500),
    };
  }

  return result;
}

function cleanStageNumber(value: unknown, stageCount: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 1), stageCount)
    : 1;
}

function cleanState(value: unknown, legacyActiveStage = 1): StoredTrackerState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  if (input.tracks && typeof input.tracks === "object" && !Array.isArray(input.tracks)) {
    const tracks = input.tracks as Record<string, unknown>;
    const inference = cleanTrack(tracks.inference, 12);
    const java = cleanTrack(tracks.java, 16);
    if (!inference || !java) return null;

    const activeStages = input.activeStages && typeof input.activeStages === "object"
      ? input.activeStages as Record<string, unknown>
      : {};

    return {
      version: 3,
      tracks: { inference, java },
      activeStages: {
        inference: cleanStageNumber(activeStages.inference, 12),
        java: cleanStageNumber(activeStages.java, 16),
      },
      selectedTrack: input.selectedTrack === "java" ? "java" : "inference",
    };
  }

  // Convert the original 12-stage payload when an existing tracker saves again.
  const legacyInference = cleanTrack(input, 12, 3);
  if (!legacyInference) return null;

  return {
    version: 3,
    tracks: { inference: legacyInference, java: emptyTrack(16) },
    activeStages: { inference: cleanStageNumber(legacyActiveStage, 12), java: 1 },
    selectedTrack: "inference",
  };
}

app.get("/health", (context) =>
  context.json({ ok: true, service: "engineering-tracker" }),
);

app.get("/state", async (context) => {
  const userId = context.get("userId");

  const [row] = await db
    .select({
      state: trackerStates.state,
      activeStage: trackerStates.activeStage,
      updatedAt: trackerStates.updatedAt,
    })
    .from(trackerStates)
    .where(eq(trackerStates.userId, userId))
    .limit(1);

  if (!row) return context.json({ error: "Tracker not found." }, 404);
  return context.json(row);
});

app.put("/state", async (context) => {
  const userId = context.get("userId");

  const contentLength = Number(context.req.header("content-length") ?? 0);
  if (contentLength > 30_000) return context.json({ error: "Tracker payload is too large." }, 413);

  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Request body must be valid JSON." }, 400);
  }

  const payload = body as { state?: unknown; activeStage?: unknown };
  const activeStage =
    typeof payload.activeStage === "number"
      ? Math.min(Math.max(Math.round(payload.activeStage), 1), 16)
      : 1;
  const state = cleanState(payload.state, activeStage);

  if (!state) return context.json({ error: "Tracker state is invalid." }, 400);

  const [saved] = await db
    .insert(trackerStates)
    .values({ userId, state, activeStage, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: trackerStates.userId,
      set: { state, activeStage, updatedAt: new Date() },
    })
    .returning({ updatedAt: trackerStates.updatedAt });

  return context.json({ ok: true, updatedAt: saved.updatedAt });
});

app.get("/notes", async (context) => {
  const userId = context.get("userId");
  const rows = await db
    .select()
    .from(personalNotes)
    .where(eq(personalNotes.userId, userId))
    .orderBy(desc(personalNotes.pinned), desc(personalNotes.updatedAt))
    .limit(500);

  return context.json({ notes: rows });
});

app.post("/notes", async (context) => {
  const userId = context.get("userId");
  const contentLength = Number(context.req.header("content-length") ?? 0);
  if (contentLength > 20_000) return context.json({ error: "Note payload is too large." }, 413);

  const input = cleanNoteInput(await context.req.json().catch(() => null));
  if (!input) return context.json({ error: "The note is invalid." }, 400);

  const [note] = await db
    .insert(personalNotes)
    .values({ userId, ...input })
    .returning();

  return context.json({ note }, 201);
});

app.put("/notes/:id", async (context) => {
  const userId = context.get("userId");
  const id = context.req.param("id");
  if (!uuidPattern.test(id)) return context.json({ error: "Note not found." }, 404);

  const contentLength = Number(context.req.header("content-length") ?? 0);
  if (contentLength > 20_000) return context.json({ error: "Note payload is too large." }, 413);
  const input = cleanNoteInput(await context.req.json().catch(() => null));
  if (!input) return context.json({ error: "The note is invalid." }, 400);

  const [note] = await db
    .update(personalNotes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(personalNotes.id, id), eq(personalNotes.userId, userId)))
    .returning();

  if (!note) return context.json({ error: "Note not found." }, 404);
  return context.json({ note });
});

app.delete("/notes/:id", async (context) => {
  const userId = context.get("userId");
  const id = context.req.param("id");
  if (!uuidPattern.test(id)) return context.json({ error: "Note not found." }, 404);

  const [deleted] = await db
    .delete(personalNotes)
    .where(and(eq(personalNotes.id, id), eq(personalNotes.userId, userId)))
    .returning({ id: personalNotes.id });

  if (!deleted) return context.json({ error: "Note not found." }, 404);
  return context.json({ ok: true });
});

app.get("/speech", async (context) => {
  const userId = context.get("userId");
  const [row] = await db
    .select({ state: englishPracticeStates.state, updatedAt: englishPracticeStates.updatedAt })
    .from(englishPracticeStates)
    .where(eq(englishPracticeStates.userId, userId))
    .limit(1);

  return context.json(row ?? { state: emptySpeechState, updatedAt: null });
});

app.put("/speech", async (context) => {
  const userId = context.get("userId");
  const contentLength = Number(context.req.header("content-length") ?? 0);
  if (contentLength > 250_000) return context.json({ error: "Practice payload is too large." }, 413);

  const body = await context.req.json().catch(() => null) as { state?: unknown } | null;
  const state = cleanSpeechState(body?.state);
  if (!state) return context.json({ error: "Practice state is invalid." }, 400);

  const [saved] = await db
    .insert(englishPracticeStates)
    .values({ userId, state, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: englishPracticeStates.userId,
      set: { state, updatedAt: new Date() },
    })
    .returning({ updatedAt: englishPracticeStates.updatedAt });

  return context.json({ ok: true, updatedAt: saved.updatedAt });
});

app.notFound((context) => context.json({ error: "Not found." }, 404));
app.onError((error, context) => {
  console.error("Engineering API error", error);
  return context.json({ error: "The app could not reach its database." }, 500);
});

export default app;
