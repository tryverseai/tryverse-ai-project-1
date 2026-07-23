import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Scan, Sparkles, ArrowRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

import maleBefore from "@/assets/model-male-before.jpg";
import maleAfter from "@/assets/model-shirt-tryon.jpg";
import femaleBefore from "@/assets/model-female-before.jpg";
import femaleAfter from "@/assets/model-necklace-tryon.jpg";
import shirtProduct from "@/assets/shirt-product.jpg";
import necklaceProduct from "@/assets/necklace-product.jpg";

type Phase = "upload" | "scanning" | "result";

interface DemoConfig {
  id: string;
  label: string;
  category: string;
  productName: string;
  productImage: string;
  beforeImage: string;
  afterImage: string;
  fitLabel: string;
}

const demos: DemoConfig[] = [
  {
    id: "shirt",
    label: "Clothing",
    category: "Apparel",
    productName: "Navy Oxford Shirt",
    productImage: shirtProduct,
    beforeImage: maleBefore,
    afterImage: maleAfter,
    fitLabel: "Perfect Fit · Size M",
  },
  {
    id: "necklace",
    label: "Jewelry",
    category: "Accessories",
    productName: "Gold Pendant Necklace",
    productImage: necklaceProduct,
    beforeImage: femaleBefore,
    afterImage: femaleAfter,
    fitLabel: "Elegant Match · 18\" Chain",
  },
];

function DemoCard({ demo }: { demo: DemoConfig }) {
  const [phase, setPhase] = useState<Phase>("upload");

  useEffect(() => {
    if (phase === "scanning") {
      const timer = setTimeout(() => setPhase("result"), 2400);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const handleStart = () => setPhase("scanning");
  const handleReset = () => setPhase("upload");

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-card">
      {/* Product header */}
      <div className="flex items-center gap-4 p-5 border-b border-border/50">
        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/50 flex-shrink-0">
          <img src={demo.productImage} alt={demo.productName} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{demo.category}</p>
          <p className="font-display text-base font-semibold text-foreground truncate">{demo.productName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["upload", "scanning", "result"] as Phase[]).map((p, i) => (
            <div
              key={p}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                phase === p
                  ? "bg-foreground scale-125"
                  : i < ["upload", "scanning", "result"].indexOf(phase)
                  ? "bg-foreground/40"
                  : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Demo area */}
      <div className="relative aspect-[3/4] bg-muted/30">
        <AnimatePresence mode="wait">
          {phase === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
            >
              <img
                src={demo.beforeImage}
                alt="Model photo"
                className="w-full h-full object-cover absolute inset-0 opacity-50"
              />
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-background/90 backdrop-blur-sm flex items-center justify-center mx-auto mb-5 shadow-soft border border-border/50">
                  <Upload className="h-6 w-6 text-foreground" />
                </div>
                <p className="font-display text-lg font-semibold text-foreground mb-1">Photo Uploaded</p>
                <p className="text-sm text-muted-foreground mb-5">Ready for virtual try-on</p>
                <Button
                  onClick={handleStart}
                  className="gradient-primary text-primary-foreground shadow-soft"
                >
                  Try It On <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <img src={demo.beforeImage} alt="Scanning model" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-foreground/80 shadow-[0_0_20px_4px_hsl(var(--foreground)/0.2)]"
                initial={{ top: "0%" }}
                animate={{ top: "100%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-14 h-14 rounded-full border-2 border-foreground/20 border-t-foreground flex items-center justify-center mb-4"
                >
                  <Scan className="h-5 w-5 text-foreground" />
                </motion.div>
                <p className="font-display text-sm font-semibold text-foreground bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full">
                  AI Processing...
                </p>
              </div>
              <div className="absolute top-6 left-6 w-6 h-6 border-l-2 border-t-2 border-foreground/40" />
              <div className="absolute top-6 right-6 w-6 h-6 border-r-2 border-t-2 border-foreground/40" />
              <div className="absolute bottom-6 left-6 w-6 h-6 border-l-2 border-b-2 border-foreground/40" />
              <div className="absolute bottom-6 right-6 w-6 h-6 border-r-2 border-b-2 border-foreground/40" />
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <img src={demo.afterImage} alt="Virtual try-on result" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-transparent p-6 pt-20">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 text-foreground text-xs font-semibold mb-3">
                    <Check className="h-3 w-3" />
                    {demo.fitLabel}
                  </div>
                  <p className="text-primary-foreground font-display text-lg font-semibold">{demo.productName}</p>
                  <p className="text-primary-foreground/70 text-sm mt-1">Virtual try-on complete</p>
                </motion.div>
              </div>
              <button
                onClick={handleReset}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
              >
                <RotateCcw className="h-4 w-4 text-foreground" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function TryOnShowcase() {
  return (
    <section id="demo" className="py-24 md:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Live Demo</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            See It in Action
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Watch how TryVerse AI transforms a photo into a realistic virtual try-on — for both clothing and jewelry.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {demos.map((demo, i) => (
            <motion.div
              key={demo.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <DemoCard demo={demo} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
