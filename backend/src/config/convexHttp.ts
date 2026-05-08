import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { env } from './env';
import { AppError } from '../middleware/errorHandler';

export function createConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(env.CONVEX_URL);
}

function normalizeConvexFailureMessage(raw: string): string {
  let m = raw.trim();
  m = m.replace(/^Uncaught Error:\s*/i, '');
  if (m.length > 800) m = `${m.slice(0, 800)}…`;
  return m || 'Convex request failed';
}

/**
 * Convex trusted calls run from the API; surface function errors as 502 + message so admin
 * (and operators) see failures instead of a generic production 500.
 */
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
  throw new AppError(normalizeConvexFailureMessage(msg), 502);
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
