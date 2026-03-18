import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { renderMediaOnLambda } from '@remotion/lambda/client';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    return userId;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      videoUrl,
      subtitles,
      style,
      videoSegments,
      videoTransform,
      customTextSegments,
      customTextTracks,
      bannerSegments,
      bannerTracks,
      subtitleMode,
      highlightColor,
      videoAspectRatio,
    } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL;
    const region = process.env.AWS_REGION || 'us-east-2';

    if (!functionName || !serveUrl) {
      return NextResponse.json(
        {
          error:
            'Lambda not configured. Set REMOTION_LAMBDA_FUNCTION_NAME and REMOTION_LAMBDA_SERVE_URL.',
        },
        { status: 500 }
      );
    }

    const existingExport = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          eq(projects.exportStatus, 'exporting')
        )
      )
      .limit(1);

    if (existingExport.length > 0 && existingExport[0].id !== projectId) {
      return NextResponse.json(
        {
          error: 'Another export is already in progress. Please wait for it to complete.',
        },
        { status: 409 }
      );
    }

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: region as 'us-east-1' | 'us-east-2' | 'us-west-2' | 'eu-central-1' | 'eu-west-1' | 'ap-southeast-1',
      functionName,
      serveUrl,
      composition: 'EditorVideo',
      inputProps: {
        videoUrl: videoUrl ?? null,
        subtitles: subtitles ?? [],
        style: style ?? {},
        videoSegments: videoSegments ?? [],
        videoTransform: videoTransform ?? { scale: 1, offsetX: 0, offsetY: 0 },
        customTextSegments: customTextSegments ?? [],
        customTextTracks: customTextTracks ?? [],
        bannerSegments: bannerSegments ?? [],
        bannerTracks: bannerTracks ?? [],
        subtitleMode: subtitleMode ?? 'segment-highlight',
        highlightColor: highlightColor ?? '#facc15',
        videoAspectRatio: videoAspectRatio ?? 16 / 9,
      },
      codec: 'h264',
      imageFormat: 'jpeg',
      maxRetries: 1,
      framesPerLambda: 500,
      privacy: 'public',
      overwrite: true,
    });

    if (projectId) {
      await db
        .update(projects)
        .set({
          exportStatus: 'exporting',
          exportRenderId: renderId,
          exportBucketName: bucketName,
          exportStartedAt: new Date(),
          exportProgress: 0,
          exportUrl: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.userId, userId)
          )
        );
    }

    return NextResponse.json({
      success: true,
      renderId,
      bucketName,
    });
  } catch (error) {
    console.error('Render error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Render failed',
      },
      { status: 500 }
    );
  }
}
