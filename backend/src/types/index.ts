/**
 * Active product categories for V1 launch.
 * Future: shoes | jewelry | hats | accessories
 */
export type ProductCategory =
  | 'clothing'   // Tops, bottoms, dresses, jackets, outerwear — IDM-VTON
  | 'bags'       // Handbags, backpacks, clutches, totes — FASHN
  | 'glasses';   // Sunglasses, prescription eyewear, goggles — FASHN

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
  status: 'queued' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface ApiKeyPayload {
  id: string;
  userId: string;
  keyValue: string;
  status: string;
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
