import { supabaseAdmin } from './supabase';
import { env } from './env';
import { logger } from './logger';

/**
 * Logs if required Storage buckets are missing (creates them in Dashboard, not via API here).
 */
export async function logStorageBucketStatus(): Promise<void> {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    logger.warn('Could not verify Supabase Storage buckets', { error: error.message });
    return;
  }
  const names = new Set((buckets ?? []).map((b) => b.name));
  const required = [env.STORAGE_BUCKET_INPUTS, env.STORAGE_BUCKET_RESULTS];
  const missing = required.filter((n) => n && !names.has(n));
  if (missing.length > 0) {
    logger.error(
      'Supabase Storage: bucket(s) missing — uploads and try-on results will fail until created.',
      {
        missing,
        dashboardPath: 'Project → Storage → New bucket',
        envKeys: 'STORAGE_BUCKET_INPUTS, STORAGE_BUCKET_RESULTS',
      }
    );
  }
}
