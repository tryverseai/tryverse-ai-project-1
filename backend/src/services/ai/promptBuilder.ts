/**
 * Dynamic prompt builder for virtual try-on.
 * Builds hidden instructions based on product type, pose, and quality requirements.
 * User never sees these prompts — they are sent to the AI model only.
 */

import type { ProductCategory } from '../../types';

export interface PromptContext {
  category: ProductCategory;
  productDescription?: string;
  bodyDetected: boolean;
  /** Inferred from image aspect ratio / dimensions: 'full_body' | 'half_body' | 'face_only' */
  poseType?: 'full_body' | 'half_body' | 'face_only';
  /** Optional: specific garment type (shirt, dress, glasses, etc.) from productDescription or category */
  garmentHint?: string;
}

/**
 * Builds a dynamic try-on prompt optimized for the given context.
 * Adapts instructions based on product type and pose for premium output quality.
 */
export function buildTryOnPrompt(ctx: PromptContext): string {
  const parts: string[] = [];

  // Core instruction
  if (ctx.category === 'glasses') {
    parts.push('Place the eyewear from the second image accurately on the person\'s face.');
    parts.push('Align the glasses with the eyes and facial perspective.');
  } else if (ctx.category === 'bags') {
    parts.push('Replace or add the bag/accessory from the second image onto the person.');
    parts.push('Ensure the bag sits naturally with the body pose and fits the context.');
  } else {
    parts.push('Replace the person\'s clothing with the garment from the second image.');
  }

  // Context layer — product type
  const garmentHint = (ctx.productDescription || ctx.garmentHint || '').toLowerCase();
  if (ctx.category === 'clothing') {
    if (garmentHint.includes('dress') || garmentHint.includes('gown')) {
      parts.push('Ensure the dress flows naturally with the body shape and follows gravity and fabric draping.');
    } else if (
      garmentHint.includes('shirt') || garmentHint.includes('top') || garmentHint.includes('blouse') ||
      garmentHint.includes('jacket') || garmentHint.includes('sweater') || garmentHint.includes('tee')
    ) {
      parts.push('Ensure the top fits naturally on the upper body and aligns with shoulder and torso structure.');
    } else if (garmentHint.includes('pant') || garmentHint.includes('jeans') || garmentHint.includes('trouser')) {
      parts.push('Ensure the bottom fits naturally on the lower body with correct waist and length.');
    } else {
      parts.push('Ensure the garment fits naturally based on body shape and pose.');
    }
  }

  // Pose detection layer
  if (ctx.poseType === 'full_body' || (ctx.bodyDetected && !ctx.poseType)) {
    parts.push('Adapt the clothing to match the person\'s pose and body orientation.');
    if (ctx.category === 'clothing') {
      parts.push('Ensure full outfit alignment from top to bottom.');
    }
  } else if (ctx.poseType === 'half_body') {
    parts.push('Adapt the clothing to match the person\'s pose and visible body section.');
  } else if (ctx.poseType === 'face_only') {
    parts.push('Focus on accurate placement for the visible facial/upper area.');
  }

  // Identity & quality (always)
  parts.push('Preserve the person\'s face and identity.');
  parts.push('Ensure realistic lighting, shadows, and fabric texture.');
  parts.push('Avoid distortions, unnatural blending, or artifacts.');
  parts.push('Ensure seamless integration with no visible editing traces.');
  parts.push('Output must look like a real photograph.');

  return parts.join(' ');
}

/**
 * Infer pose type from image dimensions (optional enhancement).
 * Aspect ratio heuristic: portrait = likely full/half body, square = could be face.
 */
export function inferPoseType(width: number, height: number): 'full_body' | 'half_body' | 'face_only' {
  if (width < 256 || height < 256) return 'face_only';
  const ratio = height / width;
  if (ratio >= 1.2) return 'full_body';
  if (ratio >= 0.9) return 'half_body';
  return 'face_only';
}
