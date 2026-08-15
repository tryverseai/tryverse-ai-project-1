import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, ImagePlus, Download, Film, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  uploadImage,
  generateVideo,
  pollVideoStatus,
} from "@/lib/backendApi";
import { useIsEnterprisePlan } from "@/hooks/useIsEnterprisePlan";
import { EnterpriseUpgradeModal } from "@/components/EnterpriseUpgradeModal";
import { posthogCapture } from "@/lib/posthog";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 5000;

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

function LockedState({ onUpgradeClick }: { onUpgradeClick: () => void }) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Lock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">AI Video is an Enterprise feature</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5">
        Animate a still image into a short clip for social and ads.
      </p>
      <Button onClick={onUpgradeClick} className="gradient-primary text-primary-foreground shadow-soft gap-2">
        <Sparkles className="h-4 w-4" /> Unlock Enterprise
      </Button>
    </div>
  );
}

export function VideoTab() {
  const isEnterprise = useIsEnterprisePlan();
  const enabled = FEATURE_FLAGS.VIDEO_ENABLED;
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [duration, setDuration] = useState<"5" | "10">("5");
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("1080p");
  const [prompt, setPrompt] = useState("");

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ videoUrl: string; createdAt: string }[]>([]);

  const active = enabled && isEnterprise;

  const openUpgrade = () => {
    posthogCapture("enterprise_upgrade_modal_opened", { context: "video", source: "video_tab" });
    setUpgradeOpen(true);
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

  const handleGenerate = async () => {
    if (!sourcePath) {
      toast.error("Upload a source image first");
      return;
    }
    setGenerating(true);
    posthogCapture("video_generate_clicked", { duration, resolution });
    try {
      const started = await generateVideo({
        sourceStoragePath: sourcePath,
        prompt: prompt.trim() || undefined,
        duration: Number(duration) as 5 | 10,
        resolution,
      });

      if (started.status === "completed" && started.resultUrl) {
        setResults((prev) => [{ videoUrl: started.resultUrl!, createdAt: started.createdAt ?? new Date().toISOString() }, ...prev]);
        toast.success("Video generated");
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
          setResults((prev) => [{ videoUrl: update.resultUrl!, createdAt: update.createdAt ?? new Date().toISOString() }, ...prev]);
          toast.success("Video generated");
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Could not generate this video");
        }
      }
      throw new Error("This is taking longer than expected — check back shortly.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the video");
    } finally {
      setGenerating(false);
    }
  };

  const selectedCredits = RESOLUTION_OPTIONS.find((r) => r.value === resolution)?.credits ?? 0;
  const durationMultiplier = duration === "10" ? 2 : 1;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            AI Video
            {!isEnterprise && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" /> Enterprise
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Animate a still image into a short clip.
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
                <Film className="h-4 w-4" /> 1. Upload a source image
              </h3>
              {sourcePreview ? (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-border/50 bg-muted flex-shrink-0">
                    <img src={sourcePreview} alt="Source" className="w-full h-full object-cover" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Replace</Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg py-10 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-sm">{uploading ? "Uploading…" : "Click to upload an image"}</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3">2. Settings</h3>
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
              <p className="text-xs text-muted-foreground mt-2">
                Estimated cost: {selectedCredits * durationMultiplier} FASHN credits
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Motion guidance (optional)</Label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. gentle turn, fabric moving in the wind"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground/70 mt-1">Keep it short — motion is hard to control precisely, leave blank for automatic motion.</p>
            </div>

            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || uploading || !sourcePath}
              className="gradient-primary text-primary-foreground shadow-soft gap-2"
            >
              <Sparkles className="h-4 w-4" /> {generating ? "Generating…" : "Generate video"}
            </Button>
          </div>

          {results.length > 0 && (
            <div>
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map((r) => (
                  <div key={r.videoUrl} className="rounded-xl overflow-hidden border border-border/50 bg-card group relative">
                    <video src={r.videoUrl} className="w-full aspect-[4/5] object-cover bg-muted" controls loop muted playsInline />
                    <a
                      href={r.videoUrl}
                      download
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Button size="icon" variant="secondary" className="h-8 w-8"><Download className="h-3.5 w-3.5" /></Button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <EnterpriseUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} context="video" />
    </motion.div>
  );
}
