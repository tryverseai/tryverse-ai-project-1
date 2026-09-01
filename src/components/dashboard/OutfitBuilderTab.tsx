import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Camera, Download, Shirt, Footprints, Clock, Glasses, Gem, RotateCcw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCredits } from "@/contexts/CreditsContext";
import {
  getProducts,
  generateOutfit,
  pollOutfitStatus,
  type Product,
} from "@/lib/backendApi";
import { posthogCapture } from "@/lib/posthog";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { downloadFile, dateStampedFilename } from "@/lib/utils";
import { safeImageSrcForDom } from "@/lib/safeUrl";
import { GenerationLoadingScreen } from "@/components/GenerationLoadingScreen";
import { GeneratorEntry } from "@/components/dashboard/GeneratorEntry";
import { BackLink } from "@/components/dashboard/BackLink";
import { ModelPickerGrid, type PickedModel } from "@/components/dashboard/ModelPickerGrid";

const OUTFIT_STAGES = [
  "Preparing your pieces",
  "Fitting the look on your model",
  "Blending the outfit together",
  "Finishing the shot",
  "Almost ready",
];

type SlotKey = "top" | "bottom" | "one_piece" | "shoes" | "eyewear" | "earrings" | "necklace" | "jewelry";
type Mode = "top_bottom" | "one_piece";
type Step = "entry" | "build" | "model";
type Status = "idle" | "generating" | "done" | "error";

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;

function ComingSoonState() {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Clock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">Outfit Builder is coming soon</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        We're finishing up quality testing before rolling this out.
      </p>
    </div>
  );
}

function ProductPickerGrid({
  products,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  products: Product[];
  selectedId?: string;
  onSelect: (p: Product | undefined) => void;
  emptyLabel: string;
}) {
  if (products.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
      {products.map((p) => {
        const isSelected = selectedId === p.id;
        const bg = safeImageSrcForDom(p.image_display_url || p.image_url);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(isSelected ? undefined : p)}
            title={p.name}
            className={`aspect-square rounded-lg overflow-hidden border-2 bg-muted bg-cover bg-center transition-colors ${
              isSelected ? "border-foreground" : "border-transparent"
            }`}
            style={bg ? { backgroundImage: `url(${JSON.stringify(bg)})` } : undefined}
          />
        );
      })}
    </div>
  );
}

export function OutfitBuilderTab() {
  const { refresh: refreshCredits } = useCredits();
  const enabled = FEATURE_FLAGS.OUTFIT_BUILDER_ENABLED;

  const [step, setStep] = useState<Step>("entry");
  const [mode, setMode] = useState<Mode>("top_bottom");
  const [selected, setSelected] = useState<Partial<Record<SlotKey, Product>>>({});
  const [productsBySlot, setProductsBySlot] = useState<Record<SlotKey, Product[]>>({
    top: [],
    bottom: [],
    one_piece: [],
    shoes: [],
    eyewear: [],
    earrings: [],
    necklace: [],
    jewelry: [],
  });
  const [productsLoading, setProductsLoading] = useState(true);

  const [selectedModel, setSelectedModel] = useState<PickedModel | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const active = enabled;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    setProductsLoading(true);
    Promise.all([
      getProducts(1, 50, "tops").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "bottoms").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "dresses").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "one-pieces").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "footwear").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "eyewear").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "earrings").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "necklace").catch(() => ({ products: [] as Product[] })),
      getProducts(1, 50, "jewelry").catch(() => ({ products: [] as Product[] })),
    ]).then(([tops, bottoms, dresses, onePieces, shoes, eyewear, earrings, necklace, jewelry]) => {
      if (cancelled) return;
      setProductsBySlot({
        top: tops.products,
        bottom: bottoms.products,
        one_piece: [...dresses.products, ...onePieces.products],
        shoes: shoes.products,
        eyewear: eyewear.products,
        earrings: earrings.products,
        necklace: necklace.products,
        jewelry: jewelry.products,
      });
    }).finally(() => { if (!cancelled) setProductsLoading(false); });

    return () => { cancelled = true; };
  }, [active]);

  const setSlot = (key: SlotKey) => (product: Product | undefined) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (product) next[key] = product; else delete next[key];
      return next;
    });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSelected((prev) => {
      const cleared = { ...prev };
      if (next === "one_piece") { delete cleared.top; delete cleared.bottom; }
      else { delete cleared.one_piece; }
      return cleared;
    });
  };

  const reset = () => {
    setStep("entry");
    setMode("top_bottom");
    setSelected({});
    setSelectedModel(null);
    setStatus("idle");
    setResultUrl(null);
    setErrorMsg(null);
  };

  // Clothing is optional — a look can be built from accessories alone (e.g. just sunglasses +
  // a necklace on the model, no garment change). The only remaining hard rule is that a top
  // needs its bottom and vice versa; everything else is additive.
  const topBottomBalanced = mode !== "top_bottom" || Boolean(selected.top) === Boolean(selected.bottom);
  const anySlotFilled = Boolean(
    selected.top ||
      selected.bottom ||
      selected.one_piece ||
      selected.shoes ||
      selected.eyewear ||
      selected.earrings ||
      selected.necklace ||
      selected.jewelry
  );
  const isValidCombo = topBottomBalanced && anySlotFilled;
  const pieceCount = Object.values(selected).filter(Boolean).length;

  const handleGenerate = async () => {
    if (!isValidCombo) {
      toast.error(
        !anySlotFilled
          ? "Pick at least one product to build a look"
          : "A top needs a bottom to complete the outfit — or pick a one-piece instead"
      );
      return;
    }
    if (!selectedModel) {
      toast.error("Pick a model to try the outfit on");
      return;
    }
    setStatus("generating");
    setErrorMsg(null);
    posthogCapture("outfit_builder_generate_clicked", {
      mode,
      hasShoes: Boolean(selected.shoes),
      hasEyewear: Boolean(selected.eyewear),
      hasEarrings: Boolean(selected.earrings),
      hasNecklace: Boolean(selected.necklace),
      hasJewelry: Boolean(selected.jewelry),
      modelSource: selectedModel.source,
    });
    try {
      const slots = {
        top: mode === "top_bottom" ? selected.top?.id : undefined,
        bottom: mode === "top_bottom" ? selected.bottom?.id : undefined,
        one_piece: mode === "one_piece" ? selected.one_piece?.id : undefined,
        shoes: selected.shoes?.id,
        eyewear: selected.eyewear?.id,
        earrings: selected.earrings?.id,
        necklace: selected.necklace?.id,
        jewelry: selected.jewelry?.id,
      };
      const started = await generateOutfit({
        modelId: selectedModel.id,
        modelSource: selectedModel.source,
        slots,
      });

      if (started.status === "completed" && started.resultUrl) {
        setResultUrl(started.resultUrl);
        setStatus("done");
        toast.success("Outfit generated");
        void refreshCredits();
        return;
      }
      if (started.status === "failed") {
        throw new Error(started.error ?? "Could not generate this outfit");
      }

      let attempts = 0;
      while (attempts < MAX_POLL_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        attempts++;
        const update = await pollOutfitStatus(started.outfitId);
        if (update.status === "completed" && update.resultUrl) {
          setResultUrl(update.resultUrl);
          setStatus("done");
          toast.success("Outfit generated");
          void refreshCredits();
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Could not generate this outfit");
        }
      }
      throw new Error("This is taking longer than expected — check back shortly.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate the outfit";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const showingGenerationUi = status === "generating" || status === "done" || status === "error";

  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Outfit Builder</h2>
          <p className="text-sm text-muted-foreground">Style a complete look — combine clothing, footwear, and accessories from your catalog onto one model.</p>
        </div>
        <ComingSoonState />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Outfit Builder</h2>
        <p className="text-sm text-muted-foreground">
          Style a complete look — combine clothing, footwear, and accessories from your catalog onto one model.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "entry" && (
          <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GeneratorEntry
              title="Build a complete look"
              subtitle="Combine a top and bottom (or a dress), footwear, and accessories from your catalog onto one model — all at once."
              actions={[{ label: "Start building", icon: Layers, onClick: () => setStep("build"), variant: "primary" }]}
            />
          </motion.div>
        )}

        {step === "build" && (
          <motion.div
            key="build"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <BackLink onClick={reset} label="Back to start" />

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shirt className="h-4 w-4" /> Clothing <span className="text-muted-foreground/70 font-normal">(optional)</span>
              </h3>
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "top_bottom" ? "default" : "outline"}
                  onClick={() => switchMode("top_bottom")}
                >
                  Top + Bottom
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "one_piece" ? "default" : "outline"}
                  onClick={() => switchMode("one_piece")}
                >
                  Dress / One-piece
                </Button>
              </div>

              {productsLoading ? (
                <p className="text-xs text-muted-foreground">Loading your products…</p>
              ) : (
                <div className="space-y-5">
                  {mode === "top_bottom" ? (
                    <>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Top</p>
                        <ProductPickerGrid
                          products={productsBySlot.top}
                          selectedId={selected.top?.id}
                          onSelect={setSlot("top")}
                          emptyLabel="No tops in your catalog yet."
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Bottom</p>
                        <ProductPickerGrid
                          products={productsBySlot.bottom}
                          selectedId={selected.bottom?.id}
                          onSelect={setSlot("bottom")}
                          emptyLabel="No bottoms in your catalog yet."
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Dress / One-piece</p>
                      <ProductPickerGrid
                        products={productsBySlot.one_piece}
                        selectedId={selected.one_piece?.id}
                        onSelect={setSlot("one_piece")}
                        emptyLabel="No dresses or one-pieces in your catalog yet."
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Footprints className="h-3.5 w-3.5" /> Shoes <span className="text-muted-foreground/70">(optional)</span>
                    </p>
                    <ProductPickerGrid
                      products={productsBySlot.shoes}
                      selectedId={selected.shoes?.id}
                      onSelect={setSlot("shoes")}
                      emptyLabel="No footwear in your catalog yet — tag a product as “Footwear” to add one."
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Gem className="h-4 w-4" /> Accessories <span className="text-muted-foreground/70 font-normal">(optional)</span>
              </h3>
              {productsLoading ? (
                <p className="text-xs text-muted-foreground">Loading your products…</p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Glasses className="h-3.5 w-3.5" /> Eyewear
                    </p>
                    <ProductPickerGrid
                      products={productsBySlot.eyewear}
                      selectedId={selected.eyewear?.id}
                      onSelect={setSlot("eyewear")}
                      emptyLabel="No eyewear in your catalog yet — tag a product as “Eyewear” to add one."
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Gem className="h-3.5 w-3.5" /> Earrings
                    </p>
                    <ProductPickerGrid
                      products={productsBySlot.earrings}
                      selectedId={selected.earrings?.id}
                      onSelect={setSlot("earrings")}
                      emptyLabel="No earrings in your catalog yet — tag a product as “Earrings” to add one."
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Gem className="h-3.5 w-3.5" /> Necklace
                    </p>
                    <ProductPickerGrid
                      products={productsBySlot.necklace}
                      selectedId={selected.necklace?.id}
                      onSelect={setSlot("necklace")}
                      emptyLabel="No necklaces in your catalog yet — tag a product as “Necklace” to add one."
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Gem className="h-3.5 w-3.5" /> Other jewelry
                    </p>
                    <ProductPickerGrid
                      products={productsBySlot.jewelry}
                      selectedId={selected.jewelry?.id}
                      onSelect={setSlot("jewelry")}
                      emptyLabel="No other jewelry in your catalog yet — tag a product as “Other Jewelry” to add one."
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full h-11 gradient-primary text-primary-foreground shadow-soft"
              disabled={!isValidCombo}
              onClick={() => setStep("model")}
            >
              Continue{pieceCount > 0 ? ` with ${pieceCount} piece${pieceCount === 1 ? "" : "s"}` : ""}
            </Button>
          </motion.div>
        )}

        {step === "model" && (
          <motion.div
            key="model"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={showingGenerationUi ? "" : "max-w-md mx-auto space-y-4"}
          >
            {showingGenerationUi ? (
              status === "generating" ? (
                <GenerationLoadingScreen
                  title="Creating your look"
                  stages={OUTFIT_STAGES}
                  previewItems={selectedModel ? [{ label: selectedModel.label, imageUrl: selectedModel.imageUrl }] : []}
                />
              ) : status === "done" && resultUrl ? (
                <div className="space-y-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl overflow-hidden bg-muted w-fit max-w-full mx-auto"
                  >
                    <img
                      src={resultUrl}
                      alt="Generated outfit"
                      className="block max-h-[75vh] max-w-full w-auto h-auto object-contain"
                    />
                  </motion.div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Start over
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() =>
                        void downloadFile(resultUrl, dateStampedFilename("tryverse-outfit")).catch(() =>
                          toast.error("Download failed")
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 min-h-[220px] p-6 text-center gap-3">
                  <p className="text-sm font-medium text-destructive">Outfit generation failed</p>
                  <p className="text-xs text-muted-foreground">{errorMsg}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Start over
                    </Button>
                    <Button size="sm" onClick={() => void handleGenerate()}>
                      Try again
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <>
                <BackLink onClick={() => setStep("build")} />
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" /> Model
                </p>
                <ModelPickerGrid selectedId={selectedModel?.id} onSelect={setSelectedModel} />
                <Button
                  className="w-full h-11 gradient-primary text-primary-foreground shadow-soft"
                  disabled={!selectedModel}
                  onClick={() => void handleGenerate()}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Try full outfit
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
