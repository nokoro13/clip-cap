CREATE TABLE IF NOT EXISTS "subtitle_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_subtitle_presets_user_id" ON "subtitle_presets" ("user_id");
