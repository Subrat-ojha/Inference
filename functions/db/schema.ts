import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
