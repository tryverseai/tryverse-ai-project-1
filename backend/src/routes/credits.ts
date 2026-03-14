import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { getCreditSummary } from '../services/credits';

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
      const summary = await getCreditSummary(req.user!.id);
      if (!summary) {
        res.status(404).json({ error: 'User profile not found' });
        return;
      }
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
