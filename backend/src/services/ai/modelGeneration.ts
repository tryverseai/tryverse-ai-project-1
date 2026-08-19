import Replicate from 'replicate';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { uploadResultBuffer } from '../storage/images';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../../config/convexHttp';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

/** Mirrors fashn.ts's poll cadence — flux-schnell generations here have run 60-90s under load. */
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 150_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AiModelGenerationParams {
  /** Free-text description of the model the brand wants — e.g. "professional African fashion
   * model, female, age 28, dark skin, studio lighting, luxury editorial fashion campaign." */
  prompt: string;
}

export interface SavedAiModel {
  id: string;
  storagePath: string;
  params: AiModelGenerationParams;
  createdAt: string;
}

function buildReplicateInput(prompt: string) {
  return {
    prompt,
    aspect_ratio: '3:4',
    output_format: 'jpg',
    num_outputs: 1,
  };
}

export function buildPrompt(p: AiModelGenerationParams): string {
  return [
    p.prompt.trim(),
    'professional fashion photography, high detail, editorial quality, photorealistic, full body shot',
  ].join(', ');
}

/**
 * Generates a single consistent AI fashion model image via Replicate (Enterprise "Generate AI
 * Model" feature) and stores it in Convex, then saves the library entry. Caller must already
 * have enforced `requirePlan('enterprise')` — this function does not check plan itself.
 */
export async function generateAndSaveAiModel(
  userId: string,
  params: AiModelGenerationParams
): Promise<SavedAiModel> {
  const model = env.REPLICATE_MODEL_AI_MODEL_GENERATION;
  const prompt = buildPrompt(params);

  logger.info('Generating AI fashion model', { userId, model: model.split('/')[1]?.split(':')[0] });

  // replicate.run()'s built-in synchronous wait gives up before this model's actual generation
  // time under load (observed 60-90s) and returns a null/empty output even though the prediction
  // goes on to succeed seconds later — confirmed against Replicate's own prediction records
  // during QA. Explicit create-then-poll (same pattern fashn.ts already uses reliably) doesn't
  // have that ceiling.
  const [modelRef, versionHash] = model.split(':');
  const createOptions = versionHash
    ? { version: versionHash, input: buildReplicateInput(prompt) }
    : { model: modelRef, input: buildReplicateInput(prompt) };
  let prediction = await replicate.predictions.create(createOptions);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) {
      throw new Error('AI model generation timed out — please try again.');
    }
    await sleep(POLL_INTERVAL_MS);
    prediction = await replicate.predictions.get(prediction.id);
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(
      `AI model generation failed: ${typeof prediction.error === 'string' ? prediction.error : prediction.status}`
    );
  }

  const output = prediction.output as unknown;
  const urlHolder = Array.isArray(output) ? output[0] : output;
  if (urlHolder === null || urlHolder === undefined) {
    logger.error('AI model generation: succeeded prediction has no output', {
      predictionId: prediction.id,
      outputType: typeof output,
    });
    throw new Error('Replicate returned no output for this generation — please try again.');
  }
  const imageUrl =
    typeof urlHolder === 'string'
      ? urlHolder
      : typeof (urlHolder as { url?: () => string })?.url === 'function'
        ? (urlHolder as { url: () => string }).url()
        : String(urlHolder);

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download generated model image (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const storagePath = await uploadResultBuffer(buffer, userId);

  const saved = (await convexMutationTrusted(anyApi.backendTrusted.saveGeneratedAiModel, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    storagePath,
    params,
  })) as { id: string };

  await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    feature: 'ai_model',
  });

  return { id: saved.id, storagePath, params, createdAt: new Date().toISOString() };
}

export async function listSavedAiModels(userId: string): Promise<SavedAiModel[]> {
  return convexQueryTrusted<SavedAiModel[]>(anyApi.backendTrusted.listGeneratedAiModels, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
  });
}

export async function archiveSavedAiModel(userId: string, modelId: string): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.archiveGeneratedAiModel, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    modelId,
  });
}
