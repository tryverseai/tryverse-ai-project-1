// Bundled so the imagery ships with every deployment target (CDN-pointer media has
// previously rendered blank in production builds).
import crowd from "@/assets/campaign-crowd.jpg";
import transit from "@/assets/campaign-transit.jpg";
import seatedTrio from "@/assets/campaign-seated-trio.jpg";
import street from "@/assets/campaign-street.jpg";
import crossing from "@/assets/campaign-crossing.jpg";
import mannequins from "@/assets/campaign-mannequins.jpg";


/**
 * The TryVerse campaign library. These are brand assets, not decoration —
 * every surface that needs photography pulls from here so the visual language stays one voice.
 */
export const campaign = {
  /** Still figure seated, crowd smeared into motion around her. Stillness inside noise. */
  crowd: { src: crowd.url, alt: "Model seated still while a blurred crowd moves around her" },
  /** Editorial transit portrait, yellow train streaking past. */
  transit: { src: transit.url, alt: "Model in a black coat on a platform as a yellow train blurs past" },
  /** Three models seated on red theatre seats, one seat empty. */
  seatedTrio: { src: seatedTrio.url, alt: "Three models in coloured outerwear seated on red theatre seats" },
  /** White coat, still, traffic blurring across frame. */
  street: { src: street.url, alt: "Model in a white coat standing still as traffic blurs across the street" },
  /** Side-profile crossing in cream tailoring against a dark shutter. */
  crossing: { src: crossing.url, alt: "Model in cream tailoring walking a crosswalk against a dark shutter" },
  /** Invisible-mannequin renders — the literal picture of how the pipeline sees garments. */
  mannequins: { src: mannequins.url, alt: "Three digital mannequins wearing streetwear outfits on a white field" },
} as const;

export type CampaignKey = keyof typeof campaign;
