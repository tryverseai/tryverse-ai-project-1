import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Sparkles, ImageIcon, User, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  uploadImage,
  startTryOn,
  getCredits,
  isCreditsExhaustedApiError,
  type TryOnCategory,
} from "@/lib/backendApi";
import { posthogCapture } from "@/lib/posthog";
import { captureSentryException } from "@/lib/sentry";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ConnectStoreWizard } from "@/components/dashboard/ConnectStoreWizard";

const sampleModels = [
  { id: "model-1", name: "Model A", image: "/placeholder.svg" },
  { id: "model-2", name: "Model B", image: "/placeholder.svg" },
];

export function WidgetTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"connect" | "try">("connect");
  const [creditsRemaining, setCreditsRemaining] = useState(20);
  const [creditsPoolTotal, setCreditsPoolTotal] = useState(20);
  const [aiTryOnEnabled, setAiTryOnEnabled] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [productDescription, setProductDescription] = useState("");

  useEffect(() => {
    if (activeView === "try") {
      posthogCapture("brand_page_viewed", { source: "widget_tab" });
    }
  }, [activeView]);

  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        const credits = await getCredits();
        setCreditsRemaining(
          credits.isUnlimited ? 999 : credits.monthlyCreditsRemaining + credits.freeCreditsRemaining
        );
        setCreditsPoolTotal(credits.freeCreditsTotal + credits.monthlyCreditsTotal);
        setAiTryOnEnabled(credits.isUnlimited || credits.plan !== "free");
      } catch {
        setCreditsRemaining(20);
        setCreditsPoolTotal(20);
      }
    };
    void fetchUserData();
  }, [user]);

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setProductImage(reader.result as string);
      reader.readAsDataURL(file);
      setTryOnResult(null);
    }
  };

  const handlePersonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      posthogCapture("upload_photo_clicked", { source: "widget_tab" });
      const reader = new FileReader();
      reader.onload = () => setPersonImage(reader.result as string);
      reader.readAsDataURL(file);
      setTryOnResult(null);
    }
  };

  const handleTryOn = async () => {
    if (creditsRemaining <= 0 && !aiTryOnEnabled) {
      toast.error("No credits remaining. Upgrade your plan to continue.");
      return;
    }
    if (!productImage) {
      toast.error("Please upload a product image first.");
      return;
    }
    if (!personImage) {
      toast.error("Please upload your photo.");
      return;
    }

    setProcessing(true);
    setTryOnResult(null);
    posthogCapture("try_on_started", { source: "widget_tab", category: "clothing" });

    try {
      const productFile = await dataUrlToFile(productImage);
      const personFile = await dataUrlToFile(personImage);

      const [productUpload, personUpload] = await Promise.all([
        uploadImage(productFile, "product"),
        uploadImage(personFile, "person"),
      ]);

      const result = await startTryOn({
        personImagePath: personUpload.filePath,
        productImagePath: productUpload.filePath,
        category: "clothing" as TryOnCategory,
        productDescription: productDescription.trim() || undefined,
      });

      if (result.status === "completed" && result.resultUrl) {
        setTryOnResult(result.resultUrl);
        toast.success("Try-on generated successfully!");
        const credits = await getCredits();
        setCreditsRemaining(
          credits.isUnlimited ? 999 : credits.monthlyCreditsRemaining + credits.freeCreditsRemaining
        );
      } else {
        throw new Error(result.error || "Generation failed");
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const creditsOut = isCreditsExhaustedApiError(err);
      posthogCapture("try_on_failed", { source: "widget_tab", category: "clothing", error: err.message, credits_exhausted: creditsOut });
      if (!creditsOut) {
        captureSentryException(err, { tags: { feature: "try_on", source: "widget_tab" } });
      }
      if (creditsOut) {
        toast.error("No try-on credits left. Opening Billing…");
        navigate("/dashboard/business?tab=Billing");
      } else {
        toast.error(err.message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const dataUrlToFile = (dataUrl: string): Promise<File> => {
    return fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => new File([blob], "image.jpg", { type: blob.type || "image/jpeg" }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* View toggle */}
      <div className="flex gap-2 mb-8">
        <Button
          variant={activeView === "connect" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("connect")}
          className={activeView === "connect" ? "gradient-primary text-primary-foreground" : ""}
        >
          <Store className="h-4 w-4 mr-2" /> Connect Your Store
        </Button>
        <Button
          variant={activeView === "try" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("try")}
          className={activeView === "try" ? "gradient-primary text-primary-foreground" : ""}
        >
          <Sparkles className="h-4 w-4 mr-2" /> Try It Yourself
        </Button>
      </div>

      {activeView === "try" ? (
        <div className="space-y-6">
          {/* Credits counter */}
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card">
            <Sparkles className="h-5 w-5 text-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {aiTryOnEnabled ? "AI Virtual Try-On Enabled" : "Free AI Try-On Credits"}
              </p>
              <p className="text-xs text-muted-foreground">
                {aiTryOnEnabled ? "Unlimited generations" : `${creditsRemaining} / ${creditsPoolTotal} Remaining`}
              </p>
            </div>
          </div>

          {/* Preview area - 3 columns */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Product Upload */}
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
              <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Product Photo
              </h3>
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-foreground/20 transition-colors overflow-hidden">
                {productImage ? (
                  <img src={productImage} alt="Product" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <p className="text-sm">Upload product</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
              </label>
            </div>

            {/* Person Upload */}
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
              <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <User className="h-4 w-4" /> Your Photo
              </h3>
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-foreground/20 transition-colors overflow-hidden">
                {personImage ? (
                  <img src={personImage} alt="Person" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <p className="text-sm">Upload photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePersonUpload} />
              </label>
            </div>

            {/* Result */}
            <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
              <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Try-On Result
              </h3>
              <div className="flex items-center justify-center w-full h-48 border border-border/30 rounded-xl bg-muted/20 overflow-hidden">
                {processing ? (
                  <div className="text-center">
                    <Sparkles className="h-8 w-8 text-primary animate-pulse mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Generating...</p>
                  </div>
                ) : tryOnResult ? (
                  <img src={tryOnResult} alt="Try-on result" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <p className="text-sm">Result appears here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 shadow-card space-y-2">
            <Label htmlFor="widget-preview-product-desc" className="text-foreground">
              Product description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="widget-preview-product-desc"
              placeholder="e.g. Black floor-length evening gown, bodycon, spaghetti straps — helps AI match length and fit"
              value={productDescription}
              maxLength={400}
              rows={3}
              className="resize-y min-h-[80px] text-sm"
              onChange={(e) => setProductDescription(e.target.value.slice(0, 400))}
              disabled={processing}
            />
            <p className="text-xs text-muted-foreground">
              Used to help the AI match length, cut, and fabric — the same detail your customers can add
              when they try this product on.
            </p>
          </div>

          {/* Generate button */}
          <Button
            className="w-full gradient-primary text-primary-foreground shadow-soft"
            onClick={handleTryOn}
            disabled={!productImage || !personImage || processing || (creditsRemaining <= 0 && !aiTryOnEnabled)}
          >
            {processing ? "Generating..." : "Run AI Try-On"}
          </Button>

          {creditsRemaining === 0 && !aiTryOnEnabled && (
            <div className="bg-muted/50 border border-border/50 rounded-xl p-6 text-center">
              <p className="text-sm text-foreground font-semibold mb-2">You've used your free TryVerse tests</p>
              <p className="text-sm text-muted-foreground mb-4">Choose a plan to keep using AI Virtual Try-On.</p>
              <Button onClick={() => navigate("/pricing")} className="gradient-primary text-primary-foreground shadow-soft">
                View plans
              </Button>
            </div>
          )}
        </div>
      ) : (
        <ConnectStoreWizard aiTryOnEnabled={aiTryOnEnabled} userKey={user?.id} onTryItYourself={() => setActiveView("try")} />
      )}
    </motion.div>
  );
}
