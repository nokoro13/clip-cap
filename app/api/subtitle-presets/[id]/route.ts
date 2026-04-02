import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { subtitlePresets } from '@/lib/db/schema';
import { isUserSavedPresetId } from '@/lib/user-subtitle-presets';

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    return userId;
  } catch {
    return null;
  }
}

/** DELETE /api/subtitle-presets/:id */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || !isUserSavedPresetId(id)) {
    return NextResponse.json({ error: 'Invalid preset id' }, { status: 400 });
  }

  try {
    const deleted = await db
      .delete(subtitlePresets)
      .where(
        and(eq(subtitlePresets.id, id), eq(subtitlePresets.userId, userId))
      )
      .returning({ id: subtitlePresets.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[subtitle-presets DELETE]', e);
    return NextResponse.json(
      { error: 'Failed to delete preset' },
      { status: 500 }
    );
  }
}
