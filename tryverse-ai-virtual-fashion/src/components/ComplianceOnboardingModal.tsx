import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, FileText, Shield, Database, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { TermsContent, PrivacyContent, DataProcessingContent } from "@/content/policyContent";
import { toast } from "sonner";

const GOALS_OPTIONS = [
  "Make my brand look more premium",
  "Create professional model photos instantly",
  "Increase conversions on my product pages",
  "Reduce photoshoot costs and time",
  "Create high-fashion content for ads and social media",
];

const STEPS = [
  {
    id: "terms",
    title: "Terms of Service",
    subtitle: "Last updated: March 9, 2026",
    icon: FileText,
    content: TermsContent,
    isLegal: true,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "Last updated: March 9, 2026",
    icon: Shield,
    content: PrivacyContent,
    isLegal: true,
  },
  {
    id: "data",
    title: "Data Processing Agreement",
    subtitle: "Last updated: March 9, 2026",
    icon: Database,
    content: DataProcessingContent,
    isLegal: true,
  },
  {
    id: "goals",
    title: "What are your goals?",
    subtitle: "Help us personalize your experience",
    icon: Target,
    content: null,
    isLegal: false,
  },
] as const;

interface ComplianceOnboardingModalProps {
  open: boolean;
  userId: string;
  onComplete: () => void;
  onExit?: () => void;
}

export function ComplianceOnboardingModal({ open, userId, onComplete, onExit }: ComplianceOnboardingModalProps) {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Scroll content to top when step changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [stepIndex]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const isGoalsStep = step.id === "goals";
  const StepIcon = step.icon;
  const ContentComponent = step.content;

  const canProceed = isGoalsStep ? selectedGoals.length > 0 : acknowledged;

  const handleNext = async () => {
    if (!canProceed) return;

    if (isLastStep) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              compliance_onboarding_completed_at: new Date().toISOString(),
              onboarding_goals: selectedGoals.length > 0 ? selectedGoals : [],
            },
            { onConflict: "id" }
          );

        if (error) throw error;
        onComplete();
        navigate("/dashboard");
        toast.success("Welcome to TryVerse! Your dashboard is ready.");
      } catch (err) {
        console.error("Compliance save failed:", err);
        toast.error("Failed to save. Please try again.");
      } finally {
        setSaving(false);
      }
    } else {
      setStepIndex((i) => i + 1);
      setAcknowledged(false);
      if (!isGoalsStep) setSelectedGoals([]);
    }
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleExit = async () => {
    onExit?.();
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) handleExit();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-0 border border-border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <StepIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <DialogPrimitive.Title className="font-display text-lg font-semibold text-foreground">
                  {step.title}
                </DialogPrimitive.Title>
                <p className="text-xs text-muted-foreground">{step.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {stepIndex + 1} of {STEPS.length}
              </span>
              <button
                onClick={handleExit}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Exit"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="px-6 py-2 flex gap-2 shrink-0">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-foreground" : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Scrollable content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-4 min-h-0 max-h-[45vh]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {isGoalsStep ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Select all that apply. This helps us tailor TryVerse for your needs.
                    </p>
                    <div className="space-y-2">
                      {GOALS_OPTIONS.map((goal) => (
                        <label
                          key={goal}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            selectedGoals.includes(goal)
                              ? "border-foreground bg-muted"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <Checkbox
                            checked={selectedGoals.includes(goal)}
                            onCheckedChange={() => toggleGoal(goal)}
                            className="mt-0.5"
                          />
                          <span className="text-sm font-medium text-foreground">{goal}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  ContentComponent && <ContentComponent />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer: checkbox (legal only) + Next */}
          <div className="px-6 py-4 border-t border-border shrink-0 space-y-4">
            {!isGoalsStep && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  I have read and agree to the {step.title}
                </span>
              </label>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed || saving}
              className="w-full gap-2"
            >
              {saving ? "Saving..." : isLastStep ? "Finish & Open Dashboard" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
