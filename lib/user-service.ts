import { eq, sql } from 'drizzle-orm';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { users, type AppUser } from '@/lib/db/schema';
import {
  USAGE_PERIOD_MS,
  type AccessLevel,
  bulkLimitForAccess,
  subtitlesLimitForAccess,
} from '@/lib/access-limits';
import type { UserUsageStats } from '@/lib/user-usage-types';

export type UploadKind = 'subtitle' | 'bulk';

export type CanUploadResult = {
  allowed: boolean;
  reason?: string;
  requiresUpgrade?: boolean;
};

function getProductIds(): { premiumProductId: string; basicProductId: string | null } {
  const premiumProductId = process.env.NEXT_PUBLIC_WHOP_PREMIUM_PRODUCT_ID;
  const basicProductId = process.env.NEXT_PUBLIC_WHOP_PRODUCT_ID ?? null;
  if (!premiumProductId) {
    throw new Error('NEXT_PUBLIC_WHOP_PREMIUM_PRODUCT_ID is not set');
  }
  return { premiumProductId, basicProductId };
}

async function resolveAccessFromWhop(userId: string): Promise<AccessLevel | null> {
  const { premiumProductId, basicProductId } = getProductIds();
  const [premiumAccess, basicAccess] = await Promise.all([
    whopsdk.users.checkAccess(premiumProductId, { id: userId }),
    basicProductId
      ? whopsdk.users.checkAccess(basicProductId, { id: userId })
      : Promise.resolve({ has_access: false }),
  ]);
  if (premiumAccess.has_access) return 'premium';
  if (basicAccess.has_access) return 'basic';
  return null;
}

function periodExpired(periodStart: Date): boolean {
  return Date.now() - periodStart.getTime() >= USAGE_PERIOD_MS;
}

/**
 * Ensures a `users` row exists, access level matches Whop, and usage period is rolled if needed.
 * Returns `null` if the user has no Basic/Premium product access.
 */
export async function ensureUserSynced(userId: string): Promise<AppUser | null> {
  const accessLevel = await resolveAccessFromWhop(userId);
  if (!accessLevel) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);

  const now = new Date();

  if (existing.length === 0) {
    const [inserted] = await db
      .insert(users)
      .values({
        userId,
        accessLevel,
        generateSubtitlesCount: 0,
        bulkGenerateCount: 0,
        currentPeriodStart: now,
        updatedAt: now,
      })
      .returning();
    return inserted ?? null;
  }

  let row = existing[0]!;
  let needsReset = periodExpired(row.currentPeriodStart);
  const accessChanged = row.accessLevel !== accessLevel;

  if (needsReset) {
    await db
      .update(users)
      .set({
        generateSubtitlesCount: 0,
        bulkGenerateCount: 0,
        currentPeriodStart: now,
        accessLevel,
        updatedAt: now,
      })
      .where(eq(users.userId, userId));
  } else if (accessChanged) {
    await db
      .update(users)
      .set({
        accessLevel,
        updatedAt: now,
      })
      .where(eq(users.userId, userId));
  }

  const [fresh] = await db
    .select()
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  return fresh ?? row;
}

export async function canUpload(
  userId: string,
  kind: UploadKind
): Promise<CanUploadResult> {
  const row = await ensureUserSynced(userId);
  if (!row) {
    return {
      allowed: false,
      reason: 'No active subscription',
      requiresUpgrade: true,
    };
  }

  const level = row.accessLevel as AccessLevel;
  const subtitleLimit = subtitlesLimitForAccess(level);
  const bulkLimit = bulkLimitForAccess(level);

  if (kind === 'subtitle') {
    if (row.generateSubtitlesCount >= subtitleLimit) {
      const isBasic = level === 'basic';
      return {
        allowed: false,
        reason: isBasic
          ? 'You have used all Basic subtitle uploads for this month. Upgrade to Premium for more.'
          : 'You have used all Premium subtitle uploads for this month. Limits reset when your billing period rolls.',
        requiresUpgrade: isBasic,
      };
    }
    return { allowed: true };
  }

  // bulk
  if (level === 'basic') {
    return {
      allowed: false,
      reason: 'Bulk generate requires Premium.',
      requiresUpgrade: true,
    };
  }

  if (row.bulkGenerateCount >= bulkLimit) {
    return {
      allowed: false,
      reason:
        'You have used all bulk uploads for this month. Limits reset when your billing period rolls.',
      requiresUpgrade: false,
    };
  }

  return { allowed: true };
}

export async function incrementUsage(
  userId: string,
  kind: UploadKind
): Promise<void> {
  if (kind === 'subtitle') {
    await db
      .update(users)
      .set({
        generateSubtitlesCount: sql`${users.generateSubtitlesCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, userId));
    return;
  }

  await db
    .update(users)
    .set({
      bulkGenerateCount: sql`${users.bulkGenerateCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.userId, userId));
}

/** Server-side usage payload for the experience page / API. */
export async function getUserUsageDisplay(
  userId: string
): Promise<UserUsageStats | null> {
  const row = await ensureUserSynced(userId);
  if (!row) return null;

  const level = row.accessLevel as AccessLevel;
  const periodStart = new Date(row.currentPeriodStart);
  const resetsAt = new Date(periodStart.getTime() + USAGE_PERIOD_MS);

  return {
    accessLevel: level,
    generateSubtitles: {
      used: row.generateSubtitlesCount,
      limit: subtitlesLimitForAccess(level),
    },
    bulkGenerate: {
      used: row.bulkGenerateCount,
      limit: bulkLimitForAccess(level),
    },
    periodStart: periodStart.toISOString(),
    periodResetsAt: resetsAt.toISOString(),
  };
}
