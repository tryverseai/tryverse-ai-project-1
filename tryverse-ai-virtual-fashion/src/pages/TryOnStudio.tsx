import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Camera,
  User,
  Scan,
  Check,
  RotateCcw,
  ArrowRight,
  Glasses,
  ShoppingBag,
  Shirt,
  AlertCircle,
  X,
  BookOpen,
  Sparkles,
  Lock,
} from "lucide-react";
import { TryOnGuideContent } from "@/components/dashboard/TryOnGuideContent";
import { toast } from "sonner";
import {
  uploadImage,
  startTryOn,
  getTryverseModels,
  getCredits,
  createPersonPathFromModel,
  isCreditsExhaustedApiError,
  SHOPPER_TRYON_UNAVAILABLE_MESSAGE,
  type TryOnCategory,
  type TryverseModel,
} from "@/lib/backendApi";
import { posthogCapture } from "@/lib/posthog";
import { captureSentryException } from "@/lib/sentry";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isConvexDataEnabled } from "@/lib/convexData";

/** Diane / Andrew pinned first in Studio lists so order stays correct even when DB sort_order differs (e.g. Zoe lower than Diane). */
function sortTryverseModelsForDisplay(models: TryverseModel[]): TryverseModel[] {
  const rank = (slug: string) => {
    const s = slug.trim().toLowerCase();
    if (s === "diane" || s === "andrew") return 0;
    return 1;
  };
  return [...models].sort((a, b) => {
    const ra = rank(a.slug);
    const rb = rank(b.slug);
    if (ra !== rb) return ra - rb;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.display_name.localeCompare(b.display_name);
  });
}

/** Mirrors backend `isFreeTierPlanId` — presets may be restricted to `free_tier_eligible` models. */
function isFreeTierStudioPlan(plan: string | null | undefined): boolean {
  const p = String(plan ?? "free")
    .trim()
    .toLowerCase();
  return p === "free" || p === "free_trial" || p === "trial";
}

function modelEligibleOnFreeTier(m: TryverseModel): boolean {
  if (typeof m.free_tier_eligible === "boolean") return m.free_tier_eligible;
  const s = m.slug.trim().toLowerCase();
  return s === "diane" || s === "andrew";
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "upload" | "ai-model";
type Phase = "select" | "uploading" | "processing" | "result" | "error";
type TryOnErrorKind = "credits" | "person_photo" | "generic";
type StudioSection = "guide" | "tryon";

function classifyTryOnError(message: string, creditsOut: boolean): TryOnErrorKind {
  if (creditsOut) return "credits";
  const m = message.toLowerCase();
  if (
    m.includes("face") ||
    m.includes("one clear subject") ||
    m.includes("too small") ||
    m.includes("landscape") ||
    m.includes("invalid person photo") ||
    m.includes("taller portrait")
  ) {
    return "person_photo";
  }
  return "generic";
}

interface UploadedImage {
  file: File;
  previewUrl: string;
  filePath?: string;
}

// ─── Active categories (V1) ───────────────────────────────────────────────────
const ALL_CATEGORIES: { id: TryOnCategory; label: string; icon: typeof Shirt }[] = [
  { id: "clothing", label: "Clothing", icon: Shirt },
  { id: "bags", label: "Bags", icon: ShoppingBag },
  { id: "glasses", label: "Eyewear", icon: Glasses },
];

// ─── Component ────────────────────────────────────────────────────────────────
export type TryOnStudioVariant = "full" | "embedded";

interface TryOnStudioProps {
  /** full = marketing layout + navbar; embedded = consumer dashboard (no global chrome). */
  variant?: TryOnStudioVariant;
  /** Where “add credits” links (B2B billing vs B2C profile). */
  creditsHelpPath?: string;
  /** Open in a specific mode (e.g. individual dashboard “Models” tab). */
  initialMode?: Mode;
  /**
   * `embedded` defaults to individual-oriented copy (preset models).
   * Set `business` if this embed is ever shown in a merchant context.
   */
  audience?: "business" | "individual";
  /** When true, only clothing try-on is offered (e.g. consumer dashboard). */
  clothingOnly?: boolean;
}

const TryOnStudio = ({
  variant = "full",
  creditsHelpPath,
  initialMode,
  audience: audienceProp,
  clothingOnly = false,
}: TryOnStudioProps) => {
  const embedded = variant === "embedded";
  const [studioSection, setStudioSection] = useState<StudioSection>(() => (embedded ? "tryon" : "guide"));
  const audience = audienceProp ?? (embedded ? "individual" : "business");
  const { user } = useAuth();
  const convexOn = isConvexDataEnabled();
  const convexModels = useQuery(api.modelLibrary.listActiveModels, convexOn ? {} : "skip");
  /** When true, user has try-on credits (preset models may still be plan-gated per model). */
  const [studioModelsUnlocked, setStudioModelsUnlocked] = useState(false);
  /** From GET /api/credits — drives free-plan vs paid preset access. */
  const [studioCreditsPlan, setStudioCreditsPlan] = useState<string | null>(null);

  const categories = clothingOnly
    ? ALL_CATEGORIES.filter((c) => c.id === "clothing")
    : ALL_CATEGORIES;
  const [mode, setMode] = useState<Mode>(initialMode ?? "upload");
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedCategory, setSelectedCategory] = useState<TryOnCategory>("clothing");
  const [genderFilter, setGenderFilter] = useState<"Female" | "Male">("Female");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Upload mode state
  const [personImage, setPersonImage]   = useState<UploadedImage | null>(null);
  const [productImage, setProductImage] = useState<UploadedImage | null>(null);

  // Result state
  const [resultUrl, setResultUrl]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [errorKind, setErrorKind]       = useState<TryOnErrorKind | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const [libraryModels, setLibraryModels] = useState<TryverseModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [libraryProductImage, setLibraryProductImage] = useState<UploadedImage | null>(null);
  /** Sent to the API as `productDescription` — improves gowns, fit, and accessories. */
  const [productDescription, setProductDescription] = useState("");

  const personInputRef  = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const libraryProductInputRef = useRef<HTMLInputElement>(null);

  const [processElapsedSec, setProcessElapsedSec] = useState(0);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (clothingOnly) {
      setSelectedCategory("clothing");
      setProductImage(null);
      setLibraryProductImage(null);
      setProductDescription("");
    }
  }, [clothingOnly]);

  useEffect(() => {
    if (phase !== "processing") {
      setProcessElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    setProcessElapsedSec(0);
    const id = window.setInterval(() => {
      setProcessElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    if (convexOn) {
      if (convexModels === undefined) {
        setModelsLoading(true);
        return;
      }
      if (convexModels.length > 0) {
        setLibraryModels(sortTryverseModelsForDisplay(convexModels as TryverseModel[]));
        setModelsError(null);
        setModelsLoading(false);
        return;
      }
    }
    void (async () => {
      try {
        const models = await getTryverseModels();
        if (!cancelled) {
          setLibraryModels(sortTryverseModelsForDisplay(models));
          setModelsError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLibraryModels([]);
          setModelsError(e instanceof Error ? e.message : "Could not load model library");
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convexOn, convexModels]);

  useEffect(() => {
    if (!user) {
      setStudioModelsUnlocked(false);
      setStudioCreditsPlan(null);
      return;
    }
    let cancelled = false;
    void getCredits()
      .then((c) => {
        if (cancelled) return;
        const hasCredits =
          c.isUnlimited || c.freeCreditsRemaining + c.monthlyCreditsRemaining > 0;
        setStudioModelsUnlocked(hasCredits);
        setStudioCreditsPlan(c.plan);
      })
      .catch(() => {
        if (!cancelled) {
          setStudioModelsUnlocked(false);
          setStudioCreditsPlan(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── Image selection helpers ──────────────────────────────────────────────
  const handleFileSelect = useCallback((
    file: File,
    setter: (img: UploadedImage) => void
  ) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setter({ file, previewUrl });
  }, []);

  const handleDrop = useCallback((
    e: React.DragEvent,
    setter: (img: UploadedImage) => void
  ) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file, setter);
  }, [handleFileSelect]);

  // ── Core try-on flow ─────────────────────────────────────────────────────
  const handleTryOn = async () => {
    if (!personImage || !productImage) {
      toast.error("Please upload both your photo and a product image");
      return;
    }

    // H-4: Track uploaded file paths so we can log/attempt cleanup if the try-on fails to start
    let uploadedPersonPath: string | null = null;
    let uploadedProductPath: string | null = null;

    try {
      setPhase("uploading");
      setErrorMsg(null);
      setErrorKind(null);

      // Step 1: Upload person image
      setUploadProgress("Uploading your photo…");
      const personUpload = await uploadImage(personImage.file, 'person');
      uploadedPersonPath = personUpload.filePath;

      // Step 2: Upload product image
      setUploadProgress("Uploading product image…");
      const productUpload = await uploadImage(productImage.file, 'product');
      uploadedProductPath = productUpload.filePath;

      // Step 3: Start AI inference
      setUploadProgress("Starting AI try-on…");
      setPhase("processing");
      posthogCapture("try_on_started", { category: selectedCategory, source: "try_on_studio" });

      const result = await startTryOn({
        personImagePath: personUpload.filePath,
        productImagePath: productUpload.filePath,
        category: selectedCategory,
        productDescription: productDescription.trim() || undefined,
      });

      if (result.status === 'completed' && result.resultUrl) {
        setResultUrl(result.resultUrl);
        setProcessingTime(result.processingTimeMs || null);
        setPhase("result");
        posthogCapture("try_on_completed", { category: selectedCategory, source: "try_on_studio" });
        toast.success("Virtual try-on complete!");
      } else if (result.status === 'failed') {
        throw new Error(result.error || "AI processing failed. Please try again.");
      } else if (result.status === 'queued' || result.status === 'processing') {
        // Async mode — poll for result
        await pollForResult(result.tryonId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const creditsOut = isCreditsExhaustedApiError(err);
      const kind = classifyTryOnError(msg, creditsOut);
      posthogCapture("try_on_failed", { category: selectedCategory, source: "try_on_studio", error: msg, credits_exhausted: creditsOut });
      // H-4: Log orphaned upload paths so they can be cleaned up server-side if needed
      if (uploadedPersonPath || uploadedProductPath) {
        console.warn("[TryVerse] Try-on failed after upload — orphaned paths:", {
          person: uploadedPersonPath,
          product: uploadedProductPath,
        });
      }
      setErrorMsg(creditsOut ? SHOPPER_TRYON_UNAVAILABLE_MESSAGE : msg);
      setErrorKind(kind);
      setPhase("error");
      toast.error(creditsOut ? SHOPPER_TRYON_UNAVAILABLE_MESSAGE : msg);
    }
  };

  const handleTryOnWithLibraryModel = async () => {
    if (!selectedModel || !libraryProductImage) {
      toast.error("Select a model and upload a product image");
      return;
    }

    if (!studioModelsUnlocked) {
      toast.error("You're out of try-on credits.", {
        description: "Add credits to use preset models, or try again later.",
      });
      return;
    }

    const sel = libraryModels.find((x) => x.id === selectedModel);
    if (
      sel &&
      isFreeTierStudioPlan(studioCreditsPlan) &&
      !modelEligibleOnFreeTier(sel)
    ) {
      toast.error("This preset requires a paid plan.", {
        description: "Upgrade to unlock the full model library, or pick another model.",
      });
      return;
    }

    try {
      setPhase("uploading");
      setErrorMsg(null);
      setErrorKind(null);
      setUploadProgress("Preparing model photo…");
      const personPath = await createPersonPathFromModel(selectedModel);

      setUploadProgress("Uploading product image…");
      const productUpload = await uploadImage(libraryProductImage.file, "product");

      setUploadProgress("Starting AI try-on…");
      setPhase("processing");
      posthogCapture("try_on_started", { category: selectedCategory, source: "try_on_studio", mode: "library_model" });

      const result = await startTryOn({
        personImagePath: personPath,
        productImagePath: productUpload.filePath,
        category: selectedCategory,
        productDescription: productDescription.trim() || undefined,
      });

      if (result.status === "completed" && result.resultUrl) {
        setResultUrl(result.resultUrl);
        setProcessingTime(result.processingTimeMs || null);
        setPhase("result");
        posthogCapture("try_on_completed", { category: selectedCategory, source: "try_on_studio" });
        toast.success("Virtual try-on complete!");
      } else if (result.status === "failed") {
        throw new Error(result.error || "AI processing failed. Please try again.");
      } else if (result.status === "queued" || result.status === "processing") {
        await pollForResult(result.tryonId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const creditsOut = isCreditsExhaustedApiError(err);
      const kind = classifyTryOnError(msg, creditsOut);
      posthogCapture("try_on_failed", { category: selectedCategory, source: "try_on_studio", error: msg, credits_exhausted: creditsOut });
      setErrorMsg(creditsOut ? SHOPPER_TRYON_UNAVAILABLE_MESSAGE : msg);
      setErrorKind(kind);
      setPhase("error");
      toast.error(creditsOut ? SHOPPER_TRYON_UNAVAILABLE_MESSAGE : msg);
    }
  };

  const pollForResult = async (tryonId: string) => {
    const { pollTryOnStatus } = await import("@/lib/backendApi");
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = await pollTryOnStatus(tryonId);
      if (status.status === 'completed' && status.resultUrl) {
        setResultUrl(status.resultUrl);
        setProcessingTime(status.processingTimeMs || null);
        setPhase("result");
        posthogCapture("try_on_completed", { category: selectedCategory, source: "try_on_studio" });
        toast.success("Virtual try-on complete!");
        return;
      }
      if (status.status === 'failed') {
        const err = new Error(status.error || "Processing failed");
        posthogCapture("try_on_failed", { category: selectedCategory, source: "try_on_studio", error: status.error });
        captureSentryException(err, {
          tags: { feature: "try_on", source: "try_on_studio" },
          extra: { category: selectedCategory, tryonId },
        });
        throw err;
      }
    }
    throw new Error("Try-on timed out. Please try again.");
  };

  const handleReset = () => {
    setPhase("select");
    setPersonImage(null);
    setProductImage(null);
    setResultUrl(null);
    setErrorMsg(null);
    setErrorKind(null);
    setProcessingTime(null);
    setSelectedModel(null);
    setLibraryProductImage(null);
    setProductDescription("");
    setUploadProgress("");
  };

  const filteredModels = libraryModels.filter(
    (m) => m.gender === (genderFilter === "Female" ? "female" : "male")
  );

  const isModelLockedForUser = (m: TryverseModel) => {
    if (!studioModelsUnlocked) return true;
    if (isFreeTierStudioPlan(studioCreditsPlan)) {
      return !modelEligibleOnFreeTier(m);
    }
    return false;
  };

  const selectedPresetLocked =
    !!selectedModel &&
    (() => {
      const m = libraryModels.find((x) => x.id === selectedModel);
      return m ? isModelLockedForUser(m) : false;
    })();

  const resolvedCreditsPath = creditsHelpPath ?? (embedded ? "/dashboard/individual?tab=profile" : "/dashboard/business?tab=Billing");

  return (
    <div className="min-h-screen bg-background">
      {!embedded && <Navbar />}
      <main className={embedded ? "pb-8 px-3 sm:px-4 md:px-6" : "pt-[var(--navbar-height)] pb-20"}>
        <div className={embedded ? "max-w-7xl mx-auto" : "max-w-7xl mx-auto px-6"}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center ${embedded ? "mb-8" : "mb-12"}`}
          >
            <h1 className={`font-display font-bold text-foreground mb-3 ${embedded ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"}`}>
              {embedded ? "Try it on" : "Virtual Try-On Studio"}
            </h1>
            <p className={`text-muted-foreground max-w-xl mx-auto ${embedded ? "text-sm md:text-base" : "text-lg"}`}>
              Upload your photo and a product image — our AI will show you exactly how it looks.
            </p>
          </motion.div>

          {!embedded && (
            <div className="flex justify-center gap-2 mb-8">
              {([
                { id: "guide" as const, label: "Tips & guide", icon: BookOpen },
                { id: "tryon" as const, label: "Start try-on", icon: Sparkles },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStudioSection(s.id)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                    studioSection === s.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {!embedded && studioSection === "guide" && (
            <div className="max-w-3xl mx-auto pb-16">
              <TryOnGuideContent />
            </div>
          )}

          {(embedded || studioSection === "tryon") && (
            <>
          {/* Mode selector */}
          <div className="flex justify-center gap-2 mb-6">
            {([
              { id: "upload" as Mode,   label: "Upload Photo", icon: Upload },
              { id: "ai-model" as Mode, label: "Model library", icon: User  },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); handleReset(); }}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  mode === m.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Category selector */}
          <div className={`flex justify-center gap-2 mb-10 ${categories.length <= 1 ? "hidden" : ""}`}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setProductImage(null);
                  setLibraryProductImage(null);
                  setProductDescription("");
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? "bg-foreground/10 text-foreground border border-foreground/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>

          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">

              {/* ── SELECT PHASE ─────────────────────────────────────────── */}
              {phase === "select" && mode === "upload" && (
                <motion.div key="upload-select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-2 gap-8">

                  {/* Person Photo Upload */}
                  <div className="bg-card rounded-2xl border border-border/50 p-6">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">Your Photo</h3>
                    <p className="text-sm text-muted-foreground mb-5">Upload a clear front-facing photo</p>
                    <p className="text-xs text-muted-foreground mb-4 -mt-2 max-w-md">
                      Prefer a shot with <strong>more than just your face</strong>—for example head-to-waist or full length—so the AI has enough context to place the item naturally on you.
                    </p>

                    {personImage ? (
                      <div className="relative rounded-xl overflow-hidden">
                        <img src={personImage.previewUrl} alt="Your photo" className="w-full aspect-[3/4] object-cover" />
                        <button
                          onClick={() => setPersonImage(null)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <X className="h-4 w-4 text-foreground" />
                        </button>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-background/90 rounded-full px-2 py-1">
                          <Check className="h-3 w-3 text-foreground" />
                          <span className="text-xs font-medium text-foreground">Photo uploaded</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-foreground/30 transition-colors cursor-pointer"
                        onClick={() => { posthogCapture("upload_photo_clicked", { source: "try_on_studio" }); personInputRef.current?.click(); }}
                        onDrop={(e) => handleDrop(e, setPersonImage)}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">Drop photo here or click to upload</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 10MB</p>
                        <p className="text-xs text-muted-foreground mt-2">Best results: standing, good lighting, plain background</p>
                      </div>
                    )}
                    <input ref={personInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], setPersonImage)} />
                  </div>

                  {/* Product Image Upload */}
                  <div className="bg-card rounded-2xl border border-border/50 p-6">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                      {selectedCategory === 'clothing' ? 'Clothing Item' : selectedCategory === 'bags' ? 'Bag / Accessory' : 'Eyewear'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5">Upload the product image to try on</p>

                    {productImage ? (
                      <div className="relative rounded-xl overflow-hidden">
                        <img src={productImage.previewUrl} alt="Product" className="w-full aspect-[3/4] object-cover" />
                        <button
                          onClick={() => setProductImage(null)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <X className="h-4 w-4 text-foreground" />
                        </button>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-background/90 rounded-full px-2 py-1">
                          <Check className="h-3 w-3 text-foreground" />
                          <span className="text-xs font-medium text-foreground">Product uploaded</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-foreground/30 transition-colors cursor-pointer"
                        onClick={() => productInputRef.current?.click()}
                        onDrop={(e) => handleDrop(e, setProductImage)}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">Drop product image or click to upload</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 10MB</p>
                        <p className="text-xs text-muted-foreground mt-2">Best results: product on white background, full item visible</p>
                      </div>
                    )}
                    <input ref={productInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], setProductImage)} />

                    <div className="mt-5 space-y-2">
                      <Label htmlFor="studio-product-desc-upload" className="text-foreground">
                        Product description <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="studio-product-desc-upload"
                        placeholder={
                          selectedCategory === "clothing"
                            ? "e.g. Black floor-length mermaid gown, thin spaghetti straps, matte jersey"
                            : selectedCategory === "bags"
                              ? "e.g. Medium leather tote, tan, gold hardware"
                              : "e.g. Oversized aviators, black acetate frame"
                        }
                        value={productDescription}
                        maxLength={400}
                        rows={3}
                        className="resize-y min-h-[80px] text-sm"
                        onChange={(e) => setProductDescription(e.target.value.slice(0, 400))}
                      />
                    </div>

                    <Button
                      onClick={handleTryOn}
                      disabled={!personImage || !productImage}
                      className="w-full mt-6 gradient-primary text-primary-foreground shadow-soft"
                    >
                      Try It On <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── AI MODEL DEMO PHASE ───────────────────────────────────── */}
              {phase === "select" && mode === "ai-model" && (
                <motion.div key="demo-select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6 text-center">
                    {audience === "individual" ? (
                      <p className="text-sm text-foreground/90">
                        <span className="font-medium">Preset models</span> — pick a look, then upload a product image. Great
                        when you don&apos;t want to use your own photo; same quality AI try-on as{" "}
                        <strong>Upload Photo</strong>.
                      </p>
                    ) : (
                      <p className="text-sm text-foreground/90">
                        <span className="font-medium">Shared model library</span> — same presets shoppers can see in your{" "}
                        <strong>embedded widget</strong> when <strong>Show AI Model Selection</strong> is enabled in
                        Settings.
                      </p>
                    )}
                  </div>
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground mb-1">1. Choose a model</h3>
                    <p className="text-sm text-muted-foreground">
                      Different looks and body types.
                      {audience === "business" && " Run the migration if the list is empty."}
                    </p>
                    {user && !studioModelsUnlocked && (
                      <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/40 px-3 py-2 mt-2">
                        <span className="font-medium text-foreground">Out of try-on credits:</span> preset models are locked
                        until you add credits.{" "}
                        <Link
                          to={resolvedCreditsPath}
                          className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
                        >
                          Add credits
                        </Link>
                      </p>
                    )}
                    {user &&
                      studioModelsUnlocked &&
                      isFreeTierStudioPlan(studioCreditsPlan) &&
                      filteredModels.some((m) => !modelEligibleOnFreeTier(m)) && (
                        <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/40 px-3 py-2 mt-2">
                          <span className="font-medium text-foreground">Free plan:</span> only presets marked for the free
                          tier are unlocked here.{" "}
                          <Link
                            to="/pricing"
                            className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
                          >
                            Upgrade
                          </Link>{" "}
                          for the full library.
                        </p>
                      )}
                  </div>
                      <div className="flex gap-2">
                        {(["Female", "Male"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              setGenderFilter(g);
                              setSelectedModel(null);
                            }}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                              genderFilter === g ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                      {modelsLoading ? (
                        <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading models…</div>
                      ) : modelsError ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                          {modelsError}
                        </div>
                      ) : filteredModels.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No models for this filter.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[min(52vh,520px)] overflow-y-auto pr-1">
                          {filteredModels.map((model) => {
                            const locked = isModelLockedForUser(model);
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  if (locked) {
                                    if (
                                      studioModelsUnlocked &&
                                      isFreeTierStudioPlan(studioCreditsPlan) &&
                                      !modelEligibleOnFreeTier(model)
                                    ) {
                                      toast.message("Included on paid plans", {
                                        description:
                                          "Upgrade to unlock this preset, or choose another model.",
                                      });
                                    } else {
                                      toast.message("Try-on credits needed", {
                                        description:
                                          "Add credits to unlock preset models, or sign in if you haven't yet.",
                                      });
                                    }
                                    return;
                                  }
                                  setSelectedModel(model.id);
                                }}
                                className={`rounded-xl overflow-hidden border-2 text-left transition-all relative ${
                                  selectedModel === model.id && !locked
                                    ? "border-foreground shadow-soft"
                                    : "border-border/50 hover:border-foreground/20"
                                } ${locked ? "opacity-75 cursor-not-allowed" : ""}`}
                              >
                                <div className="aspect-[3/4] relative bg-muted">
                                  <img
                                    src={`${model.image_url}${model.image_url.includes("?") ? "&" : "?"}tryverse_slug=${encodeURIComponent(model.slug)}`}
                                    alt={model.display_name}
                                    className={`w-full h-full object-cover ${locked ? "grayscale-[0.35]" : ""}`}
                                    loading="lazy"
                                  />
                                  {locked && (
                                    <div className="absolute top-2 right-2 rounded-full bg-background/90 p-1.5 shadow-sm">
                                      <Lock className="h-3.5 w-3.5 text-foreground" aria-hidden />
                                    </div>
                                  )}
                                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                                    <p className="text-white text-xs font-semibold">{model.display_name}</p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="bg-card rounded-2xl border border-border/50 p-6 flex flex-col gap-4">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground mb-1">2. Product image</h3>
                        <p className="text-sm text-muted-foreground">
                          Upload the item to try on, then run live AI (same pipeline as “Upload Photo”).
                        </p>
                      </div>
                      {libraryProductImage ? (
                        <div className="relative rounded-xl overflow-hidden border border-border/50">
                          <img
                            src={libraryProductImage.previewUrl}
                            alt="Product"
                            className="w-full aspect-[3/4] object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setLibraryProductImage(null)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 flex items-center justify-center"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-foreground/30 transition-colors"
                          onClick={() => libraryProductInputRef.current?.click()}
                          onDrop={(e) => handleDrop(e, setLibraryProductImage)}
                          onDragOver={(e) => e.preventDefault()}
                        >
                          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium text-foreground">Drop product or click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP · up to 10MB</p>
                        </button>
                      )}
                      <input
                        ref={libraryProductInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files?.[0] && handleFileSelect(e.target.files[0], setLibraryProductImage)
                        }
                      />
                      <div className="space-y-2">
                        <Label htmlFor="studio-product-desc-library" className="text-foreground">
                          Product description <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                          id="studio-product-desc-library"
                          placeholder={
                            selectedCategory === "clothing"
                              ? "e.g. Black floor-length mermaid gown, thin spaghetti straps"
                              : selectedCategory === "bags"
                                ? "e.g. Structured crossbody, croc-embossed, chain strap"
                                : "e.g. Round metal frames, rose gold"
                          }
                          value={productDescription}
                          maxLength={400}
                          rows={3}
                          className="resize-y min-h-[80px] text-sm"
                          onChange={(e) => setProductDescription(e.target.value.slice(0, 400))}
                        />
                      </div>
                      <Button
                        onClick={handleTryOnWithLibraryModel}
                        disabled={
                          !selectedModel ||
                          selectedPresetLocked ||
                          !libraryProductImage ||
                          modelsLoading ||
                          !!modelsError
                        }
                        className="w-full gradient-primary text-primary-foreground shadow-soft"
                      >
                        Try it on <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => { setMode("upload"); handleReset(); }}>
                        <Upload className="h-4 w-4" /> Use my own photo instead
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── UPLOADING PHASE ──────────────────────────────────────── */}
              {phase === "uploading" && (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto text-center py-20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-full border-2 border-border border-t-foreground flex items-center justify-center mx-auto mb-6">
                    <Upload className="h-6 w-6 text-foreground" />
                  </motion.div>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2">Preparing Images</h3>
                  <p className="text-sm text-muted-foreground">{uploadProgress}</p>
                </motion.div>
              )}

              {/* ── PROCESSING PHASE ─────────────────────────────────────── */}
              {phase === "processing" && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto text-center py-20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-full border-2 border-border border-t-foreground flex items-center justify-center mx-auto mb-6">
                    <Scan className="h-6 w-6 text-foreground" />
                  </motion.div>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2">AI is Working</h3>
                  <p className="text-sm text-muted-foreground">Preprocessing images · Running inference · Enhancing result</p>
                  <p className="text-sm font-medium text-foreground mt-4 tabular-nums">
                    {processElapsedSec}s elapsed
                  </p>
                  <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden max-w-xs mx-auto relative">
                    <motion.div
                      className="h-full bg-foreground rounded-full absolute left-0 top-0 w-[32%]"
                      animate={{ x: ["-20%", "220%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 max-w-sm mx-auto">
                    Most runs finish in about one to three minutes (Replicate cold starts can be slower). Leave this tab open—closing it can cancel the request.
                  </p>
                </motion.div>
              )}

              {/* ── RESULT PHASE ─────────────────────────────────────────── */}
              {phase === "result" && resultUrl && (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-2xl mx-auto">
                  <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-elevated">
                    <div className="aspect-[3/4] relative">
                      <img src={resultUrl} alt="Try-on result" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/70 to-transparent p-6 pt-20">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 text-foreground text-xs font-semibold mb-3">
                          <Check className="h-3 w-3" />
                          AI Try-On Complete
                          {processingTime && <span className="text-muted-foreground ml-1">· {(processingTime / 1000).toFixed(1)}s</span>}
                        </div>
                        <p className="text-primary-foreground font-display text-xl font-semibold capitalize">{selectedCategory} Try-On</p>
                        <p className="text-primary-foreground/70 text-sm mt-1">Powered by TryVerse AI</p>
                      </div>
                    </div>
                    <div className="p-6 border-t border-border/50 flex justify-between items-center">
                      <a
                        href={resultUrl}
                        download="tryverse-result.jpg"
                        className="text-sm font-medium text-foreground hover:underline"
                        onClick={() => posthogCapture("download_result_clicked", { source: "try_on_studio" })}
                      >
                        Download result
                      </a>
                      <Button onClick={handleReset} variant="outline" className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Try Another
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── ERROR PHASE ──────────────────────────────────────────── */}
              {phase === "error" && errorKind && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto text-center py-20">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                      errorKind === "credits"
                        ? "bg-primary/10"
                        : errorKind === "person_photo"
                          ? "bg-amber-500/10"
                          : "bg-destructive/10"
                    }`}
                  >
                    {errorKind === "credits" ? (
                      <span className="text-3xl">✨</span>
                    ) : (
                      <AlertCircle
                        className={`h-7 w-7 ${
                          errorKind === "person_photo" ? "text-amber-600" : "text-destructive"
                        }`}
                      />
                    )}
                  </div>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                    {errorKind === "credits"
                      ? "You've used all your free try-ons"
                      : errorKind === "person_photo"
                        ? "We couldn’t use this photo"
                        : "Something went wrong"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {errorKind === "credits"
                      ? "Your free try-on credits have been used up. Upgrade your plan to keep trying on outfits."
                      : errorMsg || "Please try again."}
                  </p>
                  <div className="flex flex-col gap-3 items-center">
                    {errorKind === "credits" ? (
                      <>
                        <Button asChild className="gap-2 px-6">
                          <Link to={resolvedCreditsPath}>
                            {embedded ? "View Profile & Plan" : "Upgrade Plan"}
                          </Link>
                        </Button>
                        <Button onClick={handleReset} variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                          <RotateCcw className="h-3.5 w-3.5" /> Try again
                        </Button>
                      </>
                    ) : (
                      <Button onClick={handleReset} variant="outline" className="gap-2">
                        <RotateCcw className="h-4 w-4" /> Try again
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
            </>
          )}
        </div>
      </main>
      {!embedded && <Footer />}
    </div>
  );
};

export default TryOnStudio;
