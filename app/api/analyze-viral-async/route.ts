import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { analyzeViralFromInput } from '@/lib/analyze-viral';
import { getFileForWhisper } from '@/lib/extract-audio';

export const runtime = 'nodejs';
export const maxDuration = 30; // Short - we return immediately, background runs separately

/** SSRF protection: only allow URLs from our S3 upload bucket */
function isAllowedVideoUrl(url: string): boolean {
  const bucket = process.env.AWS_S3_UPLOAD_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const virtualHosted = parsed.hostname === `${bucket}.s3.${region}.amazonaws.com`;
    const pathStyle =
      parsed.hostname === `s3.${region}.amazonaws.com` &&
      parsed.pathname.startsWith(`/${bucket}/`);
    return (virtualHosted || pathStyle) && parsed.pathname.includes('/uploads/');
  } catch {
    return false;
  }
}

function extractS3KeyFromUrl(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    const key = url.pathname.slice(1);
    return key.startsWith('uploads/') ? key : null;
  } catch {
    return null;
  }
}

/** Run analysis in background and update project when done */
async function runAnalysisInBackground(
  videoUrl: string,
  projectId: string,
  experienceId: string,
  userId: string,
  title: string,
  topics: string[]
): Promise<void> {
  const startTime = Date.now();
  console.log('[analyze-viral-async] Background job started for', projectId);

  try {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video from S3: ${response.status}`);
    }
    const blob = await response.blob();
    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      blob.type ||
      'video/mp4';
    const ext = contentType.includes('quicktime') ? 'mov' : 'mp4';
    const file = new File([blob], `video.${ext}`, { type: contentType });

    const { file: fileForWhisper, cleanup } = await getFileForWhisper(file);
    try {
      const { captions, segmentCaptions, clips, duration, fullTranscript } =
        await analyzeViralFromInput({
          file: fileForWhisper,
          audioUrl: null,
          videoDuration: null,
          topics,
        });

      const clipsWithStatus = (clips ?? []).map(
        (c: { id: string; title: string; startMs: number; endMs: number; viralityScore: number; reason?: string; transcript: string }) => ({
          ...c,
          status: 'all',
        })
      );

      const s3Key = extractS3KeyFromUrl(videoUrl);
      const normalizedDuration =
        typeof duration === 'number' && Number.isFinite(duration)
          ? Math.round(duration)
          : null;

      await db
        .update(projects)
        .set({
          status: 'completed',
          progress: 100,
          duration: normalizedDuration,
          clipsCount: clipsWithStatus.length,
          videoUrl,
          s3Key: s3Key ?? undefined,
          captions: captions ?? [],
          segmentCaptions: segmentCaptions ?? [],
          clips: clipsWithStatus,
          fullTranscript: fullTranscript ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.userId, userId),
            eq(projects.experienceId, experienceId)
          )
        );

      console.log(
        '[analyze-viral-async] Background job completed:',
        projectId,
        clipsWithStatus.length,
        'clips in',
        Date.now() - startTime,
        'ms'
      );
    } finally {
      cleanup();
    }
  } catch (err) {
    console.error('[analyze-viral-async] Background job failed:', projectId, err);

    await db
      .update(projects)
      .set({
        status: 'error',
        progress: 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userId),
          eq(projects.experienceId, experienceId)
        )
      );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      videoUrl,
      projectId,
      experienceId,
      title,
      topics = ['auto'],
    } = body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { error: 'videoUrl is required' },
        { status: 400 }
      );
    }
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }
    if (!experienceId || typeof experienceId !== 'string') {
      return NextResponse.json(
        { error: 'experienceId is required' },
        { status: 400 }
      );
    }

    if (!isAllowedVideoUrl(videoUrl)) {
      return NextResponse.json(
        { error: 'Invalid video URL' },
        { status: 400 }
      );
    }

    const existing = await db
      .select({ id: projects.id, title: projects.title })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userId),
          eq(projects.experienceId, experienceId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const s3Key = extractS3KeyFromUrl(videoUrl);
    await db
      .update(projects)
      .set({
        videoUrl,
        s3Key: s3Key ?? undefined,
        status: 'processing',
        progress: 0,
        title: typeof title === 'string' ? title : existing[0].title,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userId),
          eq(projects.experienceId, experienceId)
        )
      );

    runAnalysisInBackground(
      videoUrl,
      projectId,
      experienceId,
      userId,
      title || 'Video',
      Array.isArray(topics) ? topics : ['auto']
    ).catch((e) => {
      console.error('[analyze-viral-async] Background promise rejected:', e);
    });

    console.log('[analyze-viral-async] Job queued for', projectId);

    return NextResponse.json({
      success: true,
      projectId,
      message: 'Analysis started. Poll /api/projects/:id for status.',
    });
  } catch (err) {
    console.error('[analyze-viral-async] Error:', err);
    if (err instanceof Error && err.message?.includes('verifyUserToken')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}
