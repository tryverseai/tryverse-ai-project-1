import { useState, useRef, useCallback, useEffect, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Shirt,
  User,
  Sparkles,
  ImageIcon,
  Loader2,
  RotateCcw,
  Download,
  ChevronDown,
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
  type TryOnCategory,
} from "@/lib/backendApi";
import { TryOnGuidelinesModal, hasSeenTryOnGuidelines } from "@/components/TryOnGuidelinesModal";
import { GenerationLoadingScreen } from "@/components/GenerationLoadingScreen";
import { useIsEnterprisePlan } from "@/hooks/useIsEnterprisePlan";
import { EnterpriseUpgradeModal } from "@/components/EnterpriseUpgradeModal";
import { Film } from "lucide-react";
import { downloadFile, dateStampedFilename } from "@/lib/utils";

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

type Status = "idle" | "uploading" | "processing" | "done" | "error";

interface ImageSlot {
  file: File | null;
  preview: string | null;
  path: string | null;
}

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

export function StudioTab() {
  const [model, setModel] = useState<ImageSlot>({ file: null, preview: null, path: null });
  const [garment, setGarment] = useState<ImageSlot>({ file: null, preview: null, path: null });
  const [category, setCategory] = useState<TryOnCategory>("clothing");
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultTryonId, setResultTryonId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  // First-time visitors see consent immediately on entering Personal Studio, not only when
  // they click Generate — the upload UI itself was reachable/usable before consent otherwise.
  useEffect(() => {
    if (!hasSeenTryOnGuidelines()) {
      setGuidelinesOpen(true);
    }
  }, []);
  const isEnterprise = useIsEnterprisePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [videoStatus, setVideoStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleFile = useCallback((
    slot: "model" | "garment",
    file: File
  ) => {
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
    setModel({ file: null, preview: null, path: null });
    setGarment({ file: null, preview: null, path: null });
    setCategory("clothing");
    setStatus("idle");
    setResultUrl(null);
    setResultTryonId(null);
    setErrorMsg(null);
    setVideoStatus("idle");
    setVideoUrl(null);
  };

  const run = async () => {
    if (!model.file || !garment.file) {
      toast.error("Upload both a model photo and a garment photo.");
      return;
    }
    setStatus("uploading");
    setErrorMsg(null);
    setResultUrl(null);

    try {
      const [modelUpload, garmentUpload] = await Promise.all([
        uploadImage(model.file, "person"),
        uploadImage(garment.file, "product"),
      ]);

      setStatus("processing");

      const job = await startTryOn({
        personImagePath: modelUpload.filePath,
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
  const canRun = Boolean(model.file && garment.file) && !isRunning;

  const handleGenerateClick = () => {
    if (!hasSeenTryOnGuidelines()) {
      setGuidelinesOpen(true);
      return;
    }
    void run();
  };

  const handleGenerateVideo = async () => {
    if (!isEnterprise) {
      setUpgradeOpen(true);
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Personal Studio</h2>
        <p className="text-sm text-muted-foreground">
          Test TryVerse try-on privately — upload a model photo and a garment to see the result instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left — Inputs */}
        <div className="space-y-6">
          <DropZone
            slot={model}
            label="Model photo"
            hint="Front-facing photo of the person wearing neutral clothing"
            icon={User}
            onFile={(f) => handleFile("model", f)}
          />

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
                <span className="font-medium text-foreground">Outfit Builder</span> instead —
                it composites each piece before generating, which preserves multi-garment
                fidelity better than a single photo can.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 h-11 gradient-primary text-primary-foreground shadow-soft"
              disabled={!canRun}
              onClick={handleGenerateClick}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {status === "uploading" ? "Uploading…" : "Generating…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate try-on
                </>
              )}
            </Button>

            {(status === "done" || status === "error") && (
              <Button variant="outline" className="h-11 px-4" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

        </div>

        {/* Right — Result */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            Result
          </p>

          <AnimatePresence mode="wait">
            {status === "done" && resultUrl ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="relative rounded-lg overflow-hidden"
              >
                <img
                  src={resultUrl}
                  alt="Try-on result"
                  className="w-full object-contain max-h-[640px]"
                />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  {videoStatus === "done" && videoUrl ? null : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full shadow-md"
                      disabled={videoStatus === "generating"}
                      onClick={() => void handleGenerateVideo()}
                    >
                      {videoStatus === "generating" ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Film className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {videoStatus === "generating" ? "Animating…" : "Generate video"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full shadow-md"
                    onClick={() => {
                      void downloadFile(resultUrl, dateStampedFilename("tryverse-result")).catch(() =>
                        toast.error("Download failed")
                      );
                    }}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </Button>
                </div>
              </motion.div>
            ) : status === "error" ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 min-h-[220px] p-6 text-center gap-3"
              >
                <p className="text-sm font-medium text-destructive">Try-on failed</p>
                <p className="text-xs text-muted-foreground">{errorMsg}</p>
                <Button size="sm" variant="outline" onClick={reset} className="mt-2">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Start over
                </Button>
              </motion.div>
            ) : isRunning ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <GenerationLoadingScreen
                  previewItems={[
                    ...(model.preview ? [{ label: "Model", imageUrl: model.preview }] : []),
                    ...(garment.preview ? [{ label: "Garment", imageUrl: garment.preview }] : []),
                  ]}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-transparent min-h-[320px] gap-3 text-center px-6"
              >
                <div className="rounded-full bg-muted p-4">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Your try-on will appear here</p>
                <p className="text-xs text-muted-foreground">
                  Upload a model photo and garment, then tap "Generate try-on"
                </p>
              </motion.div>
            )}
          </AnimatePresence>

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
      </div>

      <TryOnGuidelinesModal
        open={guidelinesOpen}
        onOpenChange={setGuidelinesOpen}
        onAcknowledge={() => {
          // Consent can now open on mount too, before any photo is uploaded — only
          // auto-run when the user was actually mid-generate when it opened.
          if (model.file && garment.file) void run();
        }}
        source="studio_tab"
      />
      <EnterpriseUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} context="video" />
    </div>
  );
}
