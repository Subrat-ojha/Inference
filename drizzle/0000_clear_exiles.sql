CREATE TABLE "tracker_states" (
	"tracker_id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"active_stage" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
