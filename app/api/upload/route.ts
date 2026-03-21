import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Presigned URL upload for user videos (Remotion-recommended flow).
 * Client requests a presigned URL with contentType + size; uploads directly to S3.
 * Returns readUrl for use in Remotion Player and server-side rendering.
 *
 * Required env: AWS_S3_UPLOAD_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * (or IAM role when deployed).
 */

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024 * 10; // 10GB (match UI copy)
const EXPIRES_IN_SECONDS = 60 * 60; // 1 hour for upload

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/webm',
];

function getConfig() {
  const bucket = process.env.AWS_S3_UPLOAD_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    throw new Error('AWS_S3_UPLOAD_BUCKET and AWS_REGION must be set');
  }
  return { bucket, region };
}

export async function POST(request: Request) {
  try {
    const { bucket, region } = getConfig();

    const json = await request.json();
    console.log('[upload] Presign request:', json.size, 'bytes', json.contentType);
    const size = typeof json.size === 'number' ? json.size : Number(json.size);
    const contentType =
      typeof json.contentType === 'string'
        ? json.contentType
        : (json.contentType as string);

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing size. Must be a positive number.' },
        { status: 400 }
      );
    }

    if (size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024 / 1024}GB.`,
        },
        { status: 400 }
      );
    }

    const normalizedType =
      contentType && contentType.trim() ? contentType.trim() : 'video/mp4';
    if (
      !ALLOWED_VIDEO_TYPES.some(
        (t) => normalizedType === t || normalizedType.startsWith(`${t};`)
      )
    ) {
      return NextResponse.json(
        {
          error: `Invalid content type. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const client = new S3Client({ region });
    const key = `uploads/${crypto.randomUUID()}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: normalizedType,
      ContentLength: size,
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: EXPIRES_IN_SECONDS,
    });

    // Public read URL after upload (bucket must allow public read or use CloudFront)
    const readUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log('[upload] Presigned URL generated for', key);

    return NextResponse.json({ presignedUrl, readUrl });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('must be set')) {
        return NextResponse.json(
          { error: 'Server upload configuration is missing.' },
          { status: 500 }
        );
      }
    }
    console.error('Upload presign error:', err);
    return NextResponse.json(
      { error: 'Failed to generate upload URL.' },
      { status: 500 }
    );
  }
}
