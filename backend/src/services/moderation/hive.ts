import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * HIVE IMAGE MODERATION
 *
 * Runs before the AI pipeline to prevent:
 * - Inappropriate / NSFW content
 * - Spam uploads
 * - Abuse of the free tier
 *
 * Uses Hive Moderation API (https://hivemoderation.com)
 */

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  classes: Record<string, number>;
}

const HIVE_API_URL = 'https://api.thehive.ai/api/v2/task/sync';

// Thresholds for blocking content
const BLOCK_THRESHOLDS: Record<string, number> = {
  'very_suggestive': 0.7,
  'suggestive': 0.85,
  'explicit_nudity': 0.5,
  'very_explicit': 0.4,
  'general_nsfw': 0.75,
};

/**
 * Checks an image URL against Hive's content moderation API.
 * Returns safe: false with a reason if content is inappropriate.
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  if (env.ENABLE_IMAGE_MODERATION !== true) {
    return { safe: true, classes: {} };
  }
  if (!env.HIVE_API_KEY) {
    // Moderation disabled — allow all
    return { safe: true, classes: {} };
  }

  try {
    const response = await axios.post(
      HIVE_API_URL,
      { url: imageUrl },
      {
        headers: {
          Authorization: `Token ${env.HIVE_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 8000,
      }
    );

    const classes: Record<string, number> = {};
    const output = response.data?.status?.[0]?.response?.output?.[0]?.classes || [];

    for (const item of output) {
      classes[item.class] = item.score;
    }

    // Check against block thresholds
    for (const [className, threshold] of Object.entries(BLOCK_THRESHOLDS)) {
      if ((classes[className] || 0) >= threshold) {
        logger.warn('Image failed moderation', { class: className, score: classes[className] });
        return {
          safe: false,
          reason: 'Image contains inappropriate content and cannot be processed.',
          classes,
        };
      }
    }

    return { safe: true, classes };
  } catch (err) {
    // If Hive is down or rate-limited, log and allow (fail-open for availability)
    logger.error('Hive moderation check failed', { error: String(err) });
    return { safe: true, classes: {} };
  }
}

/**
 * Moderates both images in a try-on request.
 * Fails if either image is inappropriate.
 */
export async function moderateTryOnImages(
  personImageUrl: string,
  productImageUrl: string
): Promise<{ safe: boolean; reason?: string }> {
  const [personResult, productResult] = await Promise.all([
    moderateImage(personImageUrl),
    moderateImage(productImageUrl),
  ]);

  if (!personResult.safe) {
    return { safe: false, reason: `Person image: ${personResult.reason}` };
  }
  if (!productResult.safe) {
    return { safe: false, reason: `Product image: ${productResult.reason}` };
  }

  return { safe: true };
}
