import { env } from '../config/env';
import { anyApi, convexQueryTrusted } from '../config/convexHttp';

export async function userAnalyticsSince(userId: string, sinceIso: string): Promise<{
  tryons: Array<{
    id: string | undefined;
    status: string;
    category: string;
    product_image: string;
    created_at: string;
    completed_at: string | null;
  }>;
  events: Array<{
    event_type: string;
    metadata: unknown;
    created_at: string;
  }>;
}> {
  return convexQueryTrusted(anyApi.backendTrusted.userAnalyticsSince, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    sinceIso,
  });
}
