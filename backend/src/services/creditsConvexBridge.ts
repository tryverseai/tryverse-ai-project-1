import { env } from '../config/env';
import { anyApi, convexQueryTrusted, convexMutationTrusted } from '../config/convexHttp';

const trusted = () => ({ secret: env.BACKEND_SHARED_SECRET });

/** Profile row as returned from Convex `getProfileRow` (snake_case numeric fields). */
export interface ConvexProfileRow {
  id?: string;
  plan_id?: string;
  account_type?: string | null;
  brand_name?: string | null;
  contact_email?: string | null;
  full_name?: string | null;
  free_credits_remaining?: number;
  free_credits_total?: number;
  monthly_credits_remaining?: number;
  monthly_credits_total?: number;
  is_blocked?: boolean;
  updated_at?: string | null;
  created_at?: string | null;
  beta_approved?: boolean;
  beta_requested_at?: string | null;
  beta_approved_at?: string | null;
  beta_rejected?: boolean;
  beta_rejected_at?: string | null;
  verification_email_sent_at?: string | null;
  welcome_email_sent_at?: string | null;
  terms_of_service_accepted_at?: string | null;
  [key: string]: unknown;
}

export async function cxGetProfile(userId: string): Promise<ConvexProfileRow | null> {
  return convexQueryTrusted<ConvexProfileRow | null>(anyApi.backendTrusted.getProfileRow, {
    ...trusted(),
    userId,
  });
}

export async function cxGetPlan(planId: string): Promise<Record<string, unknown> | null> {
  return convexQueryTrusted<Record<string, unknown> | null>(anyApi.backendTrusted.getPlanRow, {
    ...trusted(),
    planId,
  });
}

export async function cxPatchProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.patchProfileRow, {
    ...trusted(),
    userId,
    patch,
  });
}

export async function cxInsertProfile(
  userId: string,
  accountType: 'individual' | 'business',
  freeCreditsRemaining: number,
  freeCreditsTotal: number,
  opts?: { contactEmail?: string }
): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.insertProfileRow, {
    ...trusted(),
    userId: userId.trim(),
    accountType,
    freeCreditsRemaining,
    freeCreditsTotal,
    ...(opts?.contactEmail?.trim()
      ? { contactEmail: opts.contactEmail.trim() }
      : {}),
  });
}

export async function cxCountTrustedDevices(userProfileId: string): Promise<number> {
  return convexQueryTrusted<number>(anyApi.backendTrusted.countTrustedDevicesForProfile, {
    ...trusted(),
    userProfileId,
  });
}

export async function cxIsFingerprintTrusted(userProfileId: string, fingerprint: string): Promise<boolean> {
  return convexQueryTrusted<boolean>(anyApi.backendTrusted.isDeviceFingerprintTrusted, {
    ...trusted(),
    userProfileId,
    fingerprint,
  });
}

export async function cxRegisterTrustedDevice(userProfileId: string, fingerprint: string): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.registerTrustedDevice, {
    ...trusted(),
    userProfileId,
    fingerprint,
  });
}

export async function cxReplaceDeviceApprovalChallenge(params: {
  userProfileId: string;
  fingerprint: string;
  codeHash: string;
  expiresAtMs: number;
}): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.replaceDeviceApprovalChallenge, {
    ...trusted(),
    ...params,
  });
}

export async function cxVerifyDeviceApprovalChallenge(params: {
  userProfileId: string;
  fingerprint: string;
  codeHash: string;
}): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.verifyDeviceApprovalChallenge, {
    ...trusted(),
    ...params,
  });
}

export async function cxGetUserRow(userId: string): Promise<{ account_type?: string; email?: string; name?: string } | null> {
  // getUserRowById uses db.get() which requires a Convex document _id, but userId is
  // the auth subject string — use getProfileRow (indexed by subject) instead.
  const profile = await cxGetProfile(userId);
  if (!profile) return null;
  return {
    account_type: profile.account_type ?? undefined,
    email: profile.contact_email ?? undefined,
    name: profile.full_name ?? undefined,
  };
}

/**
 * Atomically checks and reserves one try-on credit for `userId`.
 * Convex mutations are serialized, so concurrent requests cannot both succeed
 * when only one credit remains — this eliminates the read-then-check race.
 *
 * On success the credit is already decremented; do NOT call decrementCredits afterward.
 * On failure call restoreCredits is NOT needed (no write occurred).
 */
export async function cxReserveCredit(userId: string, amount = 1): Promise<{
  ok: boolean;
  creditType?: 'monthly' | 'free';
  reason?: string;
}> {
  const result = await convexMutationTrusted(anyApi.backendTrusted.reserveCredit, {
    ...trusted(),
    userId,
    amount,
  });
  return result as { ok: boolean; creditType?: 'monthly' | 'free'; reason?: string };
}

/**
 * Atomically restores `amount` credits (undoes a reservation after a failed generation).
 * Pass the `creditType` returned by the original `cxReserveCredit`/`checkCredits` call whenever
 * it's available — without it, restoreCredit falls back to guessing which pool to restore into,
 * which can misattribute a free-pool reservation as a monthly-pool restore (see restoreCredit's
 * own doc comment in backendTrusted.ts).
 */
export async function cxRestoreCredit(
  userId: string,
  amount = 1,
  creditType?: 'monthly' | 'free',
  refundKey?: string
): Promise<{ ok: boolean; deduped?: boolean }> {
  const result = await convexMutationTrusted(anyApi.backendTrusted.restoreCredit, {
    ...trusted(),
    userId,
    amount,
    creditType,
    refundKey,
  });
  return result as { ok: boolean; deduped?: boolean };
}
