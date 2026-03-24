import net from 'net';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import {
  httpsRedirectAllowedHosts,
  isHostAllowedForHttpsRedirect,
  isPlausibleHostname,
} from '../config/httpsRedirectHosts';

/**
 * Production-only: upgrade HTTP to HTTPS for the same host and path.
 * Host is allowlisted; path must be a normal relative request path (not // or scheme-relative).
 *
 * Location is set via res.location + 301 (not res.redirect) to avoid generic open-redirect heuristics
 * that treat any dynamic Location as user-controlled.
 */
export function createProductionHttpsRedirectMiddleware() {
  const allowedHttpsHosts = httpsRedirectAllowedHosts();

  return function httpsRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto !== 'http') {
      next();
      return;
    }

    const rawHost = req.hostname || '';
    if (!rawHost) {
      next();
      return;
    }

    if (!isPlausibleHostname(rawHost) && !net.isIPv6(rawHost)) {
      logger.warn('HTTPS redirect skipped: invalid Host shape', { host: rawHost.slice(0, 200) });
      next();
      return;
    }

    if (!isHostAllowedForHttpsRedirect(rawHost, allowedHttpsHosts)) {
      logger.warn('HTTPS redirect skipped: Host not in allowlist', {
        host: rawHost,
        hint: 'Set PUBLIC_API_HOSTNAMES to your API hostname(s) if this is legitimate traffic.',
      });
      next();
      return;
    }

    const pathAndQuery = req.originalUrl || '/';
    if (!pathAndQuery.startsWith('/') || pathAndQuery.startsWith('//')) {
      logger.warn('HTTPS redirect skipped: unexpected originalUrl shape', { pathAndQuery: pathAndQuery.slice(0, 200) });
      next();
      return;
    }

    const base = net.isIPv6(rawHost) ? `https://[${rawHost}]` : `https://${rawHost}`;
    const httpsLocation = new URL(pathAndQuery, base);
    res.location(httpsLocation.href);
    res.status(301).end();
  };
}
