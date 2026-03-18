CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"experience_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"progress" integer DEFAULT 0,
	"duration" integer,
	"clips_count" integer,
	"s3_key" text,
	"video_url" text,
	"captions" jsonb,
	"segment_captions" jsonb,
	"clips" jsonb,
	"full_transcript" text,
	"youtube_video_id" text,
	"editor_state" jsonb,
	"parent_project_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_projects_user_experience" ON "projects" USING btree ("user_id","experience_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");