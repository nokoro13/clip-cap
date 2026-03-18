import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and, desc, count, isNull } from 'drizzle-orm';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';

const MAX_PROJECTS_PER_USER = 10;

function extractS3KeyFromUrl(videoUrl: string | null | undefined): string | null {
  if (!videoUrl || !videoUrl.includes('.s3.') && !videoUrl.includes('amazonaws.com')) {
    return null;
  }
  try {
    const url = new URL(videoUrl);
    const key = url.pathname.slice(1);
    return key.startsWith('uploads/') ? key : null;
  } catch {
    return null;
  }
}

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    return userId;
  } catch {
    return null;
  }
}

/** GET /api/projects?experienceId=... - List user's projects */
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const experienceId = searchParams.get('experienceId');
  if (!experienceId) {
    return NextResponse.json(
      { error: 'experienceId is required' },
      { status: 400 }
    );
  }

  try {
    const rows = await db
      .select({
        id: projects.id,
        title: projects.title,
        type: projects.type,
        status: projects.status,
        progress: projects.progress,
        duration: projects.duration,
        clipsCount: projects.clipsCount,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          eq(projects.experienceId, experienceId),
          isNull(projects.parentProjectId)
        )
      )
      .orderBy(desc(projects.createdAt))
      .limit(50);

    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      status: r.status,
      progress: r.progress ?? 0,
      duration: r.duration ?? undefined,
      clipsCount: r.clipsCount ?? undefined,
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    }));

    return NextResponse.json(list);
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

/** POST /api/projects - Create or update project */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      experienceId,
      title,
      type,
      status,
      progress,
      duration,
      clipsCount,
      s3Key,
      videoUrl,
      captions,
      segmentCaptions,
      clips,
      fullTranscript,
      youtubeVideoId,
      editorState,
      parentProjectId,
    } = body;

    if (!id || typeof id !== 'string' || !experienceId || typeof experienceId !== 'string') {
      return NextResponse.json(
        { error: 'id and experienceId are required' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || !type || !status) {
      return NextResponse.json(
        { error: 'title, type, and status are required' },
        { status: 400 }
      );
    }

    if (type !== 'editor' && type !== 'project') {
      return NextResponse.json(
        { error: 'type must be editor or project' },
        { status: 400 }
      );
    }

    if (!['processing', 'completed', 'error'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be processing, completed, or error' },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, userId),
          eq(projects.experienceId, experienceId)
        )
      )
      .limit(1);

    let resolvedS3Key =
      typeof s3Key === 'string' && s3Key.startsWith('uploads/')
        ? s3Key
        : extractS3KeyFromUrl(videoUrl);
    // Preserve existing s3Key when client sends blob URL (e.g. projects page uses IndexedDB blob for playback)
    if (!resolvedS3Key && existing.length > 0 && existing[0].s3Key) {
      resolvedS3Key = existing[0].s3Key;
    }

    const normalizedDuration =
      typeof duration === 'number' && Number.isFinite(duration)
        ? Math.round(duration)
        : null;

    const resolvedParentProjectId =
      typeof parentProjectId === 'string' && parentProjectId.length > 0
        ? parentProjectId
        : null;

    const row = {
      id,
      userId,
      experienceId,
      title: String(title),
      type: type as 'editor' | 'project',
      status: status as 'processing' | 'completed' | 'error',
      progress: typeof progress === 'number' ? progress : 0,
      duration: normalizedDuration,
      clipsCount: typeof clipsCount === 'number' ? clipsCount : null,
      s3Key: resolvedS3Key ?? null,
      videoUrl: typeof videoUrl === 'string' ? videoUrl : null,
      captions: captions ?? null,
      segmentCaptions: segmentCaptions ?? null,
      clips: clips ?? null,
      fullTranscript: typeof fullTranscript === 'string' ? fullTranscript : null,
      youtubeVideoId: typeof youtubeVideoId === 'string' ? youtubeVideoId : null,
      editorState: editorState ?? null,
      parentProjectId: resolvedParentProjectId,
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      const countResult = await db
        .select({ count: count() })
        .from(projects)
        .where(
          and(
            eq(projects.userId, userId),
            eq(projects.experienceId, experienceId),
            isNull(projects.parentProjectId)
          )
        );

      const total = countResult[0]?.count ?? 0;
      if (total >= MAX_PROJECTS_PER_USER) {
        return NextResponse.json(
          { error: `Maximum ${MAX_PROJECTS_PER_USER} projects per experience. Delete an existing project first.` },
          { status: 400 }
        );
      }

      await db.insert(projects).values(row);
    } else {
      await db
        .update(projects)
        .set({
          title: row.title,
          type: row.type,
          status: row.status,
          progress: row.progress,
          duration: row.duration,
          clipsCount: row.clipsCount,
          s3Key: row.s3Key,
          videoUrl: row.videoUrl,
          captions: row.captions,
          segmentCaptions: row.segmentCaptions,
          clips: row.clips,
          fullTranscript: row.fullTranscript,
          youtubeVideoId: row.youtubeVideoId,
          editorState: row.editorState,
          parentProjectId: row.parentProjectId,
          updatedAt: row.updatedAt,
        })
        .where(
          and(
            eq(projects.id, id),
            eq(projects.userId, userId),
            eq(projects.experienceId, experienceId)
          )
        );
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error('POST /api/projects error:', err);
    return NextResponse.json(
      { error: 'Failed to save project' },
      { status: 500 }
    );
  }
}
