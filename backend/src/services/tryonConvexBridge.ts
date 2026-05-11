import { authSubjectSegments, canonicalConvexProfileUserId } from '../lib/convexProfileId';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';
import type { ProductCategory, TryOnStatus, UsageEventType } from '../types';

const secretArg = () => ({ secret: env.BACKEND_SHARED_SECRET });

// ─── Shared row shape returned by list queries ────────────────────────────────

export interface TryOnRow {
  id: string;
  status: TryOnStatus;
  category: ProductCategory;
  result_image: string | null;
  created_at: string | null;
  completed_at: string | null;
}

// ─── Single-record shape (includes ownership field) ──────────────────────────

export interface TryOnRecord extends TryOnRow {
  user_id: string | null;
  /**
   * Populated when `status === 'failed'` — the pipeline writes a sanitized
   * public error message to this field via `cxPatchTryon`.
   *
   * NOTE: The current `getTryonByLegacyIdForUser` Convex query does NOT yet
   * return this field; callers will see `undefined` until the query is updated.
   * The route falls back to `'Processing failed'` in the meantime.
   */
  error_message?: string | null;
}

// ─── Bridge functions ─────────────────────────────────────────────────────────

/** Move legacy non-canonical try-on rows to profiles’ canonical Convex user doc id after login. */
export async function cxConsolidateTryonsToCanonicalUserId(rawSubject: string): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.consolidateTryonsToCanonicalUserId, {
    ...secretArg(),
    aliases: authSubjectSegments(rawSubject),
    canonicalUserId: canonicalConvexProfileUserId(rawSubject),
  });
}

export async function cxInsertTryon(args: {
  legacyId: string;
  userId: string;
  personImage: string;
  productImage: string;
  category: ProductCategory;
  status: TryOnStatus;
}): Promise<{ legacyId: string }> {
  return convexMutationTrusted(anyApi.backendTrusted.insertTryon, {
    ...secretArg(),
    ...args,
  }) as Promise<{ legacyId: string }>;
}

export async function cxPatchTryon(
  legacyId: string,
  patch: { status?: TryOnStatus; result_image?: string; completed_at?: string | null }
): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.patchTryonByLegacyId, {
    ...secretArg(),
    legacyId,
    patch,
  });
}

export async function cxGetTryonForUser(
  legacyId: string,
  userId: string
): Promise<TryOnRecord | null> {
  return convexQueryTrusted<TryOnRecord | null>(
    anyApi.backendTrusted.getTryonByLegacyIdForUser,
    { ...secretArg(), legacyId, userId }
  );
}

export async function cxDeleteTryonForUser(legacyId: string, userId: string): Promise<boolean> {
  const r = await convexMutationTrusted(anyApi.backendTrusted.deleteTryonByLegacyIdForUser, {
    ...secretArg(),
    legacyId,
    userId,
  });
  // Convex returns { deleted: boolean } — guard before accessing
  if (r !== null && typeof r === 'object' && 'deleted' in r) {
    return Boolean((r as { deleted: boolean }).deleted);
  }
  return false;
}

export async function cxListTryons(
  userId: string,
  limit: number,
  offset: number,
  category?: ProductCategory
): Promise<{ tryons: TryOnRow[]; total: number }> {
  return convexQueryTrusted(anyApi.backendTrusted.listTryonsForUser, {
    ...secretArg(),
    userId,
    limit,
    offset,
    category,
  });
}

/**
 * Cursor-based try-on listing. Reads exactly `numItems` rows; pass the returned
 * `nextCursor` into the next call to get the following page.
 */
export async function cxListTryonsCursor(
  userId: string,
  numItems: number,
  cursor: string | null
): Promise<{ tryons: TryOnRow[]; nextCursor: string | null; isDone: boolean }> {
  return convexQueryTrusted(anyApi.backendTrusted.listTryonsForUserCursor, {
    ...secretArg(),
    userId,
    numItems,
    cursor,
  });
}

export async function cxInsertUsageEvent(
  userId: string,
  eventType: UsageEventType,
  metadata?: Record<string, string | number | boolean | null>
): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.insertUsageEvent, {
    ...secretArg(),
    userId,
    eventType,
    metadata,
  });
}
