import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, matchedData } from 'express-validator';
import { requireAdmin } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { getTryOnQueue } from '../services/queue/producer';
import { enqueueTryOnJob } from '../services/queue/producer';
import { executeTryOnPipeline } from '../services/ai/pipeline';
import { env } from '../config/env';
import { getRecentLogs, clearLogBuffer } from '../config/logBuffer';
import { logAudit } from '../services/audit';
import { AppError } from '../middleware/errorHandler';
import { listAllModelsForAdmin } from '../services/models/modelLibrary';

const router = Router();

/**
 * Block/unblock: always updates profiles.is_blocked (enforced in requireAuth) and
 * sets Supabase auth ban_duration when the hosted Auth API supports it.
 */
async function setUserBlockedState(userId: string, blocked: boolean, req: Request): Promise<void> {
  const { data: profileRow, error: exErr } = await supabaseAdmin
    .from('profiles')
    .select('id, brand_name, contact_email, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (exErr) throw exErr;
  if (!profileRow) {
    throw new AppError('User not found', 404);
  }

  const { error: pe } = await supabaseAdmin.from('profiles').update({ is_blocked: blocked }).eq('id', userId);
  if (pe) throw pe;

  const { error: ae } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? '876000h' : 'none',
  });
  if (ae) {
    await supabaseAdmin.from('profiles').update({ is_blocked: !blocked }).eq('id', userId);
    logger.error('Admin: auth ban failed after profile update; reverted is_blocked', {
      userId,
      blocked,
      authError: ae.message,
    });
    throw new AppError(
      ae.message || 'Auth could not apply ban (profile was reverted). Try again or check Supabase Auth.',
      400
    );
  }

  const brand = profileRow.brand_name?.trim() || null;
  const email = profileRow.contact_email?.trim() || null;
  const fullName = profileRow.full_name?.trim() || null;
  const displayLabel = [brand, email || fullName].filter(Boolean).join(' · ') || userId;
  const summary = blocked
    ? `Blocked user ${displayLabel}: API access denied (profiles.is_blocked) and Supabase auth ban applied (~100y).`
    : `Unblocked user ${displayLabel}: profiles.is_blocked cleared and Supabase auth ban removed.`;

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
      ban_duration: blocked ? '876000h' : 'none',
    },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });
  logger.info(`Admin: User ${blocked ? 'banned' : 'unbanned'}`, { userId, displayLabel });
}

// All admin routes require X-Admin-Key header
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
 * GET /api/admin/metrics
 * High-level platform metrics dashboard.
 */
router.get('/metrics', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { count: totalUsers },
      { count: totalTryons },
      { count: activeSubscriptions },
      { count: tryonsToday },
      { count: tryonsThisMonth },
      { count: completedTryons },
      { data: revenueData },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('tryons').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabaseAdmin
        .from('tryons')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      supabaseAdmin
        .from('tryons')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart),
      supabaseAdmin
        .from('tryons')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabaseAdmin
        .from('payments')
        .select('amount, currency')
        .eq('status', 'success'),
    ]);

    const successRate =
      totalTryons && totalTryons > 0
        ? Math.round(((completedTryons || 0) / (totalTryons || 1)) * 100)
        : 0;

    const revenueNGN = (revenueData || [])
      .filter((p) => p.currency === 'NGN')
      .reduce((sum, p) => sum + p.amount, 0);

    const revenueUSD = (revenueData || [])
      .filter((p) => p.currency === 'USD')
      .reduce((sum, p) => sum + p.amount, 0);

    // Daily usage for charts (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dailyTryons } = await supabaseAdmin
      .from('tryons')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo);
    const { data: newUsersData } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo);

    const dailyMap: Record<string, { tryons: number; users: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      dailyMap[day] = { tryons: 0, users: 0 };
    }
    for (const t of dailyTryons || []) {
      const day = t.created_at?.slice(0, 10);
      if (day && dailyMap[day]) dailyMap[day].tryons++;
    }
    for (const u of newUsersData || []) {
      const day = u.created_at?.slice(0, 10);
      if (day && dailyMap[day]) dailyMap[day].users++;
    }
    const usageOverTime = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, tryons: v.tryons, newUsers: v.users }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      users: { total: totalUsers || 0 },
      tryons: {
        total: totalTryons || 0,
        today: tryonsToday || 0,
        thisMonth: tryonsThisMonth || 0,
        successRate,
      },
      subscriptions: { active: activeSubscriptions || 0 },
      revenue: { ngn: revenueNGN, usd: revenueUSD, totalPayments: (revenueData || []).length },
      usageOverTime,
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
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = matchedData(req) as { limit?: number; page?: number; search?: string };
      const limit = Math.min(q.limit ?? 50, 200);
      const page = Math.max(q.page ?? 1, 1);
      const offset = (page - 1) * limit;
      const searchRaw = q.search;
      // Sanitize: alphanumeric, spaces, @.- allowed; max 80 chars (prevents injection and DoS)
      const search = searchRaw
        ? String(searchRaw).slice(0, 80).replace(/[^a-zA-Z0-9@.\s-]/g, '').trim() || undefined
        : undefined;

      // Use plan_id only - current_plan_id may not exist in all schemas
      let profilesQuery = supabaseAdmin
        .from('profiles')
        .select(
          'id, brand_name, full_name, contact_email, plan_id, free_credits_remaining, monthly_credits_remaining, monthly_credits_total, widget_activated, created_at, is_blocked',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        const term = `%${search}%`;
        profilesQuery = profilesQuery.or(`brand_name.ilike.${term},contact_email.ilike.${term}`);
      }

      const { data, error, count } = await profilesQuery;
      if (error) {
        logger.error('Admin users query failed', { error });
        throw error;
      }

      const profiles = data || [];
      const usersWithBan = profiles.map((profile: { id: string; is_blocked?: boolean } & Record<string, unknown>) => ({
        ...profile,
        is_banned: Boolean(profile.is_blocked),
      }));

      res.json({
        users: usersWithBan,
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
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

    let query = supabaseAdmin
      .from('tryons')
      .select('id, user_id, status, category, created_at, completed_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = data || [];
    const userIds = [...new Set(rows.map((r: { user_id: string | null }) => r.user_id).filter(Boolean))] as string[];

    let profileMap: Record<string, { brand_name: string | null; contact_email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabaseAdmin
        .from('profiles')
        .select('id, brand_name, contact_email')
        .in('id', userIds);
      profileMap = (profilesData || []).reduce(
        (acc, p) => {
          acc[p.id] = { brand_name: p.brand_name ?? null, contact_email: p.contact_email ?? null };
          return acc;
        },
        {} as Record<string, { brand_name: string | null; contact_email: string | null }>
      );
    }

    const tryonsWithBrand = rows.map((t: { user_id: string | null } & Record<string, unknown>) => {
      const p = t.user_id ? profileMap[t.user_id] : null;
      return {
        ...t,
        brand_name: p?.brand_name ?? null,
        contact_email: p?.contact_email ?? null,
      };
    });

    res.json({
      tryons: tryonsWithBrand,
      pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
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

    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('amount, currency, provider, status, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const payments = data || [];
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

    const { data: recentPayments } = await supabaseAdmin
      .from('payments')
      .select('id, user_id, amount, currency, provider, status, reference, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

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
 * Body: { "blocked": true | false } — updates profiles.is_blocked + Supabase auth ban.
 */
router.post(
  '/users/:userId/block',
  [param('userId').isUUID(), body('blocked').isBoolean()],
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
 * PATCH /api/admin/users/:userId/credits
 * Manually adjust user credits (support use case).
 */
router.patch(
  '/users/:userId/credits',
  [
    param('userId').isUUID(),
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

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('id, free_credits_remaining, monthly_credits_remaining')
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      logger.info('Admin: Credits adjusted', { userId, updates });
      res.json({ success: true, profile: data });
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
      const { data: tryon, error: fetchError } = await supabaseAdmin
        .from('tryons')
        .select('id, user_id, person_image, product_image, garment_image, category, status')
        .eq('id', tryonId)
        .single();

      if (fetchError || !tryon) {
        res.status(404).json({ error: 'Try-on not found' });
        return;
      }

      if (tryon.status !== 'failed') {
        res.status(400).json({ error: 'Only failed try-ons can be retried' });
        return;
      }

      const personImage = tryon.person_image;
      const productImage = tryon.product_image || tryon.garment_image;
      if (!personImage || !productImage) {
        res.status(400).json({ error: 'Try-on missing image paths' });
        return;
      }

      await supabaseAdmin
        .from('tryons')
        .update({ status: 'queued', completed_at: null })
        .eq('id', tryonId);

      const queue = getTryOnQueue();
      const jobData = {
        jobId: `retry-${tryonId}`,
        userId: tryon.user_id,
        apiKeyId: null,
        personImageUrl: personImage,
        productImageUrl: productImage,
        category: (tryon.category || 'clothing') as 'clothing' | 'bags' | 'glasses',
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
    const { data: plans } = await supabaseAdmin.from('plans').select('id, name, tryons_per_month, max_products, price_ngn, price_usd').eq('is_active', true).order('tryons_per_month');

    res.json({
      featureFlags: {
        enableBackgroundRemoval: env.ENABLE_BACKGROUND_REMOVAL,
        enableFacePreservation: env.ENABLE_FACE_PRESERVATION,
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
    const { data: tryons } = await supabaseAdmin
      .from('tryons')
      .select('id, user_id, status, category, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const userIds = [...new Set((tryons || []).map((t) => t.user_id).filter(Boolean))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, brand_name').in('id', userIds);
      profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p.brand_name || 'Unknown';
        return acc;
      }, {} as Record<string, string>);
    }

    const items = (tryons || []).map((t) => ({
      id: t.id,
      type: 'tryon' as const,
      brand: t.user_id ? profileMap[t.user_id] : 'Unknown',
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
    const { data: keys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, user_id, key_value, name, status, last_used, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const userIds = [...new Set((keys || []).map((k) => k.user_id))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, brand_name').in('id', userIds);
      profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p.brand_name || 'Unknown';
        return acc;
      }, {} as Record<string, string>);
    }

    const keysWithBrand = (keys || []).map((k) => ({
      ...k,
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
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin.from('api_keys').update({ status: 'revoked' }).eq('id', id);

      if (error) throw error;
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
    const { data, error } = await supabaseAdmin
      .from('allowed_domains')
      .select('id, api_key_id, domain, verified, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const apiKeyIds = [...new Set((data || []).map((d) => d.api_key_id))];
    let keyToBrand: Record<string, string> = {};
    if (apiKeyIds.length > 0) {
      const { data: keys } = await supabaseAdmin.from('api_keys').select('id, user_id').in('id', apiKeyIds);
      const userIds = [...new Set((keys || []).map((k) => k.user_id))];
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, brand_name').in('id', userIds);
      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p.brand_name || '—';
        return acc;
      }, {} as Record<string, string>);
      (keys || []).forEach((k) => {
        keyToBrand[k.id] = profileMap[k.user_id] || '—';
      });
    }

    const domainsWithBrand = (data || []).map((d) => ({
      ...d,
      brand_name: keyToBrand[d.api_key_id] || '—',
    }));

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

    let query = supabaseAdmin
      .from('admin_audit_log')
      .select('id, event_type, actor, action, target_id, details, ip_address, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType) {
      query = query.eq('event_type', eventType);
    } else if (severity && severityGroups[severity]) {
      query = query.in('event_type', severityGroups[severity]);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const entries = data || [];
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const profileActions = new Set(['user_banned', 'user_unbanned']);
    const targetIds = [
      ...new Set(
        entries
          .filter((e) => e.target_id && uuidRe.test(String(e.target_id)))
          .map((e) => String(e.target_id))
      ),
    ];
    let profileMap: Record<string, { brand_name: string | null; contact_email: string | null; full_name: string | null }> =
      {};
    if (targetIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, brand_name, contact_email, full_name')
        .in('id', targetIds);
      profileMap = (profiles || []).reduce(
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
      total: count ?? (data?.length ?? 0),
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
    const { error } = await supabaseAdmin
      .from('admin_audit_log')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00.000Z');
    if (error) throw error;
    res.json({ ok: true, message: 'Audit log cleared' });
  } catch (err) {
    next(err);
  }
});

export default router;
