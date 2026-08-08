import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, matchedData } from 'express-validator';
import { normalizeAdminKeyInput } from '../lib/adminKey';
import { requireAdmin } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { logger } from '../config/logger';
import { anyApi, convexQueryTrusted, convexMutationTrusted } from '../config/convexHttp';
import { cxGetProfile, cxPatchProfile } from '../services/creditsConvexBridge';
import { cxPatchTryon } from '../services/tryonConvexBridge';
import { getTryOnQueue } from '../services/queue/producer';
import { enqueueTryOnJob } from '../services/queue/producer';
import { executeTryOnPipeline } from '../services/ai/pipeline';
import { env } from '../config/env';
import { getRecentLogs, clearLogBuffer } from '../config/logBuffer';
import { logAudit } from '../services/audit';
import { AppError } from '../middleware/errorHandler';
import { listAllModelsForAdmin } from '../services/models/modelLibrary';
import { sendEmail } from '../services/email/resend';
import { businessInviteBodies, FIXED_FROM, personalInviteBodies } from '../email/inviteEmailBodies';

const router = Router();

function convexFunctionMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Could not find public function/i.test(msg);
}

/** When `listPendingBetaAccessAdmin` is not deployed yet, derive pending beta users from `adminListProfiles`. */
async function betaPendingFallbackFromProfiles(): Promise<{
  profiles: Array<{
    userId: string;
    full_name?: string | null;
    contact_email?: string | null;
    brand_name?: string | null;
    account_type: string;
    created_at?: string | null;
    beta_requested_at?: string | null;
  }>;
}> {
  const out = await convexQueryTrusted<{
    profiles: Array<Record<string, unknown>>;
    total: number;
  }>(anyApi.adminTrusted.adminListProfiles, {
    secret: env.BACKEND_SHARED_SECRET,
    limit: 8000,
    offset: 0,
  });
  const pending = out.profiles
    .filter((p) => p.beta_rejected !== true && p.beta_approved !== true)
    .map((p) => ({
      userId: String(p.id),
      full_name: (p.full_name as string | undefined) ?? null,
      contact_email: (p.contact_email as string | undefined) ?? null,
      brand_name: (p.brand_name as string | undefined) ?? null,
      account_type: String(p.account_type ?? 'business'),
      created_at: (p.created_at as string | undefined) ?? null,
      beta_requested_at: (p.beta_requested_at as string | undefined) ?? null,
    }))
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

  const needsEmail = pending.filter((row) => !(row.contact_email && String(row.contact_email).trim()));
  let emailMap: Record<string, string | null> = {};
  if (needsEmail.length > 0) {
    try {
      emailMap = await convexQueryTrusted<Record<string, string | null>>(anyApi.adminTrusted.batchResolveAuthEmailsAdmin, {
        secret: env.BACKEND_SHARED_SECRET,
        profileIds: needsEmail.map((row) => row.userId),
      });
    } catch (e) {
      if (!convexFunctionMissing(e)) {
        logger.warn('admin beta-pending: batchResolveAuthEmailsAdmin failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      // Old deploy: show rows without auth email enrichment
    }
  }

  const merged = pending.map((row) => ({
    ...row,
    contact_email:
      row.contact_email && String(row.contact_email).trim()
        ? row.contact_email
        : emailMap[row.userId] ?? null,
  }));
  return { profiles: merged };
}

/** When dedicated beta mutations are absent on the Convex deployment, patch via backendTrusted.patchProfileRow (stable). */
async function betaApproveViaPatchProfile(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await cxPatchProfile(userId, {
    beta_approved: true,
    beta_approved_at: now,
    beta_rejected: false,
    updated_at: now,
  });
}

async function betaRejectViaPatchProfile(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await cxPatchProfile(userId, {
    beta_rejected: true,
    beta_rejected_at: now,
    updated_at: now,
  });
}

/**
 * Block/unblock: updates profiles.is_blocked (enforced in requireAuth).
 */
async function setUserBlockedState(userId: string, blocked: boolean, req: Request): Promise<void> {
  const profileRow = await convexQueryTrusted<{
    id: string;
    brand_name: string | null;
    contact_email: string | null;
    full_name: string | null;
  } | null>(anyApi.adminTrusted.getProfileForAdminBlock, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
  });
  if (!profileRow) {
    throw new AppError('User not found', 404);
  }

  await cxPatchProfile(userId, {
    is_blocked: blocked,
    updated_at: new Date().toISOString(),
  });

  const brand = profileRow.brand_name?.trim() || null;
  const email = profileRow.contact_email?.trim() || null;
  const fullName = profileRow.full_name?.trim() || null;
  const displayLabel = [brand, email || fullName].filter(Boolean).join(' · ') || userId;
  const summary = blocked
    ? `Blocked user ${displayLabel}: API access denied (profiles.is_blocked).`
    : `Unblocked user ${displayLabel}: profiles.is_blocked cleared.`;

  await logAudit({
    event_type: 'admin_action',
    actor: 'admin',
    action: blocked ? 'user_banned' : 'user_unbanned',
    target_id: userId,
    details: {
      summary,
      target_user_id: userId,
      target_brand_name: brand,
      target_email: email,
      target_full_name: fullName,
      blocked,
    },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });
  logger.info(`Admin: User ${blocked ? 'banned' : 'unbanned'}`, { userId, displayLabel });
}

// ─── Session management (unauthenticated — these create / destroy sessions) ──
import {
  createAdminSession,
  revokeAdminSession,
  validateAndRefreshSession,
  parseCookie,
  ADMIN_SESSION_COOKIE,
} from '../services/adminSession';

/**
 * Vercel (tryverseai.com) + Railway API (*.railway.app) = cross-site fetches.
 * SameSite=Strict/Lax cookies are not sent on those requests; admin must use SameSite=None + Secure.
 */
function adminSessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'none' | 'lax';
  secure: boolean;
  maxAge: number;
  path: string;
} {
  const prod = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: prod ? 'none' : 'lax',
    secure: prod,
    maxAge: 15 * 60 * 1000, // 15 minutes (ms for Express res.cookie)
    path: '/api/admin',
  };
}

/**
 * POST /api/admin/session
 * Validates the admin key and issues an HttpOnly session cookie.
 * Replaces the previous pattern of storing the raw key in sessionStorage.
 */
router.post(
  '/session',
  [
    body('key')
      .customSanitizer((v) => normalizeAdminKeyInput(v))
      .notEmpty()
      .withMessage('key is required')
      .isLength({ max: 4096 })
      .withMessage('key is too long'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    const submitted = normalizeAdminKeyInput((req.body as { key?: string }).key);
    if (submitted !== env.ADMIN_SECRET_KEY) {
      logAudit({
        event_type: 'failed_login',
        actor: req.ip ? `ip:${req.ip}` : undefined,
        action: 'admin_session_create_denied',
        details: { reason: 'invalid_key' },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      logger.warn('Admin session: invalid key', {
        ip: req.ip,
        submittedLen: submitted.length,
        expectedLen: env.ADMIN_SECRET_KEY.length,
      });
      res.status(403).json({ error: 'Invalid admin key' });
      return;
    }
    const token = await createAdminSession();
    res.cookie(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
    logAudit({
      event_type: 'admin_login',
      actor: req.ip ? `ip:${req.ip}` : undefined,
      action: 'admin_session_created',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  }
);

/**
 * DELETE /api/admin/session
 * Revokes the current session and clears the cookie.
 */
router.delete('/session', async (req: Request, res: Response): Promise<void> => {
  const token = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  await revokeAdminSession(token);
  const cookieOpts = adminSessionCookieOptions();
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    path: cookieOpts.path,
    sameSite: cookieOpts.sameSite,
    secure: cookieOpts.secure,
  });
  res.json({ ok: true });
});

/**
 * GET /api/admin/session/check
 * Returns 200 if the session cookie is valid; 401 otherwise.
 * Used by the frontend on page mount to restore admin state without re-entering the key.
 */
router.get('/session/check', async (req: Request, res: Response): Promise<void> => {
  const token = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (await validateAndRefreshSession(token)) {
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false });
});

// ─── All subsequent routes require a valid session ────────────────────────────
router.use(requireAdmin);

/**
 * GET /api/admin/model-library
 * Full model catalog (active + inactive) for admin review.
 */
router.get('/model-library', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    const models = await listAllModelsForAdmin();
    res.json({ models });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/model-library/:id
 * Toggle catalog visibility (is_active) and free-tier preset access (free_tier_eligible).
 */
router.patch(
  '/model-library/:id',
  [
    // Convex rows often use Convex document IDs; legacy rows may still use UUID strings.
    param('id')
      .trim()
      .notEmpty()
      .isLength({ min: 8, max: 128 })
      .matches(/^[-a-zA-Z0-9_]+$/)
      .withMessage('id must be a legacy model UUID or Convex document id'),
    body('is_active').optional().isBoolean(),
    body('free_tier_eligible').optional().isBoolean(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = matchedData(req) as { id: string };
      const b = matchedData(req) as { is_active?: boolean; free_tier_eligible?: boolean };
      const patch: Record<string, boolean> = {};
      if (typeof b.is_active === 'boolean') patch.is_active = b.is_active;
      if (typeof b.free_tier_eligible === 'boolean') patch.free_tier_eligible = b.free_tier_eligible;
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: 'Provide is_active and/or free_tier_eligible (boolean).' });
        return;
      }
      const row = await convexQueryTrusted<{ id: string; slug: string; display_name: string } | null>(
        anyApi.backendTrusted.getModelLibraryRowByLegacyId,
        { secret: env.BACKEND_SHARED_SECRET, legacyId: id }
      );
      if (!row) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      await convexMutationTrusted(anyApi.backendTrusted.patchModelLibraryByLegacyId, {
        secret: env.BACKEND_SHARED_SECRET,
        legacyId: id,
        patch,
      });
      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'model_library_update',
        target_id: id,
        details: {
          summary: `Updated model ${row.display_name} (${row.slug}): ${JSON.stringify(patch)}`,
          model_id: id,
          slug: row.slug,
          patch,
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.json({ ok: true, id, ...patch });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/model-library/bulk-free-tier
 * Unlock presets for free-plan users: all in-catalog, every DB row (testing), or defaults (Diane + Andrew).
 */
router.post(
  '/model-library/bulk-free-tier',
  [
    body('mode')
      .isIn(['all_in_catalog', 'defaults_only', 'all_rows'])
      .withMessage('mode must be all_in_catalog, defaults_only, or all_rows'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mode } = matchedData(req) as {
        mode: 'all_in_catalog' | 'defaults_only' | 'all_rows';
      };
      const result = (await convexMutationTrusted(anyApi.backendTrusted.bulkSetModelLibraryFreeTier, {
        secret: env.BACKEND_SHARED_SECRET,
        mode,
      })) as { ok: true; updated: number };
      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'model_library_bulk_free_tier',
        target_id: 'model_library',
        details: {
          summary: `Bulk free-tier preset access: ${mode} (${result.updated} rows updated)`,
          mode,
          rows_updated: result.updated,
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.json({ ok: true, mode, updated: result.updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/metrics
 * High-level platform metrics dashboard.
 */
router.get('/metrics', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bundle = await convexQueryTrusted<{
      totalUsers: number;
      totalTryons: number;
      activeSubscriptions: number;
      tryonsToday: number;
      tryonsThisMonth: number;
      completedTryons: number;
      revenueData: Array<{ amount: number; currency: string }>;
      usageOverTime: Array<{ date: string; tryons: number; newUsers: number }>;
    }>(anyApi.adminTrusted.adminMetricsBundle, { secret: env.BACKEND_SHARED_SECRET });

    const successRate =
      bundle.totalTryons > 0
        ? Math.round((bundle.completedTryons / bundle.totalTryons) * 100)
        : 0;

    const revenueNGN = bundle.revenueData
      .filter((p) => p.currency === 'NGN')
      .reduce((sum, p) => sum + p.amount, 0);
    const revenueUSD = bundle.revenueData
      .filter((p) => p.currency === 'USD')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      users: { total: bundle.totalUsers },
      tryons: {
        total: bundle.totalTryons,
        today: bundle.tryonsToday,
        thisMonth: bundle.tryonsThisMonth,
        successRate,
      },
      subscriptions: { active: bundle.activeSubscriptions },
      revenue: { ngn: revenueNGN, usd: revenueUSD, totalPayments: bundle.revenueData.length },
      usageOverTime: bundle.usageOverTime,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users
 * Lists all users with their plan and usage info.
 */
router.get(
  '/users',
  [
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('search').optional().isString().trim().isLength({ max: 80 }),
    query('accountType').optional().isIn(['business', 'individual', 'all']),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = matchedData(req) as {
        limit?: number;
        page?: number;
        search?: string;
        accountType?: 'business' | 'individual' | 'all';
      };
      const limit = Math.min(q.limit ?? 50, 200);
      const page = Math.max(q.page ?? 1, 1);
      const offset = (page - 1) * limit;
      const searchRaw = q.search;
      // Sanitize: alphanumeric, spaces, @.- allowed; max 80 chars (prevents injection and DoS)
      const search = searchRaw
        ? String(searchRaw).slice(0, 80).replace(/[^a-zA-Z0-9@.\s-]/g, '').trim() || undefined
        : undefined;

      const at = q.accountType || 'all';
      const { profiles, total } = await convexQueryTrusted<{
        profiles: Array<Record<string, unknown>>;
        total: number;
      }>(anyApi.adminTrusted.adminListProfiles, {
        secret: env.BACKEND_SHARED_SECRET,
        limit,
        offset,
        search,
        accountType: at === 'all' ? undefined : at,
      });

      const usersWithBan = profiles.map((profile) => ({
        ...profile,
        is_banned: Boolean(profile.is_blocked),
      }));

      res.json({
        users: usersWithBan,
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit) || 1) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/tryons
 * Lists all try-on jobs with status and brand info.
 */
router.get('/tryons', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const { tryons: rows, total } = await convexQueryTrusted<{
      tryons: Array<Record<string, unknown>>;
      total: number;
    }>(anyApi.adminTrusted.adminListTryons, {
      secret: env.BACKEND_SHARED_SECRET,
      limit,
      offset,
      status,
    });

    res.json({
      tryons: rows,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit) || 1) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/revenue
 * Revenue breakdown by provider, currency, and date.
 */
router.get('/revenue', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const days = Math.min(parseInt(String(req.query.days || '30'), 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const payments = await convexQueryTrusted<
      Array<{ amount: number; currency: string; provider: string; status: string; created_at: string }>
    >(anyApi.adminTrusted.adminPaymentsSince, {
      secret: env.BACKEND_SHARED_SECRET,
      sinceIso: since,
    });
    const successful = payments.filter((p) => p.status === 'success');

    const byProvider: Record<string, { count: number; amountNGN: number; amountUSD: number }> = {};
    const dailyMap: Record<string, number> = {};

    for (const p of successful) {
      if (!byProvider[p.provider]) {
        byProvider[p.provider] = { count: 0, amountNGN: 0, amountUSD: 0 };
      }
      byProvider[p.provider].count++;
      if (p.currency === 'NGN') byProvider[p.provider].amountNGN += p.amount;
      if (p.currency === 'USD') byProvider[p.provider].amountUSD += p.amount;

      const day = p.created_at.slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + (p.currency === 'USD' ? p.amount * 1500 : p.amount);
    }

    const dailyRevenue = Object.entries(dailyMap)
      .map(([date, totalNGN]) => ({ date, totalNGN }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recentPayments = await convexQueryTrusted<unknown[]>(anyApi.adminTrusted.adminRecentPayments, {
      secret: env.BACKEND_SHARED_SECRET,
      limit: 20,
    });

    res.json({
      period: { days },
      byProvider,
      dailyRevenue,
      totalTransactions: successful.length,
      recentPayments: recentPayments || [],
    });
  } catch (err) {
    next(err);
  }
});

/** Bull queue stats — never hang waiting on Redis (common when REDIS_URL points at nothing). */
const QUEUE_STATS_TIMEOUT_MS = 5000;

/**
 * GET /api/admin/queue
 * Bull queue health and stats.
 */
router.get('/queue', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queue = getTryOnQueue();
    if (!queue) {
      res.json({ status: 'unavailable', message: 'Redis not connected' });
      return;
    }

    const statsPromise = Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('queue_stats_timeout')), QUEUE_STATS_TIMEOUT_MS);
    });

    let waiting: number;
    let active: number;
    let completed: number;
    let failed: number;
    let delayed: number;
    try {
      [waiting, active, completed, failed, delayed] = await Promise.race([statsPromise, timeoutPromise]);
    } catch (raceErr) {
      const msg = raceErr instanceof Error ? raceErr.message : String(raceErr);
      logger.warn('Admin queue stats unavailable (Redis slow or down)', { error: msg });
      res.json({
        status: 'unavailable',
        message: 'Redis is not responding — queue stats timed out. Try-ons still run in sync mode without Redis.',
      });
      return;
    }

    res.json({ status: 'healthy', counts: { waiting, active, completed, failed, delayed } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:userId/block
 * Body: { "blocked": true | false } — updates profiles.is_blocked.
 */
router.post(
  '/users/:userId/block',
  [param('userId').isString().trim().isLength({ min: 1, max: 256 }), body('blocked').isBoolean()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const blocked = Boolean(req.body?.blocked);
      await setUserBlockedState(userId, blocked, req);
      res.json({ success: true, userId, action: blocked ? 'banned' : 'unbanned' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/admin/users/:userId/ban
 * Legacy: same as POST block (blocked=true) or ?none / ?unblock=1 for unblock.
 */
router.delete(
  '/users/:userId/ban',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const unban =
        'none' in req.query ||
        req.query.unblock === '1' ||
        req.query.unblock === 'true';
      await setUserBlockedState(userId, !unban, req);
      res.json({ success: true, userId, action: unban ? 'unbanned' : 'banned' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/admin/users/:userId/account — cascade delete user data (Convex trust mutation).
 */
router.delete(
  '/users/:userId/account',
  [param('userId').isString().trim().isLength({ min: 1, max: 512 })],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const runDelete = async () => {
        await convexMutationTrusted(anyApi.adminTrusted.deleteUserAccountAdmin, {
          secret: env.BACKEND_SHARED_SECRET,
          userId,
        });
      };
      try {
        await runDelete();
      } catch (err) {
        if (!convexFunctionMissing(err)) throw err;
        logger.warn(
          'admin delete account: falling back to backendTrusted.deleteUserAccountBackendTrusted (missing deleteUserAccountAdmin)'
        );
        await convexMutationTrusted(anyApi.backendTrusted.deleteUserAccountBackendTrusted, {
          secret: env.BACKEND_SHARED_SECRET,
          userId,
        });
      }
      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'user_account_deleted',
        target_id: userId,
        details: { summary: `Cascade-deleted account data for ${userId}` },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/admin/users/:userId/credits
 * Manually adjust user credits (support use case).
 */
router.patch(
  '/users/:userId/credits',
  [
    param('userId').isString().trim().isLength({ min: 1, max: 256 }),
    body('freeCredits').optional().isInt({ min: 0 }),
    body('monthlyCredits').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const { freeCredits, monthlyCredits } = req.body;
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof freeCredits === 'number') updates.free_credits_remaining = freeCredits;
      if (typeof monthlyCredits === 'number') updates.monthly_credits_remaining = monthlyCredits;

      if (Object.keys(updates).length <= 1) {
        res.status(400).json({ error: 'Provide freeCredits and/or monthlyCredits' });
        return;
      }

      const existing = await cxGetProfile(userId);
      if (!existing) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      await cxPatchProfile(userId, updates);
      const data = await cxGetProfile(userId);

      logger.info('Admin: Credits adjusted', { userId, updates });
      res.json({
        success: true,
        profile: {
          id: userId,
          free_credits_remaining: data?.free_credits_remaining,
          monthly_credits_remaining: data?.monthly_credits_remaining,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/admin/users/:userId/profile — account_type (and JWT metadata sync for dashboard routing).
 */
router.patch(
  '/users/:userId/profile',
  [
    param('userId').isString().trim().isLength({ min: 1, max: 256 }),
    body('account_type').isIn(['business', 'individual']).withMessage('account_type required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const account_type = req.body.account_type as 'business' | 'individual';

      try {
        await convexMutationTrusted(anyApi.adminTrusted.patchUserAccountType, {
          secret: env.BACKEND_SHARED_SECRET,
          userId,
          account_type,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('User not found') || msg.includes('not_found')) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        throw e;
      }

      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'user_account_type_changed',
        target_id: userId,
        details: { account_type },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.json({ success: true, account_type, authMetadataSynced: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/tryons/:tryonId/retry
 * Retry a failed try-on job.
 */
router.post(
  '/tryons/:tryonId/retry',
  [param('tryonId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tryonId = req.params.tryonId as string;
      const tryon = await convexQueryTrusted<{
        id: string;
        user_id?: string | null;
        person_image: string;
        product_image: string;
        category?: string | null;
        status: string;
      } | null>(anyApi.adminTrusted.adminGetTryonForRetry, {
        secret: env.BACKEND_SHARED_SECRET,
        legacyId: tryonId,
      });

      if (!tryon) {
        res.status(404).json({ error: 'Try-on not found' });
        return;
      }

      if (tryon.status !== 'failed') {
        res.status(400).json({ error: 'Only failed try-ons can be retried' });
        return;
      }

      const personImage = tryon.person_image;
      const productImage = tryon.product_image;
      if (!personImage || !productImage) {
        res.status(400).json({ error: 'Try-on missing image paths' });
        return;
      }

      if (!tryon.user_id) {
        res.status(400).json({ error: 'Try-on missing user' });
        return;
      }

      await cxPatchTryon(tryonId, { status: 'queued', completed_at: null });

      const queue = getTryOnQueue();
      const jobData = {
        jobId: `retry-${tryonId}`,
        userId: tryon.user_id,
        apiKeyId: null,
        personImageUrl: personImage,
        productImageUrl: productImage,
        category: (tryon.category || 'clothing') as import('../types').ProductCategory,
        productDescription: undefined,
        tryonDbId: tryonId,
        widgetMode: false,
      };

      if (queue) {
        await enqueueTryOnJob(jobData);
        res.json({ success: true, tryonId, status: 'queued', message: 'Job re-queued' });
      } else {
        const result = await executeTryOnPipeline(jobData);
        res.json({ success: true, tryonId, status: result.status, resultUrl: result.resultUrl });
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/queue/pause
 * Pause the Bull queue (stops processing new jobs).
 */
router.post('/queue/pause', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queue = getTryOnQueue();
    if (!queue) {
      res.status(503).json({ error: 'Queue not available' });
      return;
    }
    await queue.pause();
    logger.info('Admin: Queue paused');
    res.json({ success: true, status: 'paused' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/queue/resume
 * Resume the Bull queue.
 */
router.post('/queue/resume', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queue = getTryOnQueue();
    if (!queue) {
      res.status(503).json({ error: 'Queue not available' });
      return;
    }
    await queue.resume();
    logger.info('Admin: Queue resumed');
    res.json({ success: true, status: 'resumed' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/settings
 * Read-only platform settings (from env).
 */
router.get('/settings', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await convexQueryTrusted<
      Array<{
        id: string;
        name: string;
        tryons_per_month: number;
        max_products: number;
        price_ngn: number;
        price_usd: number;
      }>
    >(anyApi.adminTrusted.listPlansActiveTrusted, { secret: env.BACKEND_SHARED_SECRET });

    res.json({
      featureFlags: {
        enableBackgroundRemoval: env.ENABLE_BACKGROUND_REMOVAL,
        enableFacePreservation: env.ENABLE_FACE_PRESERVATION,
        enableFaceLock: env.ENABLE_FACE_LOCK,
        enablePostProcessing: env.ENABLE_POST_PROCESSING,
        enableImageModeration: env.ENABLE_IMAGE_MODERATION,
      },
      queue: {
        concurrency: env.JOB_CONCURRENCY,
        timeoutMs: env.JOB_TIMEOUT_MS,
        maxRetries: env.JOB_MAX_RETRIES,
      },
      replicate: {
        modelClothing: env.REPLICATE_MODEL_CLOTHING?.split(':')[0] || 'idm-vton',
        modelAccessories: env.REPLICATE_MODEL_ACCESSORIES?.split(':')[0] || 'fashn',
        modelRembg: env.REPLICATE_MODEL_REMBG?.split(':')[0] || 'remove-bg',
        clothingTryOn: env.TRYON_CLOTHING_USE_FASHN ? 'fashn' : 'idm-vton',
        fashnFallbackIdm: env.TRYON_FASHN_FALLBACK_IDM,
        fashnCategoryAuto: env.TRYON_FASHN_CATEGORY_AUTO,
        fashnLightPost: env.TRYON_FASHN_LIGHT_POST,
        fashnFaceLock: env.TRYON_FASHN_FACE_LOCK,
        fashnRestoreClothes: env.TRYON_FASHN_RESTORE_CLOTHES,
      },
      plans: plans || [],
      maintenanceMode: false,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/health
 * System health: API, Queue, AI availability.
 */
router.get('/health', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queue = getTryOnQueue();
    const queueHealthy = !!queue;
    const apiHealthy = true; // We're in the API

    res.json({
      api: { status: apiHealthy ? 'healthy' : 'unavailable' },
      queue: {
        status: queueHealthy ? 'healthy' : 'unavailable',
        message: queueHealthy ? undefined : 'Redis not connected',
      },
      ai: {
        status: !!env.REPLICATE_API_TOKEN ? 'configured' : 'missing_token',
        message: !env.REPLICATE_API_TOKEN ? 'REPLICATE_API_TOKEN not set' : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/activity
 * Recent activity feed (try-ons, signups).
 */
router.get('/activity', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 50);
    const tryons = await convexQueryTrusted<
      Array<{
        id: string;
        user_id?: string | null;
        status: string;
        category: string;
        created_at: string;
        brand_name?: string | null;
      }>
    >(anyApi.adminTrusted.recentTryonsActivity, {
      secret: env.BACKEND_SHARED_SECRET,
      limit,
    });

    const items = tryons.map((t) => ({
      id: t.id,
      type: 'tryon' as const,
      brand: t.brand_name?.trim() || (t.user_id ? 'Unknown' : 'Unknown'),
      status: t.status,
      category: t.category,
      createdAt: t.created_at,
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/api-keys
 * List all API keys across users (admin view).
 */
router.get('/api-keys', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const keys = await convexQueryTrusted<
      Array<{
        id: string;
        user_id: string;
        key_value: string;
        name: string;
        status: string;
        last_used: string | null;
        created_at: string;
      }>
    >(anyApi.adminTrusted.listApiKeysAdmin, {
      secret: env.BACKEND_SHARED_SECRET,
      limit,
    });

    const userIds = [...new Set(keys.map((k) => k.user_id))];
    const profiles =
      userIds.length > 0
        ? await convexQueryTrusted<
            Array<{ id: string; brand_name: string | null; contact_email: string | null; full_name: string | null }>
          >(anyApi.adminTrusted.getProfilesByIdsAdmin, {
            secret: env.BACKEND_SHARED_SECRET,
            ids: userIds,
          })
        : [];
    const profileMap = profiles.reduce((acc, p) => {
      acc[p.id] = p.brand_name?.trim() || p.contact_email?.trim() || p.full_name?.trim() || 'Unknown';
      return acc;
    }, {} as Record<string, string>);

    const keysWithBrand = keys.map((k) => ({
      id: k.id,
      user_id: k.user_id,
      // key_value is intentionally excluded from the response — only the
      // truncated preview is returned to limit blast radius if this endpoint
      // is ever accessed by an unauthorised actor.
      name: k.name,
      status: k.status,
      last_used: k.last_used,
      created_at: k.created_at,
      brand_name: profileMap[k.user_id] || '—',
      key_preview: k.key_value ? `${k.key_value.slice(0, 8)}…` : '—',
    }));

    res.json({ keys: keysWithBrand });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/api-keys/:id/revoke
 * Revoke an API key.
 */
router.post(
  '/api-keys/:id/revoke',
  [param('id').isString().trim().isLength({ min: 1, max: 256 })],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      try {
        await convexMutationTrusted(anyApi.adminTrusted.revokeApiKeyAdmin, {
          secret: env.BACKEND_SHARED_SECRET,
          legacyId: id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('not_found')) {
          res.status(404).json({ error: 'API key not found' });
          return;
        }
        throw e;
      }
      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'api_key_revoked',
        target_id: typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined,
        ip_address: typeof req.ip === 'string' ? req.ip : undefined,
        user_agent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      });
      logger.info('Admin: API key revoked', { keyId: id });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/domains
 * Allowed domains (from allowed_domains + api_keys).
 */
router.get('/domains', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const domainsWithBrand = await convexQueryTrusted<
      Array<{
        id: string;
        api_key_id: string;
        domain: string;
        verified: boolean;
        created_at: string;
        brand_name: string;
      }>
    >(anyApi.adminTrusted.listAllowedDomainsAdmin, { secret: env.BACKEND_SHARED_SECRET });

    res.json({ domains: domainsWithBrand });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/sentry-config
 * Returns Sentry configuration for the Logs/Errors UI.
 */
router.get('/sentry-config', (_req: Request, res: Response): void => {
  res.json({
    enabled: !!env.SENTRY_DSN,
    issuesUrl: env.SENTRY_ISSUES_URL || undefined,
  });
});

/**
 * GET /api/admin/logs
 * Recent in-memory log entries.
 */
router.get('/logs', (req: Request, res: Response): void => {
  const limit = Math.min(parseInt(String(req.query.limit || '200'), 10), 500);
  const level = req.query.level as string | undefined;
  const entries = getRecentLogs(limit, level);
  res.json({ logs: entries, count: entries.length });
});

/**
 * POST /api/admin/logs/clear
 * Clears the in-memory Winston log buffer (runtime logs only).
 */
router.post('/logs/clear', (_req: Request, res: Response): void => {
  clearLogBuffer();
  res.json({ ok: true, message: 'In-memory log buffer cleared' });
});

/**
 * GET /api/admin/audit
 * Security audit log (admin actions, failed logins, rate limits, etc).
 */
router.get('/audit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
    const eventType = req.query.event_type as string | undefined;
    const severity = req.query.severity as string | undefined;
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10), 0);

    const severityGroups: Record<string, string[]> = {
      error: ['failed_login', 'api_key_anomaly'],
      warn: ['rate_limit', 'api_key_blocked'],
      info: ['admin_action'],
    };

    let eventTypes: string[] | undefined;
    if (eventType) {
      eventTypes = [eventType];
    } else if (severity && severityGroups[severity]) {
      eventTypes = severityGroups[severity];
    }

    const { entries, total } = await convexQueryTrusted<{
      entries: Array<{
        id: string;
        event_type: string;
        actor: string;
        action: string;
        target_id?: string | null;
        details?: unknown;
        ip_address?: string | null;
        created_at: string;
      }>;
      total: number;
    }>(anyApi.adminTrusted.listAuditLogAdmin, {
      secret: env.BACKEND_SHARED_SECRET,
      limit,
      offset,
      eventTypes,
    });

    const profileActions = new Set(['user_banned', 'user_unbanned']);
    const targetIds = [...new Set(entries.map((e) => (e.target_id ? String(e.target_id) : '')).filter(Boolean))];
    let profileMap: Record<string, { brand_name: string | null; contact_email: string | null; full_name: string | null }> =
      {};
    if (targetIds.length > 0) {
      const profiles = await convexQueryTrusted<
        Array<{
          id: string;
          brand_name: string | null;
          contact_email: string | null;
          full_name: string | null;
        }>
      >(anyApi.adminTrusted.getProfilesByIdsAdmin, {
        secret: env.BACKEND_SHARED_SECRET,
        ids: targetIds,
      });
      profileMap = profiles.reduce(
        (acc, p) => {
          acc[p.id] = {
            brand_name: p.brand_name ?? null,
            contact_email: p.contact_email ?? null,
            full_name: p.full_name ?? null,
          };
          return acc;
        },
        {} as Record<string, { brand_name: string | null; contact_email: string | null; full_name: string | null }>
      );
    }

    const enriched = entries.map((e) => {
      const tid = e.target_id ? String(e.target_id) : null;
      const prof = tid && profileMap[tid] ? profileMap[tid] : null;
      const details = (e.details && typeof e.details === 'object' ? e.details : {}) as Record<string, unknown>;
      let displaySummary = typeof details.summary === 'string' ? details.summary : null;
      if (!displaySummary && prof && profileActions.has(e.action)) {
        const label = [prof.brand_name, prof.contact_email || prof.full_name].filter(Boolean).join(' · ') || tid;
        if (e.action === 'user_banned') {
          const dur = details.ban_duration ?? details.banDuration ?? '—';
          displaySummary = `Blocked user ${label}. Auth ban duration: ${dur}.`;
        } else if (e.action === 'user_unbanned') {
          displaySummary = `Unblocked user ${label}.`;
        }
      }
      return {
        ...e,
        target_profile: prof,
        display_summary: displaySummary,
      };
    });

    res.json({
      entries: enriched,
      total,
      pagination: { offset, limit },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/audit/clear
 * Deletes all rows in admin_audit_log (use with care).
 */
router.post('/audit/clear', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await convexMutationTrusted(anyApi.adminTrusted.clearAuditLogAdmin, {
      secret: env.BACKEND_SHARED_SECRET,
    });
    res.json({ ok: true, message: 'Audit log cleared' });
  } catch (err) {
    next(err);
  }
});

router.get('/beta-pending', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    try {
      const out = await convexQueryTrusted<{
        profiles: Array<{
          userId: string;
          full_name?: string | null;
          contact_email?: string | null;
          brand_name?: string | null;
          account_type: string;
          created_at?: string | null;
          beta_requested_at?: string | null;
        }>;
      }>(anyApi.adminTrusted.listPendingBetaAccessAdmin, {
        secret: env.BACKEND_SHARED_SECRET,
      });
      res.json(out);
    } catch (err) {
      if (!convexFunctionMissing(err)) throw err;
      logger.warn('admin beta-pending: falling back to adminListProfiles (deploy listPendingBetaAccessAdmin)');
      const out = await betaPendingFallbackFromProfiles();
      res.json(out);
    }
  } catch (err) {
    next(err);
  }
});

router.post(
  '/beta-access/:userId/approve',
  [
    param('userId')
      .trim()
      .notEmpty()
      .isLength({ min: 1, max: 512 })
      .withMessage('userId required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = matchedData(req) as { userId: string };
      const runApprove = async () => {
        await convexMutationTrusted(anyApi.adminTrusted.approveBetaAccessAdmin, {
          secret: env.BACKEND_SHARED_SECRET,
          userId,
        });
      };
      try {
        await runApprove();
      } catch (err) {
        if (!convexFunctionMissing(err)) throw err;
        logger.warn(
          'admin beta approve: falling back to backendTrusted.approveBetaAccessBackendTrusted (missing approveBetaAccessAdmin)'
        );
        try {
          await convexMutationTrusted(anyApi.backendTrusted.approveBetaAccessBackendTrusted, {
            secret: env.BACKEND_SHARED_SECRET,
            userId,
          });
        } catch (err2) {
          if (!convexFunctionMissing(err2)) throw err2;
          logger.warn('admin beta approve: falling back to cxPatchProfile (missing backend beta mutations)');
          await betaApproveViaPatchProfile(userId);
        }
      }
      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'beta_access_approve',
        target_id: userId,
        details: { summary: `Beta access approved for ${userId}` },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/beta-access/:userId/reject',
  [
    param('userId')
      .trim()
      .notEmpty()
      .isLength({ min: 1, max: 512 })
      .withMessage('userId required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = matchedData(req) as { userId: string };
      const runReject = async () => {
        await convexMutationTrusted(anyApi.adminTrusted.rejectBetaAccessAdmin, {
          secret: env.BACKEND_SHARED_SECRET,
          userId,
        });
      };
      try {
        await runReject();
      } catch (err) {
        if (!convexFunctionMissing(err)) throw err;
        logger.warn(
          'admin beta reject: falling back to backendTrusted.rejectBetaAccessBackendTrusted (missing rejectBetaAccessAdmin)'
        );
        try {
          await convexMutationTrusted(anyApi.backendTrusted.rejectBetaAccessBackendTrusted, {
            secret: env.BACKEND_SHARED_SECRET,
            userId,
          });
        } catch (err2) {
          if (!convexFunctionMissing(err2)) throw err2;
          logger.warn('admin beta reject: falling back to cxPatchProfile (missing backend beta mutations)');
          await betaRejectViaPatchProfile(userId);
        }
      }
      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'beta_access_reject',
        target_id: userId,
        details: { summary: `Beta access rejected for ${userId}` },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/** Public marketing URL base for outbound invite links. */
function lifecycleInviteAcceptUrl(token: string): string {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, '');
  return `${base}/auth/invite/${encodeURIComponent(token)}`;
}

router.get('/waitlist/early-access', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows = await convexQueryTrusted<
      Array<{
        id: string;
        applicant_type?: string | null;
        first_name: string;
        email: string;
        brand_name: string;
        role: string;
        website_url: string;
        platform: string;
        timeline: string;
        biggest_challenge: string;
        created_at?: string | null;
        waitlist_review_status?: string | null;
      }>
    >(anyApi.backendTrusted.listEarlyAccessRequestsAdminTrusted, {
      secret: env.BACKEND_SHARED_SECRET,
    });
    res.json({ rows });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/waitlist/early-access/:id/review',
  [
    param('id').trim().notEmpty().withMessage('id required'),
    body('waitlist_review_status').trim().notEmpty().isLength({ max: 80 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = matchedData(req) as { id: string };
      const { waitlist_review_status } = matchedData(req) as { waitlist_review_status: string };
      await convexMutationTrusted(anyApi.backendTrusted.patchEarlyAccessReviewTrusted, {
        secret: env.BACKEND_SHARED_SECRET,
        docId: id,
        waitlist_review_status,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/invites/create',
  [
    body('email').trim().isEmail().isLength({ max: 254 }),
    body('name').optional({ nullable: true }).isString().isLength({ max: 200 }),
    body('accountType').isIn(['personal', 'business']),
    body('companyName').optional({ nullable: true }).isString().isLength({ max: 400 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const b = matchedData(req) as {
        email: string;
        name?: string | null;
        accountType: 'personal' | 'business';
        companyName?: string | null;
      };
      const companyName = typeof b.companyName === 'string' ? b.companyName.trim() : '';
      if (b.accountType === 'business' && !companyName) {
        res.status(400).json({ error: 'companyName is required for business invitations' });
        return;
      }
      const actor = req.ip ? `admin_ip:${req.ip}` : 'admin';
      const out = (await convexMutationTrusted(anyApi.invites.createInviteTrusted, {
        secret: env.BACKEND_SHARED_SECRET,
        email: b.email.trim().toLowerCase(),
        name: b.name?.trim() || undefined,
        accountType: b.accountType,
        companyName: b.accountType === 'business' ? companyName : undefined,
        createdBy: actor,
      })) as { token: string };

      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'invite_create',
        details: {
          summary: `Created invite (${b.accountType}) for ${b.email.trim().toLowerCase()}`,
          email: b.email.trim().toLowerCase(),
          accountType: b.accountType,
          token_preview: `${out.token.slice(0, 12)}…`,
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      const token = String(out.token);
      res.status(201).json({
        token,
        inviteUrl: lifecycleInviteAcceptUrl(token),
        email: b.email.trim().toLowerCase(),
        accountType: b.accountType,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/invites/send',
  [
    body('token')
      .trim()
      .isLength({ min: 8, max: 280 })
      .matches(/^inv_[a-zA-Z0-9]+$/),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = matchedData(req) as { token: string };
      const row = await convexQueryTrusted<{
        token: string;
        email: string;
        name?: string;
        accountType: string;
        companyName?: string;
        status: string;
      } | null>(anyApi.invites.getInviteByTokenTrusted, {
        secret: env.BACKEND_SHARED_SECRET,
        token,
      });

      if (!row) {
        res.status(404).json({ error: 'Invitation not found' });
        return;
      }
      if (row.status !== 'pending') {
        res.status(400).json({ error: `Invite is not pending (current: ${row.status})` });
        return;
      }

      const inviteUrl = lifecycleInviteAcceptUrl(row.token);
      const name = row.name ?? row.email.split('@')[0];

      let subject: string;
      let html: string;
      let text: string;
      if (row.accountType === 'personal') {
        const b = personalInviteBodies({
          name,
          email: row.email,
          inviteUrl,
        });
        ({ subject, html, text } = b);
      } else {
        const b = businessInviteBodies({
          name,
          email: row.email,
          companyName: row.companyName ?? '',
          inviteUrl,
        });
        ({ subject, html, text } = b);
      }

      const sent = await sendEmail({
        to: row.email.toLowerCase(),
        subject,
        html,
        text,
        from: FIXED_FROM,
      });

      if (!sent) {
        res.status(502).json({
          error: 'Email provider did not confirm send — check RESEND_API_KEY and EMAIL_FROM / domain verification.',
        });
        return;
      }

      await convexMutationTrusted(anyApi.invites.markInviteSentTrusted, {
        secret: env.BACKEND_SHARED_SECRET,
        token,
      });

      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'invite_sent',
        target_id: token,
        details: {
          summary: `Invitation email dispatched to ${row.email}`,
          accountType: row.accountType,
        },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.json({ success: true, sentTo: row.email.toLowerCase(), accountType: row.accountType });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/invites', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
    const accountTypeFilter =
      typeof req.query.accountType === 'string' ? req.query.accountType : undefined;
    const args = {
      secret: env.BACKEND_SHARED_SECRET,
      ...(statusFilter ? { statusFilter } : {}),
      ...(accountTypeFilter ? { accountTypeFilter } : {}),
    };
    let rows: Array<{
      token: string;
      email: string;
      name?: string;
      accountType: string;
      companyName?: string;
      status: string;
      createdAt: number;
      sentAt?: number;
      acceptedAt?: number;
      createdBy?: string;
      _creationTime?: number;
    }>;
    try {
      rows = await convexQueryTrusted<
        Array<{
          token: string;
          email: string;
          name?: string;
          accountType: string;
          companyName?: string;
          status: string;
          createdAt: number;
          sentAt?: number;
          acceptedAt?: number;
          createdBy?: string;
          _creationTime?: number;
        }>
      >(anyApi.backendTrusted.listInvitesForAdminTrusted, args);
    } catch (e1) {
      if (!convexFunctionMissing(e1)) throw e1;
      logger.warn('admin invites: falling back to invites.listInvitesTrusted');
      rows = await convexQueryTrusted<
        Array<{
          token: string;
          email: string;
          name?: string;
          accountType: string;
          companyName?: string;
          status: string;
          createdAt: number;
          sentAt?: number;
          acceptedAt?: number;
          createdBy?: string;
          _creationTime?: number;
        }>
      >(anyApi.invites.listInvitesTrusted, args);
    }
    res.json({ invites: rows });
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/invites/:token',
  [param('token').trim().isLength({ min: 8, max: 320 })],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = matchedData(req) as { token: string };
      const out = (await convexMutationTrusted(anyApi.invites.deleteInviteByTokenTrusted, {
        secret: env.BACKEND_SHARED_SECRET,
        token,
      })) as { deleted: boolean };

      await logAudit({
        event_type: 'admin_action',
        actor: 'admin',
        action: 'invite_deleted',
        target_id: token,
        details: { summary: out.deleted ? 'Invite row removed' : 'No invite matched token' },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });

      res.json({ ok: true, deleted: out.deleted });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
