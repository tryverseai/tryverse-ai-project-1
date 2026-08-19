import Replicate from 'replicate';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { uploadResultBuffer } from '../storage/images';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../../config/convexHttp';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

export interface AiModelGenerationParams {
  gender: string;
  skinTone: string;
  pose: string;
  age: string;
  hair: string;
  background: string;
  fashionStyle: string;
}

export interface SavedAiModel {
  id: string;
  storagePath: string;
  params: AiModelGenerationParams;
  createdAt: string;
}

export function buildPrompt(p: AiModelGenerationParams): string {
  return [
    `Professional fashion photography of a ${p.age} ${p.gender} model,`,
    `${p.skinTone} skin tone, ${p.hair} hair,`,
    `${p.pose} pose, ${p.fashionStyle} fashion style,`,
    `${p.background} background,`,
    'studio lighting, high detail, editorial quality, photorealistic, full body shot, neutral expression',
  ].join(' ');
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

  const output = await replicate.run(model as `${string}/${string}:${string}`, {
    input: {
      prompt,
      aspect_ratio: '3:4',
      output_format: 'jpg',
      num_outputs: 1,
    },
  });

  const urlHolder = Array.isArray(output) ? output[0] : output;
  if (urlHolder === null || urlHolder === undefined) {
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
