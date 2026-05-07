import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env, assertProductionSecurityConfig } from './config/env';
import { logger } from './config/logger';
import { initSentry, Sentry } from './config/sentry';
import { connectRedis } from './config/redis';
import { generalRateLimit } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requireAdmin } from './middleware/auth';
import { createProductionHttpsRedirectMiddleware } from './middleware/httpsRedirect';

// Routes
import uploadRouter from './routes/upload';
import tryonRouter from './routes/tryon';
import creditsRouter from './routes/credits';
import usageRouter from './routes/usage';
import paymentRouter from './routes/payment';
import widgetRouter from './routes/widget';
import modelsRouter from './routes/models';
import productsRouter from './routes/products';
import adminRouter from './routes/admin';
import analyticsRouter from './routes/analytics';
import emailsRouter from './routes/emails';
import accountRouter from './routes/account';
import earlyAccessRouter from './routes/earlyAccess';
import supportRouter from './routes/support';
import inviteRouter from './routes/invite';
import authInviteRouter from './routes/authInvite';

// ─── Sentry (must init before everything else) ────────────────────────────────
initSentry();

assertProductionSecurityConfig();

const app = express();

// Trust proxy for X-Forwarded-* headers (required behind nginx, load balancers)
app.set('trust proxy', 1);

// Sentry request/tracing middleware (gracefully skipped if DSN not set)
if (env.SENTRY_DSN) {
  try {
    // @ts-expect-error — Handlers shape differs across @sentry/node major versions
    if (typeof Sentry.Handlers?.requestHandler === 'function') app.use(Sentry.Handlers.requestHandler());
    // @ts-expect-error
    if (typeof Sentry.Handlers?.tracingHandler === 'function') app.use(Sentry.Handlers.tracingHandler());
  } catch { /* skip */ }
}

// ─── CORS (before HTTPS redirect / helmet so OPTIONS preflight always gets ACAO) ─
/** Trim comma-separated origins from WIDGET_ALLOWED_ORIGINS (same as splitting process.env in production). */
function parseCommaOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const widgetOriginsRaw = env.WIDGET_ALLOWED_ORIGINS.trim();

const defaultProdOrigins = ['https://tryverseai.com', 'https://www.tryverseai.com'];
const corsOriginsList: string[] | null =
  !widgetOriginsRaw || widgetOriginsRaw === ''
    ? defaultProdOrigins
    : widgetOriginsRaw === '*'
      ? null
      : parseCommaOrigins(widgetOriginsRaw);

/** Dev + LAN: Vite / local UIs not listed in WIDGET_ALLOWED_ORIGINS. */
function isNonProductionLanDevOrigin(origin: string): boolean {
  if (env.NODE_ENV === 'production') return false;
  try {
    const { hostname } = new URL(origin);
    const h = hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (h === '[::1]' || h.endsWith('.local')) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    const m = /^172\.(\d{1,3})\./.exec(h);
    if (m) {
      const n = Number(m[1]);
      if (n >= 16 && n <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (widgetOriginsRaw === '*') return callback(null, true);
      const o = origin.trim().replace(/\/$/, '');
      const list =
        corsOriginsList && corsOriginsList.length > 0
          ? [...new Set([env.FRONTEND_URL.trim(), ...corsOriginsList])]
          : [...new Set([env.FRONTEND_URL.trim(), ...defaultProdOrigins])];
      const normalizedList = list.map((x) => x.trim().replace(/\/$/, ''));
      if (normalizedList.includes(o)) return callback(null, true);
      if (isNonProductionLanDevOrigin(origin)) return callback(null, true);
      // Never pass Error into cors callback — that invokes next(err) and preflight can miss CORS headers entirely.
      logger.warn('CORS origin denied', { origin: o });
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-admin-key', 'Cookie'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    optionsSuccessStatus: 204,
  })
);

// ─── Security ─────────────────────────────────────────────────────────────────
// Enforce HTTPS in production (rely on X-Forwarded-Proto from reverse proxy).
// Runs after CORS so OPTIONS is not 301'd without ACAO (see httpsRedirect middleware).
if (env.NODE_ENV === 'production') {
  app.use(createProductionHttpsRedirectMiddleware());
}
// JSON API only — no HTML responses; CSP on API responses confuses scanners and adds no value here.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.path === '/health',
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use('/api/payment/webhook', express.text({ type: '*/*' }));
// 1 MB is ample for all JSON API payloads. File uploads go through multer
// (its own 10 MB cap) and are not parsed by these middlewares.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', generalRateLimit);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  // Production: minimal response for load balancers (avoid feature / integration fingerprinting).
  if (env.NODE_ENV === 'production') {
    res.json({
      status: 'ok',
      service: 'tryverse-backend',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  res.json({
    status: 'ok',
    service: 'tryverse-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    features: {
      backgroundRemoval: env.ENABLE_BACKGROUND_REMOVAL,
      facePreservation: env.ENABLE_FACE_PRESERVATION,
      faceLock: env.ENABLE_FACE_LOCK,
      postProcessing: env.ENABLE_POST_PROCESSING,
      imageModeration: env.ENABLE_IMAGE_MODERATION,
      cdnEnabled: !!env.CLOUDFLARE_CDN_DOMAIN,
      sentryEnabled: !!env.SENTRY_DSN,
      paystackEnabled: !!env.PAYSTACK_SECRET_KEY,
      flutterwaveEnabled: !!env.FLUTTERWAVE_SECRET_KEY,
    },
  });
});

// ─── Bull Board — Queue Monitoring UI ────────────────────────────────────────
// Mounted at /admin/queues — protected by x-admin-key header
async function mountBullBoard(): Promise<void> {
  try {
    const { createBullBoard } = await import('@bull-board/api');
    const { BullAdapter } = await import('@bull-board/api/bullAdapter');
    const { ExpressAdapter } = await import('@bull-board/express');
    const { getTryOnQueue } = await import('./services/queue/producer');

    const queue = getTryOnQueue();
    if (!queue) {
      logger.warn('Bull Board: queue not available');
      return;
    }

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullAdapter(queue)],
      serverAdapter,
    });

    app.use('/admin/queues', requireAdmin, serverAdapter.getRouter());
    logger.info('Bull Board mounted at /admin/queues');
  } catch (err) {
    logger.warn('Bull Board not available', { error: String(err) });
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/early-access', earlyAccessRouter);
app.use('/api/support', supportRouter);
app.use('/api/invite', inviteRouter);
app.use('/api/auth/invite', authInviteRouter);
app.use('/api/upload',    uploadRouter);
app.use('/api/tryon',     tryonRouter);
app.use('/api/credits',   creditsRouter);
app.use('/api/usage',     usageRouter);
app.use('/api/payment',   paymentRouter);
app.use('/api/widget',    widgetRouter);
app.use('/api/models',    modelsRouter);
app.use('/api/products',  productsRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/emails',    emailsRouter);
app.use('/api/account',   accountRouter);

// ─── Sentry error handler ────────────────────────────────────────────────────
try {
  // @ts-expect-error Handlers available in older @sentry/node builds
  if (Sentry.Handlers?.errorHandler) app.use(Sentry.Handlers.errorHandler());
} catch { /* skip */ }

// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectRedis();
  const { logStorageBucketStatus } = await import('./config/storageHealth');
  await logStorageBucketStatus();
  await mountBullBoard();

  app.listen(env.PORT, () => {
    logger.info('TryVerse Backend running', {
      port: env.PORT,
      env: env.NODE_ENV,
      frontend: env.FRONTEND_URL,
      convexUrl: env.CONVEX_URL.replace(/\/$/, ''),
    });
    if (env.NODE_ENV !== 'production') {
      logger.info(
        'JWT verification uses CONVEX_URL above — it must match VITE_CONVEX_URL in the web app or Bearer auth will fail.'
      );
    }
    logger.info('Clothing try-on routing (effective)', {
      clothingUseFashn: env.TRYON_CLOTHING_USE_FASHN,
      fashnFallbackToIdm: env.TRYON_FASHN_FALLBACK_IDM,
      fluxKontextAllClothing: env.REPLICATE_USE_FLUX_KONTEXT,
      fashnModel: env.REPLICATE_MODEL_ACCESSORIES?.split(':')[0] ?? '(unset)',
      idmClothingModel: env.REPLICATE_MODEL_CLOTHING?.split(':')[0] ?? '(unset)',
    });
    logger.info(`Health:     http://localhost:${env.PORT}/health`);
    logger.info(`API:        http://localhost:${env.PORT}/api`);
    logger.info(`Queue UI:   http://localhost:${env.PORT}/admin/queues`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: String(err) });
  process.exit(1);
});

export default app;
