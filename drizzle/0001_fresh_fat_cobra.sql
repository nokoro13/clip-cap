CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_level" text NOT NULL,
	"generate_subtitles_count" integer DEFAULT 0 NOT NULL,
	"bulk_generate_count" integer DEFAULT 0 NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_status" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_render_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_bucket_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "export_progress" integer;