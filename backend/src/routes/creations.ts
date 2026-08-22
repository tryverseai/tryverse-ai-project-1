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

router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [tryonsRes, outfits, productModels, photoshoots, videos, aiModels] = await Promise.all([
      convexQueryTrusted<{ tryons: Array<{ id: string; status: string; result_image: string | null; created_at: string | null; completed_at: string | null }> }>(
        anyApi.backendTrusted.listTryonsForUserCursor,
        { secret: env.BACKEND_SHARED_SECRET, userId, numItems: 100, cursor: null }
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listOutfitGenerationsForUser,
        { secret: env.BACKEND_SHARED_SECRET, userId }
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listProductModelGenerationsForUser,
        { secret: env.BACKEND_SHARED_SECRET, userId }
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultImage: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listPhotoshootGenerationsForUser,
        { secret: env.BACKEND_SHARED_SECRET, userId }
      ),
      convexQueryTrusted<Array<{ id: string; status: string; resultVideo: string | null; error: string | null; createdAt: string; completedAt: string | null }>>(
        anyApi.backendTrusted.listVideoGenerationsForUser,
        { secret: env.BACKEND_SHARED_SECRET, userId }
      ),
      convexQueryTrusted<Array<{ id: string; storagePath: string; createdAt: string }>>(
        anyApi.backendTrusted.listGeneratedAiModels,
        { secret: env.BACKEND_SHARED_SECRET, userId }
      ),
    ]);

    const items: CreationItem[] = [];

    for (const t of tryonsRes.tryons) {
      if (t.status !== 'completed' || !t.result_image) continue;
      items.push({
        id: t.id,
        type: 'tryon',
        status: t.status,
        resultUrl: await signOrNull(t.result_image),
        isVideo: false,
        createdAt: t.created_at ?? '',
        completedAt: t.completed_at ?? null,
        error: null,
      });
    }
    for (const o of outfits) {
      if (o.status !== 'completed' || !o.resultImage) continue;
      items.push({
        id: o.id,
        type: 'outfit',
        status: o.status,
        resultUrl: await signOrNull(o.resultImage),
        isVideo: false,
        createdAt: o.createdAt,
        completedAt: o.completedAt,
        error: null,
      });
    }
    for (const p of productModels) {
      if (p.status !== 'completed' || !p.resultImage) continue;
      items.push({
        id: p.id,
        type: 'product_model',
        status: p.status,
        resultUrl: await signOrNull(p.resultImage),
        isVideo: false,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
        error: null,
      });
    }
    for (const ps of photoshoots) {
      if (ps.status !== 'completed' || !ps.resultImage) continue;
      items.push({
        id: ps.id,
        type: 'photoshoot',
        status: ps.status,
        resultUrl: await signOrNull(ps.resultImage),
        isVideo: false,
        createdAt: ps.createdAt,
        completedAt: ps.completedAt,
        error: null,
      });
    }
    for (const v of videos) {
      if (v.status !== 'completed' || !v.resultVideo) continue;
      items.push({
        id: v.id,
        type: 'video',
        status: v.status,
        resultUrl: await signOrNull(v.resultVideo),
        isVideo: true,
        createdAt: v.createdAt,
        completedAt: v.completedAt,
        error: null,
      });
    }
    for (const m of aiModels) {
      items.push({
        id: m.id,
        type: 'ai_model',
        status: 'completed',
        resultUrl: await signOrNull(m.storagePath),
        isVideo: false,
        createdAt: m.createdAt,
        completedAt: m.createdAt,
        error: null,
      });
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ creations: items });
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

export default router;
