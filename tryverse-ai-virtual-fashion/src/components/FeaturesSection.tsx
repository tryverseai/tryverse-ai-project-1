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
      "Photorealistic AI previews of customers wearing any product from your catalog — clothing, accessories, and jewelry.",
  },
  {
    icon: Ruler,
    title: "Fit Prediction Engine",
    description:
      "AI analyzes body proportions and garment measurements to predict the best size and fit for each customer.",
  },
  {
    icon: Camera,
    title: "AI Marketing Assets",
    description:
      "Automatically generate model shots, product visuals, and promotional images — no photoshoot required.",
  },
  {
    icon: Video,
    title: "AI Product Videos",
    description:
      "Turn try-on images into short, realistic product videos for ads and social media — no extra shoots required.",
  },
  {
    icon: Code2,
    title: "API & Widget SDK",
    description:
      "Embed virtual try-on into any e-commerce platform with a single script tag or integrate via REST API.",
  },
  {
    icon: BarChart3,
    title: "Brand Dashboard",
    description:
      "Manage catalogs, view try-on analytics, track conversion lifts, and monitor fit prediction performance.",
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
            Platform
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 leading-tight px-1">
            Everything Brands Need to Sell Fashion Online
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed px-1">
            From virtual try-on to AI content generation — a complete infrastructure for modern fashion commerce.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: Math.min(i * 0.06, 0.36), duration: 0.75, ease: GLASS_EASE }}
              whileHover={{
                y: -6,
                transition: { duration: 0.7, ease: GLASS_EASE },
              }}
              className={glassOuter}
            >
              <div className={glassInnerCard}>
                <div
                  className="relative z-[2] mb-4 sm:mb-5 flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-soft transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                >
                  <feature.icon className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
                </div>
                <h3 className="relative z-[2] font-display text-base sm:text-lg font-semibold text-foreground mb-2 leading-snug">
                  {feature.title}
                </h3>
                <p className="relative z-[2] text-muted-foreground text-sm leading-relaxed flex-1">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Video — same glass rim; video sits above shine layer */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, ease: GLASS_EASE }}
          whileHover={{ y: -4, transition: { duration: 0.65, ease: GLASS_EASE } }}
          className={`${glassOuter} mt-12 sm:mt-16 max-w-4xl mx-auto`}
        >
          <div
            className={cn(
              glassInner,
              "!p-0 overflow-hidden bg-white/50 supports-[backdrop-filter]:backdrop-blur-[24px]"
            )}
          >
            <div className="relative z-[2] aspect-video w-full overflow-hidden rounded-[14px] sm:rounded-[26px] bg-muted/30">
              <AutoPlayVideo
                src={featuresModelVideo}
                poster={featuresSofaPoster}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
