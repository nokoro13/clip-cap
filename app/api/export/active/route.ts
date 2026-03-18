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
 * GET /api/export/active
 * Returns the project ID currently exporting for this user, if any.
 * Used to enforce one export per user - disable export on other projects.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: projects.id,
        exportProgress: projects.exportProgress,
      })
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          eq(projects.exportStatus, 'exporting')
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ activeExportProjectId: null });
    }

    return NextResponse.json({
      activeExportProjectId: rows[0].id,
      progress: rows[0].exportProgress ?? 0,
    });
  } catch (err) {
    console.error('Export active check error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to check export' },
      { status: 500 }
    );
  }
}
