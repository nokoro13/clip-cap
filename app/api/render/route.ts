import { NextResponse } from 'next/server';
import { renderMediaOnLambda } from '@remotion/lambda/client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
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
