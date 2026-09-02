import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Download, Film, Clock, Users, Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCredits } from "@/contexts/CreditsContext";
import {
  uploadImage,
  generateVideo,
  pollVideoStatus,
  createPersonPathFromModel,
} from "@/lib/backendApi";
import { useIsFreePlan } from "@/hooks/useIsFreePlan";
import { posthogCapture } from "@/lib/posthog";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { downloadFile, dateStampedFilename } from "@/lib/utils";
import { GenerationLoadingScreen } from "@/components/GenerationLoadingScreen";
import { GeneratorEntry } from "@/components/dashboard/GeneratorEntry";
import { BackLink } from "@/components/dashboard/BackLink";
import { ModelPickerGrid, type PickedModel } from "@/components/dashboard/ModelPickerGrid";
import { DarkPanel } from "@/components/dashboard/DarkPanel";
import { useFilePicker } from "@/hooks/useFilePicker";

const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 5000;

const VIDEO_STAGES = [
  "Preparing your image",
  "Mapping motion",
  "Rendering frames",
  "Encoding your clip",
  "Almost ready",
];

const DURATION_OPTIONS: { value: "5" | "10"; label: string; credits: string }[] = [
  { value: "5", label: "5 seconds", credits: "1×" },
  { value: "10", label: "10 seconds", credits: "2×" },
];

const RESOLUTION_OPTIONS: { value: "480p" | "720p" | "1080p"; label: string; credits: number }[] = [
  { value: "480p", label: "480p", credits: 1 },
  { value: "720p", label: "720p", credits: 3 },
  { value: "1080p", label: "1080p", credits: 6 },
];

function ComingSoonState() {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Clock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">AI Video is coming soon</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        We're finishing up quality testing before rolling this out.
      </p>
    </div>
  );
}

type Step = "entry" | "choose-model" | "settings";
type EntryMode = "upload" | "model" | null;
type Status = "idle" | "generating" | "done" | "error";

export function VideoTab() {
  const { refresh: refreshCredits } = useCredits();
  const isFreePlan = useIsFreePlan();
  const enabled = FEATURE_FLAGS.VIDEO_ENABLED;

  const [step, setStep] = useState<Step>("entry");
  const [entryMode, setEntryMode] = useState<EntryMode>(null);

  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickedModel, setPickedModel] = useState<PickedModel | null>(null);
  const [resolvingModel, setResolvingModel] = useState(false);

  const [duration, setDuration] = useState<"5" | "10">("5");
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("1080p");
  const [prompt, setPrompt] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = () => {
    setStep("entry");
    setEntryMode(null);
    setSourcePreview(null);
    setSourcePath(null);
    setPickedModel(null);
    setDuration("5");
    setResolution("1080p");
    setPrompt("");
    setStatus("idle");
    setResultUrl(null);
    setErrorMsg(null);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setSourcePreview(URL.createObjectURL(file));
    setSourcePath(null);
    setUploading(true);
    try {
      const { filePath } = await uploadImage(file, "product");
      setSourcePath(filePath);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const photoPicker = useFilePicker((f) => {
    void handleFile(f);
    setEntryMode("upload");
    setStep("settings");
  });

  const openPhotoPicker = () => {
    setEntryMode("upload");
    photoPicker.open();
  };

  const handlePickModel = async (m: PickedModel) => {
    setPickedModel(m);
    setSourcePreview(m.imageUrl);
    setSourcePath(null);
    setResolvingModel(true);
    try {
      const path = m.source === "generated" ? m.storagePath : await createPersonPathFromModel(m.id);
      setSourcePath(path);
      setStep("settings");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use this model");
    } finally {
      setResolvingModel(false);
    }
  };

  const handleGenerate = async () => {
    if (!sourcePath) {
      toast.error(entryMode === "model" ? "Choose a model first" : "Upload a source image first");
      return;
    }
    if (isFreePlan) {
      toast.error("AI Video requires a paid plan.", { description: "Upgrade in Billing to unlock video generation." });
      return;
    }
    setStatus("generating");
    setErrorMsg(null);
    posthogCapture("video_generate_clicked", { duration, resolution });
    try {
      const started = await generateVideo({
        sourceStoragePath: sourcePath,
        prompt: prompt.trim() || undefined,
        duration: Number(duration) as 5 | 10,
        resolution,
      });

      if (started.status === "completed" && started.resultUrl) {
        setResultUrl(started.resultUrl);
        setStatus("done");
        toast.success("Video generated");
        void refreshCredits();
        return;
      }
      if (started.status === "failed") {
        throw new Error(started.error ?? "Could not generate this video");
      }

      let attempts = 0;
      while (attempts < MAX_POLL_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        attempts++;
        const update = await pollVideoStatus(started.generationId);
        if (update.status === "completed" && update.resultUrl) {
          setResultUrl(update.resultUrl);
          setStatus("done");
          toast.success("Video generated");
          void refreshCredits();
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Could not generate this video");
        }
      }
      throw new Error("This is taking longer than expected — check back shortly.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not generate the video";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const selectedCredits = RESOLUTION_OPTIONS.find((r) => r.value === resolution)?.credits ?? 0;
  const durationMultiplier = duration === "10" ? 2 : 1;
  const showingGenerationUi = status === "generating" || status === "done" || status === "error";
  const canGenerate = Boolean(sourcePath) && !uploading && !resolvingModel;

  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">AI Video</h2>
          <p className="text-sm text-muted-foreground">Motion Studio — turn a still image into a short clip for social and ads.</p>
        </div>
        <ComingSoonState />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">AI Video</h2>
        <p className="text-sm text-muted-foreground">
          Motion Studio — turn a still image into a short clip for social and ads.
          {isFreePlan && " Requires a paid plan."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "entry" && (
          <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GeneratorEntry
              title="Bring a still into motion"
              subtitle="Upload an image or pick a model, and get a short, social-ready clip in moments."
              actions={[
                { label: "Upload an image", icon: Upload, onClick: openPhotoPicker, variant: "primary" },
                { label: "Choose a model", icon: Users, onClick: () => { setEntryMode("model"); setStep("choose-model"); }, variant: "onInk" },
              ]}
            />
          </motion.div>
        )}

        {step === "choose-model" && (
          <motion.div
            key="choose-model"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <DarkPanel onBack={reset} eyebrow="Choose a model">
              <ModelPickerGrid
                selectedId={pickedModel?.id}
                onSelect={(m) => void handlePickModel(m)}
                theme="dark"
              />
            </DarkPanel>
          </motion.div>
        )}

        {step === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={showingGenerationUi ? "" : "max-w-md mx-auto space-y-4"}
          >
            {showingGenerationUi ? (
              status === "generating" ? (
                <GenerationLoadingScreen
                  title="Creating your video"
                  stages={VIDEO_STAGES}
                  previewItems={sourcePreview ? [{ label: "Source", imageUrl: sourcePreview }] : []}
                />
              ) : status === "done" && resultUrl ? (
                <div className="space-y-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl overflow-hidden bg-muted w-fit max-w-full mx-auto"
                  >
                    <video src={resultUrl} controls loop className="block max-h-[75vh] max-w-full w-auto h-auto" />
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
                        void downloadFile(resultUrl, dateStampedFilename("tryverse-video", "mp4")).catch(() =>
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
                  <p className="text-sm font-medium text-destructive">Video generation failed</p>
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
                <BackLink onClick={() => (entryMode === "upload" ? reset() : setStep("choose-model"))} />

                {sourcePreview && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <img src={sourcePreview} alt="Source" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Using</p>
                      <p className="text-sm font-medium text-foreground">{entryMode === "model" ? pickedModel?.label ?? "Model" : "Your image"}</p>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <Select value={duration} onValueChange={(v) => setDuration(v as "5" | "10")}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label} ({o.credits} credits)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Resolution</Label>
                    <Select value={resolution} onValueChange={(v) => setResolution(v as "480p" | "720p" | "1080p")}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESOLUTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estimated usage: {selectedCredits * durationMultiplier} credits
                </p>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Motion guidance (optional)</Label>
                  <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. gentle turn, fabric moving in the wind"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground/70 mt-1">Keep it short — leave blank for automatic motion.</p>
                </div>

                <Button
                  className="w-full h-11 gradient-primary text-primary-foreground shadow-soft"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerate()}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate video
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
