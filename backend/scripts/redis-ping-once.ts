import { connectRedis, getRedisClient } from "../src/config/redis";

(async (): Promise<void> => {
  await connectRedis();
  const c = getRedisClient();
  const ping = await c.ping().catch((e: unknown) => `error: ${e instanceof Error ? e.message : String(e)}`);
  console.log(JSON.stringify({ status: c.status, ping }));
  process.exit(0);
})();
