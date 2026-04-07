import { env } from '../config/env';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';

const secretArg = () => ({ secret: env.BACKEND_SHARED_SECRET });

export async function cxInsertTryon(args: {
  legacyId: string;
  userId: string;
  personImage: string;
  productImage: string;
  category: string;
  status: string;
}): Promise<{ legacyId: string }> {
  return convexMutationTrusted(anyApi.backendTrusted.insertTryon, { ...secretArg(), ...args }) as Promise<{
    legacyId: string;
  }>;
}

export async function cxPatchTryon(
  legacyId: string,
  patch: { status?: string; result_image?: string; completed_at?: string | null }
): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.patchTryonByLegacyId, {
    ...secretArg(),
    legacyId,
    patch,
  });
}

export async function cxGetTryonForUser(legacyId: string, userId: string) {
  return convexQueryTrusted<{
    id: string;
    status: string;
    result_image: string | null;
    created_at: string | null;
    completed_at: string | null;
    category: string;
    user_id: string | undefined | null;
  } | null>(anyApi.backendTrusted.getTryonByLegacyIdForUser, { ...secretArg(), legacyId, userId });
}

export async function cxDeleteTryonForUser(legacyId: string, userId: string): Promise<boolean> {
  const r = await convexMutationTrusted(anyApi.backendTrusted.deleteTryonByLegacyIdForUser, {
    ...secretArg(),
    legacyId,
    userId,
  });
  return Boolean(r && typeof r === 'object' && 'deleted' in r && (r as { deleted: boolean }).deleted);
}

export async function cxListTryons(
  userId: string,
  limit: number,
  offset: number,
  category?: string
): Promise<{
  tryons: Array<{
    id: string;
    status: string;
    category: string;
    result_image: string | null;
    created_at: string | null;
    completed_at: string | null;
  }>;
  total: number;
}> {
  return convexQueryTrusted(anyApi.backendTrusted.listTryonsForUser, {
    ...secretArg(),
    userId,
    limit,
    offset,
    category,
  });
}

export async function cxInsertUsageEvent(
  userId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.insertUsageEvent, {
    ...secretArg(),
    userId,
    eventType,
    metadata,
  });
}
