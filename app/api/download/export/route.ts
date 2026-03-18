import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy download for exported videos. Streams from Remotion Lambda's S3 bucket
 * with Content-Disposition: attachment so the browser triggers a download
 * instead of redirecting. Same-origin URL works in WebViews and mobile apps.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const renderId = searchParams.get('renderId');
    const bucket = searchParams.get('bucket');

    if (!renderId || !bucket) {
      return NextResponse.json(
        { error: 'Missing renderId or bucket' },
        { status: 400 }
      );
    }

    const region = process.env.AWS_REGION || 'us-east-2';
    const accessKeyId =
      process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: 'AWS credentials not configured' },
        { status: 500 }
      );
    }

    const client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    const key = `renders/${renderId}/out.mp4`;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return NextResponse.json(
        { error: 'Video not found or empty' },
        { status: 404 }
      );
    }

    const contentLength = response.ContentLength ?? 0;

    return new NextResponse(response.Body as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="clip.mp4"',
        ...(contentLength > 0 && {
          'Content-Length': String(contentLength),
        }),
      },
    });
  } catch (error) {
    console.error('Download export error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to download video',
      },
      { status: 500 }
    );
  }
}
