import { runVtonInference, type ClothingTryOnEngine } from './replicate';
import { inferPoseType } from './promptBuilder';
import { preprocessPersonImage, preprocessProductImage } from './preprocessing';
import { applyFaceLockFromPersonInput } from './facePreservation';
import {
  validatePersonForTryOn,
  normalizePersonToTryOnCanvas,
  classifyGarmentTopology,
  runHumanParsingStage,
  validateTryOnOutput,
  meanAbsDiffDownscaled,
  assertTryOnOutputNotCollage,
} from './tryon';
import { inferIdmVtonGarmentCategory } from './garmentDescriptor';
import { postProcessResultBuffer, postProcessResultBufferMinimal, addGarmentShadow } from './postprocessing';
import { moderateTryOnImages } from '../moderation/hive';
import { getCachedResultByHash, setCachedResultByHash, computeImageHash } from '../cache/tryonCache';
import { optimizeImageForAI, bufferToDataUrl } from './imageOptimizer';
import { prepareClothingPersonForIdmVton } from './tryOnFraming';
import { getCdnUrl, getResponsiveImageUrls } from '../cdn/cloudflare';
import {
  getSignedUrl,
  INPUT_BUCKET,
  RESULT_BUCKET,
  uploadInferenceScratchJpeg,
  removeInferenceScratchPaths,
  uploadResultBuffer,
} from '../storage/images';
import { cxPatchTryon, cxInsertUsageEvent } from '../tryonConvexBridge';
import { decrementCredits, restoreCredits } from '../credits';
import { sendTryOnCompletedEmail } from '../email';
import { captureAiError } from '../../config/sentry';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import sharp from 'sharp';
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
 *    • Clothing → FASHN Try-On (default) / IDM-VTON / Flux Kontext + optional human-parse hook
 *    • Bags / Glasses → FASHN
 *        ↓
 *  Face + neck lock (clothing, IDM/Flux only): paste identity from input — skipped for FASHN
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
  /** Temp files in INPUT bucket — Replicate uses signed HTTPS URLs instead of huge data URIs. */
  const inferenceScratchPaths: string[] = [];
  let garmentTopology: string = 'n/a';
  let clothingEngine: ClothingTryOnEngine | undefined;

  logger.info('Try-on request', { tryonDbId, userId, category });

  await cxPatchTryon(tryonDbId, { status: 'processing' });

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

    let personBuffer = personOptimized.buffer;
    let personHash = personOptimized.hash;
    let personW = personOptimized.width;
    let personH = personOptimized.height;

    if (category === 'clothing' && env.TRYON_CLOTHING_SMART_FRAME) {
      personBuffer = await prepareClothingPersonForIdmVton(personBuffer);
      const meta = await sharp(personBuffer).metadata();
      personW = meta.width ?? personW;
      personH = meta.height ?? personH;
      personHash = computeImageHash(personBuffer);
    }

    const productHeightOverWidth =
      productOptimized.width > 0 ? productOptimized.height / productOptimized.width : undefined;

    if (category === 'clothing') {
      const accept = await validatePersonForTryOn(personBuffer);
      if (!accept.ok) {
        await cxPatchTryon(tryonDbId, { status: 'failed' });
        return {
          jobId: job.jobId,
          status: 'failed',
          error: accept.reason || 'Invalid person photo',
        };
      }
      if (env.TRYON_CANONICAL_PERSON) {
        personBuffer = await normalizePersonToTryOnCanvas(personBuffer);
        const meta = await sharp(personBuffer).metadata();
        personW = meta.width ?? personW;
        personH = meta.height ?? personH;
        personHash = computeImageHash(personBuffer);
      }
      garmentTopology = classifyGarmentTopology(category, productDescription, productHeightOverWidth);
      if (env.REPLICATE_USE_FLUX_KONTEXT) {
        clothingEngine = 'flux_kontext';
      } else if (garmentTopology === 'full_body' && env.TRYON_FULLBODY_USE_FLUX) {
        clothingEngine = 'flux_kontext';
      } else if (env.TRYON_CLOTHING_USE_FASHN) {
        clothingEngine = 'fashn';
      } else {
        clothingEngine = 'idm_vton';
      }
      logger.info('tryon.route', { tryonDbId, garmentTopology, clothingEngine });
    }

    const cacheVariant =
      category === 'clothing'
        ? clothingEngine === 'flux_kontext'
          ? 'flux'
          : clothingEngine === 'fashn'
            ? 'fashn'
            : 'idm'
        : undefined;

    logger.info('Images optimized', { tryonDbId, personHash: personHash.slice(0, 12) });

    // ── STEP 2: Cache Check (content-based hashes) ───────────────────────────
    const cachedResultPath = await getCachedResultByHash(
      personHash,
      productOptimized.hash,
      category,
      cacheVariant
    );
    if (cachedResultPath) {
      const cachedResultUrl = getCdnUrl(
        await getSignedUrl(RESULT_BUCKET, cachedResultPath, 86400 * 30)
      );
      await cxPatchTryon(tryonDbId, {
        status: 'completed',
        result_image: cachedResultPath,
        completed_at: new Date().toISOString(),
      });

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
      const personDataUrl = bufferToDataUrl(personBuffer);
      const productDataUrl = bufferToDataUrl(productOptimized.buffer);
      const moderation = await moderateTryOnImages(personDataUrl, productDataUrl);
      if (!moderation.safe) {
        await cxPatchTryon(tryonDbId, { status: 'failed' });
        return {
          jobId: job.jobId,
          status: 'failed',
          error: moderation.reason || 'Image failed content moderation',
        };
      }
    }

    // ── STEP 4: Preprocessing — upload scratch JPEGs, signed HTTPS URLs for Replicate ──
    const personScratchPath = await uploadInferenceScratchJpeg(personBuffer, 'person', userId);
    inferenceScratchPaths.push(personScratchPath);
    const productScratchPath = await uploadInferenceScratchJpeg(
      productOptimized.buffer,
      'product',
      userId
    );
    inferenceScratchPaths.push(productScratchPath);

    const inferenceSignedTtlSec = 7200;
    const [personHttps, productHttps] = await Promise.all([
      getSignedUrl(INPUT_BUCKET, personScratchPath, inferenceSignedTtlSec),
      getSignedUrl(INPUT_BUCKET, productScratchPath, inferenceSignedTtlSec),
    ]);

    const parseStage = await runHumanParsingStage(personHttps);
    logger.info('tryon.stage.humanParsing', {
      tryonDbId,
      skipped: parseStage.skipped,
      hasAux: !!parseStage.auxiliaryUrl,
    });

    const [personPreprocessed, productPreprocessed] = await Promise.all([
      preprocessPersonImage(personHttps),
      preprocessProductImage(productHttps),
    ]);

    if (!personPreprocessed.bodyDetected) {
      logger.warn('Body not clearly detected in person image', { tryonDbId });
    }

    const idmGarmentSlot =
      category === 'clothing'
        ? inferIdmVtonGarmentCategory(productHeightOverWidth, productDescription)
        : 'upper_body';

    // ── STEP 5–7: Inference → optional face lock → post — retry if model returns a stitched/collage frame ──
    const MAX_LAYOUT_RETRIES = 3;
    let rawResultUrl!: string;
    let processingTimeMs = 0;
    let modelUsed = '';
    let finalBuffer!: Buffer;
    let faceLockApplied = false;
    let layoutOk = false;

    for (let layoutAttempt = 0; layoutAttempt < MAX_LAYOUT_RETRIES; layoutAttempt++) {
      if (layoutAttempt > 0) {
        logger.warn('tryon: retry after bad output layout', { tryonDbId, layoutAttempt });
      }

      const poseType = inferPoseType(personW, personH);
      let compositeBuffer!: Buffer;

      const maxVtonAttempts = category === 'clothing' ? 2 : 1;
      for (let vtonAttempt = 0; vtonAttempt < maxVtonAttempts; vtonAttempt++) {
        const inf = await runVtonInference(
          {
            personImageUrl: personPreprocessed.processedImageUrl,
            productImageUrl: productPreprocessed.processedImageUrl,
            category,
            productDescription,
            productHeightOverWidth,
            bodyDetected: personPreprocessed.bodyDetected,
            poseType,
          },
          category === 'clothing' && clothingEngine ? { clothingEngine } : undefined
        );
        rawResultUrl = inf.resultUrl;
        processingTimeMs = inf.processingTimeMs;
        modelUsed = inf.modelUsed;

        const vtonFetch = await fetch(rawResultUrl);
        if (!vtonFetch.ok) throw new Error('Failed to fetch try-on result image');
        compositeBuffer = Buffer.from(await vtonFetch.arrayBuffer());

        if (category !== 'clothing' || maxVtonAttempts < 2) break;

        const mad = await meanAbsDiffDownscaled(personBuffer, compositeBuffer);
        logger.info('tryon.vton.diff', {
          tryonDbId,
          vtonAttempt,
          meanAbsDiff: Number(mad.toFixed(4)),
          threshold: env.TRYON_IDENTITY_OUTPUT_MAD_THRESHOLD,
        });
        if (mad >= env.TRYON_IDENTITY_OUTPUT_MAD_THRESHOLD) break;
        if (vtonAttempt + 1 >= maxVtonAttempts) {
          logger.warn('tryon.vton: output still near-identical to person after retry', {
            tryonDbId,
            meanAbsDiff: mad,
          });
          throw new Error(
            'The outfit could not be applied on this photo. Try a clearer front-facing shot, different lighting, or a flat product photo of the garment.'
          );
        }
        logger.warn('tryon.vton: near-identical output; retrying with new seed', { tryonDbId, meanAbsDiff: mad });
      }

      faceLockApplied = false;
      if (category === 'clothing' && env.ENABLE_FACE_LOCK) {
        if (clothingEngine === 'fashn') {
          if (env.TRYON_FASHN_FACE_LOCK) {
            const lock = await applyFaceLockFromPersonInput(personBuffer, compositeBuffer, {
              faceOnlyMode: true,
            });
            compositeBuffer = Buffer.from(lock.buffer);
            faceLockApplied = lock.applied;
          }
        } else {
          const lock = await applyFaceLockFromPersonInput(
            personBuffer,
            compositeBuffer,
            idmGarmentSlot === 'dresses' ? { dressMode: true } : undefined
          );
          compositeBuffer = Buffer.from(lock.buffer);
          faceLockApplied = lock.applied;
        }
      }

      const postInputBuffer = compositeBuffer;

      if (env.ENABLE_POST_PROCESSING) {
        const postResult =
          category === 'clothing' && clothingEngine === 'fashn' && env.TRYON_FASHN_LIGHT_POST
            ? await postProcessResultBufferMinimal(postInputBuffer)
            : await postProcessResultBuffer(postInputBuffer);
        finalBuffer = await addGarmentShadow(postResult.buffer);
      } else {
        finalBuffer = postInputBuffer;
      }

      const outputGate = await validateTryOnOutput(finalBuffer);
      if (!outputGate.ok) {
        throw new Error(outputGate.reason || 'Generated image failed quality checks');
      }

      try {
        await assertTryOnOutputNotCollage(finalBuffer, personW, personH);
        layoutOk = true;
        break;
      } catch (layoutErr) {
        const msg = layoutErr instanceof Error ? layoutErr.message : '';
        if (
          msg.includes('model layout') &&
          layoutAttempt + 1 < MAX_LAYOUT_RETRIES
        ) {
          continue;
        }
        throw layoutErr;
      }
    }

    if (!layoutOk) {
      throw new Error('Invalid output — model layout looks wrong; please try again.');
    }

    // ── STEP 8: Store result (Convex file storage) ─────────────────────────
    const resultPath = await uploadResultBuffer(finalBuffer, userId ?? undefined);

    // ── STEP 9: Cache the result (content-based) ──────────────────────────────
    await setCachedResultByHash(
      personHash,
      productOptimized.hash,
      category,
      resultPath,
      cacheVariant
    );

    // ── STEP 10: Generate CDN URL ───────────────────────────────────────────
    const storedSignedUrl = await getSignedUrl(RESULT_BUCKET, resultPath, 86400 * 30);
    const cdnUrl = getCdnUrl(storedSignedUrl);
    const responsiveUrls = getResponsiveImageUrls(storedSignedUrl);

    // ── STEP 11: Update DB record ───────────────────────────────────────────
    await cxPatchTryon(tryonDbId, {
      status: 'completed',
      result_image: resultPath,
      completed_at: new Date().toISOString(),
    });

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
      await cxInsertUsageEvent(userId, 'tryon_completed', {
        tryon_id: tryonDbId,
        category,
        model_used: modelUsed,
        processing_time_ms: processingTimeMs,
        total_pipeline_ms: Date.now() - startTime,
        widget_mode: job.widgetMode,
        face_lock_applied: faceLockApplied,
        post_processed: env.ENABLE_POST_PROCESSING,
        body_detected: personPreprocessed.bodyDetected,
        garment_topology: garmentTopology,
        clothing_engine: clothingEngine ?? null,
        human_parsing_skipped: parseStage.skipped,
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

    await cxPatchTryon(tryonDbId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
    });

    if (userId) {
      await restoreCredits(userId);
      await cxInsertUsageEvent(userId, 'tryon_failed', {
        tryon_id: tryonDbId,
        category,
        error: error.message,
      });
    }

    return { jobId: job.jobId, status: 'failed', error: error.message };
  } finally {
    if (inferenceScratchPaths.length > 0) {
      try {
        await removeInferenceScratchPaths(inferenceScratchPaths);
      } catch (cleanupErr) {
        logger.warn('Inference scratch cleanup error', { error: String(cleanupErr) });
      }
    }
  }
}
