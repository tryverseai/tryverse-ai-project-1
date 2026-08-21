import { Router, Request, Response, NextFunction } from 'express';
import { param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validate';
import { env } from '../config/env';
import { anyApi, convexQueryTrusted } from '../config/convexHttp';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/results/tryon/:id
 * TryVerse-controlled result link used in result-ready emails, instead of the raw Convex storage
 * URL. Fetches the asset server-side and streams it back under this API's own domain — the
 * browser/email client never sees the storage provider's host. The try-on's own (high-entropy,
 * non-sequential) legacy ID is the access token, so this deliberately has no session requirement —
 * it must work when opened from an email client with no TryVerse session.
 */
router.get(
  '/tryon/:id',
  [param('id').isString().trim().isLength({ min: 4, max: 128 })],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const row = await convexQueryTrusted<{ result_image: string } | null>(
        anyApi.backendTrusted.getTryonResultForPublicLink,
        { secret: env.BACKEND_SHARED_SECRET, legacyId: id }
      );
      if (!row) {
        res.status(404).type('text/plain').send('Result not found or no longer available.');
        return;
      }

      const signedUrl = await getSignedUrl(RESULT_BUCKET, row.result_image);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        res.status(502).type('text/plain').send('Could not load this result right now.');
        return;
      }

      res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=3600');
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      logger.error('Result proxy failed', { error: err instanceof Error ? err.message : String(err) });
      next(err);
    }
  }
);

export default router;
