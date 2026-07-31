/**
 * Idempotently seeds the `plans` table (including `enterprise`) via the trusted Convex mutation —
 * no `npx convex dev` link needed, just BACKEND_SHARED_SECRET + CONVEX_URL from .env.
 *
 * Run: npx tsx scripts/seed-plans.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { anyApi, convexMutationTrusted } from '../src/config/convexHttp';
import { env } from '../src/config/env';

async function main() {
  const result = await convexMutationTrusted(anyApi.backendTrusted.ensurePlansSeeded, {
    secret: env.BACKEND_SHARED_SECRET,
  });
  console.log('ensurePlansSeeded result:', result);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
