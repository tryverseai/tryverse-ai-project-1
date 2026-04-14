/**
 * tryOnOrchestrator
 * ─────────────────
 * Single authoritative place for the try-on "create → dispatch" flow.
 *
 * Both the dashboard API (routes/tryon.ts) and the widget API (routes/widget.ts)
 * used to duplicate this ~60-line block.  This module owns it once.
 *
 * What it does:
 *  1. Creates a pending Convex record for the try-on job.
 *  2. Assembles the TryOnJob payload.
 *  3. Either enqueues the job (async) or runs the AI pipeline inline (sync).
 *
 * What it does NOT do:
 *  - Ownership / IDOR checks (stays in the route — different error messages)
 *  - Credit checks (stays in the route — different response shapes)
 *  - Build the HTTP response (stays in the route — API contracts differ)
 */

import { v4 as uuidv4 } from 'uuid';
import { cxInsertTryon } from './tryonConvexBridge';
import { enqueueTryOnJob, getTryOnQueue } from './queue/producer';
import { executeTryOnPipeline } from './ai/pipeline';
import { logger } from '../config/logger';
import { ESTIMATED_WAIT_SECONDS } from '../lib/constants';
import type { TryOnJob, TryOnResult, ProductCategory } from '../types';

// ─── Typed error so routes can issue a clean 500 without leaking internals ───

export class TryOnDbError extends Error {
  constructor(cause: unknown) {
    super('Failed to create try-on record in database');
    this.name = 'TryOnDbError';
    this.cause = cause;
  }
}

// ─── Result type returned to route handlers ───────────────────────────────────

export type TryOnDispatchResult =
  | { dispatched: 'queued'; tryonLegacyId: string; jobId: string; estimatedWaitSeconds: number }
  | { dispatched: 'sync'; tryonLegacyId: string; jobId: string; result: TryOnResult };

// ─── Core orchestration function ─────────────────────────────────────────────

export interface CreateAndDispatchParams {
  userId: string;
  /** API key id if the request came via the widget; null for JWT users. */
  apiKeyId: string | null;
  personImagePath: string;
  productImagePath: string;
  category: ProductCategory;
  productDescription?: string;
  /**
   * When true (default) and a Bull queue is available, the job is enqueued for
   * async processing.  When false the pipeline runs inline (sync fallback).
   */
  asyncMode?: boolean;
  widgetMode?: boolean;
}

export async function createAndDispatchTryOn(
  params: CreateAndDispatchParams
): Promise<TryOnDispatchResult> {
  const {
    userId,
    apiKeyId,
    personImagePath,
    productImagePath,
    category,
    productDescription,
    asyncMode = true,
    widgetMode = false,
  } = params;

  // 1 ─ Persist a "queued" record so we can track status immediately ─────────
  const tryonLegacyId = uuidv4();
  try {
    await cxInsertTryon({
      legacyId: tryonLegacyId,
      userId,
      personImage: personImagePath,
      productImage: productImagePath,
      category,
      status: 'queued',
    });
  } catch (dbError) {
    logger.error('tryOnOrchestrator: failed to insert tryon record', {
      userId,
      category,
      error: String(dbError),
    });
    throw new TryOnDbError(dbError);
  }

  // 2 ─ Build the job payload ────────────────────────────────────────────────
  const jobId = uuidv4();
  const jobData: TryOnJob = {
    jobId,
    userId,
    apiKeyId,
    personImageUrl: personImagePath,
    productImageUrl: productImagePath,
    category,
    productDescription: productDescription || undefined,
    tryonDbId: tryonLegacyId,
    widgetMode,
  };

  // 3 ─ Dispatch: enqueue (async) or run inline (sync fallback) ─────────────
  const queue = getTryOnQueue();

  if (asyncMode && queue) {
    await enqueueTryOnJob(jobData);
    logger.info('tryOnOrchestrator: job queued', {
      jobId,
      tryonId: tryonLegacyId,
      userId,
      category,
    });
    return {
      dispatched: 'queued',
      tryonLegacyId,
      jobId,
      estimatedWaitSeconds: ESTIMATED_WAIT_SECONDS,
    };
  }

  // Sync path — no queue available or caller explicitly opted out of async
  logger.info('tryOnOrchestrator: processing synchronously', {
    jobId,
    tryonId: tryonLegacyId,
    category,
  });
  const result = await executeTryOnPipeline(jobData);
  return { dispatched: 'sync', tryonLegacyId, jobId, result };
}
