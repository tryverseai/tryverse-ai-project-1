import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin, convexProfileCreditLookupKey } from '../middleware/auth';
import { getBrandAnalytics } from '../services/analytics/analytics';
import { getCacheStats } from '../services/cache/tryonCache';
import { env } from '../config/env';
import { anyApi, convexQueryTrusted } from '../config/convexHttp';

const router = Router();

/**
 * GET /api/analytics
 * Returns brand analytics for the authenticated user.
 * ?days=30 (default) — lookback period
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = Math.min(parseInt(String(req.query.days || '30'), 10), 365);
      const analytics = await getBrandAnalytics(
        convexProfileCreditLookupKey(req),
        req.user!.id,
        days
      );
      res.json({ ...analytics, period: { days } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/analytics/platform  (Admin only)
 * Platform-wide analytics: total try-ons, top brands, revenue trends.
 */
router.get(
  '/platform',
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = Math.min(parseInt(String(req.query.days || '30'), 10), 365);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [platform, cacheStats] = await Promise.all([
        convexQueryTrusted<{
          tryons: Array<{ category: string; created_at: string; status: string }>;
          newUsers: number;
        }>(anyApi.adminTrusted.platformAnalyticsSince, {
          secret: env.BACKEND_SHARED_SECRET,
          sinceIso: since,
        }),
        getCacheStats(),
      ]);
      const totalTryons = platform.tryons.length;
      const totalUsers = platform.newUsers;
      const categoryBreakdown = platform.tryons.map((t) => ({ category: t.category }));
      const dailyTryons = platform.tryons;

      // Category breakdown
      const catMap: Record<string, number> = {};
      for (const t of (categoryBreakdown || [])) {
        catMap[t.category] = (catMap[t.category] || 0) + 1;
      }

      // Daily volume
      const dailyMap: Record<string, { total: number; completed: number }> = {};
      for (const t of (dailyTryons || [])) {
        const day = t.created_at.slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { total: 0, completed: 0 };
        dailyMap[day].total++;
        if (t.status === 'completed') dailyMap[day].completed++;
      }

      res.json({
        period: { days, since },
        totals: { tryons: totalTryons, newUsers: totalUsers },
        byCategory: Object.entries(catMap).map(([cat, count]) => ({ category: cat, count })),
        dailyVolume: Object.entries(dailyMap)
          .map(([date, d]) => ({ date, ...d }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        cache: cacheStats,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
