import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Upload, ImagePlus, Camera, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { uploadImage, generateProductPhotoshoot } from "@/lib/backendApi";
import { useIsEnterprisePlan } from "@/hooks/useIsEnterprisePlan";
import { EnterpriseUpgradeModal } from "@/components/EnterpriseUpgradeModal";
import { posthogCapture } from "@/lib/posthog";
import { downloadFile, dateStampedFilename } from "@/lib/utils";
import { GenerationLoadingScreen } from "@/components/GenerationLoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import { ModelPickerGrid, type PickedModel } from "@/components/dashboard/ModelPickerGrid";

const PHOTOSHOOT_STAGES = [
  "Preparing your product photo",
  "Placing it in scene",
  "Applying lighting and theme",
  "Finishing the shot",
  "Almost ready",
];

const THEME_OPTIONS = ["Contemporary catalog", "Luxury editorial", "Streetwear", "Minimal studio", "Lifestyle outdoor"];
const LIGHTING_OPTIONS = ["Soft studio", "Bright daylight", "Dramatic contrast", "Golden hour"];
const BACKGROUND_OPTIONS = ["Clean neutral", "Studio white", "Textured backdrop", "Urban street", "Outdoor"];

function LockedState({ onUpgradeClick }: { onUpgradeClick: () => void }) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Lock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">AI Product Photoshoot is an Enterprise feature</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5">
        Upload a product photo and shoot it on any model in your library — no studio required.
      </p>
      <Button onClick={onUpgradeClick} className="gradient-primary text-primary-foreground shadow-soft gap-2">
        <Sparkles className="h-4 w-4" /> Unlock Enterprise
      </Button>
    </div>
  );
}

export function AiPhotoshootTab() {
  const isEnterprise = useIsEnterprisePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [productStoragePath, setProductStoragePath] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<PickedModel | null>(null);

  const [theme, setTheme] = useState(THEME_OPTIONS[0]);
  const [lighting, setLighting] = useState(LIGHTING_OPTIONS[0]);
  const [background, setBackground] = useState(BACKGROUND_OPTIONS[0]);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ imageUrl: string; createdAt: string }[]>([]);

  const openUpgrade = () => {
    posthogCapture("enterprise_upgrade_modal_opened", { context: "photoshoot", source: "ai_photoshoot_tab" });
    setUpgradeOpen(true);
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setProductFile(file);
    setProductPreview(URL.createObjectURL(file));
    setProductStoragePath(null);
    setUploading(true);
    try {
      const { filePath } = await uploadImage(file, "product");
      setProductStoragePath(filePath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload product photo");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!productStoragePath) {
      toast.error("Upload a product photo first");
      return;
    }
    if (!selectedModel) {
      toast.error("Pick a model to shoot the product on");
      return;
    }
    setGenerating(true);
    posthogCapture("ai_photoshoot_generate_clicked", { modelSource: selectedModel.source, theme, lighting, background });
    try {
      const result = await generateProductPhotoshoot({
        productStoragePath,
        modelId: selectedModel.id,
        modelSource: selectedModel.source,
        theme,
        lighting,
        background,
      });
      setResults((prev) => [result, ...prev]);
      toast.success("Photoshoot generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the photoshoot");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            AI Product Photoshoot
            {!isEnterprise && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" /> Enterprise
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create campaign-ready imagery — upload a product, pick a model, set the scene.
          </p>
        </div>
      </div>

      {!isEnterprise ? (
        <LockedState onUpgradeClick={openUpgrade} />
      ) : (
        <div className="space-y-8">
          <div className="bg-card rounded-xl border border-border/50 shadow-card p-6 space-y-6">
            {/* Step 1: product upload */}
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" /> 1. Upload your product
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
              />
              {productPreview ? (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                    <img src={productPreview} alt="Product" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{productFile?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {uploading ? "Uploading…" : productStoragePath ? "Ready" : "Upload failed"}
                    </p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-10 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-sm">Click to upload a product photo</span>
                </button>
              )}
            </div>

            {/* Step 2: pick a model */}
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4" /> 2. Pick a model
              </h3>
              <ModelPickerGrid selectedId={selectedModel?.id} onSelect={setSelectedModel} />
            </div>

            {/* Step 3: scene */}
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3">3. Scene</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THEME_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Lighting</Label>
                  <Select value={lighting} onValueChange={setLighting}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LIGHTING_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Background</Label>
                  <Select value={background} onValueChange={setBackground}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BACKGROUND_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || uploading || !productStoragePath || !selectedModel}
              className="gradient-primary text-primary-foreground shadow-soft gap-2"
            >
              <Sparkles className="h-4 w-4" /> {generating ? "Generating…" : "Generate photoshoot"}
            </Button>
          </div>

          {generating ? (
            <GenerationLoadingScreen
              title="Creating your photoshoot"
              stages={PHOTOSHOOT_STAGES}
              previewItems={[
                ...(productPreview ? [{ label: "Product", imageUrl: productPreview }] : []),
                ...(selectedModel ? [{ label: selectedModel.label, imageUrl: selectedModel.imageUrl }] : []),
              ]}
            />
          ) : results.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No photoshoots yet"
              description="Generated campaign imagery will appear here so you can reuse and download it."
            />
          ) : (
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map((r) => (
                  <div key={r.imageUrl} className="rounded-xl overflow-hidden border border-border/50 bg-card group relative">
                    <div className="aspect-[4/5] bg-muted">
                      <img src={r.imageUrl} alt="Generated photoshoot" className="w-full h-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadFile(r.imageUrl, dateStampedFilename("tryverse-photoshoot")).catch(() =>
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

      <EnterpriseUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} context="photoshoot" />
    </motion.div>
  );
}
