import { logger } from './logger';
import { anyApi, convexQueryPublic } from './convexHttp';

/** Verifies Convex responds (try-on images use Convex file storage). */
export async function logStorageBucketStatus(): Promise<void> {
  try {
    await convexQueryPublic<any[]>(anyApi.modelLibrary.listActiveModels, {});
  } catch (e) {
    logger.warn('Convex connectivity check failed', { error: String(e) });
  }
}
