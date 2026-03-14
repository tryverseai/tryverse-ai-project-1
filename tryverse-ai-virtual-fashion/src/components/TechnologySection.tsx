import { motion } from "framer-motion";
import { Brain, Scan, Box, Layers, Cpu, Globe } from "lucide-react";

const techs = [
  { icon: Brain, title: "Computer Vision", description: "Advanced image recognition and body detection for precise virtual fitting." },
  { icon: Scan, title: "Diffusion Models", description: "State-of-the-art generative AI creates photorealistic try-on visualizations." },
  { icon: Box, title: "Pose Estimation", description: "Accurate body pose and landmark detection from a single photograph." },
  { icon: Layers, title: "Fit Prediction", description: "ML models predict garment fit based on body proportions and product data." },
  { icon: Cpu, title: "GPU Inference", description: "Cloud GPU infrastructure for fast inference and smooth user experiences." },
  { icon: Globe, title: "CDN Delivery", description: "Global edge network ensures fast delivery of try-on results worldwide." },
];

export function TechnologySection() {
  return (
    <section id="technology" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Technology</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built on Cutting-Edge AI
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Modern AI infrastructure designed for speed, accuracy, and reliability.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techs.map((tech, i) => (
            <motion.div
              key={tech.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-7 rounded-2xl border border-border/50 hover:border-foreground/10 hover:shadow-elevated transition-all duration-300 group"
            >
              <div className="w-11 h-11 rounded-xl bg-foreground/[0.06] flex items-center justify-center mb-5 group-hover:gradient-primary group-hover:shadow-soft transition-all duration-300">
                <tech.icon className="h-5 w-5 text-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{tech.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{tech.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
