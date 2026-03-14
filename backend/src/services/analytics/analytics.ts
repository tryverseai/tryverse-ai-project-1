import { supabaseAdmin } from '../../config/supabase';
import { logger } from '../../config/logger';

/**
 * BRAND ANALYTICS SERVICE
 *
 * Tracks and surfaces actionable data for brand dashboards:
 * - Try-ons per day/week/month
 * - Conversion rate (try-on → purchase intent)
 * - Most tried products
 * - Success/failure rates per category
 * - Widget engagement metrics
 */

export interface BrandAnalytics {
  overview: {
    totalTryons: number;
    completedTryons: number;
    failedTryons: number;
    successRate: number;
    avgProcessingMs: number;
    creditsUsed: number;
    creditsRemaining: number;
  };
  byCategory: Array<{ category: string; count: number; successRate: number }>;
  dailyTrend: Array<{ date: string; count: number; completed: number }>;
  topProducts: Array<{ productImage: string; count: number; category: string }>;
  widgetEngagement: {
    totalWidgetTryons: number;
    widgetConversionRate: number;
  };
}

/**
 * Gets full analytics for a brand (user).
 */
export async function getBrandAnalytics(
  userId: string,
  days = 30
): Promise<BrandAnalytics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: tryons },
    { data: profile },
    { data: events },
  ] = await Promise.all([
    supabaseAdmin
      .from('tryons')
      .select('id, status, category, product_image, created_at, completed_at')
      .eq('user_id', userId)
      .gte('created_at', since),
    supabaseAdmin
      .from('profiles')
      .select('monthly_credits_remaining, monthly_credits_total, free_credits_remaining')
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('usage_events')
      .select('event_type, metadata, created_at')
      .eq('user_id', userId)
      .gte('created_at', since),
  ]);

  const allTryons = tryons || [];
  const allEvents = events || [];

  // Overview
  const completed = allTryons.filter((t) => t.status === 'completed');
  const failed = allTryons.filter((t) => t.status === 'failed');
  const successRate = allTryons.length > 0
    ? Math.round((completed.length / allTryons.length) * 100)
    : 0;

  const processingTimes = completed
    .filter((t) => t.completed_at)
    .map((t) => new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime());

  const avgProcessingMs = processingTimes.length > 0
    ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
    : 0;

  const creditsUsed = (profile?.monthly_credits_total || 0) - (profile?.monthly_credits_remaining || 0);
  const creditsRemaining = (profile?.monthly_credits_remaining || 0) + (profile?.free_credits_remaining || 0);

  // By category
  const categoryMap = new Map<string, { total: number; completed: number }>();
  for (const t of allTryons) {
    const entry = categoryMap.get(t.category) || { total: 0, completed: 0 };
    entry.total++;
    if (t.status === 'completed') entry.completed++;
    categoryMap.set(t.category, entry);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.total,
    successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  // Daily trend
  const dailyMap = new Map<string, { count: number; completed: number }>();
  for (const t of allTryons) {
    const day = t.created_at.slice(0, 10);
    const entry = dailyMap.get(day) || { count: 0, completed: 0 };
    entry.count++;
    if (t.status === 'completed') entry.completed++;
    dailyMap.set(day, entry);
  }
  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top products by frequency
  const productMap = new Map<string, { count: number; category: string }>();
  for (const t of allTryons) {
    if (t.product_image) {
      const entry = productMap.get(t.product_image) || { count: 0, category: t.category };
      entry.count++;
      productMap.set(t.product_image, entry);
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([productImage, data]) => ({ productImage, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Widget engagement
  const widgetEvents = allEvents.filter(
    (e) => e.event_type === 'tryon_completed' &&
      (e.metadata as Record<string, unknown>)?.widget_mode === true
  );
  const totalWidgetTryons = widgetEvents.length;
  const widgetConversionRate = allTryons.length > 0
    ? Math.round((totalWidgetTryons / allTryons.length) * 100)
    : 0;

  return {
    overview: {
      totalTryons: allTryons.length,
      completedTryons: completed.length,
      failedTryons: failed.length,
      successRate,
      avgProcessingMs,
      creditsUsed,
      creditsRemaining,
    },
    byCategory,
    dailyTrend,
    topProducts,
    widgetEngagement: { totalWidgetTryons, widgetConversionRate },
  };
}

/**
 * Tracks a custom analytics event.
 * Called from the pipeline and payment handlers.
 */
export async function trackEvent(
  userId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.from('usage_events').insert({
      user_id: userId,
      event_type: eventType,
      metadata: metadata || null,
    });
  } catch (err) {
    logger.error('Failed to track event', { eventType, error: String(err) });
  }
}
