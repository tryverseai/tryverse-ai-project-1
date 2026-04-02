import { supabaseAdmin } from '../../config/supabase';
import { env } from '../../config/env';
import { uploadImageBuffer } from '../storage/images';
import { logger } from '../../config/logger';
import { isFreeTierPlanId } from '../../lib/planTier';
import { AppError } from '../../middleware/errorHandler';

const SSRF_BLOCKED_HOSTS =
  /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|\[::\]|0\.0\.0\.0)/i;

/**
 * DB may store absolute HTTPS URLs (e.g. Unsplash) or app-relative paths like `/model-library/zoe.png`.
 * Relative paths are joined to FRONTEND_URL so the backend can fetch them and embeds get a full URL.
 */
export function resolveModelImageUrl(stored: string): string {
  const trimmed = stored.trim();
  if (trimmed.startsWith('/')) {
    // Use centralized env (includes default for local dev) — not raw process.env, which may be unset.
    const base = env.FRONTEND_URL.replace(/\/$/, '');
    if (!base) {
      throw new Error('FRONTEND_URL must be set when model library uses path-only image_url values');
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
  /** When true, users on the free plan may select this preset; paid plans may use any active model. */
  free_tier_eligible: boolean;
}

const SELECT_ACTIVE_BASE =
  'id, slug, display_name, gender, body_type, appearance_tag, image_url, sort_order';
const SELECT_ACTIVE_WITH_FREE = `${SELECT_ACTIVE_BASE}, free_tier_eligible`;
const SELECT_ADMIN_BASE = `${SELECT_ACTIVE_BASE}, is_active, created_at`;
const SELECT_ADMIN_WITH_FREE = `${SELECT_ADMIN_BASE}, free_tier_eligible`;

/** When DB column `free_tier_eligible` is absent, fall back to default free presets. */
export function freeTierEligibleFromRow(row: {
  slug: string;
  free_tier_eligible?: boolean | null;
}): boolean {
  if (typeof row.free_tier_eligible === 'boolean') return row.free_tier_eligible;
  const s = String(row.slug).trim().toLowerCase();
  return s === 'diane' || s === 'andrew';
}

function shouldRetryModelQueryWithoutFreeTier(err: { message?: string; details?: string; hint?: string }): boolean {
  const blob = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase();
  return (
    blob.includes('free_tier_eligible') ||
    (blob.includes('column') && (blob.includes('does not exist') || blob.includes('not find'))) ||
    blob.includes('schema cache') ||
    blob.includes('could not find') ||
    blob.includes('unknown field')
  );
}

function hostnameAllowedForModelImageFetch(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // Same-origin model assets (e.g. /model-library/* resolved against FRONTEND_URL) —
  // must run before SSRF private-host block so localhost works in dev.
  try {
    const fe = new URL(env.FRONTEND_URL);
    const feHost = fe.hostname.toLowerCase();
    if (h === feHost || h.endsWith(`.${feHost}`)) return true;
  } catch {
    /* ignore */
  }

  try {
    const su = new URL(env.SUPABASE_URL);
    const suHost = su.hostname.toLowerCase();
    if (h === suHost || h.endsWith(`.${suHost}`)) return true;
  } catch {
    /* ignore */
  }

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

  const trustedImageHosts = new Set([
    'images.unsplash.com',
    'images.pexels.com',
    'cdn.pixabay.com',
    'res.cloudinary.com',
    'replicate.delivery',
  ]);
  if (trustedImageHosts.has(h)) return true;

  return false;
}

function assertSafeImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
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
  const first = await supabaseAdmin
    .from('tryverse_model_library')
    .select(SELECT_ACTIVE_WITH_FREE)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  let data: unknown[] | null = first.data as unknown[] | null;
  let error = first.error;

  if (error && shouldRetryModelQueryWithoutFreeTier(error)) {
    logger.warn('listActiveModels: retrying without free_tier_eligible', { message: error.message });
    const r2 = await supabaseAdmin
      .from('tryverse_model_library')
      .select(SELECT_ACTIVE_BASE)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    data = r2.data as unknown[] | null;
    error = r2.error;
  }

  if (error) {
    logger.error('listActiveModels failed', { message: error.message });
    throw new Error('Could not load model library');
  }
  return (data || []).flatMap((rowRaw) => {
    const row = rowRaw as PublicModelRow & { free_tier_eligible?: boolean | null };
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
  const first = await supabaseAdmin
    .from('tryverse_model_library')
    .select(SELECT_ADMIN_WITH_FREE)
    .order('sort_order', { ascending: true });

  let data: unknown[] | null = first.data as unknown[] | null;
  let error = first.error;

  if (error && shouldRetryModelQueryWithoutFreeTier(error)) {
    logger.warn('listAllModelsForAdmin: retrying without free_tier_eligible', { message: error.message });
    const r2 = await supabaseAdmin.from('tryverse_model_library').select(SELECT_ADMIN_BASE).order('sort_order', {
      ascending: true,
    });
    data = r2.data as unknown[] | null;
    error = r2.error;
  }

  if (error) {
    logger.error('listAllModelsForAdmin failed', { message: error.message });
    throw new Error('Could not load model library');
  }
  return (data || []).map((rowRaw) => {
    const row = rowRaw as PublicModelRow & {
      is_active: boolean;
      created_at: string;
      free_tier_eligible?: boolean | null;
    };
    return {
      ...row,
      free_tier_eligible: freeTierEligibleFromRow(row),
      image_url: resolveModelImageUrl(row.image_url),
    } as PublicModelRow & { is_active: boolean; created_at: string };
  });
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fetch model image and store as person image for the given user (JWT or widget API key owner).
 * Accepts a row UUID or a unique model slug (same identifiers returned by GET /api/models).
 */
export async function resolveModelToPersonPath(modelIdOrSlug: string, userId: string): Promise<string> {
  const raw = modelIdOrSlug.trim();
  const base = supabaseAdmin.from('tryverse_model_library');
  let qb = base.select('id, slug, image_url, is_active, free_tier_eligible');
  qb = UUID_RE.test(raw) ? qb.eq('id', raw) : qb.eq('slug', raw);
  let { data: row, error } = await qb.maybeSingle();

  if (error && shouldRetryModelQueryWithoutFreeTier(error)) {
    logger.warn('resolveModelToPersonPath: retrying without free_tier_eligible', { message: error.message });
    let qb2 = base.select('id, slug, image_url, is_active');
    qb2 = UUID_RE.test(raw) ? qb2.eq('id', raw) : qb2.eq('slug', raw);
    const r2 = await qb2.maybeSingle();
    row = r2.data as typeof row;
    error = r2.error;
  }

  if (error || !row || !row.is_active) {
    throw new Error('Model not found or inactive');
  }

  const { data: profile } = await supabaseAdmin.from('profiles').select('plan_id').eq('id', userId).maybeSingle();
  const planId = profile?.plan_id ?? 'free';
  const freeTier = isFreeTierPlanId(planId);
  const eligible = freeTierEligibleFromRow(row as { slug: string; free_tier_eligible?: boolean | null });
  if (freeTier && !eligible) {
    throw new AppError(
      'This model is available on paid plans. Upgrade or use a free-tier model (e.g. Diane or Andrew).',
      403,
      'MODEL_PAID_ONLY'
    );
  }

  const absoluteUrl = resolveModelImageUrl(row.image_url);
  const { buffer, mime } = await fetchBinaryFromAllowlistedModelImageUrl(absoluteUrl);
  return uploadImageBuffer(buffer, mime, 'person', userId);
}

/**
 * HTTP GET for a model image URL that has already been allowlisted (SSRF-safe).
 * Separated from request handling so static analysis does not conflate body params with fetch().
 */
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
