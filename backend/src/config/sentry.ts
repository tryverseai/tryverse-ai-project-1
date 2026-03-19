import * as Sentry from '@sentry/node';
import { env } from './env';
import { logger } from './logger';

/**
 * SENTRY ERROR MONITORING
 *
 * Captures:
 * - AI inference failures (Replicate errors, timeouts)
 * - API crashes (unhandled exceptions)
 * - Payment errors (webhook processing failures)
 * - Queue job failures
 *
 * Set SENTRY_DSN in .env to enable. Optional — gracefully disabled if not set.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry not configured (SENTRY_DSN not set)');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.2,
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      event.tags = { ...event.tags, environment: env.NODE_ENV };
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['x-api-key'];
        delete event.request.headers['x-admin-key'];
      }
      return event;
    },
  });

  logger.info('Sentry initialized', { env: env.NODE_ENV });
}

/**
 * Captures an AI-specific error with context.
 */
export function captureAiError(err: Error, context: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;

  Sentry.captureException(err, {
    tags: { type: 'ai_inference' },
    extra: context,
  });
}

/**
 * Captures a payment processing error.
 */
export function capturePaymentError(err: Error, context: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;

  Sentry.captureException(err, {
    tags: { type: 'payment' },
    level: 'error',
    extra: context,
  });
}

/**
 * Captures a queue job failure with job details.
 */
export function captureJobFailure(err: Error, jobData: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;

  Sentry.captureException(err, {
    tags: { type: 'queue_job_failure', feature: 'try_on' },
    level: 'error',
    extra: jobData,
  });
}

/**
 * Captures an authentication error.
 */
export function captureAuthError(msg: string, context: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;

  Sentry.captureMessage(msg, {
    level: 'warning',
    tags: { feature: 'auth', type: 'auth_error' },
    extra: context,
  });
}

export { Sentry };
