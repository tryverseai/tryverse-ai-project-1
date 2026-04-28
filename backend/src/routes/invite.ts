import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const router = Router();

function parseTokenMap(): Record<string, string> {
  try {
    const raw = env.INVITE_TOKEN_MAP_JSON?.trim() || '{}';
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim()) {
        out[k.trim()] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * GET /api/invite/validate?token=...
 * Public. Maps token → email via INVITE_TOKEN_MAP_JSON (server env). Not part of API user auth.
 * Convex profile/bootstrap flows are unchanged; this only gates who may use the invite signup page.
 */
router.get('/validate', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = String(req.query.token ?? '').trim();
    if (!token) {
      res.json({ valid: false as const });
      return;
    }
    const email = parseTokenMap()[token];
    if (!email) {
      res.json({ valid: false as const });
      return;
    }
    res.json({ valid: true as const, email });
  } catch (err) {
    next(err);
  }
});

export default router;
