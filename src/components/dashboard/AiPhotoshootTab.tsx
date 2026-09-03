import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Upload, Camera, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCredits } from "@/contexts/CreditsContext";
import { uploadImage, generateProductPhotoshoot } from "@/lib/backendApi";
import { posthogCapture } from "@/lib/posthog";
import { downloadFile, dateStampedFilename } from "@/lib/utils";
import { GenerationLoadingScreen } from "@/components/GenerationLoadingScreen";
import { GeneratorEntry } from "@/components/dashboard/GeneratorEntry";
import { BackLink } from "@/components/dashboard/BackLink";
import { ModelPickerGrid, type PickedModel } from "@/components/dashboard/ModelPickerGrid";
import { useFilePicker } from "@/hooks/useFilePicker";

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

type Step = "entry" | "shoot";
type Status = "idle" | "generating" | "done" | "error";

export function AiPhotoshootTab() {
  const { refresh: refreshCredits } = useCredits();

  const [step, setStep] = useState<Step>("entry");

  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [productStoragePath, setProductStoragePath] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<PickedModel | null>(null);

  const [theme, setTheme] = useState(THEME_OPTIONS[0]);
  const [lighting, setLighting] = useState(LIGHTING_OPTIONS[0]);
  const [background, setBackground] = useState(BACKGROUND_OPTIONS[0]);

  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = () => {
    setStep("entry");
    setProductFile(null);
    setProductPreview(null);
    setProductStoragePath(null);
    setSelectedModel(null);
    setTheme(THEME_OPTIONS[0]);
    setLighting(LIGHTING_OPTIONS[0]);
    setBackground(BACKGROUND_OPTIONS[0]);
    setStatus("idle");
    setResultUrl(null);
    setErrorMsg(null);
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
    setStatus("generating");
    setErrorMsg(null);
    posthogCapture("ai_photoshoot_generate_clicked", { modelSource: selectedModel.source, theme, lighting, background });
    try {
      const result = await generateProductPhotoshoot({
        productStoragePath,
        modelId: selectedModel.id,
        modelSource: selectedModel.source,
        theme,
        lighting,
        background,
        idempotencyKey: crypto.randomUUID(),
      });
      setResultUrl(result.imageUrl);
      setStatus("done");
      toast.success("Photoshoot generated");
      void refreshCredits();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate the photoshoot";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const photoPicker = useFilePicker((f) => {
    void handleFileChange(f);
    setStep("shoot");
  });

  const showingGenerationUi = status === "generating" || status === "done" || status === "error";
  const canGenerate = Boolean(productStoragePath) && Boolean(selectedModel) && !uploading;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">AI Photoshoot</h2>
        <p className="text-sm text-muted-foreground">
          Create campaign-ready imagery — upload a product, pick a model, set the scene.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "entry" && (
          <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GeneratorEntry
              title="Shoot it like a campaign"
              subtitle="Upload one product photo, pick a model and a scene, and get a campaign-ready shot in seconds."
              actions={[{ label: "Upload a product", icon: Upload, onClick: photoPicker.open, variant: "primary" }]}
            />
          </motion.div>
        )}

        {step === "shoot" && (
          <motion.div
            key="shoot"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={showingGenerationUi ? "" : "max-w-2xl mx-auto space-y-6"}
          >
            {showingGenerationUi ? (
              status === "generating" ? (
                <GenerationLoadingScreen
                  title="Creating your photoshoot"
                  stages={PHOTOSHOOT_STAGES}
                  previewItems={[
                    ...(productPreview ? [{ label: "Product", imageUrl: productPreview }] : []),
                    ...(selectedModel ? [{ label: selectedModel.label, imageUrl: selectedModel.imageUrl }] : []),
                  ]}
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
                      alt="Generated photoshoot"
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
                        void downloadFile(resultUrl, dateStampedFilename("tryverse-photoshoot")).catch(() =>
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
                  <p className="text-sm font-medium text-destructive">Photoshoot failed</p>
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
                <BackLink onClick={reset} label="Back to start" />

                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <img src={productPreview ?? undefined} alt="Product" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Using</p>
                    <p className="text-sm font-medium text-foreground">Your product</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" /> Model
                  </p>
                  <ModelPickerGrid selectedId={selectedModel?.id} onSelect={setSelectedModel} />
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Scene</p>
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
                  className="w-full h-11 gradient-primary text-primary-foreground shadow-soft"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerate()}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate photoshoot
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={photoPicker.inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={photoPicker.onChange}
      />
    </div>
  );
}
