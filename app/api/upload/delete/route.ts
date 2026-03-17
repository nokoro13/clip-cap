import { NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Delete an S3 object by key.
 * POST /api/upload/delete with body { key: "uploads/..." }
 */

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
    const key = typeof json.key === 'string' ? json.key : '';

    if (!key || !key.startsWith('uploads/')) {
      return NextResponse.json(
        { error: 'Invalid or missing key. Must start with uploads/.' },
        { status: 400 }
      );
    }

    const client = new S3Client({ region });
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete S3 object error:', err);
    return NextResponse.json(
      { error: 'Failed to delete S3 object.' },
      { status: 500 }
    );
  }
}
