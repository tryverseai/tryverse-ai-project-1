import Replicate from 'replicate';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getSignedUrl, uploadResultBuffer, INPUT_BUCKET, RESULT_BUCKET } from '../storage/images';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../../config/convexHttp';
import { resolveModelImageUrl } from '../models/modelLibrary';
import { AppError } from '../../middleware/errorHandler';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

export type PhotoshootModelSource = 'library' | 'generated';

export interface ProductPhotoshootParams {
  productStoragePath: string;
  modelId: string;
  modelSource: PhotoshootModelSource;
  background?: string;
  theme?: string;
  lighting?: string;
}

export interface ProductPhotoshootResult {
  storagePath: string;
  createdAt: string;
}

/**
 * Resolves the chosen model (stock library or the brand's own saved AI-generated model) to a
 * fetchable image URL. Exported for reuse by the Outfit Builder (`aiStudio.ts` outfit routes),
 * which picks a model the same way this feature does.
 */
export async function resolveModelUrl(userId: string, modelId: string, source: PhotoshootModelSource): Promise<string> {
  if (source === 'library') {
    const row = await convexQueryTrusted<{ id: string; image_url: string; is_active: boolean } | null>(
      anyApi.backendTrusted.getModelForResolvePath,
      { secret: env.BACKEND_SHARED_SECRET, idOrSlug: modelId }
    );
    if (!row || !row.is_active) throw new AppError('Model not found or inactive', 404);
    return resolveModelImageUrl(row.image_url);
  }

  const saved = (await convexQueryTrusted(anyApi.backendTrusted.listGeneratedAiModels, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
  })) as Array<{ id: string; storagePath: string }>;
  const match = saved.find((m) => m.id === modelId);
  if (!match) throw new AppError('Saved model not found', 404);
  return getSignedUrl(RESULT_BUCKET, match.storagePath);
}

/**
 * Generates a professional product-photography composite: the brand's own uploaded product photo,
 * shown on a model they picked (from the stock library or their saved AI-generated models).
 * Enterprise-only — caller must already have enforced `requirePlan('enterprise')`.
 */
export async function generateProductPhotoshoot(
  userId: string,
  params: ProductPhotoshootParams
): Promise<ProductPhotoshootResult> {
  const model = env.REPLICATE_MODEL_PRODUCT_PHOTOSHOOT;
  const [productUrl, modelUrl] = await Promise.all([
    getSignedUrl(INPUT_BUCKET, params.productStoragePath),
    resolveModelUrl(userId, params.modelId, params.modelSource),
  ]);

  const prompt = [
    'Professional e-commerce product photography: dress the model in the provided product,',
    `${params.theme || 'contemporary catalog'} theme, ${params.lighting || 'soft studio'} lighting,`,
    `${params.background || 'clean neutral'} background,`,
    'commercial fashion catalog quality, sharp focus, no visible AI artifacts, photorealistic, keep the model\'s identity consistent',
  ].join(' ');

  logger.info('Generating product photoshoot', { userId, model: model.split('/')[1]?.split(':')[0] });

  const output = await replicate.run(model as `${string}/${string}:${string}`, {
    input: {
      prompt,
      input_image_1: modelUrl,
      input_image_2: productUrl,
      aspect_ratio: '4:5',
      output_format: 'jpg',
    },
  });

  const urlHolder = Array.isArray(output) ? output[0] : output;
  const imageUrl =
    typeof urlHolder === 'string'
      ? urlHolder
      : typeof (urlHolder as { url?: () => string })?.url === 'function'
        ? (urlHolder as { url: () => string }).url()
        : String(urlHolder);

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download photoshoot image (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const storagePath = await uploadResultBuffer(buffer, userId);

  await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    feature: 'ai_photoshoot',
  });

  return { storagePath, createdAt: new Date().toISOString() };
}
