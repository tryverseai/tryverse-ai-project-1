import type { OutfitSlots } from '../services/ai/outfitSlots';

/**
 * Product categories shared by the product catalog and the single-item try-on pipeline: apparel,
 * footwear, and accessories (eyewear, jewelry) routed through FASHN Try-On Max for the
 * non-apparel values — see `isAccessoryCategory` in `services/ai/pipeline.ts`. Grouped into
 * higher-level display categories by `PRODUCT_CATEGORY_GROUPS` in `lib/constants.ts`.
 */
export type ProductCategory =
  | 'clothing'
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'one-pieces'
  | 'eyewear'
  | 'jewelry'
  | 'footwear';

/**
 * Product catalog category — historically a superset of `ProductCategory` for the Outfit
 * Builder's 'shoes' slot, which had no equivalent in the single-item try-on pipeline. Now that
 * `ProductCategory` includes `'footwear'`, catalog and single-item try-on share one category
 * space; the Outfit Builder's `shoes` *slot key* (its internal object field, matching the
 * `outfit_generations` Convex schema) is unrelated and stays as-is — only the catalog tagging
 * value moved to `'footwear'`.
 */
export type CatalogCategory = ProductCategory;

/** Lifecycle states a try-on record can be in (mirrors Convex schema). */
export type TryOnStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** Possible states for an API key. */
export type ApiKeyStatus = 'active' | 'revoked';

/** Storage sub-folder for uploaded images. */
export type StorageFolder = 'person' | 'garment';

/**
 * Bull/BullMQ job state strings returned by `job.getState()`, plus two
 * synthetic values produced by `getJobStatus` when the queue is unavailable
 * (`'unknown'`) or the job ID was not found (`'not_found'`).
 */
export type BullJobStatus =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'unknown'
  | 'not_found';

/**
 * Known usage-event types recorded via `cxInsertUsageEvent`.
 * The trailing `(string & {})` member lets callers pass arbitrary strings
 * while TypeScript still autocompletes the well-known values.
 */
export type UsageEventType =
  | 'tryon_completed'
  | 'tryon_failed'
  | 'subscription_activated'
  | (string & {});

export interface TryOnJob {
  jobId: string;
  userId: string | null;
  apiKeyId: string | null;
  personImageUrl: string;
  productImageUrl: string;      // generic: any product, not just garment
  category: ProductCategory;
  productDescription?: string;  // optional hint to improve AI accuracy
  tryonDbId: string;
  widgetMode: boolean;
}

export interface TryOnResult {
  jobId: string;
  status: TryOnStatus;
  resultUrl?: string;
  /** User-facing error message — sanitized, no vendor internals. */
  error?: string;
  /** Machine-readable error code (e.g. NO_PERSON_DETECTED, TIMEOUT). */
  errorCode?: string;
  processingTimeMs?: number;
}

/**
 * Outfit Builder job — deliberately separate from `TryOnJob`/`tryon-jobs`. One model photo +
 * multiple product image URLs (per slot) → one composited flat-lay → one FASHN Try-On Max result.
 * Processed by its own `outfit-jobs` Bull queue (`services/queue/outfitProducer.ts`) and its own
 * `executeOutfitPipeline` — never touches the single-garment pipeline.
 */
export interface OutfitJob {
  jobId: string;
  userId: string;
  outfitDbId: string;
  /** TryVerse credits reserved for this job — restored via restoreCredits() on failure. */
  creditAmount: number;
  /** Which pool creditAmount was drawn from — passed to restoreCredits() so a refund lands back in the same pool instead of being guessed. */
  creditType?: 'monthly' | 'free';
  modelImageUrl: string;
  /** Same shape reused for both — one holds resolved image URLs, the other product display names. */
  slotImageUrls: OutfitSlots;
  slotLabels: OutfitSlots;
}

export interface OutfitResult {
  jobId: string;
  status: 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

/**
 * AI Model Studio job — separate from every other queue. Product photo (+ optional face
 * reference) → one FASHN `product-to-model` result. Processed by its own `product-model-jobs`
 * Bull queue and `executeProductModelPipeline`.
 */
export interface ProductModelJob {
  jobId: string;
  userId: string;
  generationDbId: string;
  /** TryVerse credits reserved for this job — restored via restoreCredits() on failure. */
  creditAmount: number;
  /** Which pool creditAmount was drawn from — passed to restoreCredits() so a refund lands back in the same pool instead of being guessed. */
  creditType?: 'monthly' | 'free';
  productImageUrl: string;
  faceReferenceUrl?: string;
  prompt?: string;
}

export interface ProductModelResult {
  jobId: string;
  status: 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

/**
 * AI Video job — separate from every other queue. One still image → one FASHN `image-to-video`
 * clip. Processed by its own `video-jobs` Bull queue and `executeVideoPipeline`.
 */
export interface VideoJob {
  jobId: string;
  userId: string;
  generationDbId: string;
  /** TryVerse credits reserved for this job — restored via restoreCredits() on failure. */
  creditAmount: number;
  /** Which pool creditAmount was drawn from — passed to restoreCredits() so a refund lands back in the same pool instead of being guessed. */
  creditType?: 'monthly' | 'free';
  sourceImageUrl: string;
  prompt?: string;
  duration: 5 | 10;
  resolution: '480p' | '720p' | '1080p';
}

export interface VideoResult {
  jobId: string;
  status: 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface ApiKeyPayload {
  id: string;
  userId: string;
  keyValue: string;
  status: ApiKeyStatus;
  name: string;
  /** Subset of ["read","write"]. null/undefined = full access (legacy/unscoped key). */
  scopes?: string[] | null;
}

export interface CreditCheckResult {
  allowed: boolean;
  creditsRemaining: number;
  creditType: 'free' | 'monthly';
  reason?: string;
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    metadata: {
      user_id: string;
      plan_id: string;
    };
    customer: {
      email: string;
    };
  };
}

export interface FlutterwaveWebhookEvent {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
    // Present on charge.completed/charge.failed (merchant-supplied at checkout init). Not
    // documented as present on subscription.cancelled — that event's payload centers on a `plan`
    // object instead, so code handling cancellation must treat this as possibly absent.
    meta?: {
      user_id: string;
      plan_id: string;
    };
    customer: {
      email: string;
    };
  };
}

export interface PlanConfig {
  id: string;
  name: string;
  monthlyCredits: number;
  maxProducts: number;
  price_ngn: number;
  price_usd: number;
}

export interface WidgetRequest {
  apiKey: string;
  domain: string;
  personImageUrl?: string;
  productImageUrl?: string;
  category: ProductCategory;
  productDescription?: string;
}

export interface AdminMetrics {
  totalUsers: number;
  totalTryons: number;
  totalRevenue: number;
  activeSubscriptions: number;
  tryonsToday: number;
  tryonsThisMonth: number;
  successRate: number;
  avgProcessingTime: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
      /** Bearer / Local-auth subject before canonicalization — used for Convex profile lookups. */
      convexAuthSubjectRaw?: string;
      apiKey?: ApiKeyPayload;
      widgetUserId?: string;
    }
  }
}
