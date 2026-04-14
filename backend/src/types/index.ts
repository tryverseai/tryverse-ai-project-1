/**
 * Active product categories for V1 launch.
 * Future: shoes | jewelry | hats | accessories
 */
export type ProductCategory =
  | 'clothing'   // Tops, bottoms, dresses, jackets, outerwear — IDM-VTON
  | 'bags'       // Handbags, backpacks, clutches, totes — FASHN
  | 'glasses';   // Sunglasses, prescription eyewear, goggles — FASHN

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

export interface ApiKeyPayload {
  id: string;
  userId: string;
  keyValue: string;
  status: ApiKeyStatus;
  name: string;
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
    meta: {
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
      apiKey?: ApiKeyPayload;
      widgetUserId?: string;
    }
  }
}
