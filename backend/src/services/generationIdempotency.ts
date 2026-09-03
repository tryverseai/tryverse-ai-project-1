import { env } from '../config/env';
import { anyApi, convexMutationTrusted } from '../config/convexHttp';

const secret = () => ({ secret: env.BACKEND_SHARED_SECRET });

export type ClaimIdempotencyKeyResult =
  | { claimed: true }
  | { claimed: false; route: string; refId: string | null };

/**
 * Call before reserving credits / creating a generation job. `key` is optional — omitting it
 * (an older client build, or a caller that intentionally doesn't want this protection) preserves
 * the exact prior behavior: always returns `{claimed: true}` without touching Convex at all.
 */
export async function claimIdempotencyKey(
  userId: string,
  key: string | undefined,
  route: string
): Promise<ClaimIdempotencyKeyResult> {
  if (!key) return { claimed: true };
  const result = await convexMutationTrusted(anyApi.generationIdempotency.claimIdempotencyKey, {
    ...secret(),
    userId,
    key,
    route,
  });
  return result as ClaimIdempotencyKeyResult;
}

/** Call once the generation record's id is known (right after it's created), regardless of
 * whether the job has finished — the point being guarded against is a second RESERVATION/CREATION
 * for the same client action, not the job's eventual outcome. No-op if `key` was never provided. */
export async function completeIdempotencyKey(
  userId: string,
  key: string | undefined,
  refId: string
): Promise<void> {
  if (!key) return;
  await convexMutationTrusted(anyApi.generationIdempotency.completeIdempotencyKey, {
    ...secret(),
    userId,
    key,
    refId,
  });
}
