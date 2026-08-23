import { env } from '../../config/env';
import { uploadImageBuffer } from '../storage/images';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';
import { cxGetProfile } from '../creditsConvexBridge';
import { isFreeTierPlanId } from '../../lib/planTier';
import { anyApi, convexQueryPublic, convexQueryTrusted } from '../../config/convexHttp';

const SSRF_BLOCKED_HOSTS =
  /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|\[::\]|0\.0\.0\.0)/i;

function isLocalhostOrigin(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(u) || u === '';
}

/**
 * Path-only `image_url` values (e.g. `/model-library/diane.png`) need a public site origin.
 * On Railway many teams set PUBLIC_APP_URL to production while FRONTEND_URL is still localhost
 * — without this, every model row fails resolution or resolves to unreachable URLs.
 */
export function resolveModelImageUrl(stored: string): string {
  const trimmed = stored.trim();
  if (trimmed.startsWith('/')) {
    const fe = env.FRONTEND_URL.replace(/\/$/, '');
    const pub =
      typeof env.PUBLIC_APP_URL === 'string' ? env.PUBLIC_APP_URL.replace(/\/$/, '') : '';
    let base = fe;
    if (pub && !isLocalhostOrigin(pub)) {
      if (isLocalhostOrigin(fe) || env.NODE_ENV === 'production') {
        base = pub;
      }
    }
    if (!base || isLocalhostOrigin(base)) {
      if (pub && !isLocalhostOrigin(pub)) {
        base = pub;
      }
    }
    if (!base) {
      throw new Error(
        'FRONTEND_URL or PUBLIC_APP_URL must be set when model library uses path-only image_url values'
      );
    }
    return `${base}${trimmed}`;
  }
  return trimmed;
}

export interface PublicModelRow {
  id: string;
  slug: string;
  display_name: string;
  gender: 'female' | 'male';
  body_type: string | null;
  appearance_tag: string | null;
  image_url: string;
  sort_order: number;
  free_tier_eligible: boolean;
}

export function freeTierEligibleFromRow(row: {
  slug: string;
  free_tier_eligible?: boolean | null;
}): boolean {
  if (typeof row.free_tier_eligible === 'boolean') return row.free_tier_eligible;
  const s = String(row.slug).trim().toLowerCase();
  return s === 'diane' || s === 'andrew';
}

function hostnameAllowedForModelImageFetch(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const tryAllowedOrigin = (raw: string): boolean => {
    const u = raw.trim();
    if (!u) return false;
    try {
      const parsed = new URL(u.includes('://') ? u : `https://${u}`);
      const ho = parsed.hostname.toLowerCase();
      if (h === ho || h.endsWith(`.${ho}`)) return true;
    } catch {
      /* ignore */
    }
    return false;
  };

  if (tryAllowedOrigin(env.FRONTEND_URL)) return true;
  if (tryAllowedOrigin(env.PUBLIC_APP_URL)) return true;

  if (env.CLOUDFLARE_CDN_DOMAIN) {
    const raw = env.CLOUDFLARE_CDN_DOMAIN.trim();
    try {
      const cdnUrl = raw.includes('://') ? raw : `https://${raw}`;
      const cdnHost = new URL(cdnUrl).hostname.toLowerCase();
      if (h === cdnHost || h.endsWith(`.${cdnHost}`)) return true;
    } catch {
      /* ignore */
    }
  }

  if (SSRF_BLOCKED_HOSTS.test(h)) return false;
  return true;
}

function assertSafeImageUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid model image URL');
  }

  if (parsed.protocol === 'http:') {
    const h = parsed.hostname;
    if (h !== 'localhost' && h !== '127.0.0.1') {
      throw new Error('Model image URL must use HTTPS');
    }
  } else if (parsed.protocol !== 'https:') {
    throw new Error('Model image URL must use HTTP(S)');
  }

  if (!hostnameAllowedForModelImageFetch(parsed.hostname)) {
    throw new Error('Model image host is not in the allowlist (SSRF protection)');
  }
}

export async function listActiveModels(): Promise<PublicModelRow[]> {
  const data = await convexQueryPublic<PublicModelRow[]>(anyApi.modelLibrary.listActiveModels, {});
  return (data || []).flatMap((row) => {
    try {
      return [
        {
          ...row,
          free_tier_eligible: freeTierEligibleFromRow(row),
          image_url: resolveModelImageUrl(row.image_url),
        } as PublicModelRow,
      ];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('listActiveModels: skipped row (invalid image_url)', { slug: row.slug, message: msg });
      return [];
    }
  });
}

export async function listAllModelsForAdmin(): Promise<
  (PublicModelRow & { is_active: boolean; created_at: string })[]
> {
  const rows = await convexQueryTrusted<
    Array<{
      id: string;
      slug: string;
      display_name: string;
      gender: string;
      body_type: string | null;
      appearance_tag: string | null;
      image_url: string;
      sort_order: number;
      is_active: boolean;
      created_at: string;
      free_tier_eligible: boolean;
    }>
  >(anyApi.backendTrusted.listAllModelLibraryRows, { secret: env.BACKEND_SHARED_SECRET });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    display_name: row.display_name,
    gender: row.gender as 'female' | 'male',
    body_type: row.body_type,
    appearance_tag: row.appearance_tag,
    image_url: resolveModelImageUrl(row.image_url),
    sort_order: row.sort_order,
    is_active: row.is_active,
    created_at: row.created_at,
    free_tier_eligible: freeTierEligibleFromRow(row),
  }));
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveModelToPersonPath(
  modelIdOrSlug: string,
  storageUserId: string,
  profileCreditUserId: string
): Promise<string> {
  const raw = modelIdOrSlug.trim();
  const row = await convexQueryTrusted<{
    id: string;
    slug: string;
    image_url: string;
    is_active: boolean;
    free_tier_eligible: boolean;
  } | null>(anyApi.backendTrusted.getModelForResolvePath, {
    secret: env.BACKEND_SHARED_SECRET,
    idOrSlug: raw,
  });

  if (!row) {
    throw new Error('Model not found or inactive');
  }

  const profile = await cxGetProfile(profileCreditUserId);
  const planId = profile?.plan_id ?? 'free';
  const eligible = freeTierEligibleFromRow(row);
  if (isFreeTierPlanId(planId) && !eligible) {
    throw new AppError(
      'This preset is available on paid plans. Upgrade to unlock the full model library.',
      403,
      'MODEL_NOT_ALLOWED_FOR_PLAN'
    );
  }

  const absoluteUrl = resolveModelImageUrl(row.image_url);
  const { buffer, mime } = await fetchBinaryFromAllowlistedModelImageUrl(absoluteUrl);
  return uploadImageBuffer(buffer, mime, 'person', storageUserId);
}

async function fetchBinaryFromAllowlistedModelImageUrl(
  imageUrl: string
): Promise<{ buffer: Buffer; mime: string }> {
  assertSafeImageUrl(imageUrl);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch model image');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mime = contentType.split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Model image must be JPEG, PNG, or WebP');
  }
  return { buffer, mime };
}
