import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validate';
import { inviteCompleteRateLimit, inviteValidateRateLimit } from '../middleware/rateLimiter';
import { resolveInviteGate } from '../lib/inviteGate';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';
import { env } from '../config/env';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/auth/invite/validate?token=...
 * Public — valid only when Convex invite lifecycle status is sent (plus legacy INVITE_TOKEN_MAP_JSON).
 */
router.get('/validate', inviteValidateRateLimit, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = String(req.query.token ?? '').trim();
    if (!token) {
      res.json({ valid: false as const });
      return;
    }
    const gate = await resolveInviteGate(token);
    if (!gate.valid) {
      res.json({ valid: false as const });
      return;
    }
    res.json({
      valid: true as const,
      email: gate.email,
      ...(gate.name ? { name: gate.name } : {}),
      ...(gate.accountType ? { accountType: gate.accountType } : {}),
      ...(gate.companyName ? { companyName: gate.companyName } : {}),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/invite/complete
 * After successful signup — marks Convex lifecycle invite accepted when applicable.
 */
router.post(
  '/complete',
  inviteCompleteRateLimit,
  [
    body('token').trim().isLength({ min: 10, max: 200 }),
    body('email').trim().isEmail().isLength({ max: 254 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = String((req.body as { token?: string }).token ?? '').trim();
      const email = String((req.body as { email?: string }).email ?? '')
        .trim()
        .toLowerCase();

      const row = await convexQueryTrusted<{
        email: string;
        status: string;
      } | null>(anyApi.invites.getInviteByTokenTrusted, {
        secret: env.BACKEND_SHARED_SECRET,
        token,
      });

      if (!row) {
        res.json({ ok: true as const, skipped: true as const });
        return;
      }
      if (row.status !== 'sent') {
        res.status(400).json({ error: 'Invitation is no longer active' });
        return;
      }
      if (String(row.email).toLowerCase() !== email) {
        res.status(400).json({ error: 'Email does not match invitation' });
        return;
      }

      try {
        await convexMutationTrusted(anyApi.invites.markInviteAcceptedTrusted, {
          secret: env.BACKEND_SHARED_SECRET,
          token,
        });
      } catch (e) {
        logger.warn('markInviteAccepted failed', { error: String(e), token: token.slice(0, 12) });
        res.status(409).json({ error: 'Could not finalize invitation' });
        return;
      }

      res.json({ ok: true as const });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
