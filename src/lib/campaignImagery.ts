// Bundled so the imagery ships with every deployment target (CDN-pointer media has
// previously rendered blank in production builds).
import crowd from "@/assets/campaign-crowd.jpg";
import transit from "@/assets/campaign-transit.jpg";
import seatedTrio from "@/assets/campaign-seated-trio.jpg";
import street from "@/assets/campaign-street.jpg";
import crossing from "@/assets/campaign-crossing.jpg";
import mannequins from "@/assets/campaign-mannequins.jpg";
import studio from "@/assets/campaign-studio.jpg";
import shirt from "@/assets/campaign-shirt.jpg";
import denim from "@/assets/campaign-denim.jpg";


/**
 * The TryVerse campaign library. These are brand assets, not decoration —
 * every surface that needs photography pulls from here so the visual language stays one voice.
 */
export const campaign = {
  /** Still figure seated, crowd smeared into motion around her. Stillness inside noise. */
  crowd: { src: crowd, alt: "Model seated still while a blurred crowd moves around her" },
  /** Editorial transit portrait, yellow train streaking past. */
  transit: { src: transit, alt: "Model in a black coat on a platform as a yellow train blurs past" },
  /** Three models seated on red theatre seats, one seat empty. */
  seatedTrio: { src: seatedTrio, alt: "Three models in coloured outerwear seated on red theatre seats" },
  /** White coat, still, traffic blurring across frame. */
  street: { src: street, alt: "Model in a white coat standing still as traffic blurs across the street" },
  /** Side-profile crossing in cream tailoring against a dark shutter. */
  crossing: { src: crossing, alt: "Model in cream tailoring walking a crosswalk against a dark shutter" },
  /** Invisible-mannequin renders — the literal picture of how the pipeline sees garments. */
  mannequins: { src: mannequins, alt: "Three digital mannequins wearing streetwear outfits on a white field" },
  /** Behind the scenes: the shoot itself, crew and lights inside the frame. */
  studio: { src: studio, alt: "Model in a white t-shirt photographed by two crew members inside a bright studio" },
  /** Oversized white shirt and wide-leg trousers against a grey sweep. */
  shirt: { src: shirt, alt: "Model in an oversized white shirt and black wide-leg trousers against a grey backdrop" },
  /** Cropped top and baggy light-wash denim — everyday fit, editorial light. */
  denim: { src: denim, alt: "Model in a white crop top and light-wash baggy jeans" },
} as const;

export type CampaignKey = keyof typeof campaign;
