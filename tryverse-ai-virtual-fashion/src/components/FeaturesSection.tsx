import { motion } from "framer-motion";
import { Eye, Ruler, Camera, BarChart3, Code2, Video } from "lucide-react";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import featuresModelVideo from "@/assets/features-model-video.mp4";
import featuresSofaPoster from "@/assets/features-model-sofa.jpg";
import { cn } from "@/lib/utils";
import { GLASS_EASE, glassOuter, glassInner, glassInnerCard, glassSectionBackdrop } from "@/lib/glassFrame";

const features = [
  {
    icon: Eye,
    title: "Virtual Try-On",
    description:
      "Photorealistic clothing previews on your storefront — shoppers see how garments look before they buy.",
  },
  {
    icon: Ruler,
    title: "Fit Prediction Engine",
    description:
      "AI analyzes body proportions and garment context to suggest size and fit for shoppers directly on your site.",
  },
  {
    icon: Camera,
    title: "AI Marketing Assets",
    description:
      "Auto-generate model shots, catalog visuals, and campaign stills — less reliance on full studio shoots.",
  },
  {
    icon: Video,
    title: "AI Product Videos",
    description:
      "Turn try-on stills into short, realistic clips for ads, PDPs, and social — built for brand and growth teams.",
  },
  {
    icon: Code2,
    title: "API & Widget SDK",
    description:
      "Drop-in widget or REST API for Shopify, custom stacks, and headless storefronts — ship try-on without rebuilding your stack.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description:
      "Track try-on engagement, conversion lift, and return-rate impact from your brand dashboard.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative bg-white py-16 sm:py-24 md:py-32 overflow-hidden">
      <div className={glassSectionBackdrop} aria-hidden />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14 md:mb-16 max-w-3xl mx-auto"
        >
          <p className="text-xs font-medium text-muted-foreground mb-2 sm:mb-3 tracking-[0.2em] uppercase">
            Platform Features
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 leading-tight">
            Built for Fashion Brands
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Everything you need to embed AI virtual try-on on your store — widget, API, dashboard, and analytics in one
            platform.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 md:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: Math.min(i * 0.08, 0.32), duration: 0.8, ease: GLASS_EASE }}
              className={glassOuter}
            >
              <div className={cn(glassInnerCard, "gap-4")}>
                <div className="relative z-[2] flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-soft">
                  <feature.icon className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
                </div>
                <h3 className="relative z-[2] font-display text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="relative z-[2] text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={cn(glassOuter, "mt-12 sm:mt-16 max-w-4xl mx-auto")}
        >
          <div className={cn(glassInner, "flex flex-col md:flex-row items-center gap-6 p-6 sm:p-8")}>
            <div className="relative w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden shrink-0">
              <AutoPlayVideo src={featuresModelVideo} poster={featuresSofaPoster} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Embed in minutes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add the TryVerse widget to your product pages with a single script tag. Works with Shopify, WooCommerce,
                and custom storefronts.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
