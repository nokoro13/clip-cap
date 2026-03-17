import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    return userId;
  } catch {
    return null;
  }
}

function getS3Config() {
  const bucket = process.env.AWS_S3_UPLOAD_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    throw new Error('AWS_S3_UPLOAD_BUCKET and AWS_REGION must be set');
  }
  return { bucket, region };
}

async function deleteS3Object(key: string): Promise<void> {
  const { bucket, region } = getS3Config();
  const client = new S3Client({ region });
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/** GET /api/projects/:id - Get single project */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, userId)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const p = rows[0];
    return NextResponse.json({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      progress: p.progress,
      duration: p.duration,
      clipsCount: p.clipsCount,
      videoUrl: p.videoUrl,
      captions: p.captions,
      segmentCaptions: p.segmentCaptions,
      clips: p.clips,
      fullTranscript: p.fullTranscript,
      youtubeVideoId: p.youtubeVideoId,
      experienceId: p.experienceId,
      createdAt: p.createdAt,
    });
  } catch (err) {
    console.error('GET /api/projects/:id error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

/** DELETE /api/projects/:id - Delete project and S3 object */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  try {
    const rows = await db
      .select({ s3Key: projects.s3Key })
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, userId)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const s3Key = rows[0].s3Key;

    await db
      .delete(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, userId)
        )
      );

    if (s3Key && s3Key.startsWith('uploads/')) {
      try {
        await deleteS3Object(s3Key);
      } catch (s3Err) {
        console.error('Failed to delete S3 object:', s3Err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/:id error:', err);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
