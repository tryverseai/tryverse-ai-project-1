import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

/**
 * GET /api/usage
 * Returns usage analytics for the authenticated user.
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const daysRaw = parseInt(String(req.query.days || '30'), 10);
      const days = Number.isNaN(daysRaw) || daysRaw < 1 ? 30 : Math.min(daysRaw, 365);

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: tryons, error: tryonError },
        { data: events, error: eventError },
      ] = await Promise.all([
        supabaseAdmin
          .from('tryons')
          .select('id, status, category, created_at, completed_at')
          .eq('user_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: true }),
        supabaseAdmin
          .from('usage_events')
          .select('event_type, created_at, metadata')
          .eq('user_id', userId)
          .gte('created_at', since)
          .order('created_at', { ascending: true }),
      ]);

      if (tryonError) throw tryonError;
      if (eventError) throw eventError;

      const allTryons = tryons || [];

      // Aggregations
      const totalTryons = allTryons.length;
      const completed = allTryons.filter((t) => t.status === 'completed').length;
      const failed = allTryons.filter((t) => t.status === 'failed').length;
      const successRate = totalTryons > 0 ? Math.round((completed / totalTryons) * 100) : 0;

      // By category
      const byCategory: Record<string, number> = {};
      for (const t of allTryons) {
        byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      }

      // Daily breakdown
      const dailyMap: Record<string, number> = {};
      for (const t of allTryons) {
        const day = t.created_at.slice(0, 10);
        dailyMap[day] = (dailyMap[day] || 0) + 1;
      }
      const dailyUsage = Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Average processing time
      const completedWithTime = allTryons.filter(
        (t) => t.status === 'completed' && t.completed_at
      );
      let avgProcessingMs = 0;
      if (completedWithTime.length > 0) {
        const totalMs = completedWithTime.reduce((sum, t) => {
          return sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime());
        }, 0);
        avgProcessingMs = Math.round(totalMs / completedWithTime.length);
      }

      res.json({
        period: { days, since },
        summary: {
          totalTryons,
          completed,
          failed,
          successRate,
          avgProcessingMs,
        },
        byCategory,
        dailyUsage,
        recentEvents: (events || []).slice(-20),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
