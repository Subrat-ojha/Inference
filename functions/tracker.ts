import { attachDatabasePool } from "@neon/functions";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";
import {
  trackerStates,
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

const app = new Hono<{ Variables: { userId: string } }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "PUT", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.use("/state", async (context, next) => {
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
});

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
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

app.notFound((context) => context.json({ error: "Not found." }, 404));
app.onError((error, context) => {
  console.error("Tracker API error", error);
  return context.json({ error: "The tracker could not reach its database." }, 500);
});

export default app;
