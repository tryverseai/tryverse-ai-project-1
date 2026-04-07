import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { env } from './env';

export function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(env.CONVEX_URL);
}

/** Trusted server calls (shared secret inside Convex function args). */
export async function convexQueryTrusted<T>(
  ref: Parameters<ConvexHttpClient['query']>[0],
  args: Record<string, unknown>
): Promise<T> {
  const client = createConvexClient();
  return client.query(ref, args) as Promise<T>;
}

export async function convexMutationTrusted(
  ref: Parameters<ConvexHttpClient['mutation']>[0],
  args: Record<string, unknown>
): Promise<unknown> {
  const client = createConvexClient();
  return client.mutation(ref, args);
}

/** Public Convex queries (no auth). */
export async function convexQueryPublic<T>(
  ref: Parameters<ConvexHttpClient['query']>[0],
  args: Record<string, unknown> = {}
): Promise<T> {
  const client = createConvexClient();
  return client.query(ref, args) as Promise<T>;
}

export { anyApi };
