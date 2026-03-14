import { motion } from "framer-motion";
import { Gem, Sparkles, Camera, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import necklaceProduct from "@/assets/necklace-product.jpg";
import femaleAfter from "@/assets/model-necklace-tryon.jpg";

const jewelryFeatures = [
  {
    icon: Camera,
    title: "One Photo, Infinite Pieces",
    description: "Upload a single photo and try on hundreds of necklaces, earrings, and bracelets instantly.",
  },
  {
    icon: Sparkles,
    title: "True-to-Life Rendering",
    description: "Our AI accurately simulates metal reflections, gemstone brilliance, and natural drape on skin.",
  },
  {
    icon: Heart,
    title: "Confidence Before Purchase",
    description: "Know exactly how a piece will look on you — reducing returns and increasing satisfaction.",
  },
];

export function JewelrySection() {
  return (
    <section id="jewelry" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30">
              <img
                src={femaleAfter}
                alt="Virtual jewelry try-on showing a delicate gold pendant necklace on a model"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
            </div>

            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-6 -right-6 md:right-6 bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl p-4 flex items-center gap-3 max-w-[220px] shadow-card"
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border/50">
                <img src={necklaceProduct} alt="Gold pendant necklace" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Gold Pendant</p>
                <p className="text-[11px] text-muted-foreground">Virtually tried on</p>
                <div className="flex items-center gap-1 mt-1">
                  <Gem className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">Perfect Match</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-foreground text-xs font-medium mb-5">
              <Gem className="h-3.5 w-3.5" />
              Jewelry Try-On
            </div>

            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-5 leading-tight">
              Try On Fine Jewelry — Without Leaving Home
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              From delicate necklaces to statement earrings, our AI renders jewelry on your photo with stunning realism. See the exact drape, scale, and sparkle before you buy.
            </p>

            <div className="space-y-6 mb-8">
              {jewelryFeatures.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-foreground/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <f.icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground mb-1">{f.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <Link to="/try-on">
              <Button className="gradient-primary text-primary-foreground shadow-soft">
                Explore Jewelry Try-On <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
