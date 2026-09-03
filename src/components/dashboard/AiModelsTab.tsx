import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateAiModel } from "@/lib/backendApi";
import { useCredits } from "@/contexts/CreditsContext";
import { posthogCapture } from "@/lib/posthog";

const PROMPT_EXAMPLE =
  "Professional African fashion model, female, age 28, dark skin, studio lighting, luxury editorial fashion campaign.";

/**
 * Creation workflow only — the generated-model gallery, reuse/video/download/delete actions live
 * in `MyModelsTab` (Models > My Models), deliberately separate so this stays a focused "describe
 * and generate" screen rather than a screen that's also a library.
 */
export function AiModelsTab() {
  const navigate = useNavigate();
  const { refresh: refreshCredits } = useCredits();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    posthogCapture("ai_model_generate_clicked", { promptLength: prompt.trim().length });
    try {
      await generateAiModel({ prompt: prompt.trim(), idempotencyKey: crypto.randomUUID() });
      setPrompt("");
      void refreshCredits();
      toast.success("AI model generated", {
        description: "Find it under Models → My Models.",
        action: {
          label: "View",
          onClick: () => navigate("/dashboard/business?tab=My+Models"),
        },
      });
    } catch (e) {
      toast.error("Could not generate the AI model right now", {
        description: e instanceof Error ? e.message : undefined,
      });
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
      </div>
    </motion.div>
  );
}
