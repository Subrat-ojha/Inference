import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type StoredStageState = {
  completed: string[];
  hours: number;
  notes: string;
};

export type StoredTrackState = Record<string, StoredStageState>;

export type StoredTrackerState = {
  version: 3;
  tracks: {
    inference: StoredTrackState;
    java: StoredTrackState;
  };
  activeStages: {
    inference: number;
    java: number;
  };
  selectedTrack: "inference" | "java";
};

export const trackerStates = pgTable("tracker_states", {
  userId: text("tracker_id").primaryKey(),
  state: jsonb("state").$type<StoredTrackerState>().notNull(),
  activeStage: integer("active_stage").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type StoredNoteType = "github" | "prompt" | "project" | "text";

export type StoredEnglishPracticeState = {
  accent: "us" | "uk" | null;
  completed: string[];
  notes: Record<string, string>;
  clips: Record<string, string>;
};

export type StoredPlannerItem = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  details: string;
  url: string;
  sourceUrl: string;
  kind: "task" | "event";
  tentative: boolean;
  completed: boolean;
};

export type StoredWeekendPlannerState = {
  items: StoredPlannerItem[];
};

export type StoredScheduleItem = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  kind: "task" | "event";
  category: "work" | "personal" | "learning" | "health" | "travel" | "other";
  location: string;
  details: string;
  url: string;
  completed: boolean;
};

export type StoredScheduleState = { items: StoredScheduleItem[] };

export const scheduleStates = pgTable("schedule_states", {
  userId: text("user_id").primaryKey(),
  state: jsonb("state").$type<StoredScheduleState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const personalNotes = pgTable(
  "personal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    type: text("type").$type<StoredNoteType>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("personal_notes_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const englishPracticeStates = pgTable("english_practice_states", {
  userId: text("user_id").primaryKey(),
  state: jsonb("state").$type<StoredEnglishPracticeState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weekendPlannerStates = pgTable("weekend_planner_states", {
  userId: text("user_id").primaryKey(),
  state: jsonb("state").$type<StoredWeekendPlannerState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
