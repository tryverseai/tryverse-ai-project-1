import Replicate from 'replicate';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { waitForReplicateSlot } from '../replicate';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

export interface HumanParsingStageResult {
  skipped: boolean;
  /** Optional mask / parse map URL for future compositing (model-dependent). */
  auxiliaryUrl?: string;
  error?: string;
}

function extractUrl(output: unknown): string | null {
  if (typeof output === 'string' && output.startsWith('http')) return output;
  if (Array.isArray(output) && output[0]) return String(output[0]);
  if (output && typeof output === 'object' && 'url' in output) {
    const u = (output as { url: unknown }).url;
    if (typeof u === 'function') return String(u());
    if (typeof u === 'string') return u;
  }
  return null;
}

/**
 * Optional human parsing / soft-segmentation hook.
 * Set `REPLICATE_MODEL_HUMAN_PARSE` to a Replicate model that accepts `{ image: "<url>" }` and returns an image URL.
 * If unset, this stage is skipped (routing still works via garment classification + heuristics).
 */
export async function runHumanParsingStage(personImageHttpsUrl: string): Promise<HumanParsingStageResult> {
  const model = env.REPLICATE_MODEL_HUMAN_PARSE.trim();
  if (!model) {
    logger.info('tryon.humanParsing: skipped (REPLICATE_MODEL_HUMAN_PARSE unset)');
    return { skipped: true };
  }

  try {
    await waitForReplicateSlot();
    const output = await replicate.run(model as `${string}/${string}:${string}`, {
      input: { image: personImageHttpsUrl },
    });
    const url = extractUrl(output);
    if (!url) {
      logger.warn('tryon.humanParsing: model returned no URL, continuing without map');
      return { skipped: false, error: 'no_parse_url' };
    }
    logger.info('tryon.humanParsing: auxiliary map available', { urlPrefix: url.slice(0, 48) });
    return { skipped: false, auxiliaryUrl: url };
  } catch (err) {
    logger.warn('tryon.humanParsing: failed, continuing', { error: String(err) });
    return { skipped: false, error: err instanceof Error ? err.message : String(err) };
  }
}
