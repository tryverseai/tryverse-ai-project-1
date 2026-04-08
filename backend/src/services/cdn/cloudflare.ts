import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * CLOUDFLARE CDN DELIVERY
 *
 * Routes try-on result images through Cloudflare for:
 * - Global edge caching (fast load times worldwide)
 * - Image optimization (WebP conversion, lazy resizing)
 * - Brand widget performance (images load instantly on embedded sites)
 *
 * Configuration options:
 * A) Cloudflare proxy in front of your image origin (signed URLs from storage, R2, etc.)
 * B) Cloudflare Images (upload via API, serve via CDN)
 * C) Cloudflare R2 (object storage, CDN-native)
 *
 * For MVP: Option A is often enough (DNS + orange-cloud proxy).
 */

export interface CdnUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'avif' | 'auto';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
}

/**
 * Rewrites an HTTPS image URL to use CLOUDFLARE_CDN_DOMAIN as the host (orange-cloud proxy).
 *
 * If CLOUDFLARE_CDN_DOMAIN is unset, returns the original URL.
 */
export function getCdnUrl(storageUrl: string, options?: CdnUrlOptions): string {
  if (!env.CLOUDFLARE_CDN_DOMAIN || !storageUrl) return storageUrl;

  try {
    const url = new URL(storageUrl);

    // Replace origin with Cloudflare CDN domain
    const cdnUrl = new URL(storageUrl);
    cdnUrl.host = env.CLOUDFLARE_CDN_DOMAIN;
    cdnUrl.protocol = 'https:';

    // Use Cloudflare Image Resizing if options provided
    // Format: /cdn-cgi/image/options/original-path
    if (options && env.CLOUDFLARE_IMAGE_RESIZING_ENABLED) {
      const params = buildCfParams(options);
      const cdnImageUrl = `https://${env.CLOUDFLARE_CDN_DOMAIN}/cdn-cgi/image/${params}${url.pathname}`;
      return cdnImageUrl;
    }

    return cdnUrl.toString();
  } catch (err) {
    logger.warn('CDN URL generation failed, returning original', { error: String(err) });
    return storageUrl;
  }
}

/**
 * Generates responsive image variants for different screen sizes.
 * Returns URLs optimized for mobile, tablet, and desktop.
 */
export function getResponsiveImageUrls(storageUrl: string): {
  thumbnail: string;
  mobile: string;
  tablet: string;
  desktop: string;
  original: string;
} {
  return {
    thumbnail: getCdnUrl(storageUrl, { width: 150, height: 200, quality: 75, format: 'webp', fit: 'cover' }),
    mobile:    getCdnUrl(storageUrl, { width: 375, height: 500, quality: 85, format: 'webp', fit: 'contain' }),
    tablet:    getCdnUrl(storageUrl, { width: 768, height: 1024, quality: 88, format: 'webp', fit: 'contain' }),
    desktop:   getCdnUrl(storageUrl, { width: 1080, height: 1440, quality: 92, format: 'webp', fit: 'contain' }),
    original:  getCdnUrl(storageUrl),
  };
}

/**
 * Purges a URL from Cloudflare's cache (e.g., after result is updated).
 */
export async function purgeCdnCache(urls: string[]): Promise<boolean> {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) return false;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    const data = await response.json() as { success: boolean };
    if (data.success) {
      logger.info('CDN cache purged', { count: urls.length });
    }
    return data.success;
  } catch (err) {
    logger.error('CDN cache purge failed', { error: String(err) });
    return false;
  }
}

function buildCfParams(options: CdnUrlOptions): string {
  const parts: string[] = [];
  if (options.width)   parts.push(`width=${options.width}`);
  if (options.height)  parts.push(`height=${options.height}`);
  if (options.quality) parts.push(`quality=${options.quality}`);
  if (options.format)  parts.push(`format=${options.format}`);
  if (options.fit)     parts.push(`fit=${options.fit}`);
  return parts.join(',');
}
