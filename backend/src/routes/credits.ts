import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, convexProfileCreditLookupKey } from '../middleware/auth';
import { getCreditSummary } from '../services/credits';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/credits
 * Returns the authenticated user's credit balance and usage summary.
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await getCreditSummary(convexProfileCreditLookupKey(req));
      if (!summary) {
        logger.warn('credits: user profile not found', { userId: req.user!.id });
        res.status(404).json({ error: 'User profile not found' });
        return;
      }
      res.json(summary);
    } catch (err) {
      logger.error('credits: failed to fetch credit summary', {
        userId: req.user?.id,
        error: String(err),
      });
      next(err);
    }
  }
);

export default router;
