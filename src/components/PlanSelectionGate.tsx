import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { Check, ArrowRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { cn } from "@/lib/utils";

interface PlanOption {
  id: string;
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

const PLANS: PlanOption[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Explore TryVerse with your own account.",
    features: ["20 try-ons on signup", "Try-On Studio in your dashboard"],
    cta: "Continue with Free",
  },
  {
    id: "starter",
    name: "Starter",
    price: "~$60/mo",
    blurb: "Entry plan for small brands running a pilot.",
    features: ["100–200 try-ons", "50–100 products", "HD images"],
    cta: "Choose Starter",
  },
  {
    id: "growth",
    name: "Growth",
    price: "~$150/mo",
    blurb: "For growing brands ready to go live on their storefront.",
    features: ["500–1000 try-ons", "Analytics", "API access"],
    cta: "Choose Growth",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Let's talk",
    blurb: "Custom limits, SLA, and dedicated infrastructure.",
    features: ["Negotiated limits", "Dedicated infrastructure", "Custom SLA"],
    cta: "Talk to us",
  },
];

/**
 * One-time gate shown after Terms acceptance, before the dashboard. Free starts immediately;
 * paid tiers hand off to the real /pricing checkout (Paystack/Flutterwave) rather than
 * re-implementing payment here — this screen only records the customer's stated intent.
 */
export function PlanSelectionGate({ onComplete }: { onComplete: () => void }) {
  const confirmPlanSelection = useMutation(api.profiles.confirmPlanSelection);
  const navigate = useNavigate();
  const [saving, setSaving] = useState<string | null>(null);

  const choosePlan = async (plan: PlanOption) => {
    setSaving(plan.id);
    try {
      await confirmPlanSelection({ plan_id: plan.id === "free" ? "free" : undefined });
      if (plan.id === "free") {
        onComplete();
      } else {
        onComplete();
        navigate("/pricing");
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background overflow-y-auto">
      <div className="shrink-0 border-b border-border bg-card/95 px-4 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <TryVerseLogo height={52} />
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Choose your plan
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Start free, or pick a plan now — you can change this anytime from Billing.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-10">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl border p-5 bg-card",
                plan.featured ? "border-foreground shadow-card" : "border-border/50"
              )}
            >
              {plan.featured && (
                <span className="mb-2 inline-flex w-fit items-center rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                  Recommended
                </span>
              )}
              <h2 className="font-display text-base font-semibold text-foreground">{plan.name}</h2>
              <p className="mt-1 text-lg font-semibold text-foreground">{plan.price}</p>
              <p className="mt-2 text-xs text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-4 space-y-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-foreground/60 mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant={plan.featured ? "default" : "outline"}
                className={cn("mt-5 gap-2", plan.featured && "gradient-primary text-primary-foreground")}
                disabled={saving !== null}
                onClick={() => void choosePlan(plan)}
              >
                {saving === plan.id ? "Saving…" : plan.cta}
                {plan.id !== "free" && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
