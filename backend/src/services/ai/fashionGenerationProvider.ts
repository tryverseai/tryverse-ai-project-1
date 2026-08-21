/**
 * FashionGenerationProvider — a single, provider-agnostic entry point for the fashion-generation
 * features that already call FASHN directly with no engine-routing logic of their own (Outfit
 * Builder, Product Photography's product-to-model path, AI Video). Features call this module,
 * not `fashn.ts` (or any other provider SDK) directly, so swapping/adding a provider later means
 * changing this one file instead of every feature's pipeline.
 *
 *   Outfit Builder      ↘
 *   Product-to-Model  →  FashionGenerationProvider  →  FASHN
 *   AI Video            ↗
 *
 * Deliberately NOT wrapping every generation feature in the app:
 *   - Virtual Try-On (`pipeline.ts`) has its own topology/engine-selection logic (FASHN vs
 *     IDM-VTON vs Flux Kontext, with retry/fallback behavior) that is intentionally more than a
 *     single provider call — routing it through here would either flatten that logic or just move
 *     the same complexity into this file. Left as-is.
 *   - AI Photoshoot (`productPhotoshoot.ts`) and AI Model Generation (`modelGeneration.ts`) are
 *     still genuinely on Replicate — see the audit note in each file for the specific FASHN
 *     capability gap that prevents a like-for-like swap (FASHN's `product-to-model` generates a
 *     new person rather than compositing onto a specific pre-chosen saved model; FASHN has no
 *     prompt-only text-to-image endpoint). Wrapping a Replicate call in a "provider" abstraction
 *     that still only has one real implementation wouldn't make the migration any more possible —
 *     it needs a genuine FASHN capability that doesn't exist yet, not a refactor.
 */
import {
  runFashnOutfit,
  runFashnProductToModel,
  runFashnImageToVideo,
  type FashnOutfitOutput,
  type FashnProductToModelInput,
  type FashnImageToVideoInput,
} from './fashn';

export type GenerationResult = FashnOutfitOutput;

export const FashionGenerationProvider = {
  /**
   * Outfit Builder: a pre-composited flat-lay of multiple garments + a styling prompt, applied to
   * one model photo.
   */
  outfitTryOn(compositeImageUrl: string, modelImageUrl: string, prompt: string): Promise<GenerationResult> {
    return runFashnOutfit(compositeImageUrl, modelImageUrl, prompt);
  },

  /** Product Photography: a flat-lay/ghost-mannequin product photo → a generated on-model shot. */
  productToModel(input: FashnProductToModelInput): Promise<GenerationResult> {
    return runFashnProductToModel(input);
  },

  /** AI Video: a still image → a short animated clip. */
  imageToVideo(input: FashnImageToVideoInput): Promise<GenerationResult> {
    return runFashnImageToVideo(input);
  },
} as const;
