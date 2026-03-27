import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { whopsdk } from '@/lib/whop-sdk';
import { getUserUsageDisplay } from '@/lib/user-service';

/** GET /api/users/usage — current user’s usage and limits (requires Whop auth). */
export async function GET() {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usage = await getUserUsageDisplay(userId);
    if (!usage) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 403 }
      );
    }

    return NextResponse.json(usage);
  } catch (err) {
    if (err instanceof Error && err.message?.includes('verifyUserToken')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/users/usage error:', err);
    return NextResponse.json(
      { error: 'Failed to load usage' },
      { status: 500 }
    );
  }
}
