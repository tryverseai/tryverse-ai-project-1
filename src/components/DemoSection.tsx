import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, Check, Loader2 } from "lucide-react";

const clothingItems = [
  { id: 1, name: "Classic White Tee", category: "Tops", color: "bg-gray-100" },
  { id: 2, name: "Navy Blazer", category: "Outerwear", color: "bg-blue-900" },
  { id: 3, name: "Slim Denim Jeans", category: "Bottoms", color: "bg-blue-600" },
  { id: 4, name: "Black Leather Jacket", category: "Outerwear", color: "bg-gray-900" },
  { id: 5, name: "Linen Summer Shirt", category: "Tops", color: "bg-amber-100" },
  { id: 6, name: "Casual Chinos", category: "Bottoms", color: "bg-amber-700" },
];

type DemoStep = "upload" | "select" | "preview";

export function DemoSection() {
  const [step, setStep] = useState<DemoStep>("upload");
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleUpload = () => setStep("select");

  const handleSelect = (id: number) => {
    setSelectedItem(id);
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setStep("preview");
    }, 2000);
  };

  const handleReset = () => {
    setStep("upload");
    setSelectedItem(null);
  };

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Live Demo</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Experience Virtual Try-On
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            See how TryVerse AI works in three simple steps.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-10 max-w-md mx-auto">
            {(["upload", "select", "preview"] as DemoStep[]).map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step === s
                      ? "gradient-primary text-primary-foreground shadow-soft"
                      : i < ["upload", "select", "preview"].indexOf(step)
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i < ["upload", "select", "preview"].indexOf(step) ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full transition-colors ${
                      i < ["upload", "select", "preview"].indexOf(step) ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card p-12 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">Upload Your Photo</h3>
                <p className="text-muted-foreground mb-6">Drag & drop or click to upload a full-body photo</p>
                <Button onClick={handleUpload} className="gradient-primary text-primary-foreground shadow-soft">
                  Upload Photo
                </Button>
              </motion.div>
            )}

            {step === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card p-8"
              >
                <h3 className="font-display text-xl font-semibold text-foreground mb-6 text-center">
                  {isGenerating ? "Generating your look..." : "Select a Clothing Item"}
                </h3>

                {isGenerating ? (
                  <div className="flex flex-col items-center py-12">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground text-sm">AI is creating your virtual try-on...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {clothingItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.id)}
                        className="p-4 rounded-xl border border-border/50 hover:border-primary/40 hover:shadow-soft transition-all text-left group"
                      >
                        <div className={`w-full aspect-square rounded-lg ${item.color} mb-3`} />
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card p-8 text-center"
              >
                <div className="w-full max-w-sm mx-auto aspect-[3/4] rounded-xl bg-gradient-to-br from-primary/5 to-primary/15 flex items-center justify-center mb-6 border border-primary/10">
                  <div className="text-center">
                    <Sparkle />
                    <p className="font-display text-lg font-semibold text-foreground mt-4">Virtual Try-On Ready!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Wearing: {clothingItems.find((c) => c.id === selectedItem)?.name}
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Check className="h-3 w-3" /> Perfect Fit
                    </div>
                  </div>
                </div>
                <Button onClick={handleReset} variant="outline">
                  Try Another Outfit
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Sparkle() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", bounce: 0.5 }}
      className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto shadow-elevated"
    >
      <span className="text-3xl">👗</span>
    </motion.div>
  );
}
