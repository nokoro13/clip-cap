import type { BillingReasons } from '@whop/sdk/resources/payments.js';
import type { Membership, Payment } from '@whop/sdk/resources.js';
import { USAGE_PERIOD_MS } from '@/lib/access-limits';
import { whopsdk } from '@/lib/whop-sdk';
import {
  accessLevelForTrackedProduct,
  isTrackedWhopProductId,
  renewalEpochToDate,
  resetUsageForNewPeriod,
  resolveAccessFromWhop,
  syncUserRowFromWhopAccess,
} from '@/lib/user-service';

const RESET_PAYMENT_REASONS = new Set<BillingReasons>([
  'subscription_cycle',
  'subscription_create',
  'subscription_update',
]);

function membershipUserId(m: Membership): string | null {
  return m.user?.id ?? null;
}

async function resolveMembershipUserId(membership: Membership): Promise<string | null> {
  let userId = membershipUserId(membership);
  if (userId) return userId;
  try {
    const full = await whopsdk.memberships.retrieve(membership.id);
    return full.user?.id ?? null;
  } catch (err) {
    console.warn('[whop webhook] memberships.retrieve failed (user id)', membership.id, err);
    return null;
  }
}

async function resolveBillingWindow(
  membership: Membership,
  options?: { fallbackStart?: Date },
): Promise<{ periodStart: Date; periodEnd: Date }> {
  let periodStart = renewalEpochToDate(membership.renewal_period_start);
  let periodEnd = renewalEpochToDate(membership.renewal_period_end);

  if (periodStart == null || periodEnd == null) {
    try {
      const full = await whopsdk.memberships.retrieve(membership.id);
      periodStart = renewalEpochToDate(full.renewal_period_start) ?? periodStart;
      periodEnd = renewalEpochToDate(full.renewal_period_end) ?? periodEnd;
    } catch (err) {
      console.warn('[whop webhook] memberships.retrieve failed (billing window)', membership.id, err);
    }
  }

  const start = periodStart ?? options?.fallbackStart ?? new Date();
  const end = periodEnd ?? new Date(start.getTime() + USAGE_PERIOD_MS);
  return { periodStart: start, periodEnd: end };
}

/**
 * [membership.activated](https://docs.whop.com/api-reference/memberships/membership-activated) —
 * reset usage for the current Whop billing window when the event is for your Basic/Premium product.
 */
export async function handleMembershipActivated(membership: Membership): Promise<void> {
  const productId = membership.product?.id;
  if (!isTrackedWhopProductId(productId)) {
    console.warn('[whop webhook] membership.activated skipped: untracked product', productId ?? '(missing)');
    return;
  }

  const userId = await resolveMembershipUserId(membership);
  if (!userId) {
    console.warn('[whop webhook] membership.activated skipped: no user id');
    return;
  }

  const eventLevel = accessLevelForTrackedProduct(productId);
  if (!eventLevel) return;

  const effective = (await resolveAccessFromWhop(userId)) ?? eventLevel;

  if (eventLevel !== effective) {
    await syncUserRowFromWhopAccess(userId);
    return;
  }

  const { periodStart, periodEnd } = await resolveBillingWindow(membership);

  await resetUsageForNewPeriod(userId, effective, periodStart, periodEnd);
}

/** membership.deactivated — drop or downgrade row when access ends. */
export async function handleMembershipDeactivated(membership: Membership): Promise<void> {
  const productId = membership.product?.id;
  if (!isTrackedWhopProductId(productId)) {
    return;
  }

  const userId = await resolveMembershipUserId(membership);
  if (!userId) {
    console.warn('[whop webhook] membership.deactivated skipped: no user id');
    return;
  }

  await syncUserRowFromWhopAccess(userId);
}

/** payment.succeeded — align period on recurring charges (membership.activated does not fire each cycle). */
export async function handlePaymentSucceededForUsage(payment: Payment): Promise<void> {
  const reason = payment.billing_reason;
  if (!reason || !RESET_PAYMENT_REASONS.has(reason)) return;

  const productId = payment.product?.id;
  if (!isTrackedWhopProductId(productId)) return;

  const userId = payment.user?.id;
  const membershipId = payment.membership?.id;
  if (!userId || !membershipId) return;

  const eventLevel = accessLevelForTrackedProduct(productId);
  if (!eventLevel) return;

  const effective = (await resolveAccessFromWhop(userId)) ?? eventLevel;
  if (eventLevel !== effective) return;

  const full = await whopsdk.memberships.retrieve(membershipId);
  const paidAt = payment.paid_at ? new Date(payment.paid_at) : undefined;
  const { periodStart, periodEnd } = await resolveBillingWindow(full, { fallbackStart: paidAt });

  await resetUsageForNewPeriod(userId, effective, periodStart, periodEnd);
}
