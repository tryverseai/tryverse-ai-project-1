import { motion } from "framer-motion";
import { Eye, Sparkles, Wand2, Layers, Globe, ShieldCheck } from "lucide-react";
import { GLASS_EASE, glassOuter, glassInnerCard, glassSectionBackdrop } from "@/lib/glassFrame";

const techs = [
  {
    icon: Eye,
    title: "Product Visualization",
    description: "Transform the way customers experience products online with richer, more contextual visual experiences.",
  },
  {
    icon: Sparkles,
    title: "Virtual Try-On",
    description: "Give shoppers a more personal way to experience products before making a purchase.",
  },
  {
    icon: Wand2,
    title: "AI Fashion Content",
    description: "Create new possibilities for product imagery, model content, and campaign experiences without relying entirely on traditional production workflows.",
  },
  {
    icon: Layers,
    title: "Commerce Integration",
    description: "Connect TryVerse to the systems your business already uses and bring AI-powered experiences directly into your existing customer journey.",
  },
  {
    icon: Globe,
    title: "Built to Scale",
    description: "From early experimentation to high-volume commerce, TryVerse is designed to support growing brands and increasingly demanding customer experiences.",
  },
  {
    icon: ShieldCheck,
    title: "Reliable by Design",
    description: "Production-ready infrastructure built around consistent performance, dependable experiences, and the demands of modern digital commerce.",
  },
];

export function TechnologySection() {
  return (
    <section id="technology" className="relative bg-white py-16 sm:py-24 md:py-32 overflow-hidden">
      <div className={glassSectionBackdrop} aria-hidden />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: GLASS_EASE }}
          className="text-center mb-10 sm:mb-14 md:mb-16 max-w-3xl mx-auto"
        >
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 leading-tight px-1">
            Built for Modern Fashion Commerce
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed px-1">
            Fashion visualization needs to be fast, reliable, and effortless to integrate. TryVerse gives brands the
            foundation to introduce AI-powered shopping experiences without rebuilding their existing commerce stack.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {techs.map((tech, i) => (
            <motion.div
              key={tech.title}
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
                  className="relative z-[2] mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-soft transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                >
                  <tech.icon className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
                </div>
                <h3 className="relative z-[2] font-display text-base sm:text-lg font-semibold text-foreground mb-2 leading-snug">
                  {tech.title}
                </h3>
                <p className="relative z-[2] text-sm text-muted-foreground leading-relaxed flex-1">
                  {tech.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
