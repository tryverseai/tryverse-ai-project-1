import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { getTryOnQueue } from '../services/queue/producer';

const router = Router();

// All admin routes require X-Admin-Key header
router.use(requireAdmin);

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
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users
 * Lists all users with their plan and usage info.
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const offset = (page - 1) * limit;
    const searchRaw = req.query.search as string | undefined;
    // Sanitize: alphanumeric, spaces, @.- allowed; max 80 chars (prevents injection and DoS)
    const search = searchRaw
      ? String(searchRaw).slice(0, 80).replace(/[^a-zA-Z0-9@.\s-]/g, '').trim() || undefined
      : undefined;

    let query = supabaseAdmin
      .from('profiles')
      .select(
        'id, brand_name, full_name, contact_email, current_plan_id, free_credits_remaining, monthly_credits_remaining, monthly_credits_total, widget_activated, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`brand_name.ilike.%${search}%,contact_email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      users: data || [],
      pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err) {
    next(err);
  }
});

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

    res.json({
      tryons: data || [],
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

    res.json({ period: { days }, byProvider, dailyRevenue, totalTransactions: successful.length });
  } catch (err) {
    next(err);
  }
});

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

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    res.json({ status: 'healthy', counts: { waiting, active, completed, failed, delayed } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/users/:userId/ban
 * Suspends a user account.
 */
router.delete(
  '/users/:userId/ban',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const banDuration: string = 'none' in req.query ? 'none' : '876600h';
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
      });

      if (error) throw error;

      logger.info('Admin: User banned', { userId });
      res.json({ success: true, userId, action: 'banned' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
