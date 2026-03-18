import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
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

/**
 * POST /api/projects/:id/export-reset
 * Clears export state (Export again). Only clears when user explicitly requests.
 */
export async function POST(
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
    const result = await db
      .update(projects)
      .set({
        exportStatus: 'idle',
        exportUrl: null,
        exportRenderId: null,
        exportBucketName: null,
        exportStartedAt: null,
        exportProgress: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, userId)
        )
      )
      .returning({ id: projects.id });

    if (result.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/projects/:id/export-reset error:', err);
    return NextResponse.json(
      { error: 'Failed to reset export' },
      { status: 500 }
    );
  }
}
