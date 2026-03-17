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
