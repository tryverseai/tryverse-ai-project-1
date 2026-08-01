import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, User, ShoppingBag, Star, Heart, ChevronRight, Scan, Check, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { posthogCapture } from "@/lib/posthog";
import { toast } from "sonner";
import { safeImageSrcForDom } from "@/lib/safeUrl";
import type { CSSProperties } from "react";
import { captureSentryException } from "@/lib/sentry";
import {
  uploadImageWithApiKey,
  uploadImageFromUrlWithApiKey,
  widgetRequestTryOnWithApiKey,
  pollWidgetTryOnUntilResult,
  type TryOnCategory,
} from "@/lib/backendApi";

import modelFemaleBefore from "@/assets/model-female-before.jpg";
import modelMaleBefore from "@/assets/model-male-before.jpg";
import modelShirtTryon from "@/assets/model-shirt-tryon.jpg";
import shirtProduct from "@/assets/shirt-product.jpg";

function previewImageBg(raw: string | null | undefined): CSSProperties | undefined {
  const s = safeImageSrcForDom(raw);
  if (!s) return undefined;
  return { backgroundImage: `url(${JSON.stringify(s)})` };
}

type WidgetMode = "popup" | "embedded";
type WidgetPhase = "idle" | "open" | "uploading" | "processing" | "result" | "error";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function normalizeTryOnCategory(raw: string): TryOnCategory {
  const s = raw.toLowerCase();
  if (s === "tops" || s === "bottoms" || s === "dresses" || s === "one-pieces" || s === "clothing") return s;
  return "clothing";
}

const WidgetPreview = () => {
  const [searchParams] = useSearchParams();
  const isWidgetMode = searchParams.get('mode') === 'widget';

  useEffect(() => {
    posthogCapture("brand_page_viewed", { source: "widget_preview", mode: isWidgetMode ? "widget" : "preview" });
  }, [isWidgetMode]);
  const apiKeyParam = searchParams.get('apiKey');
  const productImageParam = searchParams.get('productImage');
  const productTypeParam = searchParams.get('productType') || 'clothing';

  const [mode, setMode] = useState<WidgetMode>("popup");
  const [phase, setPhase] = useState<WidgetPhase>(isWidgetMode ? "open" : "idle");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [uploadedPersonImage, setUploadedPersonImage] = useState<string | null>(null);
  const [personUploadFile, setPersonUploadFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    posthogCapture("upload_photo_clicked", { source: "widget_preview" });

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be under 5MB.");
      return;
    }

    setPhase("uploading");

    try {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedPersonImage(reader.result as string);
        setPersonUploadFile(file);
        setSelectedModel(null);
        setPhase("open");
        toast.success("Photo ready!");
      };
      reader.readAsDataURL(file);
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast.error("Failed to read photo. Please try again.");
      setPhase("open");
    }
  };

  const handleTryOn = async () => {
    const personImg = uploadedPersonImage || (selectedModel ? models.find(m => m.id === selectedModel)?.image : null);
    if (!personImg && !personUploadFile) return;

    const productImg =
      (productImageParam && safeImageSrcForDom(productImageParam)) || String(shirtProduct);
    const apiKey = apiKeyParam;
    const category = normalizeTryOnCategory(productTypeParam);

    setPhase("processing");
    setErrorMessage(null);
    posthogCapture("try_on_started", { source: "widget_preview", category: productTypeParam });

    try {
      if (apiKey) {
        let personFile = personUploadFile;
        if (!personFile && personImg) {
          const url = typeof personImg === "string" ? (safeImageSrcForDom(personImg) || personImg) : "";
          const res = await fetch(url);
          if (!res.ok) throw new Error("Could not load person image");
          const blob = await res.blob();
          personFile = new File([blob], "person.jpg", { type: blob.type || "image/jpeg" });
        }
        if (!personFile) throw new Error("Missing person image");

        const personPath = (await uploadImageWithApiKey(personFile, "person", apiKey)).filePath;

        let productUrl = productImg;
        if (productUrl.startsWith("/")) {
          productUrl = `${window.location.origin}${productUrl}`;
        }
        const productPath = (await uploadImageFromUrlWithApiKey(productUrl, apiKey)).filePath;

        const started = await widgetRequestTryOnWithApiKey(
          { personImagePath: personPath, productImagePath: productPath, category },
          apiKey
        );

        let outUrl: string | undefined;
        if ("status" in started && started.status === "queued") {
          outUrl = await pollWidgetTryOnUntilResult(started.tryonId, apiKey);
        } else {
          const done = started as { resultUrl?: string; error?: string };
          outUrl = done.resultUrl;
          if (!outUrl) throw new Error(done.error || "No result image received");
        }

        setResultImage(outUrl);
        setPhase("result");
        posthogCapture("try_on_completed", { source: "widget_preview", category: productTypeParam });
      } else {
        // Demo mode - simulate
        await new Promise(r => setTimeout(r, 2000));
        setResultImage(modelShirtTryon);
        setPhase("result");
        posthogCapture("try_on_completed", { source: "widget_preview", category: productTypeParam });
      }
    } catch (error: any) {
      console.error('Try-on error:', error);
      const err = error instanceof Error ? error : new Error(String(error?.message || 'Unknown'));
      posthogCapture("try_on_failed", { source: "widget_preview", category: productTypeParam, error: err.message });
      captureSentryException(err, { tags: { feature: "try_on", source: "widget_preview" }, extra: { category: productTypeParam } });
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
      setPhase("error");
    }
  };

  const handleReset = () => {
    setPhase(isWidgetMode ? "open" : "idle");
    setSelectedModel(null);
    setUploadedPersonImage(null);
    setPersonUploadFile(null);
    setResultImage(null);
    setErrorMessage(null);
  };

  const models = [
    { id: "f1", name: "Sarah", image: modelFemaleBefore },
    { id: "m1", name: "James", image: modelMaleBefore },
  ];

  const WidgetContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold text-foreground">TryVerse</span>
          <span className="text-xs text-muted-foreground">Virtual Try-On</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {(phase === "idle" || phase === "open") && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Choose how to try on</p>
            <p className="text-xs text-muted-foreground mb-4">Upload your photo or pick an AI model</p>

            {/* Upload own photo */}
            <label className="flex items-center gap-3 p-3 mb-3 rounded-xl border border-dashed border-border/50 cursor-pointer hover:border-foreground/20 transition-colors">
              <Upload className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {uploadedPersonImage ? (
                  <p className="text-xs font-medium text-foreground truncate">Photo uploaded ✓</p>
                ) : (
                  <>
                    <p className="text-xs font-medium text-foreground">Upload your photo</p>
                    <p className="text-[10px] text-muted-foreground">JPEG/PNG, max 5MB</p>
                  </>
                )}
              </div>
              {uploadedPersonImage && previewImageBg(uploadedPersonImage) && (
                <div
                  role="img"
                  aria-label="Uploaded"
                  className="w-8 h-8 rounded bg-cover bg-center"
                  style={previewImageBg(uploadedPersonImage)}
                />
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileUpload} />
            </label>

            <p className="text-[10px] text-muted-foreground text-center mb-3">— or select a model —</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setUploadedPersonImage(null);
                    setPersonUploadFile(null);
                  }}
                  className={`rounded-xl overflow-hidden border-2 transition-all ${
                    selectedModel === m.id ? "border-foreground" : "border-border/50 hover:border-foreground/20"
                  }`}
                >
                  <div className="aspect-[3/4] relative">
                    <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-foreground/50 to-transparent">
                      <p className="text-primary-foreground text-[10px] font-medium">{m.name}</p>
                    </div>
                  </div>
                  {selectedModel === m.id && (
                    <div className="bg-foreground text-background text-[10px] font-medium py-1 text-center">
                      <Check className="h-2.5 w-2.5 inline mr-0.5" /> Selected
                    </div>
                  )}
                </button>
              ))}
            </div>

            <Button
              onClick={handleTryOn}
              disabled={!selectedModel && !uploadedPersonImage && !personUploadFile}
              className="w-full gradient-primary text-primary-foreground text-xs h-9"
            >
              Generate Try-On <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </motion.div>
        )}

        {phase === "uploading" && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Uploading photo...</p>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-10 h-10 rounded-full border-2 border-border border-t-foreground flex items-center justify-center mx-auto mb-4">
              <Scan className="h-4 w-4 text-foreground" />
            </motion.div>
            <p className="text-sm font-semibold text-foreground">Generating...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take up to 30 seconds</p>
            <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden max-w-[200px] mx-auto">
              <motion.div className="h-full bg-foreground rounded-full" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 25 }} />
            </div>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Something went wrong</p>
            <p className="text-xs text-muted-foreground mb-4">{errorMessage}</p>
            <Button onClick={handleReset} variant="outline" size="sm" className="gap-1 text-xs">
              <RotateCcw className="h-3 w-3" /> Try Again
            </Button>
          </motion.div>
        )}

        {phase === "result" && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="aspect-[3/4] relative">
              <div
                role="img"
                aria-label="Try-on result"
                className="w-full h-full bg-cover bg-center"
                style={
                  previewImageBg(resultImage) || {
                    backgroundImage: `url(${JSON.stringify(modelShirtTryon)})`,
                  }
                }
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-foreground/60 to-transparent">
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/90 text-foreground text-[10px] font-semibold">
                  <Check className="h-2.5 w-2.5" /> Perfect Fit · Size M
                </div>
              </div>
            </div>
            <div className="p-4">
              <Button onClick={handleReset} variant="outline" size="sm" className="w-full gap-1 text-xs">
                <RotateCcw className="h-3 w-3" /> Try Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Widget-only mode (iframe embed)
  if (isWidgetMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <WidgetContent />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Integration Preview</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              See TryVerse in Action
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Preview how the virtual try-on widget looks on a brand's product page.
            </p>
          </motion.div>

          {/* Mode selector */}
          <div className="flex justify-center gap-2 mb-10">
            {[
              { id: "popup" as WidgetMode, label: "Popup Widget" },
              { id: "embedded" as WidgetMode, label: "Embedded Component" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); handleReset(); }}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  mode === m.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Mock product page */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-card">
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-muted rounded-lg px-4 py-1.5 text-xs text-muted-foreground text-center">
                    www.acme-fashion.com/products/navy-oxford-shirt
                  </div>
                </div>
              </div>

              {/* Mock product page content */}
              <div className="p-6 md:p-10">
                <div className={`grid ${mode === "embedded" ? "lg:grid-cols-3" : "md:grid-cols-2"} gap-8`}>
                  {/* Product image */}
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted">
                    <img src={shirtProduct} alt="Navy Oxford Shirt" className="w-full h-full object-cover" loading="lazy" />
                  </div>

                  {/* Product details */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Acme Fashion Co.</p>
                    <h2 className="font-display text-2xl font-bold text-foreground mb-2">Navy Oxford Shirt</h2>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex text-foreground">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < 4 ? "fill-current" : ""}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">128 reviews</span>
                    </div>
                    <p className="font-display text-xl font-bold text-foreground mb-4">$89.00</p>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      Classic navy Oxford shirt crafted from premium cotton. Perfect for both casual and semi-formal occasions.
                    </p>

                    {/* Size selector */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-foreground mb-2">Size</p>
                      <div className="flex gap-2">
                        {["XS", "S", "M", "L", "XL"].map((size) => (
                          <button key={size} className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                            size === "M" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/30"
                          }`}>
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button className="w-full gradient-primary text-primary-foreground h-12 shadow-soft">
                        <ShoppingBag className="mr-2 h-4 w-4" /> Add to Cart
                      </Button>

                      {mode === "popup" && (
                        <Button
                          variant="outline"
                          className="w-full h-12 border-foreground/20 hover:bg-foreground/[0.03]"
                          onClick={() => setPhase("open")}
                        >
                          <span className="font-display text-xs font-bold mr-2 text-muted-foreground">TryVerse</span>
                          Try It On Virtually
                        </Button>
                      )}

                      <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground py-2">
                        <Heart className="h-4 w-4" /> Add to Wishlist
                      </button>
                    </div>
                  </div>

                  {/* Embedded widget */}
                  {mode === "embedded" && (
                    <div>
                      <WidgetContent />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Popup modal overlay */}
          <AnimatePresence>
            {mode === "popup" && phase !== "idle" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
                onClick={() => { handleReset(); }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="w-full max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <WidgetContent onClose={handleReset} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WidgetPreview;
