import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

/**
 * Verifies a Supabase JWT from the Authorization header.
 * Sets req.user = { id, email } on success.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = { id: user.id, email: user.email || '' };
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: String(err) });
    res.status(500).json({ error: 'Authentication service error' });
  }
}

/**
 * Optional auth — populates req.user if a valid token is present,
 * but does not block the request if absent.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      req.user = { id: user.id, email: user.email || '' };
    }
  } catch {
    // silently continue without user
  }
  next();
}

/**
 * Admin-only guard — checks for X-Admin-Key header.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
