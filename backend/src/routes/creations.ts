import { Router, Request, Response, NextFunction } from 'express';
import { param } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { anyApi, convexQueryTrusted, convexMutationTrusted } from '../config/convexHttp';
import { getSignedUrl, RESULT_BUCKET, removeInferenceScratchPaths } from '../services/storage/images';
import { archiveSavedAiModel } from '../services/ai/modelGeneration';

const router = Router();

/**
 * "My Creations" — a single, unified read of everything a brand has generated across every
 * TryVerse tool (Try-On, Outfit Builder, AI Model Studio, AI Product Photoshoot, AI Video, AI
 * Models). Each tool's own tab keeps its own working state during a session, but that state is
 * never persisted client-side — this endpoint is the durable record, so a result a brand
 * generated still shows up after a refresh, a new device, or a new login.
 */

type CreationType = 'tryon' | 'outfit' | 'product_model' | 'photoshoot' | 'video' | 'ai_model';

interface CreationItem {
  id: string;
  type: CreationType;
  status: string;
  resultUrl: string | null;
  isVideo: boolean;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

async function signOrNull(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    return await getSignedUrl(RESULT_BUCKET, path);
  } catch (err) {
    logger.warn('My Creations: failed to sign a result URL', { path, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * My Creations spans six independently-timestamped Convex tables. True cross-table cursor
 * pagination fetches a bounded `limit` window from EACH source (via the `by_user_created` index
 * range, never a full-table scan or fetch-everything-then-slice), merges the six already-sorted
 * windows, and returns only the newest `limit` overall. The cursor returned to the client is the
 * createdAt of the oldest item shown — passed back as `before` so every source's next fetch
 * resumes exactly where it left off, regardless of how unevenly creations are distributed across
 * types.
 */
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const before = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.limit ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

    const pageArgs = { secret: env.BACKEND_SHARED_SECRET, userId, before, limit };

    const [tryons, outfits, productModels, photoshoots, videos, aiModels] = await Promise.all([
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listTryonsForUserPage,
        pageArgs
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listOutfitGenerationsForUserPage,
        pageArgs
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listProductModelGenerationsForUserPage,
        pageArgs
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listPhotoshootGenerationsForUserPage,
        pageArgs
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultVideo: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listVideoGenerationsForUserPage,
        pageArgs
      ),
      convexQueryTrusted<Array<{ id: string; storagePath: string; createdAt: string }>>(
        anyApi.backendTrusted.listGeneratedAiModelsForUserPage,
        pageArgs
      ),
    ]);

    // A source is not yet exhausted if its bounded fetch came back completely full — there may be
    // more beyond this window even if none of it makes the cut for the page we return below.
    const sourceFetchCounts = [tryons.length, outfits.length, productModels.length, photoshoots.length, videos.length, aiModels.length];
    const anySourceAtCap = sourceFetchCounts.some((n) => n === limit);

    type Candidate = { createdAt: string; build: () => Promise<CreationItem> };
    const candidates: Candidate[] = [];

    for (const t of tryons) {
      if (t.status !== 'completed' || !t.resultImage) continue;
      candidates.push({
        createdAt: t.createdAt,
        build: async () => ({
          id: t.id, type: 'tryon', status: t.status, resultUrl: await signOrNull(t.resultImage),
          isVideo: false, createdAt: t.createdAt, completedAt: t.completedAt, error: null,
        }),
      });
    }
    for (const o of outfits) {
      if (o.status !== 'completed' || !o.resultImage) continue;
      candidates.push({
        createdAt: o.createdAt,
        build: async () => ({
          id: o.id, type: 'outfit', status: o.status, resultUrl: await signOrNull(o.resultImage),
          isVideo: false, createdAt: o.createdAt, completedAt: o.completedAt, error: null,
        }),
      });
    }
    for (const p of productModels) {
      if (p.status !== 'completed' || !p.resultImage) continue;
      candidates.push({
        createdAt: p.createdAt,
        build: async () => ({
          id: p.id, type: 'product_model', status: p.status, resultUrl: await signOrNull(p.resultImage),
          isVideo: false, createdAt: p.createdAt, completedAt: p.completedAt, error: null,
        }),
      });
    }
    for (const ps of photoshoots) {
      if (ps.status !== 'completed' || !ps.resultImage) continue;
      candidates.push({
        createdAt: ps.createdAt,
        build: async () => ({
          id: ps.id, type: 'photoshoot', status: ps.status, resultUrl: await signOrNull(ps.resultImage),
          isVideo: false, createdAt: ps.createdAt, completedAt: ps.completedAt, error: null,
        }),
      });
    }
    for (const v of videos) {
      if (v.status !== 'completed' || !v.resultVideo) continue;
      candidates.push({
        createdAt: v.createdAt,
        build: async () => ({
          id: v.id, type: 'video', status: v.status, resultUrl: await signOrNull(v.resultVideo),
          isVideo: true, createdAt: v.createdAt, completedAt: v.completedAt, error: null,
        }),
      });
    }
    for (const m of aiModels) {
      candidates.push({
        createdAt: m.createdAt,
        build: async () => ({
          id: m.id, type: 'ai_model', status: 'completed', resultUrl: await signOrNull(m.storagePath),
          isVideo: false, createdAt: m.createdAt, completedAt: m.createdAt, error: null,
        }),
      });
    }

    candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = candidates.slice(0, limit);
    const items = await Promise.all(page.map((c) => c.build()));

    const hasMore = candidates.length > limit || anySourceAtCap;
    const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

    res.json({ creations: items, nextCursor: hasMore ? nextCursor : null, hasMore });
  } catch (err) {
    logger.error('My Creations: list failed', { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
    next(err);
  }
});

router.delete(
  '/:type/:id',
  requireAuth,
  [param('type').isIn(['tryon', 'outfit', 'product_model', 'photoshoot', 'video', 'ai_model']), param('id').isString().trim().notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const type = req.params.type as CreationType;
      const id = String(req.params.id);

      if (type === 'ai_model') {
        await archiveSavedAiModel(userId, id);
        res.json({ ok: true });
        return;
      }

      if (type === 'tryon') {
        const result = (await convexMutationTrusted(anyApi.backendTrusted.deleteTryonByLegacyIdForUser, {
          secret: env.BACKEND_SHARED_SECRET,
          legacyId: id,
          userId,
        })) as { deleted: boolean };
        if (!result.deleted) throw new AppError('Creation not found', 404);
        res.json({ ok: true });
        return;
      }

      let result: { deleted: boolean; resultPath: string | null };
      switch (type) {
        case 'outfit':
          result = (await convexMutationTrusted(anyApi.backendTrusted.deleteOutfitGenerationForUser, {
            secret: env.BACKEND_SHARED_SECRET,
            userId,
            id,
          })) as { deleted: boolean; resultPath: string | null };
          break;
        case 'product_model':
          result = (await convexMutationTrusted(anyApi.backendTrusted.deleteProductModelGenerationForUser, {
            secret: env.BACKEND_SHARED_SECRET,
            userId,
            id,
          })) as { deleted: boolean; resultPath: string | null };
          break;
        case 'photoshoot':
          result = (await convexMutationTrusted(anyApi.backendTrusted.deletePhotoshootGenerationForUser, {
            secret: env.BACKEND_SHARED_SECRET,
            userId,
            id,
          })) as { deleted: boolean; resultPath: string | null };
          break;
        case 'video':
          result = (await convexMutationTrusted(anyApi.backendTrusted.deleteVideoGenerationForUser, {
            secret: env.BACKEND_SHARED_SECRET,
            userId,
            id,
          })) as { deleted: boolean; resultPath: string | null };
          break;
        default:
          throw new AppError('Unknown creation type', 400);
      }
      if (!result.deleted) throw new AppError('Creation not found', 404);
      if (result.resultPath) {
        await removeInferenceScratchPaths([result.resultPath]);
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error('My Creations: delete failed', { error: err instanceof Error ? err.message : String(err) });
      next(err instanceof AppError ? err : new AppError('Could not delete this creation right now', 502));
    }
  }
);

/**
 * "Save as model" — the Brand Library write path. Promotes a completed result (try-on, outfit,
 * photoshoot, or product-model output) into a reusable saved model, which then shows up in
 * ModelPickerGrid everywhere a model can be picked (Personal Studio, AI Photoshoot, Outfit
 * Builder) exactly like a model made in AI Model Studio. Not offered for `video` (not an image)
 * or `ai_model` (already a model).
 */
router.post(
  '/:type/:id/promote-to-model',
  requireAuth,
  [param('type').isIn(['tryon', 'outfit', 'photoshoot', 'product_model']), param('id').isString().trim().notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const type = req.params.type as 'tryon' | 'outfit' | 'photoshoot' | 'product_model';
      const id = String(req.params.id);

      const result = (await convexMutationTrusted(anyApi.backendTrusted.promoteResultToModel, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        type,
        id,
      })) as { id: string };

      res.json({ ok: true, modelId: result.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not_found')) {
        next(new AppError('Creation not found', 404));
        return;
      }
      if (msg.includes('no_result_image')) {
        next(new AppError('This result has no image to save as a model', 400));
        return;
      }
      logger.error('My Creations: promote-to-model failed', { error: msg });
      next(new AppError('Could not save this as a model right now', 502));
    }
  }
);

export default router;
