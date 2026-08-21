import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Trash2, RefreshCw, Users, Film, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  generateAiModel,
  getSavedAiModels,
  deleteAiModel,
  generateVideo,
  pollVideoStatus,
  type AiModelResult,
} from "@/lib/backendApi";
import { useIsFreePlan } from "@/hooks/useIsFreePlan";
import { posthogCapture } from "@/lib/posthog";
import { EmptyState } from "@/components/EmptyState";
import { ModelPortrait } from "@/components/ModelPortrait";
import { downloadFile, dateStampedFilename } from "@/lib/utils";

const PROMPT_EXAMPLE =
  "Professional African fashion model, female, age 28, dark skin, studio lighting, luxury editorial fashion campaign.";

export function AiModelsTab() {
  const isFreePlan = useIsFreePlan();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [models, setModels] = useState<AiModelResult[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [videoByModel, setVideoByModel] = useState<
    Record<string, { status: "generating" | "done" | "error"; url?: string }>
  >({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    getSavedAiModels()
      .then((rows) => { if (!cancelled) setModels(rows); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    posthogCapture("ai_model_generate_clicked", { promptLength: prompt.trim().length });
    try {
      const result = await generateAiModel({ prompt: prompt.trim() });
      setModels((prev) => [result, ...prev]);
      toast.success("AI model generated");
    } catch (e) {
      toast.error("Could not generate the AI model right now", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async (modelId: string) => {
    if (isFreePlan) {
      toast.error("AI Video requires a paid plan.", { description: "Upgrade in Billing to unlock video generation." });
      return;
    }
    setVideoByModel((prev) => ({ ...prev, [modelId]: { status: "generating" } }));
    try {
      const started = await generateVideo({ modelId, modelSource: "generated" });
      if (started.status === "completed" && started.resultUrl) {
        setVideoByModel((prev) => ({ ...prev, [modelId]: { status: "done", url: started.resultUrl } }));
        return;
      }

      let attempts = 0;
      while (attempts < 60) {
        await new Promise<void>((r) => setTimeout(r, 5000));
        attempts++;
        const update = await pollVideoStatus(started.generationId);
        if (update.status === "completed" && update.resultUrl) {
          setVideoByModel((prev) => ({ ...prev, [modelId]: { status: "done", url: update.resultUrl } }));
          return;
        }
        if (update.status === "failed") {
          throw new Error(update.error ?? "Video generation failed.");
        }
      }
      throw new Error("Video generation timed out. Please try again.");
    } catch (e) {
      setVideoByModel((prev) => ({ ...prev, [modelId]: { status: "error" } }));
      toast.error(e instanceof Error ? e.message : "Could not generate the video.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setDeleting(true);
    try {
      await deleteAiModel(id);
      setModels((prev) => prev.filter((x) => x.id !== id));
      toast.success("Model deleted");
      setConfirmDeleteId(null);
    } catch (e) {
      toast.error("Could not delete this model", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            AI Model Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build campaign-ready digital talent, on demand.
          </p>
        </div>
      </div>

      <div className="space-y-8">
          <div className="bg-card rounded-xl border border-border/50 shadow-card p-6">
            <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Describe your model
            </h3>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={PROMPT_EXAMPLE}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Describe gender, age, skin tone, pose, style, and setting in plain language — the AI
              interprets your prompt directly. e.g. "{PROMPT_EXAMPLE}"
            </p>

            <Button
              onClick={() => void handleGenerate()}
              disabled={generating || !prompt.trim()}
              className="mt-6 gradient-primary text-primary-foreground shadow-soft gap-2"
            >
              <Sparkles className="h-4 w-4" /> {generating ? "Generating…" : "Generate"}
            </Button>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Your models
            </h3>
            {modelsLoading ? (
              <div className="flex justify-center py-16 text-sm text-muted-foreground">Loading models…</div>
            ) : models.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No models yet"
                description="Generated models will appear here so you can reuse them across try-ons."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {models.map((m) => {
                  const video = videoByModel[m.id];
                  return (
                    <div key={m.id} className="rounded-xl overflow-hidden border border-border/50 bg-card group relative">
                      {video?.status === "done" && video.url ? (
                        <div className="aspect-[3/4] bg-muted">
                          <video src={video.url} controls loop className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <ModelPortrait src={m.imageUrl} alt="Generated AI model" className="aspect-[3/4]" />
                      )}
                      {!(video?.status === "done" && video.url) && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="icon" variant="secondary" className="h-8 w-8" title="Reuse in a try-on">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8"
                            title="Generate video from this model"
                            disabled={video?.status === "generating"}
                            onClick={() => void handleGenerateVideo(m.id)}
                          >
                            {video?.status === "generating" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Film className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8"
                            title="Download"
                            onClick={() =>
                              void downloadFile(m.imageUrl, dateStampedFilename("tryverse-model")).catch(() =>
                                toast.error("Download failed")
                              )
                            }
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 text-destructive"
                            title="Delete"
                            onClick={() => setConfirmDeleteId(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this model?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from your model library. It won't affect results you've already generated with it.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
