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
import {
  postProcessResultBuffer,
  postProcessResultBufferMinimal,
  addGarmentShadow,
} from './postprocessing';
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
import { restoreCredits } from '../credits';
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
// ─── Public error classification ─────────────────────────────────────────────

interface PublicError { code: string; message: string }

/**
 * Maps raw internal pipeline errors to stable public-facing codes and messages.
 * Full error details are always logged server-side; clients only receive the
 * sanitized version to prevent leaking vendor names, API URLs, or model internals.
 */
function classifyTryOnError(err: Error): PublicError {
  const msg = err.message.toLowerCase();

  // Do not map vendor try-on errors (e.g. FASHN "nsfw") to CONTENT_MODERATED — that string
  // was misleading for fashion photos. Hive blocks are returned explicitly in STEP 3 with
  // moderation.reason when ENABLE_IMAGE_MODERATION is enabled.

  // No person / body not detected
  if (msg.includes('no person') || msg.includes('no human') || msg.includes('body not') ||
      msg.includes('person not') || msg.includes('could not detect') || msg.includes('no body')) {
    return { code: 'NO_PERSON_DETECTED', message: 'We could not detect a person in the uploaded photo. Please try with a clearer, well-lit photo.' };
  }
  // Image quality
  if (msg.includes('resolution') || msg.includes('too small') || msg.includes('image quality') ||
      msg.includes('blurry') || msg.includes('low quality')) {
    return { code: 'IMAGE_QUALITY', message: 'The image resolution or quality is too low. Please upload a clearer photo (at least 512×512 px).' };
  }
  // Timeout / slow model
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline')) {
    return { code: 'TIMEOUT', message: 'Processing took too long. Please try again in a moment.' };
  }
  // Rate limit / quota on vendor side
  if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many requests') ||
      msg.includes('429') || msg.includes('capacity')) {
    return { code: 'SERVICE_CAPACITY', message: 'Our try-on service is temporarily busy. Please try again in a few seconds.' };
  }
  // Credit / billing issues (should rarely surface here since credits are checked upfront)
  if (msg.includes('credit') || msg.includes('billing') || msg.includes('payment required') ||
      msg.includes('402')) {
    return { code: 'SERVICE_CAPACITY', message: 'Service is temporarily unavailable. Please try again shortly.' };
  }
  // Auth / HTTP failures against vendor APIs (FASHN uses "API error 400" without parentheses)
  if (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('(400)') ||
    msg.includes('api error 4') ||
    msg.includes('api error 5') ||
    msg.includes('invalid token') ||
    msg.includes('api key')
  ) {
    return { code: 'SERVICE_ERROR', message: 'An internal service error occurred. Our team has been notified.' };
  }
  // Storage / upload errors
  if (msg.includes('upload') || msg.includes('storage') || msg.includes('file') ||
      msg.includes('bucket') || msg.includes('s3') || msg.includes('blob')) {
    return { code: 'STORAGE_ERROR', message: 'Could not save your try-on result. Please try again.' };
  }
  // Transient network (Node fetch, Convex CDN, FASHN output URL, tfjs model hosts)
  if (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Connection was interrupted while processing. Check your network and try again in a few seconds.',
    };
  }
  // Default catch-all
  return { code: 'PROCESSING_FAILED', message: 'Try-on processing failed. Please try again or use a different photo.' };
}

// ─────────────────────────────────────────────────────────────────────────────

async function fetchUrlBufferWithRetry(url: string, label: string): Promise<Buffer> {
  const attempts = 4;
  let last: Error | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${label}: ${res.status} ${res.statusText}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      logger.warn('tryon: fetch retry', { label, attempt: i + 1, error: last.message });
      if (i + 1 < attempts) {
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    }
  }
  throw last ?? new Error(`Failed to fetch ${label}`);
}

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
      logger.info('tryon.pipeline: engine selected', { tryonDbId, garmentTopology, clothingEngine });
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
        // Credit was already atomically reserved by checkCredits at request start — no decrement here.
        // Email link is TryVerse's own domain, not the raw Convex storage URL — see routes/results.ts.
        sendTryOnCompletedEmail(userId, `${env.PUBLIC_API_URL}/api/results/tryon/${tryonDbId}`).catch((e) =>
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
    if (env.ENABLE_IMAGE_MODERATION === true) {
      try {
        const personDataUrl = bufferToDataUrl(personBuffer);
        const productDataUrl = bufferToDataUrl(productOptimized.buffer);
        const moderation = (await moderateTryOnImages(personDataUrl, productDataUrl)) as {
          safe: boolean;
          reason?: string;
          confidence?: number;
        };
        if (!moderation.safe) {
          // Only block if HIGH confidence — not borderline
          if (moderation.confidence !== undefined && moderation.confidence > 0.85) {
            await cxPatchTryon(tryonDbId, { status: 'failed' });
            return {
              jobId: job.jobId,
              status: 'failed',
              error: moderation.reason || 'Image failed content moderation',
            };
          }
          logger.warn('Moderation flagged but below confidence threshold — allowing', {
            tryonDbId,
            reason: moderation.reason,
          });
        }
      } catch (modErr) {
        logger.warn('Moderation check failed — defaulting to safe', {
          tryonDbId,
          error: String(modErr),
        });
        // Do not block — let pipeline continue
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

    const skipProductRembg =
      category === 'clothing' &&
      clothingEngine === 'fashn' &&
      env.TRYON_FASHN_SKIP_PRODUCT_BG_REMOVAL;

    const [personPreprocessed, productPreprocessed] = await Promise.all([
      preprocessPersonImage(personHttps),
      preprocessProductImage(productHttps, {
        skipBackgroundRemoval: skipProductRembg,
      }),
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
    let postProcessedApplied = false;

    for (let layoutAttempt = 0; layoutAttempt < MAX_LAYOUT_RETRIES; layoutAttempt++) {
      if (layoutAttempt > 0) {
        logger.warn('tryon: retry after bad output layout', { tryonDbId, layoutAttempt });
      }

      const poseType = inferPoseType(personW, personH);
      let compositeBuffer!: Buffer;

      // Near-identical output retry uses mean abs diff vs the input person — tuned for IDM-VTON + new seed.
      // FASHN (direct API) has no seed; subtle swaps can still score below the threshold at 72×72 → false failures.
      const maxVtonAttempts =
        category === 'clothing' && clothingEngine === 'idm_vton' ? 2 : 1;
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

        compositeBuffer = await fetchUrlBufferWithRetry(rawResultUrl, 'try-on result image');

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
      const useFaceLock =
        category === 'clothing' &&
        env.ENABLE_FACE_LOCK &&
        (clothingEngine !== 'fashn' || env.TRYON_FASHN_FACE_LOCK);

      if (useFaceLock) {
        const lockOpts =
          clothingEngine === 'fashn'
            ? { faceOnlyMode: true as const }
            : idmGarmentSlot === 'dresses'
              ? { dressMode: true as const }
              : undefined;
        const lock = await applyFaceLockFromPersonInput(personBuffer, compositeBuffer, lockOpts);
        compositeBuffer = Buffer.from(lock.buffer);
        faceLockApplied = lock.applied;
      }

      const postInputBuffer = compositeBuffer;
      postProcessedApplied = false;

      if (category === 'clothing' && clothingEngine === 'fashn') {
        if (env.TRYON_FASHN_LIGHT_POST) {
          const postResult = await postProcessResultBufferMinimal(postInputBuffer);
          finalBuffer = await addGarmentShadow(postResult.buffer);
          postProcessedApplied = true;
        } else if (env.ENABLE_POST_PROCESSING) {
          const postResult = await postProcessResultBuffer(postInputBuffer);
          finalBuffer = await addGarmentShadow(postResult.buffer);
          postProcessedApplied = true;
        } else {
          finalBuffer = postInputBuffer;
        }
      } else if (env.ENABLE_POST_PROCESSING) {
        const postResult = await postProcessResultBuffer(postInputBuffer);
        finalBuffer = await addGarmentShadow(postResult.buffer);
        postProcessedApplied = true;
      } else {
        finalBuffer = postInputBuffer;
      }

      const isFashnOutput = clothingEngine === 'fashn' || modelUsed === 'fashn-direct';

      const outputGate = await validateTryOnOutput(finalBuffer, {
        skipFlatnessCheck: false,
        flatnessVarianceMin: isFashnOutput ? env.TRYON_OUTPUT_FLATNESS_MIN_VARIANCE_FASHN : undefined,
      });
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

    // ── STEP 12: Credits already reserved atomically at request start — no decrement here.

    // ── STEP 12b: Send try-on completed email ──────────────────────────────
    // Email link is TryVerse's own domain, not the raw Convex storage URL — see routes/results.ts.
    if (userId) {
      sendTryOnCompletedEmail(userId, `${env.PUBLIC_API_URL}/api/results/tryon/${tryonDbId}`).catch((e) =>
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
        post_processed: postProcessedApplied,
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

    // Classify before logging so the code is included in structured logs
    const publicError = classifyTryOnError(error);

    // Full internal message is logged server-side and sent to Sentry — never to the client
    logger.error('AI pipeline failed', {
      tryonDbId,
      category,
      userId,
      errorCode: publicError.code,
      internalError: error.message, // raw vendor message stays server-side
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
        // Store the public code (not the raw vendor message) in usage events
        error_code: publicError.code,
      });
    }

    // Return only the sanitized public message — no vendor names, API details, or stack traces
    return { jobId: job.jobId, status: 'failed', error: publicError.message, errorCode: publicError.code };
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
