import { supabaseAdmin } from '../../config/supabase';
import { runVtonInference } from './replicate';
import { inferPoseType } from './promptBuilder';
import { preprocessPersonImage, preprocessProductImage } from './preprocessing';
import { preserveFace } from './facePreservation';
import { postProcessResult, addGarmentShadow } from './postprocessing';
import { moderateTryOnImages } from '../moderation/hive';
import { getCachedResultByHash, setCachedResultByHash } from '../cache/tryonCache';
import { optimizeImageForAI, bufferToDataUrl } from './imageOptimizer';
import { getCdnUrl, getResponsiveImageUrls } from '../cdn/cloudflare';
import { getSignedUrl, INPUT_BUCKET, RESULT_BUCKET } from '../storage/images';
import { decrementCredits, restoreCredits } from '../credits';
import { sendTryOnCompletedEmail } from '../email';
import { captureAiError } from '../../config/sentry';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type { TryOnJob, TryOnResult } from '../../types';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  FULL AI TRY-ON PIPELINE
 *
 *  User uploads photo
 *        ↓
 *  Image moderation (Hive) — blocks inappropriate content
 *        ↓
 *  Cache check (Redis) — returns instantly if seen before
 *        ↓
 *  Image preprocessing
 *    • Background normalization (person image)
 *    • Background removal (product image)
 *        ↓
 *  AI model inference (Replicate)
 *    • Clothing → IDM-VTON
 *    • Bags / Glasses → FASHN
 *        ↓
 *  Face preservation (GFPGAN) — restores identity
 *        ↓
 *  Post-processing (Sharp)
 *    • Color correction
 *    • Lighting normalization
 *    • Shadow enhancement
 *        ↓
 *  CDN delivery (Cloudflare)
 *        ↓
 *  Result returned to widget / dashboard
 * ═══════════════════════════════════════════════════════════════════
 */
export async function executeTryOnPipeline(job: TryOnJob): Promise<TryOnResult> {
  const { tryonDbId, personImageUrl, productImageUrl, category, userId, productDescription } = job;
  const startTime = Date.now();

  logger.info('Try-on request', { tryonDbId, userId, category });

  await supabaseAdmin.from('tryons').update({ status: 'processing' }).eq('id', tryonDbId);

  try {
    // ── STEP 1: Get signed URLs and optimize images ──────────────────────────
    const [personSignedUrl, productSignedUrl] = await Promise.all([
      getSignedUrl(INPUT_BUCKET, personImageUrl, 7200),
      getSignedUrl(INPUT_BUCKET, productImageUrl, 7200),
    ]);

    const [personOptimized, productOptimized] = await Promise.all([
      optimizeImageForAI(personSignedUrl),
      optimizeImageForAI(productSignedUrl),
    ]);

    logger.info('Images optimized', { tryonDbId, personHash: personOptimized.hash.slice(0, 12) });

    // ── STEP 2: Cache Check (content-based hashes) ───────────────────────────
    const cachedResultPath = await getCachedResultByHash(
      personOptimized.hash,
      productOptimized.hash,
      category
    );
    if (cachedResultPath) {
      const cachedResultUrl = getCdnUrl(
        await getSignedUrl(RESULT_BUCKET, cachedResultPath, 86400 * 30)
      );
      await supabaseAdmin.from('tryons').update({
        status: 'completed',
        result_image: cachedResultPath,
        completed_at: new Date().toISOString(),
      }).eq('id', tryonDbId);

      if (userId) {
        await decrementCredits(userId);
        sendTryOnCompletedEmail(userId, cachedResultUrl).catch((e) =>
          logger.warn('Try-on completed email failed (cache hit)', { userId, error: String(e) })
        );
      }

      logger.info('Cache hit — served without AI', { tryonDbId, category });
      return {
        jobId: job.jobId,
        status: 'completed',
        resultUrl: cachedResultUrl,
        processingTimeMs: Date.now() - startTime,
      };
    }

    logger.info('Cache miss — running AI inference', { tryonDbId });

    // ── STEP 3: Image Moderation (Hive) ────────────────────────────────────
    if (env.ENABLE_IMAGE_MODERATION) {
      const personDataUrl = bufferToDataUrl(personOptimized.buffer);
      const productDataUrl = bufferToDataUrl(productOptimized.buffer);
      const moderation = await moderateTryOnImages(personDataUrl, productDataUrl);
      if (!moderation.safe) {
        await supabaseAdmin.from('tryons').update({ status: 'failed' }).eq('id', tryonDbId);
        return {
          jobId: job.jobId,
          status: 'failed',
          error: moderation.reason || 'Image failed content moderation',
        };
      }
    }

    // ── STEP 4: Preprocessing (use optimized images as input) ─────────────────
    const personDataUrl = bufferToDataUrl(personOptimized.buffer);
    const productDataUrl = bufferToDataUrl(productOptimized.buffer);
    const [personPreprocessed, productPreprocessed] = await Promise.all([
      preprocessPersonImage(personDataUrl),
      preprocessProductImage(productDataUrl),
    ]);

    if (!personPreprocessed.bodyDetected) {
      logger.warn('Body not clearly detected in person image', { tryonDbId });
    }

    // ── STEP 5: AI Inference (hidden dynamic prompts when using flux-kontext) ─
    const poseType = inferPoseType(personOptimized.width, personOptimized.height);
    const { resultUrl: rawResultUrl, processingTimeMs, modelUsed } = await runVtonInference({
      personImageUrl: personPreprocessed.processedImageUrl,
      productImageUrl: productPreprocessed.processedImageUrl,
      category,
      productDescription,
      bodyDetected: personPreprocessed.bodyDetected,
      poseType,
    });

    // ── STEP 6: Face Preservation (GFPGAN) ─────────────────────────────────
    let facePreservedUrl = rawResultUrl;
    if (env.ENABLE_FACE_PRESERVATION && category === 'clothing') {
      const { processedImageUrl, faceEnhanced } = await preserveFace(rawResultUrl);
      facePreservedUrl = processedImageUrl;
      logger.info('Face preservation', { faceEnhanced, tryonDbId });
    }

    // ── STEP 7: Post-Processing (color, lighting, shadow) ───────────────────
    let finalBuffer: Buffer;
    if (env.ENABLE_POST_PROCESSING) {
      const postResult = await postProcessResult(facePreservedUrl);
      finalBuffer = await addGarmentShadow(postResult.buffer);
    } else {
      const response = await fetch(facePreservedUrl);
      finalBuffer = Buffer.from(await response.arrayBuffer());
    }

    // ── STEP 8: Store result in Supabase Storage ────────────────────────────
    const resultPath = userId
      ? `${userId}/results/${tryonDbId}.jpg`
      : `anonymous/results/${tryonDbId}.jpg`;

    const { error: storageError } = await supabaseAdmin.storage
      .from(RESULT_BUCKET)
      .upload(resultPath, finalBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '86400',
        upsert: true,
      });

    if (storageError) throw new Error(`Result storage failed: ${storageError.message}`);

    // ── STEP 9: Cache the result (content-based) ──────────────────────────────
    await setCachedResultByHash(
      personOptimized.hash,
      productOptimized.hash,
      category,
      resultPath
    );

    // ── STEP 10: Generate CDN URL ───────────────────────────────────────────
    const storedSignedUrl = await getSignedUrl(RESULT_BUCKET, resultPath, 86400 * 30);
    const cdnUrl = getCdnUrl(storedSignedUrl);
    const responsiveUrls = getResponsiveImageUrls(storedSignedUrl);

    // ── STEP 11: Update DB record ───────────────────────────────────────────
    await supabaseAdmin.from('tryons').update({
      status: 'completed',
      result_image: resultPath,
      completed_at: new Date().toISOString(),
    }).eq('id', tryonDbId);

    // ── STEP 12: Decrement credits ──────────────────────────────────────────
    if (userId) await decrementCredits(userId);

    // ── STEP 12b: Send try-on completed email ──────────────────────────────
    if (userId) {
      sendTryOnCompletedEmail(userId, cdnUrl).catch((e) =>
        logger.warn('Try-on completed email failed', { userId, error: String(e) })
      );
    }

    // ── STEP 13: Log usage event ────────────────────────────────────────────
    if (userId) {
      await supabaseAdmin.from('usage_events').insert({
        user_id: userId,
        event_type: 'tryon_completed',
        metadata: {
          tryon_id: tryonDbId,
          category,
          model_used: modelUsed,
          processing_time_ms: processingTimeMs,
          total_pipeline_ms: Date.now() - startTime,
          widget_mode: job.widgetMode,
          face_preserved: env.ENABLE_FACE_PRESERVATION && category === 'clothing',
          post_processed: env.ENABLE_POST_PROCESSING,
          body_detected: personPreprocessed.bodyDetected,
        },
      });
    }

    const totalMs = Date.now() - startTime;
    logger.info('Pipeline completed', { tryonDbId, category, modelUsed, totalMs });

    return {
      jobId: job.jobId,
      status: 'completed',
      resultUrl: cdnUrl,
      processingTimeMs: totalMs,
      ...(responsiveUrls as unknown as Record<string, unknown>),
    } as TryOnResult;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('AI pipeline failed', {
      tryonDbId,
      category,
      userId,
      error: error.message,
    });

    captureAiError(error, { tryonDbId, category, userId, jobId: job.jobId });

    await supabaseAdmin.from('tryons').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    }).eq('id', tryonDbId);

    if (userId) {
      await restoreCredits(userId);
      await supabaseAdmin.from('usage_events').insert({
        user_id: userId,
        event_type: 'tryon_failed',
        metadata: { tryon_id: tryonDbId, category, error: error.message },
      });
    }

    return { jobId: job.jobId, status: 'failed', error: error.message };
  }
}
