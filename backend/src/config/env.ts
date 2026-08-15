import dotenv from 'dotenv';
import path from 'path';
import { normalizeAdminKeyInput } from '../lib/adminKey';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Like requireEnv but trims BOM/whitespace — avoids Convex `Unauthorized` when secrets differ only by newline. */
function requireEnvTrimmed(key: string): string {
  const value = sanitizeEnvLine(process.env[key], '');
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** ADMIN_SECRET_KEY may be quoted in `.env`; strip so it matches the login field. */
function requireAdminSecretFromEnv(): string {
  const base = sanitizeEnvLine(process.env['ADMIN_SECRET_KEY'], '');
  const v = normalizeAdminKeyInput(base);
  if (!v) {
    throw new Error('Missing required environment variable: ADMIN_SECRET_KEY');
  }
  return v;
}

function optionalEnv(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue;
}

/** Strip UTF-8 BOM and surrounding whitespace — common cause of "API key is invalid" from Resend. */
function sanitizeEnvLine(raw: string | undefined, defaultValue = ''): string {
  if (!raw) return defaultValue;
  return raw.replace(/^\uFEFF/, '').trim();
}

/**
 * ConvexHttpClient + JWT verification require a stable URL (trailing slash differences break auth).
 */
function normalizeConvexDeploymentUrl(raw: string): string {
  let u = sanitizeEnvLine(raw, '').replace(/\/+$/, '');
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

function optionalBool(key: string, defaultValue = false): boolean {
  const val = process.env[key];
  if (!val) return defaultValue;
  const v = val.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function optionalInt(key: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const v = parseInt(raw, 10);
  if (Number.isNaN(v)) return defaultValue;
  return Math.min(max, Math.max(min, v));
}

function optionalFloat(key: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return defaultValue;
  return Math.min(max, Math.max(min, v));
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '3001'), 10),

  // ── Convex (primary DB + auth validation) ─────────────────────────────────
  /** Must match `VITE_CONVEX_URL` in the web app (same deployment = same JWT issuer). */
  CONVEX_URL: normalizeConvexDeploymentUrl(requireEnvTrimmed('CONVEX_URL')),
  /** Shared secret for Node → Convex `backendTrusted.*` (set same value in Convex env). */
  BACKEND_SHARED_SECRET: requireEnvTrimmed('BACKEND_SHARED_SECRET'),

  /**
   * Accept `Authorization: Local <base64url(JSON)>` with `{ "sub": "<user id>", "email"?: "..." }`.
   * Intended for local-only / rebuilt auth without Convex JWT in the browser. **Insecure on the public
   * internet** unless you treat it like a dev-only bypass — keep `false` in production unless you know
   * the risk and set `ALLOW_LOCAL_SESSION_AUTH=true` explicitly.
   */
  ALLOW_LOCAL_SESSION_AUTH: optionalBool(
    'ALLOW_LOCAL_SESSION_AUTH',
    optionalEnv('NODE_ENV', 'development') !== 'production'
  ),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

  // ── OpenAI — GPT Image (AI Model Personalization) ─────────────────────────
  /** OpenAI API key for gpt-image-1 model replacement. When set, /api/personalize/* is active. */
  OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),

  // ── FASHN AI — direct API (https://api.fashn.ai) ─────────────────────────
  /** Direct FASHN AI API key (fa-…). When set, FASHN try-ons bypass Replicate entirely. */
  FASHN_API_KEY: optionalEnv('FASHN_API_KEY', ''),

  // ── Replicate AI — model IDs per category ─────────────────────────────────
  REPLICATE_API_TOKEN: requireEnv('REPLICATE_API_TOKEN'),
  /**
   * Minimum milliseconds between Replicate API calls (reduces 429 bursts).
   * Development default 2s; production default 10s. Raise if you see rate limits.
   */
  REPLICATE_MIN_GAP_MS: optionalInt(
    'REPLICATE_MIN_GAP_MS',
    optionalEnv('NODE_ENV', 'development') === 'production' ? 10_000 : 2_000,
    0,
    120_000
  ),

  // Clothing → pinned IDM-VTON (stable). OOT / other slugs: set REPLICATE_MODEL_CLOTHING in .env.
  REPLICATE_MODEL_CLOTHING: optionalEnv(
    'REPLICATE_MODEL_CLOTHING',
    'cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4'
  ),
  /**
   * Replicate-hosted FASHN try-on model, used as the clothing engine when `TRYON_CLOTHING_USE_FASHN`
   * is on and no direct `FASHN_API_KEY` is set (see `runFashnClothing` in `services/ai/replicate.ts`).
   * Name is legacy from when FASHN also served now-removed bag/glasses/accessory categories —
   * TryVerse is apparel-only today (clothing | tops | bottoms | dresses | one-pieces), so this is
   * purely the clothing fallback model id. Kept as `REPLICATE_MODEL_ACCESSORIES` for backward
   * compatibility with existing Railway/Convex env config; do not repurpose for a new category.
   */
  REPLICATE_MODEL_ACCESSORIES: optionalEnv(
    'REPLICATE_MODEL_ACCESSORIES',
    'fashn/tryon:54bb2780ade1e2584e29a1b634a59571e59ddc65958fcfad8514a30c7d5d4ea5'
  ),
  // Enterprise "Generate AI Model" — text-to-image model for consistent fashion-model generation.
  REPLICATE_MODEL_AI_MODEL_GENERATION: optionalEnv(
    'REPLICATE_MODEL_AI_MODEL_GENERATION',
    'black-forest-labs/flux-schnell'
  ),
  // Enterprise "AI Product Photoshoot" — garment + scene compositing model.
  REPLICATE_MODEL_PRODUCT_PHOTOSHOOT: optionalEnv(
    'REPLICATE_MODEL_PRODUCT_PHOTOSHOOT',
    'black-forest-labs/flux-kontext-pro'
  ),
  // Optional: flux-kontext for dynamic prompt-based try-on (set to enable)
  REPLICATE_MODEL_FLUX_KONTEXT: optionalEnv(
    'REPLICATE_MODEL_FLUX_KONTEXT',
    'flux-kontext-apps/multi-image-kontext-pro:6d14f9b3d25a9400c4a5e5f0f6842ae7537fefcf68df86dad9533f66204f2bb2'
  ),
  REPLICATE_USE_FLUX_KONTEXT: optionalBool('REPLICATE_USE_FLUX_KONTEXT', false),
  /** When true, full_body topology uses Flux Kontext (can return side-by-side collages — off by default). */
  TRYON_FULLBODY_USE_FLUX: optionalBool('TRYON_FULLBODY_USE_FLUX', false),
  /** If Flux fails for full_body, fall back to IDM-VTON once. */
  TRYON_FULLBODY_FLUX_FALLBACK_IDM: optionalBool('TRYON_FULLBODY_FLUX_FALLBACK_IDM', true),
  /**
   * Clothing via FASHN Try-On (Replicate model id in `REPLICATE_MODEL_ACCESSORIES`) — closer to fashn.ai app quality; preserves face/neck without IDM artifacts.
   * Set false to use IDM-VTON only (`REPLICATE_MODEL_CLOTHING`).
   */
  TRYON_CLOTHING_USE_FASHN: optionalBool('TRYON_CLOTHING_USE_FASHN', true),
  /** If FASHN clothing fails (Replicate error), run IDM-VTON once. */
  TRYON_FASHN_FALLBACK_IDM: optionalBool('TRYON_FASHN_FALLBACK_IDM', true),
  /** Let FASHN infer garment slot (`category=auto`) when the product caption is blank/generic (fixes gowns sent as `tops`). */
  TRYON_FASHN_CATEGORY_AUTO: optionalBool('TRYON_FASHN_CATEGORY_AUTO', true),
  /** FASHN output: mild encode + ground shadow (no aggressive sharpen). */
  TRYON_FASHN_LIGHT_POST: optionalBool('TRYON_FASHN_LIGHT_POST', true),
  /**
   * Paste a tight face region from the input onto FASHN output (`faceOnlyMode` — minimal neck to avoid garment seams).
   */
  TRYON_FASHN_FACE_LOCK: optionalBool('TRYON_FASHN_FACE_LOCK', true),
  /**
   * FASHN `segmentation_free`: when true (default), the API uses a less rigid garment mask — often fewer hem/notch artifacts.
   */
  FASHN_SEGMENTATION_FREE: optionalBool('FASHN_SEGMENTATION_FREE', true),
  /**
   * For FASHN clothing, skip Replicate rembg on the product image (preserves ties, ghost-mannequin edges, multi-piece layouts).
   * Only applies when `ENABLE_BACKGROUND_REMOVAL` is true.
   */
  TRYON_FASHN_SKIP_PRODUCT_BG_REMOVAL: optionalBool('TRYON_FASHN_SKIP_PRODUCT_BG_REMOVAL', true),
  /**
   * Minimum 64×64 luminance variance for output gate (FASHN only; main path uses 8).
   */
  TRYON_OUTPUT_FLATNESS_MIN_VARIANCE_FASHN: optionalFloat(
    'TRYON_OUTPUT_FLATNESS_MIN_VARIANCE_FASHN',
    3,
    1,
    8
  ),
  /**
   * When false (default), FASHN does a full garment swap. `true` blends old outfit layers and often causes
   * horizontal smear / edge bleed on tops (meant for accessories keeping the rest of the outfit).
   */
  TRYON_FASHN_RESTORE_CLOTHES: optionalBool('TRYON_FASHN_RESTORE_CLOTHES', false),
  /**
   * FASHN try-on `nsfw_filter`. When true (default), FASHN may reject images it classifies as NSFW;
   * failures surface as a generic content-policy message. Set false for local testing or if false
   * positives block legitimate fashion photos (review FASHN / product policy before turning off in prod).
   */
  FASHN_NSFW_FILTER: optionalBool('FASHN_NSFW_FILTER', true),
  /**
   * FASHN model used by the Outfit Builder (`services/ai/fashn.ts::runFashnOutfit`) — a separate,
   * additive path from the single-garment `tryon-v1.6` model above. Try-On Max supports shoes/
   * hats/bags, which tryon-v1.6 does not. Configurable in case FASHN renames/versions this model.
   */
  FASHN_OUTFIT_MODEL_NAME: optionalEnv('FASHN_OUTFIT_MODEL_NAME', 'tryon-max'),

  // Preprocessing — background removal (rembg)
  REPLICATE_MODEL_REMBG: optionalEnv(
    'REPLICATE_MODEL_REMBG',
    'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285d65c14638e98ef4f5d22dcfa'
  ),

  // Face restoration — GFPGAN (optional; off by default — prefer face lock for identity)
  REPLICATE_MODEL_GFPGAN: optionalEnv(
    'REPLICATE_MODEL_GFPGAN',
    'tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355f67302c51d70fbc95d863a95a4c85'
  ),
  /**
   * Optional Replicate model ID for human parsing / soft segmentation (`input: { image }` → image URL).
   * Leave empty to skip; routing still uses garment heuristics without it.
   */
  REPLICATE_MODEL_HUMAN_PARSE: optionalEnv('REPLICATE_MODEL_HUMAN_PARSE', ''),

  // ── Pipeline feature flags ────────────────────────────────────────────────
  /** Clothing (IDM-VTON): letterbox to 3:4 and expand tight head-and-shoulders shots so the model can render more of the garment. */
  TRYON_CLOTHING_SMART_FRAME: optionalBool('TRYON_CLOTHING_SMART_FRAME', true),
  ENABLE_BACKGROUND_REMOVAL: optionalBool('ENABLE_BACKGROUND_REMOVAL', false),
  ENABLE_BACKGROUND_NORMALIZATION: optionalBool('ENABLE_BACKGROUND_NORMALIZATION', false),
  /**
   * Deprecated: GFPGAN mutates face pixels — disabled in pipeline. Kept for env compatibility only.
   */
  ENABLE_FACE_PRESERVATION: optionalBool('ENABLE_FACE_PRESERVATION', false),
  /** Clothing: paste face + upper neck from input onto model output (BlazeFace + Sharp feather blend). */
  ENABLE_FACE_LOCK: optionalBool('ENABLE_FACE_LOCK', true),
  /**
   * Extra region below face box as fraction of face height (upper neck / jaw transition).
   * Lower values paste less of the original torso — important when swapping dresses/tops so the old outfit is not copied back.
   */
  FACE_LOCK_NECK_EXTENSION_RATIO: optionalFloat('FACE_LOCK_NECK_EXTENSION_RATIO', 0.28, 0.12, 0.85),
  /** Peak alpha for the identity patch feather (0–1). ~0.93 keeps a hair of generated context at edges. */
  FACE_LOCK_BLEND_OPACITY: optionalFloat('FACE_LOCK_BLEND_OPACITY', 0.93, 0.85, 0.99),
  /** Minimum feather edge in px (Sharp blur scales from this). */
  FACE_LOCK_FEATHER_MIN_PX: optionalInt('FACE_LOCK_FEATHER_MIN_PX', 4, 3, 12),
  /** Hard cap: identity patch height ≤ this × person height (stops rare BlazeFace boxes from overlaying most of the body). */
  FACE_LOCK_MAX_HEIGHT_FRAC: optionalFloat('FACE_LOCK_MAX_HEIGHT_FRAC', 0.38, 0.22, 0.55),
  /** Hard cap: identity patch width ≤ this × person width. */
  FACE_LOCK_MAX_WIDTH_FRAC: optionalFloat('FACE_LOCK_MAX_WIDTH_FRAC', 0.55, 0.35, 0.75),
  /**
   * If mean abs diff (downscaled) between VTON output and person is below this, the model likely returned the input unchanged — retry once with a new seed.
   */
  TRYON_IDENTITY_OUTPUT_MAD_THRESHOLD: optionalFloat('TRYON_IDENTITY_OUTPUT_MAD_THRESHOLD', 2.75, 1.2, 8),
  /** Enforce canonical 768×1024 normalization for clothing after smart frame. */
  TRYON_CANONICAL_PERSON: optionalBool('TRYON_CANONICAL_PERSON', true),
  /** Reject photos with 0 or 2+ detected faces before inference. */
  TRYON_STRICT_PERSON_VALIDATION: optionalBool('TRYON_STRICT_PERSON_VALIDATION', true),
  ENABLE_POST_PROCESSING: optionalBool('ENABLE_POST_PROCESSING', true),
  ENABLE_IMAGE_MODERATION: optionalBool('ENABLE_IMAGE_MODERATION', false),

  /** Longest edge (px) for images fed to try-on models (768–1536). */
  TRYON_AI_MAX_DIMENSION: optionalInt('TRYON_AI_MAX_DIMENSION', 1152, 768, 1536),
  /** JPEG quality when preparing tensors (higher = closer to upload, slightly larger payloads). */
  TRYON_AI_JPEG_QUALITY: optionalInt('TRYON_AI_JPEG_QUALITY', 94, 85, 98),
  /** IDM-VTON diffusion steps (20–50). Higher often looks cleaner; slower per run. */
  IDM_VTON_DENOISE_STEPS: optionalInt('IDM_VTON_DENOISE_STEPS', 50, 20, 50),
  /** IDM-VTON CFG / guidance (typical 1.5–3). */
  IDM_VTON_GUIDANCE_SCALE: optionalFloat('IDM_VTON_GUIDANCE_SCALE', 2, 1, 5),
  /**
   * After inference: `natural` = light touch (closer to model output, better for brand realism).
   * `vivid` = stronger saturation/sharpen (legacy).
   */
  TRYON_POST_PROCESS_STYLE: (() => {
    const v = optionalEnv('TRYON_POST_PROCESS_STYLE', 'natural').toLowerCase();
    return v === 'vivid' ? 'vivid' : 'natural';
  })(),

  // ── Payments (Paystack · Flutterwave) ────────────────────────────────────
  PAYSTACK_SECRET_KEY: optionalEnv('PAYSTACK_SECRET_KEY', ''),
  PAYSTACK_WEBHOOK_SECRET: optionalEnv('PAYSTACK_WEBHOOK_SECRET', ''),
  FLUTTERWAVE_SECRET_KEY: optionalEnv('FLUTTERWAVE_SECRET_KEY', ''),
  FLUTTERWAVE_WEBHOOK_SECRET: optionalEnv('FLUTTERWAVE_WEBHOOK_SECRET', ''),

  // ── Image Moderation (Hive) ───────────────────────────────────────────────
  HIVE_API_KEY: optionalEnv('HIVE_API_KEY', ''),

  // ── CDN (Cloudflare) ──────────────────────────────────────────────────────
  CLOUDFLARE_CDN_DOMAIN: optionalEnv('CLOUDFLARE_CDN_DOMAIN', ''),
  CLOUDFLARE_ZONE_ID: optionalEnv('CLOUDFLARE_ZONE_ID', ''),
  CLOUDFLARE_API_TOKEN: optionalEnv('CLOUDFLARE_API_TOKEN', ''),
  CLOUDFLARE_IMAGE_RESIZING_ENABLED: optionalBool('CLOUDFLARE_IMAGE_RESIZING_ENABLED', false),

  // ── Monitoring (Sentry) ───────────────────────────────────────────────────
  SENTRY_DSN: optionalEnv('SENTRY_DSN', ''),
  SENTRY_ISSUES_URL: optionalEnv('SENTRY_ISSUES_URL', ''),

  // ── Frontend ─────────────────────────────────────────────────────────────
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:8080'),
  /**
   * Public marketing site origin for links in transactional email (waitlist confirmations).
   * Set PUBLIC_APP_URL=https://tryverseai.com in production if API FRONTEND_URL differs.
   */
  PUBLIC_APP_URL: sanitizeEnvLine(
    process.env['PUBLIC_APP_URL'] || optionalEnv('FRONTEND_URL', 'http://localhost:8080'),
    'http://localhost:8080'
  ).replace(/\/$/, ''),

  // ── Email (Resend) ─────────────────────────────────────────────────────
  /** Trimmed — trailing newlines/quotes in .env break Resend with "API key is invalid". */
  RESEND_API_KEY: sanitizeEnvLine(process.env['RESEND_API_KEY'], ''),
  EMAIL_FROM: sanitizeEnvLine(
    process.env['EMAIL_FROM'],
    'TryVerse AI <info@tryverseai.com>'
  ),

  // ── Storage ───────────────────────────────────────────────────────────────
  STORAGE_BUCKET_INPUTS: optionalEnv('STORAGE_BUCKET_INPUTS', 'tryon-inputs'),
  STORAGE_BUCKET_RESULTS: optionalEnv('STORAGE_BUCKET_RESULTS', 'tryon-results'),
  IMAGE_EXPIRY_SECONDS: parseInt(optionalEnv('IMAGE_EXPIRY_SECONDS', '3600'), 10),

  // ── Security ──────────────────────────────────────────────────────────────
  /**
   * Trimmed + optional quote-stripped — matches `normalizeAdminKeyInput` on POST /api/admin/session.
   */
  ADMIN_SECRET_KEY: requireAdminSecretFromEnv(),
  WIDGET_ALLOWED_ORIGINS: optionalEnv('WIDGET_ALLOWED_ORIGINS', '*'),
  /** Comma-separated hostnames allowed for Host header on prod HTTPS upgrade (e.g. api.tryverseai.com). Empty = derive from FRONTEND_URL only. */
  PUBLIC_API_HOSTNAMES: optionalEnv('PUBLIC_API_HOSTNAMES', ''),
  /** Allow ?api_key= in production (default false — use x-api-key header). */
  ALLOW_API_KEY_IN_QUERY: optionalBool('ALLOW_API_KEY_IN_QUERY', false),

  /**
   * Development only: allow try-ons without deducting TryVerse plan credits.
   * Ignored when NODE_ENV=production. Does not affect Replicate billing.
   */
  TRYON_SKIP_CREDIT_CHECK: optionalBool('TRYON_SKIP_CREDIT_CHECK', false),

  // ── Job queue ─────────────────────────────────────────────────────────────
  JOB_CONCURRENCY: parseInt(optionalEnv('JOB_CONCURRENCY', '3'), 10),
  JOB_TIMEOUT_MS: parseInt(optionalEnv('JOB_TIMEOUT_MS', '180000'), 10),
  JOB_MAX_RETRIES: parseInt(optionalEnv('JOB_MAX_RETRIES', '3'), 10),

  /**
   * JSON object: { "secret-invite-token": "invited@email.com" } for GET /api/invite/validate.
   * Does not replace Convex Auth; Express account bootstrap still runs after signup.
   */
  INVITE_TOKEN_MAP_JSON: optionalEnv('INVITE_TOKEN_MAP_JSON', '{}'),
};

/**
 * Environment-aware rate-limit ceiling. Production keeps the exact tuned value (zero behavior
 * change there); development/test get a generous multiple so local work — repeated onboarding
 * runs, every plan tier, rapid AI-generation testing — never gets throttled by anti-abuse limits
 * meant for the public internet. Set RATE_LIMIT_DEV_MULTIPLIER to override (e.g. in a staging
 * env that wants closer-to-prod limits without being production).
 */
export function envAwareLimit(prodMax: number, devMultiplier?: number): number {
  if (env.NODE_ENV === 'production') return prodMax;
  const multiplier = devMultiplier ?? optionalInt('RATE_LIMIT_DEV_MULTIPLIER', 50, 1, 1000);
  return prodMax * multiplier;
}

/**
 * Fail fast on unsafe production configuration.
 */
export function assertProductionSecurityConfig(): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.TRYON_SKIP_CREDIT_CHECK) {
    throw new Error('TRYON_SKIP_CREDIT_CHECK cannot be enabled in production.');
  }
  if (env.WIDGET_ALLOWED_ORIGINS.trim() === '*') {
    throw new Error(
      'WIDGET_ALLOWED_ORIGINS cannot be "*" in production. Set comma-separated origins (e.g. https://yourstore.com,https://www.yourstore.com).'
    );
  }
}
