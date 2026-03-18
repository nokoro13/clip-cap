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
 * POST /api/projects/:id/export-complete
 * Marks export as done and stores the download URL.
 * Called when the client confirms export completion.
 */
export async function POST(
  request: Request,
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
    const body = await request.json().catch(() => ({}));
    const { exportUrl } = body as { exportUrl?: string };

    if (!exportUrl || typeof exportUrl !== 'string') {
      return NextResponse.json(
        { error: 'exportUrl is required' },
        { status: 400 }
      );
    }

    const result = await db
      .update(projects)
      .set({
        exportStatus: 'done',
        exportUrl,
        exportProgress: 100,
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
    console.error('POST /api/projects/:id/export-complete error:', err);
    return NextResponse.json(
      { error: 'Failed to update export' },
      { status: 500 }
    );
  }
}
