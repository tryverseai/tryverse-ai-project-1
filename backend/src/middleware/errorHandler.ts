import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { Sentry } from '../config/sentry';
import { env } from '../config/env';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Multer file size error
  if (err.message?.includes('File too large')) {
    res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
    return;
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  if (env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('environment', env.NODE_ENV);
      scope.setTag('feature', inferFeatureFromPath(req.path));
      scope.setContext('request', {
        method: req.method,
        path: req.path,
        userId: (req as Request & { user?: { id: string } }).user?.id,
      });
      Sentry.captureException(err);
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(env.NODE_ENV !== 'production' && { details: err.message }),
  });
}

function inferFeatureFromPath(path: string): string {
  if (path.includes('/tryon')) return 'try_on';
  if (path.includes('/payment')) return 'payment';
  if (path.includes('/auth') || path.includes('/upload')) return 'auth';
  if (path.includes('/admin')) return 'admin';
  return 'api';
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
