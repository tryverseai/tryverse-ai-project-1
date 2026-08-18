import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, ImagePlus, Download, Camera, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  uploadImage,
  generateProductModel,
  pollProductModelStatus,
} from "@/lib/backendApi";
import { useIsEnterprisePlan } from "@/hooks/useIsEnterprisePlan";
import { EnterpriseUpgradeModal } from "@/components/EnterpriseUpgradeModal";
import { posthogCapture } from "@/lib/posthog";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { downloadFile, dateStampedFilename } from "@/lib/utils";

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;

function ComingSoonState() {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Clock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">AI Model Studio is coming soon</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        We're finishing up quality testing before rolling this out.
      </p>
    </div>
  );
}

function LockedState({ onUpgradeClick }: { onUpgradeClick: () => void }) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Lock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">AI Model Studio is an Enterprise feature</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5">
        Turn a product photo into professional on-model photography, instantly.
      </p>
      <Button onClick={onUpgradeClick} className="gradient-primary text-primary-foreground shadow-soft gap-2">
        <Sparkles className="h-4 w-4" /> Unlock Enterprise
      </Button>
    </div>
  );
}

export function ProductModelTab() {
  const isEnterprise = useIsEnterprisePlan();
  const enabled = FEATURE_FLAGS.PRODUCT_MODEL_ENABLED;
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productPath, setProductPath] = useState<string | null>(null);
  const [productUploading, setProductUploading] = useState(false);

  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [facePath, setFacePath] = useState<string | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ imageUrl: string; createdAt: string }[]>([]);

  const active = enabled && isEnterprise;

  const openUpgrade = () => {
    posthogCapture("enterprise_upgrade_modal_opened", { context: "product-model", source: "product_model_tab" });
    setUpgradeOpen(true);
  };

  const handleProductFile = async (file: File | null) => {
    if (!file) return;
    setProductPreview(URL.createObjectURL(file));
    setProductPath(null);
    setProductUploading(true);
    try {
      const { filePath } = await uploadImage(file, "product");
      setProductPath(filePath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload product photo");
    } finally {
      setProductUploading(false);
    }
  };

  const handleFaceFile = async (file: File | null) => {
    if (!file) return;
    setFacePreview(URL.createObjectURL(file));
    setFacePath(null);
    setFaceUploading(true);
    try {
      const { filePath } = await uploadImage(file, "product");
      setFacePath(filePath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload face reference");
    } finally {
      setFaceUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!productPath) {
      toast.error("Upload a product photo first");
      return;
    }
    setGenerating(true);
    posthogCapture("product_model_generate_clicked", { hasFaceReference: Boolean(facePath) });
    try {
      const started = await generateProductModel({
        productStoragePath: productPath,
        faceReferenceStoragePath: facePath ?? undefined,
        prompt: prompt.trim() || undefined,
      });

      if (started.status === "completed" && started.resultUrl) {
        setResults((prev) => [{ imageUrl: started.resultUrl!, createdAt: started.createdAt ?? new Date().toISOString() }, ...prev]);
        toast.success("Generated");
        return;
      }
      if (started.status === "failed") {
        throw new Error(started.error ?? "Could not generate this");
      }

      let attempts = 0;
      while (attempts < MAX_POLL_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        attempts++;
        const update = await pollProductModelStatus(started.generationId);
        if (update.status === "completed" && update.resultUrl) {
          setResults((prev) => [{ imageUrl: update.resultUrl!, createdAt: update.createdAt ?? new Date().toISOString() }, ...prev]);
          toast.success("Generated");
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Could not generate this");
        }
      }
      throw new Error("This is taking longer than expected — check back shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            AI Model Studio
            {!isEnterprise && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" /> Enterprise
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Turn a product photo into professional on-model photography — no model library needed.
          </p>
        </div>
      </div>

      {!enabled ? (
        <ComingSoonState />
      ) : !isEnterprise ? (
        <LockedState onUpgradeClick={openUpgrade} />
      ) : (
        <div className="space-y-8">
          <div className="bg-card rounded-xl border border-border/50 shadow-card p-6 space-y-6">
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4" /> 1. Upload
              </h3>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Product photo</p>
                  {productPreview ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                        <img src={productPreview} alt="Product" className="w-full h-full object-cover" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => productInputRef.current?.click()}>Replace</Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => productInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-xs">{productUploading ? "Uploading…" : "Click to upload a product photo"}</span>
                    </button>
                  )}
                  <input
                    ref={productInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void handleProductFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Face reference <span className="text-muted-foreground/70">(optional)</span>
                  </p>
                  {facePreview ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                        <img src={facePreview} alt="Face reference" className="w-full h-full object-cover" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => faceInputRef.current?.click()}>Replace</Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => faceInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                    >
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-xs">{faceUploading ? "Uploading…" : "Guide identity"}</span>
                    </button>
                  )}
                  <input
                    ref={faceInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void handleFaceFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Styling notes (optional)</Label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. outdoor lifestyle setting, natural light"
                maxLength={500}
              />
            </div>

            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || productUploading || !productPath}
              className="gradient-primary text-primary-foreground shadow-soft gap-2"
            >
              <Sparkles className="h-4 w-4" /> {generating ? "Generating…" : "Generate"}
            </Button>
          </div>

          {results.length > 0 && (
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map((r) => (
                  <div key={r.imageUrl} className="rounded-xl overflow-hidden border border-border/50 bg-card group relative">
                    <div className="aspect-[4/5] bg-muted">
                      <img src={r.imageUrl} alt="Generated model photo" className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadFile(r.imageUrl, dateStampedFilename("tryverse-model")).catch(() =>
                          toast.error("Download failed")
                        )
                      }
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground shadow">
                        <Download className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <EnterpriseUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} context="product-model" />
    </motion.div>
  );
}
