import { motion } from "framer-motion"; // refreshed
import { Eye, Ruler, Camera, BarChart3, Code2, Video } from "lucide-react";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import featuresModelVideo from "@/assets/features-model-video.mp4";
import featuresSofaPoster from "@/assets/features-model-sofa.jpg";

const features = [
  {
    icon: Eye,
    title: "Virtual Try-On",
    description: "Photorealistic AI previews of customers wearing any product from your catalog — clothing, accessories, and jewelry.",
  },
  {
    icon: Ruler,
    title: "Fit Prediction Engine",
    description: "AI analyzes body proportions and garment measurements to predict the best size and fit for each customer.",
  },
  {
    icon: Camera,
    title: "AI Marketing Assets",
    description: "Automatically generate model shots, product visuals, and promotional images — no photoshoot required.",
  },
  {
    icon: Video,
    title: "AI Product Videos",
    description: "Turn try-on images into short, realistic product videos for ads and social media — no extra shoots required.",
  },
  {
    icon: Code2,
    title: "API & Widget SDK",
    description: "Embed virtual try-on into any e-commerce platform with a single script tag or integrate via REST API.",
  },
  {
    icon: BarChart3,
    title: "Brand Dashboard",
    description: "Manage catalogs, view try-on analytics, track conversion lifts, and monitor fit prediction performance.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Platform</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything Brands Need to Sell Fashion Online
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From virtual try-on to AI content generation — a complete infrastructure for modern fashion commerce.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-2xl p-7 border border-border/50 hover:shadow-elevated hover:border-foreground/10 transition-all duration-300 group"
            >
              <div className="w-11 h-11 rounded-xl bg-foreground/[0.06] flex items-center justify-center mb-5 group-hover:gradient-primary group-hover:shadow-soft transition-all duration-300">
                <feature.icon className="h-5 w-5 text-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Video showcase */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-16 rounded-2xl overflow-hidden border border-border/30 shadow-elevated aspect-video max-w-4xl mx-auto"
        >
          <AutoPlayVideo
            src={featuresModelVideo}
            poster={featuresSofaPoster}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
