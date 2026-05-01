import { Router, Request, Response, NextFunction } from 'express';
import { inviteValidateRateLimit } from '../middleware/rateLimiter';
import { resolveInviteGate } from '../lib/inviteGate';

const router = Router();

/**
 * GET /api/invite/validate?token=...
 * Legacy mount — forwards to shared resolver (INVITE_TOKEN_MAP_JSON + Convex lifecycle).
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

export default router;
