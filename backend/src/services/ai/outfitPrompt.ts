import type { OutfitSlots } from './outfitSlots';

/** Product names/descriptions per slot, used to auto-generate the styling prompt. */
export type OutfitPromptInputs = Partial<Record<keyof OutfitSlots, string>>;

/**
 * Auto-generates the styling prompt FASHN's Try-On Max uses to interpret the composited flat-lay
 * (see `outfitComposite.ts`) — mirrors the manual prompting technique already proven to work
 * ("open jacket over t-shirt", "tucked shirt under blazer" per FASHN's own docs). Shoppers/brands
 * never see or write this — it's derived entirely from the selected products' names.
 */
export function buildOutfitPrompt(items: OutfitPromptInputs): string {
  const parts: string[] = [];

  if (items.one_piece) {
    parts.push(`wearing ${items.one_piece}`);
  } else if (items.top && items.bottom) {
    parts.push(`wearing ${items.top} with ${items.bottom}`);
  } else if (items.top) {
    parts.push(`wearing ${items.top}`);
  } else if (items.bottom) {
    parts.push(`wearing ${items.bottom}`);
  }

  if (items.outerwear) {
    parts.push(`layered under ${items.outerwear}, worn open`);
  }

  if (items.shoes) {
    parts.push(`styled with ${items.shoes}`);
  }

  const styling = parts.join(', ');
  return `The product image is a reference sheet showing separate garment photos on a plain white background — treat each photo as one distinct garment to dress the model in, not as a pattern, layout, or scene to reproduce. Combine them into one outfit: ${styling}. Garments should overlap and layer naturally as real clothing would (e.g. a top tucked or layered under a jacket, not floating separately), with realistic fabric drape, shadows, and proportions at the seams where pieces meet. Natural fit and proportions, photorealistic, keep the model's identity, pose, and body shape unchanged.`;
}
