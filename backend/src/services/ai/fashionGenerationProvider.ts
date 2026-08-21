/**
 * FashionGenerationProvider — a single, provider-agnostic entry point for the fashion-generation
 * features that call FASHN with no engine-routing logic of their own (Outfit Builder, Product
 * Photography, AI Video, AI Model Generation, AI Photoshoot). Features call this module, not
 * `fashn.ts` (or any other provider SDK) directly, so swapping/adding a provider later means
 * changing this one file instead of every feature's pipeline.
 *
 *   Outfit Builder        ↘
 *   Product Photography  →
 *   AI Video              →  FashionGenerationProvider  →  FASHN
 *   AI Model Generation   →
 *   AI Photoshoot          ↗
 *
 * Deliberately NOT wrapping Virtual Try-On's pipeline (`pipeline.ts`): it has its own
 * topology/engine-selection logic (FASHN vs IDM-VTON vs Flux Kontext, with retry/fallback
 * behavior) that is intentionally more than a single provider call — routing it through here
 * would either flatten that logic or just move the same complexity into this file. Left as-is.
 */
import {
  runFashnOutfit,
  runFashnProductToModel,
  runFashnImageToVideo,
  runFashnModelCreate,
  runFashnModelSwap,
  type FashnOutfitOutput,
  type FashnProductToModelInput,
  type FashnImageToVideoInput,
  type FashnModelCreateInput,
  type FashnModelSwapInput,
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

  /** AI Model Generation: a text prompt alone → a new fashion model image (no input photo). */
  createModel(input: FashnModelCreateInput): Promise<GenerationResult> {
    return runFashnModelCreate(input);
  },

  /** Identity swap: keeps the clothing in a photo, changes who appears to be wearing it. */
  swapModel(input: FashnModelSwapInput): Promise<GenerationResult> {
    return runFashnModelSwap(input);
  },
} as const;
