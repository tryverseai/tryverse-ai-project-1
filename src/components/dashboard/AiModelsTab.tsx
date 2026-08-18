import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, Wand2, Trash2, RefreshCw, Users, Film, Loader2 } from "lucide-react";
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
import {
  generateAiModel,
  getSavedAiModels,
  generateVideo,
  pollVideoStatus,
  type AiModelResult,
} from "@/lib/backendApi";
import { useIsEnterprisePlan } from "@/hooks/useIsEnterprisePlan";
import { EnterpriseUpgradeModal } from "@/components/EnterpriseUpgradeModal";
import { posthogCapture } from "@/lib/posthog";

const FIELDS: {
  key: keyof typeof DEFAULT_FORM;
  label: string;
  options: string[];
}[] = [
  { key: "gender", label: "Gender", options: ["Female", "Male"] },
  { key: "skinTone", label: "Skin tone", options: ["Fair", "Light", "Medium", "Tan", "Deep", "Dark"] },
  { key: "pose", label: "Pose", options: ["Standing", "Walking", "Side profile", "Three-quarter"] },
  { key: "age", label: "Age range", options: ["18–25", "26–35", "36–45", "46–55", "56+"] },
  { key: "hair", label: "Hair", options: ["Straight", "Wavy", "Curly", "Coily", "Short / bald"] },
  { key: "background", label: "Background", options: ["Studio white", "Neutral gray", "Outdoor", "Urban street"] },
  {
    key: "fashionStyle",
    label: "Fashion style",
    options: ["Casual", "Streetwear", "Formal", "Athletic", "Bohemian", "Minimalist"],
  },
];

const DEFAULT_FORM = {
  gender: "Female",
  skinTone: "Medium",
  pose: "Standing",
  age: "26–35",
  hair: "Straight",
  background: "Studio white",
  fashionStyle: "Casual",
};

function LockedState({ onUpgradeClick }: { onUpgradeClick: () => void }) {
  return (
    <div className="text-center py-16 bg-card rounded-xl border border-border/50">
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Lock className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">Generate AI Model is an Enterprise feature</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5">
        Build a diverse library of on-brand AI fashion models and reuse them across every try-on.
      </p>
      <Button onClick={onUpgradeClick} className="gradient-primary text-primary-foreground shadow-soft gap-2">
        <Sparkles className="h-4 w-4" /> Unlock Enterprise
      </Button>
    </div>
  );
}

export function AiModelsTab() {
  const isEnterprise = useIsEnterprisePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [generating, setGenerating] = useState(false);
  const [models, setModels] = useState<AiModelResult[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [videoByModel, setVideoByModel] = useState<
    Record<string, { status: "generating" | "done" | "error"; url?: string }>
  >({});

  useEffect(() => {
    if (!isEnterprise) return;
    let cancelled = false;
    setModelsLoading(true);
    getSavedAiModels()
      .then((rows) => { if (!cancelled) setModels(rows); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [isEnterprise]);

  const openUpgrade = () => {
    posthogCapture("enterprise_upgrade_modal_opened", { context: "models", source: "ai_models_tab" });
    setUpgradeOpen(true);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    posthogCapture("ai_model_generate_clicked", { ...form });
    try {
      const result = await generateAiModel({
        gender: form.gender,
        skinTone: form.skinTone,
        pose: form.pose,
        age: form.age,
        hair: form.hair,
        background: form.background,
        fashionStyle: form.fashionStyle,
      });
      setModels((prev) => [result, ...prev]);
      toast.success("AI model generated");
    } catch (e) {
      toast.message("AI model generation isn't wired up yet", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async (modelId: string) => {
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            Generate AI Model
            {!isEnterprise && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" /> Enterprise
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create diverse, on-brand AI fashion models for your catalog.
          </p>
        </div>
      </div>

      {!isEnterprise ? (
        <LockedState onUpgradeClick={openUpgrade} />
      ) : (
        <div className="space-y-8">
          <div className="bg-card rounded-xl border border-border/50 shadow-card p-6">
            <h3 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Model attributes
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <Select
                    value={form[field.key]}
                    onValueChange={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Button
              onClick={() => void handleGenerate()}
              disabled={generating}
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
              <div className="text-center py-16 bg-card rounded-xl border border-border/50">
                <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No models yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Generated models will appear here so you can reuse them across try-ons.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {models.map((m) => {
                  const video = videoByModel[m.id];
                  return (
                    <div key={m.id} className="rounded-xl overflow-hidden border border-border/50 bg-card group relative">
                      <div className="aspect-[3/4] bg-muted">
                        {video?.status === "done" && video.url ? (
                          <video src={video.url} controls loop className="w-full h-full object-cover" />
                        ) : (
                          <img src={m.imageUrl} alt="Generated AI model" className="w-full h-full object-cover object-top" />
                        )}
                      </div>
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
                            className="h-8 w-8 text-destructive"
                            title="Delete"
                            onClick={() => setModels((prev) => prev.filter((x) => x.id !== m.id))}
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
      )}

      <EnterpriseUpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} context="models" />
    </motion.div>
  );
}
