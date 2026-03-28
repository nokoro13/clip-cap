import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    experienceId: text('experience_id').notNull(),
    title: text('title').notNull(),
    type: text('type')
      .notNull()
      .$type<'editor' | 'project'>(),
    status: text('status')
      .notNull()
      .$type<'processing' | 'completed' | 'error'>(),
    progress: integer('progress').default(0),
    duration: integer('duration'),
    clipsCount: integer('clips_count'),
    s3Key: text('s3_key'),
    videoUrl: text('video_url'),
    captions: jsonb('captions'),
    segmentCaptions: jsonb('segment_captions'),
    clips: jsonb('clips'),
    fullTranscript: text('full_transcript'),
    youtubeVideoId: text('youtube_video_id'),
    editorState: jsonb('editor_state'),
    /** When set, this project is a clip of the parent; omit from recent projects list */
    parentProjectId: text('parent_project_id'),
    /** Export state: idle | exporting | done | error */
    exportStatus: text('export_status').$type<'idle' | 'exporting' | 'done' | 'error'>(),
    /** Download URL when export is done (e.g. /api/download/export?renderId=...&bucket=...) */
    exportUrl: text('export_url'),
    /** Remotion render ID (for polling progress) */
    exportRenderId: text('export_render_id'),
    /** Remotion S3 bucket name */
    exportBucketName: text('export_bucket_name'),
    /** When export was started */
    exportStartedAt: timestamp('export_started_at', { withTimezone: true }),
    /** Progress 0-100 when exporting */
    exportProgress: integer('export_progress'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_projects_user_experience').on(
      table.userId,
      table.experienceId,
      table.createdAt
    ),
    index('idx_projects_status').on(table.status),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

/** Monthly usage + tier cache (synced from Whop product access). */
export const users = pgTable('users', {
  userId: text('user_id').primaryKey(),
  accessLevel: text('access_level')
    .notNull()
    .$type<'basic' | 'premium'>(),
  generateSubtitlesCount: integer('generate_subtitles_count').notNull().default(0),
  bulkGenerateCount: integer('bulk_generate_count').notNull().default(0),
  /** Start of current billing period (from Whop `renewal_period_start` when webhooks run). */
  currentPeriodStart: timestamp('current_period_start', {
    withTimezone: true,
  }).notNull(),
  /** End of current billing period from Whop (`renewal_period_end`); null until webhook or inferred. */
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type AppUser = typeof users.$inferSelect;
export type NewAppUser = typeof users.$inferInsert;
