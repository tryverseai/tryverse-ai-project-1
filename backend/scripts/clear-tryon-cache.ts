/**
 * Clears Redis keys for try-on result cache (`tryon:*` only — not Bull).
 *
 * Run: npx tsx scripts/clear-tryon-cache.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectRedis } from '../src/config/redis';
import { clearAllTryonResultCache } from '../src/services/cache/tryonCache';

async function main() {
  await connectRedis();
  const n = await clearAllTryonResultCache();
  console.log(`Cleared ${n} try-on cache key(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
