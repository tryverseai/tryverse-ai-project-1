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
  const clothingParts: string[] = [];

  if (items.one_piece) {
    clothingParts.push(`wearing ${items.one_piece}`);
  } else if (items.top && items.bottom) {
    clothingParts.push(`wearing ${items.top} with ${items.bottom}`);
  } else if (items.top) {
    clothingParts.push(`wearing ${items.top}`);
  } else if (items.bottom) {
    clothingParts.push(`wearing ${items.bottom}`);
  }

  if (items.outerwear) {
    clothingParts.push(`layered under ${items.outerwear}, worn open`);
  }

  if (items.shoes) {
    clothingParts.push(`styled with ${items.shoes}`);
  }

  // Accessories are described separately from clothing (different phrasing, different placement
  // guidance below) — an outfit can now be accessories-only, with no clothing items at all.
  const accessoryParts: string[] = [];
  if (items.eyewear) accessoryParts.push(`${items.eyewear} on the face`);
  if (items.jewelry) accessoryParts.push(`${items.jewelry} positioned appropriately (ears, neck, wrists, etc. as fits the piece)`);

  const styleSentenceParts: string[] = [];
  if (clothingParts.length > 0) styleSentenceParts.push(clothingParts.join(', '));
  if (accessoryParts.length > 0) styleSentenceParts.push(`accessorized with ${accessoryParts.join(' and ')}`);
  const styling = styleSentenceParts.join(', ');

  const layeringGuidance =
    clothingParts.length > 0
      ? ' Garments should overlap and layer naturally as real clothing would (e.g. a top tucked or layered under a jacket, not floating separately), with realistic fabric drape, shadows, and proportions at the seams where pieces meet.'
      : '';
  const accessoryGuidance =
    accessoryParts.length > 0
      ? ' Place each accessory naturally in its correct real-world position on the body or face — do not resize or treat it as clothing.'
      : '';

  return `The product image is a reference sheet showing separate product photos on a plain white background — treat each photo as one distinct item to add to the model, not as a pattern, layout, or scene to reproduce. Combine them into one look: ${styling}.${layeringGuidance}${accessoryGuidance} Natural fit and proportions, photorealistic, keep the model's identity, pose, and body shape unchanged.`;
}
