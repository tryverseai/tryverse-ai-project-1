import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue;
}

function optionalBool(key: string, defaultValue = false): boolean {
  const val = process.env[key];
  if (!val) return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '3001'), 10),

  // ── Supabase ──────────────────────────────────────────────────────────────
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

  // ── Replicate AI — model IDs per category ─────────────────────────────────
  REPLICATE_API_TOKEN: requireEnv('REPLICATE_API_TOKEN'),

  // Clothing → IDM-VTON (best garment try-on quality)
  REPLICATE_MODEL_CLOTHING: optionalEnv(
    'REPLICATE_MODEL_CLOTHING',
    'cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4'
  ),
  // Bags + Glasses → FASHN (accessories / overlays)
  REPLICATE_MODEL_ACCESSORIES: optionalEnv(
    'REPLICATE_MODEL_ACCESSORIES',
    'fashn/tryon:54bb2780ade1e2584e29a1b634a59571e59ddc65958fcfad8514a30c7d5d4ea5'
  ),

  // Preprocessing — background removal (rembg)
  REPLICATE_MODEL_REMBG: optionalEnv(
    'REPLICATE_MODEL_REMBG',
    'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285d65c14638e98ef4f5d22dcfa'
  ),

  // Face preservation — GFPGAN face restoration
  REPLICATE_MODEL_GFPGAN: optionalEnv(
    'REPLICATE_MODEL_GFPGAN',
    'tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355f67302c51d70fbc95d863a95a4c85'
  ),

  // ── Pipeline feature flags ────────────────────────────────────────────────
  ENABLE_BACKGROUND_REMOVAL: optionalBool('ENABLE_BACKGROUND_REMOVAL', false),
  ENABLE_BACKGROUND_NORMALIZATION: optionalBool('ENABLE_BACKGROUND_NORMALIZATION', false),
  ENABLE_FACE_PRESERVATION: optionalBool('ENABLE_FACE_PRESERVATION', false),
  ENABLE_POST_PROCESSING: optionalBool('ENABLE_POST_PROCESSING', true),
  ENABLE_IMAGE_MODERATION: optionalBool('ENABLE_IMAGE_MODERATION', false),

  // ── Payments ─────────────────────────────────────────────────────────────
  PAYSTACK_SECRET_KEY: requireEnv('PAYSTACK_SECRET_KEY'),
  PAYSTACK_WEBHOOK_SECRET: requireEnv('PAYSTACK_WEBHOOK_SECRET'),
  FLUTTERWAVE_SECRET_KEY: requireEnv('FLUTTERWAVE_SECRET_KEY'),
  FLUTTERWAVE_WEBHOOK_SECRET: requireEnv('FLUTTERWAVE_WEBHOOK_SECRET'),

  // ── Image Moderation (Hive) ───────────────────────────────────────────────
  HIVE_API_KEY: optionalEnv('HIVE_API_KEY', ''),

  // ── CDN (Cloudflare) ──────────────────────────────────────────────────────
  CLOUDFLARE_CDN_DOMAIN: optionalEnv('CLOUDFLARE_CDN_DOMAIN', ''),
  CLOUDFLARE_ZONE_ID: optionalEnv('CLOUDFLARE_ZONE_ID', ''),
  CLOUDFLARE_API_TOKEN: optionalEnv('CLOUDFLARE_API_TOKEN', ''),
  CLOUDFLARE_IMAGE_RESIZING_ENABLED: optionalBool('CLOUDFLARE_IMAGE_RESIZING_ENABLED', false),

  // ── Monitoring (Sentry) ───────────────────────────────────────────────────
  SENTRY_DSN: optionalEnv('SENTRY_DSN', ''),

  // ── Frontend ─────────────────────────────────────────────────────────────
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:8080'),

  // ── Storage ───────────────────────────────────────────────────────────────
  STORAGE_BUCKET_INPUTS: optionalEnv('STORAGE_BUCKET_INPUTS', 'tryon-inputs'),
  STORAGE_BUCKET_RESULTS: optionalEnv('STORAGE_BUCKET_RESULTS', 'tryon-results'),
  IMAGE_EXPIRY_SECONDS: parseInt(optionalEnv('IMAGE_EXPIRY_SECONDS', '3600'), 10),

  // ── Security ──────────────────────────────────────────────────────────────
  ADMIN_SECRET_KEY: requireEnv('ADMIN_SECRET_KEY'),
  WIDGET_ALLOWED_ORIGINS: optionalEnv('WIDGET_ALLOWED_ORIGINS', '*'),

  // ── Job queue ─────────────────────────────────────────────────────────────
  JOB_CONCURRENCY: parseInt(optionalEnv('JOB_CONCURRENCY', '3'), 10),
  JOB_TIMEOUT_MS: parseInt(optionalEnv('JOB_TIMEOUT_MS', '180000'), 10),
  JOB_MAX_RETRIES: parseInt(optionalEnv('JOB_MAX_RETRIES', '3'), 10),
};
