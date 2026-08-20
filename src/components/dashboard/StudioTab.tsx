import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Shirt,
  Sparkles,
  Loader2,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  uploadImage,
  startTryOn,
  pollTryOnStatus,
  generateVideo,
  pollVideoStatus,
  createPersonPathFromModel,
  type TryOnCategory,
} from "@/lib/backendApi";
import { TryOnGuidelinesModal, hasSeenTryOnGuidelines } from "@/components/TryOnGuidelinesModal";
import { GenerationLoadingScreen } from "@/components/GenerationLoadingScreen";
import { useIsFreePlan } from "@/hooks/useIsFreePlan";
import { Film } from "lucide-react";
import { downloadFile, dateStampedFilename } from "@/lib/utils";
import { StudioEntry } from "@/components/dashboard/studio/StudioEntry";
import { ModelPickerGrid, type PickedModel } from "@/components/dashboard/ModelPickerGrid";

const VIDEO_MAX_POLL_ATTEMPTS = 60;
const VIDEO_POLL_INTERVAL_MS = 5000;

const CATEGORIES: { id: TryOnCategory; label: string }[] = [
  { id: "clothing", label: "Full outfit" },
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
  { id: "one-pieces", label: "One-pieces" },
];

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 3000;

const LOADING_STAGES = [
  "Preparing your image",
  "Analyzing garment",
  "Building your look",
  "Rendering final result",
  "Almost ready",
];

type Status = "idle" | "uploading" | "processing" | "done" | "error";
type StudioStep = "entry" | "upload" | "choose-model" | "garment";
type EntryMode = "upload" | "model" | null;

interface ImageSlot {
  file: File | null;
  preview: string | null;
  path: string | null;
}

const EMPTY_SLOT: ImageSlot = { file: null, preview: null, path: null };

function DropZone({
  slot,
  label,
  hint,
  icon: Icon,
  onFile,
  accept,
}: {
  slot: ImageSlot;
  label: string;
  hint: string;
  icon: React.ElementType;
  onFile: (f: File) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer select-none overflow-hidden
          ${dragging ? "border-foreground bg-muted/60" : "border-border hover:border-muted-foreground"}
          ${slot.preview ? "min-h-[220px]" : "min-h-[180px]"}`}
      >
        {slot.preview ? (
          <>
            <img
              src={slot.preview}
              alt={label}
              className="w-full h-full object-cover absolute inset-0 rounded-[10px]"
            />
            <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-4 rounded-[10px] opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-medium bg-black/60 px-3 py-1 rounded-full">
                Click to replace
              </span>
            </div>
            <div className="absolute top-2 right-2 bg-green-500 rounded-full p-0.5">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Drop image here</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept ?? "image/*"}
          className="sr-only"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function BackLink({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

export function StudioTab() {
  const [step, setStep] = useState<StudioStep>("entry");
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [model, setModel] = useState<ImageSlot>(EMPTY_SLOT);
  const [pickedModel, setPickedModel] = useState<PickedModel | null>(null);
  const [garment, setGarment] = useState<ImageSlot>(EMPTY_SLOT);
  const [category, setCategory] = useState<TryOnCategory>("clothing");
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultTryonId, setResultTryonId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const isFreePlan = useIsFreePlan();
  const [videoStatus, setVideoStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleFile = useCallback((slot: "model" | "garment", file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    const preview = URL.createObjectURL(file);
    if (slot === "model") {
      setModel({ file, preview, path: null });
    } else {
      setGarment({ file, preview, path: null });
    }
  }, []);

  const reset = () => {
    setStep("entry");
    setEntryMode(null);
    setModel(EMPTY_SLOT);
    setPickedModel(null);
    setGarment(EMPTY_SLOT);
    setCategory("clothing");
    setStatus("idle");
    setResultUrl(null);
    setResultTryonId(null);
    setErrorMsg(null);
    setVideoStatus("idle");
    setVideoUrl(null);
  };

  const goToUploadStep = () => {
    setEntryMode("upload");
    setStep("upload");
  };

  const handleUploadPhotoClick = () => {
    if (!hasSeenTryOnGuidelines()) {
      setGuidelinesOpen(true);
      return;
    }
    goToUploadStep();
  };

  const handleChooseModelClick = () => {
    setEntryMode("model");
    setStep("choose-model");
  };

  const handlePickModel = (m: PickedModel) => {
    setPickedModel(m);
    setStep("garment");
  };

  const run = async () => {
    if (!garment.file) {
      toast.error("Upload a garment photo.");
      return;
    }
    if (entryMode === "upload" && !model.file) {
      toast.error("Upload a photo first.");
      return;
    }
    if (entryMode === "model" && !pickedModel) {
      toast.error("Choose a virtual model first.");
      return;
    }

    setStatus("uploading");
    setErrorMsg(null);
    setResultUrl(null);

    try {
      const personImagePathPromise: Promise<string> =
        entryMode === "upload"
          ? uploadImage(model.file!, "person").then((r) => r.filePath)
          : pickedModel!.source === "generated"
            ? Promise.resolve(pickedModel!.storagePath)
            : createPersonPathFromModel(pickedModel!.id);

      const [personImagePath, garmentUpload] = await Promise.all([
        personImagePathPromise,
        uploadImage(garment.file, "product"),
      ]);

      setStatus("processing");

      const job = await startTryOn({
        personImagePath,
        productImagePath: garmentUpload.filePath,
        category,
      });

      if (job.status === "completed" && job.resultUrl) {
        setResultUrl(job.resultUrl);
        setResultTryonId(job.tryonId);
        setStatus("done");
        return;
      }

      // Poll for completion
      let attempts = 0;
      const id = job.tryonId;
      while (attempts < MAX_POLL_ATTEMPTS) {
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
        attempts++;
        const update = await pollTryOnStatus(id);
        if (update.status === "completed" && update.resultUrl) {
          setResultUrl(update.resultUrl);
          setResultTryonId(id);
          setStatus("done");
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Try-on failed.");
        }
      }

      throw new Error("Try-on timed out. Please try again.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  const isRunning = status === "uploading" || status === "processing";
  const canRun =
    Boolean(garment.file) &&
    (entryMode === "upload" ? Boolean(model.file) : Boolean(pickedModel)) &&
    !isRunning;

  const handleGenerateClick = () => {
    if (entryMode === "upload" && !hasSeenTryOnGuidelines()) {
      setGuidelinesOpen(true);
      return;
    }
    void run();
  };

  const handleGenerateVideo = async () => {
    if (isFreePlan) {
      toast.error("AI Video requires a paid plan.", { description: "Upgrade in Billing to unlock video generation." });
      return;
    }
    if (!resultTryonId) return;

    setVideoStatus("generating");
    setVideoUrl(null);
    try {
      const started = await generateVideo({ tryonId: resultTryonId });
      if (started.status === "completed" && started.resultUrl) {
        setVideoUrl(started.resultUrl);
        setVideoStatus("done");
        return;
      }

      let attempts = 0;
      while (attempts < VIDEO_MAX_POLL_ATTEMPTS) {
        await new Promise<void>((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
        attempts++;
        const update = await pollVideoStatus(started.generationId);
        if (update.status === "completed" && update.resultUrl) {
          setVideoUrl(update.resultUrl);
          setVideoStatus("done");
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Video generation failed.");
        }
      }
      throw new Error("Video generation timed out. Please try again.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setVideoStatus("error");
      toast.error(msg);
    }
  };

  const chosenPreview = entryMode === "upload" ? model.preview : pickedModel?.imageUrl ?? null;
  const chosenLabel = entryMode === "upload" ? "Your photo" : pickedModel?.label ?? "Model";
  const showingGenerationUi = isRunning || status === "done" || status === "error";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Personal Studio</h2>
        <p className="text-sm text-muted-foreground">
          Try any garment on yourself or a virtual model, privately.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "entry" && (
          <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StudioEntry onUploadPhoto={handleUploadPhotoClick} onChooseModel={handleChooseModelClick} />
          </motion.div>
        )}

        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto space-y-4"
          >
            <BackLink onClick={reset} label="Back to start" />
            <DropZone
              slot={model}
              label="Your photo"
              hint="Front-facing, full-body photo works best"
              icon={Upload}
              onFile={(f) => handleFile("model", f)}
            />
            <Button
              className="w-full h-11 gradient-primary text-primary-foreground shadow-soft"
              disabled={!model.file}
              onClick={() => setStep("garment")}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === "choose-model" && (
          <motion.div
            key="choose-model"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <BackLink onClick={reset} label="Back to start" />
            <p className="text-sm font-medium text-foreground">Choose a virtual model</p>
            <ModelPickerGrid selectedId={pickedModel?.id} onSelect={handlePickModel} />
          </motion.div>
        )}

        {step === "garment" && (
          <motion.div
            key="garment"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={showingGenerationUi ? "" : "max-w-md mx-auto space-y-4"}
          >
            {showingGenerationUi ? (
              isRunning ? (
                <GenerationLoadingScreen
                  title="Creating your virtual try-on"
                  stages={LOADING_STAGES}
                  previewItems={[
                    ...(chosenPreview ? [{ label: chosenLabel, imageUrl: chosenPreview }] : []),
                    ...(garment.preview ? [{ label: "Garment", imageUrl: garment.preview }] : []),
                  ]}
                />
              ) : status === "done" && resultUrl ? (
                <div className="space-y-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl overflow-hidden bg-muted"
                  >
                    <img
                      src={resultUrl}
                      alt="Try-on result"
                      className="w-full max-h-[75vh] object-contain"
                    />
                  </motion.div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Start over
                    </Button>
                    <div className="flex gap-2">
                      {!(videoStatus === "done" && videoUrl) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={videoStatus === "generating"}
                          onClick={() => void handleGenerateVideo()}
                          className="gap-1.5"
                        >
                          {videoStatus === "generating" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Film className="h-3.5 w-3.5" />
                          )}
                          {videoStatus === "generating" ? "Animating…" : "Generate video"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5"
                        onClick={() => {
                          void downloadFile(resultUrl, dateStampedFilename("tryverse-result")).catch(() =>
                            toast.error("Download failed")
                          );
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                  {videoStatus === "done" && videoUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 rounded-xl border border-border bg-muted p-3"
                    >
                      <p className="text-xs font-medium text-muted-foreground">Animated from this result</p>
                      <video src={videoUrl} controls loop className="w-full rounded-lg" />
                    </motion.div>
                  )}
                  {videoStatus === "error" && (
                    <p className="text-xs text-destructive">Could not generate the video. Please try again.</p>
                  )}
                </div>
              ) : (
                <div className="max-w-md mx-auto flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 min-h-[220px] p-6 text-center gap-3">
                  <p className="text-sm font-medium text-destructive">Try-on failed</p>
                  <p className="text-xs text-muted-foreground">{errorMsg}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Start over
                    </Button>
                    <Button size="sm" onClick={() => void run()}>
                      Try again
                    </Button>
                  </div>
                </div>
              )
            ) : (
              <>
                <BackLink
                  onClick={() => setStep(entryMode === "upload" ? "upload" : "choose-model")}
                />

                {chosenPreview && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <img
                      src={chosenPreview}
                      alt={chosenLabel}
                      className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                    />
                    <div>
                      <p className="text-xs text-muted-foreground">Using</p>
                      <p className="text-sm font-medium text-foreground">{chosenLabel}</p>
                    </div>
                  </div>
                )}

                <DropZone
                  slot={garment}
                  label="Garment photo"
                  hint="Clear product photo on white or transparent background"
                  icon={Shirt}
                  onFile={(f) => handleFile("garment", f)}
                />

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    Garment category
                  </p>
                  <Select value={category} onValueChange={(v) => setCategory(v as TryOnCategory)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {category === "clothing" && (
                    <p className="text-xs text-muted-foreground">
                      Best for a single reference photo already showing the full look. For combining
                      separate top + bottom (or shoe) product photos into one outfit, use{" "}
                      <span className="font-medium text-foreground">Outfit Builder</span> instead.
                    </p>
                  )}
                </div>

                <Button
                  className="w-full h-11 gradient-primary text-primary-foreground shadow-soft"
                  disabled={!canRun}
                  onClick={handleGenerateClick}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate try-on
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <TryOnGuidelinesModal
        open={guidelinesOpen}
        onOpenChange={setGuidelinesOpen}
        onAcknowledge={() => {
          if (step === "entry") {
            goToUploadStep();
          } else if (model.file && garment.file) {
            void run();
          }
        }}
        source="studio_tab"
      />
    </div>
  );
}
