import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getRenderProgress } from '@remotion/lambda/client';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ renderId: string }> }
) {
  try {
    const { renderId } = await params;
    const bucketName = _request.headers.get('x-bucket-name');
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    const region = process.env.AWS_REGION || 'us-east-2';

    if (!functionName || !bucketName) {
      return NextResponse.json(
        { error: 'Missing configuration or x-bucket-name header' },
        { status: 400 }
      );
    }

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: region as 'us-east-1' | 'us-east-2' | 'us-west-2' | 'eu-central-1' | 'eu-west-1' | 'ap-southeast-1',
    });

    const progressNum =
      typeof progress.overallProgress === 'number'
        ? Math.round(progress.overallProgress * 100)
        : null;

    if (progress.done) {
      const downloadUrl = `/api/download/export?renderId=${encodeURIComponent(renderId)}&bucket=${encodeURIComponent(bucketName)}`;
      await db
        .update(projects)
        .set({
          exportStatus: 'done',
          exportUrl: downloadUrl,
          exportProgress: 100,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projects.exportRenderId, renderId),
            eq(projects.exportBucketName, bucketName)
          )
        );
    } else if (progressNum !== null) {
      await db
        .update(projects)
        .set({
          exportProgress: progressNum,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projects.exportRenderId, renderId),
            eq(projects.exportBucketName, bucketName)
          )
        );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get progress',
      },
      { status: 500 }
    );
  }
}
