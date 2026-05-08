import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { env } from './env';
import { AppError } from '../middleware/errorHandler';

export function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(env.CONVEX_URL);
}

/** Turn common Convex failures into actionable HTTP responses (Convex throws plain Errors). */
function mapConvexTrustedFailure(err: unknown): never {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
  if (/Unauthorized/i.test(msg)) {
    throw new AppError(
      'Convex rejected the backend shared secret. Set BACKEND_SHARED_SECRET on the API host (e.g. Railway) to exactly match BACKEND_SHARED_SECRET in the Convex dashboard environment for this deployment.',
      502
    );
  }
  if (err instanceof Error) throw err;
  throw new Error(msg || 'Convex request failed');
}

/** Trusted server calls (shared secret inside Convex function args). */
export async function convexQueryTrusted<T>(
  ref: Parameters<ConvexHttpClient['query']>[0],
  args: Record<string, unknown>
): Promise<T> {
  try {
    const client = createConvexClient();
    return (await client.query(ref, args)) as T;
  } catch (err) {
    mapConvexTrustedFailure(err);
  }
}

export async function convexMutationTrusted(
  ref: Parameters<ConvexHttpClient['mutation']>[0],
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    const client = createConvexClient();
    return await client.mutation(ref, args);
  } catch (err) {
    mapConvexTrustedFailure(err);
  }
}

/** Public Convex queries (no auth). */
export async function convexQueryPublic<T>(
  ref: Parameters<ConvexHttpClient['query']>[0],
  args: Record<string, unknown> = {}
): Promise<T> {
  try {
    const client = createConvexClient();
    return (await client.query(ref, args)) as T;
  } catch (err) {
    mapConvexTrustedFailure(err);
  }
}

export { anyApi };
