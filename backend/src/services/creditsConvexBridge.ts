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
  freeCreditsTotal: number
): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.insertProfileRow, {
    ...trusted(),
    userId,
    accountType,
    freeCreditsRemaining,
    freeCreditsTotal,
  });
}

export async function cxGetUserRow(userId: string): Promise<{ account_type?: string; email?: string; name?: string } | null> {
  return convexQueryTrusted<any>(anyApi.backendTrusted.getUserRowById, {
    ...trusted(),
    userId,
  });
}
