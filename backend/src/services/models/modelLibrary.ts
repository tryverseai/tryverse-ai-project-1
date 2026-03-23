import { supabaseAdmin } from '../../config/supabase';
import { uploadImageBuffer } from '../storage/images';
import { logger } from '../../config/logger';

const SSRF_BLOCKED_HOSTS =
  /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|\[::\]|0\.0\.0\.0)/i;

/**
 * DB may store absolute HTTPS URLs (e.g. Unsplash) or app-relative paths like `/model-library/zoe.png`.
 * Relative paths are joined to FRONTEND_URL so the backend can fetch them and embeds get a full URL.
 */
export function resolveModelImageUrl(stored: string): string {
  const trimmed = stored.trim();
  if (trimmed.startsWith('/')) {
    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
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
}

function assertSafeImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid model image URL');
  }

  const frontend = process.env.FRONTEND_URL;
  if (frontend) {
    try {
      const allowedOrigin = new URL(frontend).origin;
      if (parsed.origin === allowedOrigin) {
        return;
      }
    } catch {
      /* ignore invalid FRONTEND_URL */
    }
  }

  if (!url.startsWith('https://')) {
    throw new Error('Model image URL must use HTTPS (or match FRONTEND_URL for self-hosted assets)');
  }
  const host = parsed.hostname;
  if (SSRF_BLOCKED_HOSTS.test(host)) {
    throw new Error('Model image host not allowed');
  }
}

export async function listActiveModels(): Promise<PublicModelRow[]> {
  const { data, error } = await supabaseAdmin
    .from('tryverse_model_library')
    .select('id, slug, display_name, gender, body_type, appearance_tag, image_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    logger.error('listActiveModels failed', { message: error.message });
    throw new Error('Could not load model library');
  }
  return (data || []).map((row) => ({
    ...row,
    image_url: resolveModelImageUrl(row.image_url),
  })) as PublicModelRow[];
}

export async function listAllModelsForAdmin(): Promise<
  (PublicModelRow & { is_active: boolean; created_at: string })[]
> {
  const { data, error } = await supabaseAdmin
    .from('tryverse_model_library')
    .select('id, slug, display_name, gender, body_type, appearance_tag, image_url, sort_order, is_active, created_at')
    .order('sort_order', { ascending: true });

  if (error) {
    logger.error('listAllModelsForAdmin failed', { message: error.message });
    throw new Error('Could not load model library');
  }
  return (data || []).map((row) => ({
    ...row,
    image_url: resolveModelImageUrl(row.image_url),
  })) as (PublicModelRow & { is_active: boolean; created_at: string })[];
}

/**
 * Fetch model image and store as person image for the given user (JWT or widget API key owner).
 */
export async function resolveModelToPersonPath(modelId: string, userId: string): Promise<string> {
  const { data: row, error } = await supabaseAdmin
    .from('tryverse_model_library')
    .select('id, image_url, is_active')
    .eq('id', modelId)
    .maybeSingle();

  if (error || !row || !row.is_active) {
    throw new Error('Model not found or inactive');
  }

  const absoluteUrl = resolveModelImageUrl(row.image_url);
  assertSafeImageUrl(absoluteUrl);

  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch model image');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mime = contentType.split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Model image must be JPEG, PNG, or WebP');
  }

  return uploadImageBuffer(buffer, mime, 'person', userId);
}
