import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { logAudit } from '../services/audit';
import { captureAuthError, Sentry } from '../config/sentry';

/**
 * Verifies a Supabase JWT from the Authorization header.
 * Sets req.user = { id, email } on success.
 * Logs failed auth attempts for security monitoring.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logAudit({
      event_type: 'failed_login',
      actor: req.ip ? `ip:${req.ip}` : undefined,
      action: 'missing_auth_header',
      details: { path: req.path },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
    captureAuthError('Missing or invalid authorization header', { path: req.path, ip: req.ip });
    logger.warn('Auth failed: missing or invalid authorization header', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      logAudit({
        event_type: 'failed_login',
        actor: req.ip ? `ip:${req.ip}` : undefined,
        action: 'invalid_token',
        details: { path: req.path, error: error?.message },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      captureAuthError('Invalid or expired token', { path: req.path, ip: req.ip, error: error?.message });
      logger.warn('Auth failed: invalid or expired token', {
        path: req.path,
        ip: req.ip,
        error: error?.message,
      });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = { id: user.id, email: user.email || '' };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_blocked')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      logger.warn('Auth: profile lookup failed (is_blocked)', {
        userId: user.id,
        error: profileError.message,
      });
      // If column missing until migration, continue; otherwise surface error
      if (!profileError.message?.includes('column') && !profileError.message?.includes('schema cache')) {
        res.status(500).json({ error: 'Profile check failed' });
        return;
      }
    } else if (profile?.is_blocked) {
      logAudit({
        event_type: 'failed_login',
        actor: user.id,
        action: 'account_suspended',
        details: { path: req.path },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
      return;
    }

    next();
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    if (env.SENTRY_DSN) {
      Sentry.captureException(errObj, {
        tags: { feature: 'auth', type: 'auth_middleware_error' },
        extra: { path: req.path },
      });
    }
    logger.error('Auth middleware error', { error: String(err), path: req.path });
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
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('is_blocked')
        .eq('id', user.id)
        .maybeSingle();
      if (!profileError && profile?.is_blocked) {
        res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
        return;
      }
      req.user = { id: user.id, email: user.email || '' };
    }
  } catch {
    // silently continue without user
  }
  next();
}

/**
 * Admin-only guard — checks for X-Admin-Key header.
 * Uses centralized env config (never process.env directly).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== env.ADMIN_SECRET_KEY) {
    logAudit({
      event_type: 'failed_login',
      actor: req.ip ? `ip:${req.ip}` : undefined,
      action: 'admin_access_denied',
      details: { path: req.path },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
    logger.warn('Admin access denied', { path: req.path, ip: req.ip });
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
