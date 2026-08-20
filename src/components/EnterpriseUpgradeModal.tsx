import { Link } from "react-router-dom";
import {
  Sparkles,
  Mail,
  ArrowRight,
  Users,
  Repeat,
  Palette,
  Camera,
  Megaphone,
  ShoppingBag,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { posthogCapture } from "@/lib/posthog";

export type EnterpriseUpgradeContext = "photoshoot" | "models" | "outfit-builder" | "product-model" | "video";

interface EnterpriseUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which feature triggered the upgrade prompt — varies the copy and use cases shown. */
  context: EnterpriseUpgradeContext;
}

const PHOTOSHOOT_USE_CASES = [
  { icon: Camera, label: "Professional catalog photography, no studio required" },
  { icon: Layers, label: "Shoot the same product on multiple models" },
  { icon: Megaphone, label: "Product launch campaigns" },
  { icon: ShoppingBag, label: "Ecommerce promotional content" },
  { icon: Sparkles, label: "Consistent, on-brand imagery at scale" },
];

const MODEL_USE_CASES = [
  { icon: Sparkles, label: "Unlimited AI fashion models" },
  { icon: Users, label: "Brand-specific model libraries" },
  { icon: Repeat, label: "Consistent campaign models" },
  { icon: Palette, label: "Diversity of age, gender, ethnicity, skin tone, hairstyle & body type" },
  { icon: ShoppingBag, label: "Reuse generated models across Try-Ons" },
];

const OUTFIT_BUILDER_USE_CASES = [
  { icon: Layers, label: "Full outfits from multiple products, not just one item at a time" },
  { icon: ShoppingBag, label: "Top + bottom, dresses, and shoes shown together" },
  { icon: Sparkles, label: "Higher purchase confidence for complete looks" },
  { icon: Megaphone, label: "Cross-sell related products automatically" },
];

const PRODUCT_MODEL_USE_CASES = [
  { icon: Camera, label: "Turn a flat-lay product photo into professional model photography" },
  { icon: Sparkles, label: "No studio, no photographer, no model booking" },
  { icon: Users, label: "Optionally guide identity with a face reference" },
  { icon: ShoppingBag, label: "Catalog-ready imagery in minutes" },
];

const VIDEO_USE_CASES = [
  { icon: Sparkles, label: "Turn a still result into a short animated clip" },
  { icon: Megaphone, label: "Content for Reels, TikTok, and product ads" },
  { icon: Repeat, label: "5 or 10 second clips, up to 1080p" },
];

const COPY: Record<
  EnterpriseUpgradeContext,
  { eyebrow: string; title: string; description: string; useCases: typeof PHOTOSHOOT_USE_CASES }
> = {
  photoshoot: {
    eyebrow: "AI Product Photoshoot",
    title: "AI Product Photoshoot is an Enterprise feature",
    description:
      "Upload a product photo and shoot it on any model in your library — no studio, no photographer. Upgrade to Enterprise to unlock generation.",
    useCases: PHOTOSHOOT_USE_CASES,
  },
  models: {
    eyebrow: "AI Model Studio",
    title: "AI Model Studio is an Enterprise feature",
    description:
      "Build a full library of diverse, campaign-ready digital talent for your catalog. Upgrade to Enterprise to unlock generation.",
    useCases: MODEL_USE_CASES,
  },
  "outfit-builder": {
    eyebrow: "Outfit Builder",
    title: "Outfit Builder is an Enterprise feature",
    description:
      "Combine a top, bottom, and shoes into one complete look on a single model — not just one product at a time. Upgrade to Enterprise to unlock it.",
    useCases: OUTFIT_BUILDER_USE_CASES,
  },
  "product-model": {
    eyebrow: "Product Photography",
    title: "Product Photography is an Enterprise feature",
    description:
      "Turn a product photo into professional on-model photography, instantly. Upgrade to Enterprise to unlock generation.",
    useCases: PRODUCT_MODEL_USE_CASES,
  },
  video: {
    eyebrow: "AI Video",
    title: "AI Video is an Enterprise feature",
    description:
      "Animate a still result into a short clip for social and ads. Upgrade to Enterprise to unlock it.",
    useCases: VIDEO_USE_CASES,
  },
};

export function EnterpriseUpgradeModal({ open, onOpenChange, context }: EnterpriseUpgradeModalProps) {
  const copy = COPY[context];

  const handleUpgradeClick = () => {
    posthogCapture("enterprise_upgrade_modal_cta_clicked", { context, cta: "upgrade" });
  };

  const handleContactSalesClick = () => {
    posthogCapture("enterprise_upgrade_modal_cta_clicked", { context, cta: "contact_sales" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <Badge variant="secondary" className="w-fit mb-2 gap-1">
            <Sparkles className="h-3 w-3" /> {copy.eyebrow}
          </Badge>
          <DialogTitle className="font-display text-xl">{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {copy.useCases.map((useCase) => (
            <li key={useCase.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
                <useCase.icon className="h-4 w-4 text-foreground" />
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed pt-1.5">{useCase.label}</p>
            </li>
          ))}
        </ul>

        <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
          <Button asChild className="w-full gradient-primary text-primary-foreground shadow-soft gap-2" onClick={handleUpgradeClick}>
            <Link to="/pricing">
              Upgrade to Enterprise <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full gap-2" onClick={handleContactSalesClick}>
            <a href="mailto:sales@tryverseai.com?subject=TryVerse%20Enterprise%20%2F%20custom%20plan">
              <Mail className="h-4 w-4" /> Contact Sales
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
