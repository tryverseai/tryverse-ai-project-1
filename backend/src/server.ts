import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSentry, Sentry } from './config/sentry';
import { connectRedis } from './config/redis';
import { generalRateLimit } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requireAdmin } from './middleware/auth';

// Routes
import uploadRouter from './routes/upload';
import tryonRouter from './routes/tryon';
import creditsRouter from './routes/credits';
import usageRouter from './routes/usage';
import paymentRouter from './routes/payment';
import widgetRouter from './routes/widget';
import productsRouter from './routes/products';
import adminRouter from './routes/admin';
import analyticsRouter from './routes/analytics';
import emailsRouter from './routes/emails';
import earlyAccessRouter from './routes/earlyAccess';

// ─── Sentry (must init before everything else) ────────────────────────────────
initSentry();

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

// ─── Security ─────────────────────────────────────────────────────────────────
// Enforce HTTPS in production (rely on X-Forwarded-Proto from reverse proxy)
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto === 'http') {
      const host = req.headers.host || '';
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    next();
  });
}
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:3000',
  ...(env.WIDGET_ALLOWED_ORIGINS === '*' ? [] : env.WIDGET_ALLOWED_ORIGINS.split(',')),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (env.WIDGET_ALLOWED_ORIGINS === '*') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-admin-key'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', generalRateLimit);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'tryverse-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    features: {
      backgroundRemoval: env.ENABLE_BACKGROUND_REMOVAL,
      facePreservation: env.ENABLE_FACE_PRESERVATION,
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
app.use('/api/upload',    uploadRouter);
app.use('/api/tryon',     tryonRouter);
app.use('/api/credits',   creditsRouter);
app.use('/api/usage',     usageRouter);
app.use('/api/payment',   paymentRouter);
app.use('/api/widget',    widgetRouter);
app.use('/api/products',  productsRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/emails',    emailsRouter);

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
  await mountBullBoard();

  app.listen(env.PORT, () => {
    logger.info('TryVerse Backend running', {
      port: env.PORT,
      env: env.NODE_ENV,
      frontend: env.FRONTEND_URL,
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
