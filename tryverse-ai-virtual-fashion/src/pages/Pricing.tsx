import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  initializePaystackPayment,
  initializeFlutterwavePayment,
  getPaymentProviders,
} from "@/lib/backendApi";
import { captureSentryException } from "@/lib/sentry";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Enriches DB plans with on-page marketing copy (not stored in DB). */
const PLAN_UI: Record<
  string,
  { description: string; goodFor: string; featured: boolean; cta: string }
> = {
  free: {
    description: "Try the platform at no cost.",
    goodFor: "Teams",
    featured: false,
    cta: "Get Started",
  },
  free_trial: {
    description: "Try the platform at no cost.",
    goodFor: "Teams",
    featured: false,
    cta: "Get Started",
  },
  trial: {
    description: "Try the platform at no cost.",
    goodFor: "Teams",
    featured: false,
    cta: "Get Started",
  },
  starter: {
    description: "For testing and small-scale use.",
    goodFor: "Individuals · Small brands testing",
    featured: false,
    cta: "Get Started",
  },
  growth: {
    description: "For brands creating content.",
    goodFor: "Growing brands · Social media teams",
    featured: true,
    cta: "Get Started",
  },
  enterprise: {
    description: "For brands at scale.",
    goodFor: "Large brands · E-commerce",
    featured: false,
    cta: "Contact Sales",
  },
};

/** Visual order: Free → Starter → Growth → Enterprise (single row on large screens). */
const PLAN_DISPLAY_ORDER = ["free", "free_trial", "trial", "starter", "growth", "enterprise"] as const;

function sortPlansForDisplay<
  T extends { id: string },
>(plans: T[]): T[] {
  const order = [...PLAN_DISPLAY_ORDER];
  const rank = (id: string) => {
    const i = order.indexOf(id as (typeof PLAN_DISPLAY_ORDER)[number]);
    return i === -1 ? 100 : i;
  };
  return [...plans].sort((a, b) => rank(a.id) - rank(b.id));
}

function parseFeatures(features: Json): string[] {
  if (Array.isArray(features)) {
    return features.filter((x): x is string => typeof x === "string");
  }
  return [];
}

function isFreePlanId(id: string): boolean {
  return id === "free" || id === "free_trial" || id === "trial";
}

const Pricing = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [dbPlans, setDbPlans] = useState<
    Array<{
      id: string;
      name: string;
      price_ngn: number;
      price_usd: number;
      tryons_per_month: number;
      features: Json;
    }>
  >([]);
  const [providers, setProviders] = useState({
    paystack: false,
    flutterwave: false,
  });
  /** Bill in USD (Flutterwave) or NGN (Paystack when available, else Flutterwave). */
  const [checkoutCurrency, setCheckoutCurrency] = useState<"USD" | "NGN">("USD");

  useEffect(() => {
    void (async () => {
      try {
        const [{ data: planRows, error }, p] = await Promise.all([
          supabase
            .from("plans")
            .select("id, name, price_ngn, price_usd, tryons_per_month, features")
            .eq("is_active", true),
          getPaymentProviders(),
        ]);
        if (error) throw error;
        setDbPlans(sortPlansForDisplay(planRows || []));
        setProviders(p);
        if (p.flutterwave) setCheckoutCurrency("USD");
        else if (p.paystack) setCheckoutCurrency("NGN");
      } catch {
        toast.error("Could not load plans");
        setDbPlans([]);
      } finally {
        setPlansLoading(false);
      }
    })();
  }, []);

  const handleSubscribe = async (plan: (typeof dbPlans)[0]) => {
    if (plan.id === "enterprise") {
      window.open("mailto:sales@tryverse.ai?subject=Enterprise Plan Inquiry", "_blank");
      return;
    }

    if (plan.id === "free" || plan.id === "free_trial" || plan.id === "trial") {
      if (!user || !session) {
        toast.error("Please sign in to get started");
        navigate("/auth");
        return;
      }
      navigate("/dashboard");
      toast.success("You're on the free trial — head to the dashboard to try it out.");
      return;
    }

    const effectiveCurrency =
      providers.flutterwave ? checkoutCurrency : providers.paystack ? "NGN" : checkoutCurrency;
    const usePaystack = effectiveCurrency === "NGN" && providers.paystack;

    if (effectiveCurrency === "NGN" && plan.price_ngn <= 0) {
      toast.error("This plan is not available for checkout in this currency");
      return;
    }
    if (effectiveCurrency === "USD" && plan.price_usd <= 0) {
      toast.error("This plan is not available for checkout in this currency");
      return;
    }

    if (!user || !session) {
      toast.error("Please sign in to subscribe");
      navigate("/auth");
      return;
    }

    if (usePaystack && !providers.paystack) {
      toast.error("Payments are not configured for this currency.");
      return;
    }
    if (!usePaystack && !providers.flutterwave) {
      toast.error("Payments are not configured for this currency.");
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const callbackUrl = `${window.location.origin}/dashboard`;
      if (usePaystack) {
        const data = await initializePaystackPayment(plan.id, callbackUrl);
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error("No payment URL received");
        }
      } else {
        const data = await initializeFlutterwavePayment(plan.id, effectiveCurrency, callbackUrl);
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error("No payment URL received");
        }
      }
    } catch (error: unknown) {
      console.error("Payment error:", error);
      const err =
        error instanceof Error ? error : new Error(String((error as { message?: string })?.message || "Payment failed"));
      captureSentryException(err, {
        tags: { feature: "payment" },
        extra: { plan: plan.id, currency: effectiveCurrency, rail: usePaystack ? "paystack" : "flutterwave" },
      });
      toast.error(err.message || "Failed to initialize payment. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const formatNgn = (n: number) => `₦${n.toLocaleString()}`;
  const formatUsd = (n: number) =>
    n <= 0 ? "Custom" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const displayCurrency: "USD" | "NGN" = providers.flutterwave
    ? checkoutCurrency
    : providers.paystack
      ? "NGN"
      : checkoutCurrency;

  const renderPlanCard = (plan: (typeof dbPlans)[number], i: number) => {
    const ui = PLAN_UI[plan.id] || {
      description: "",
      goodFor: "Teams",
      featured: false,
      cta: "Get Started",
    };
    const features = parseFeatures(plan.features);
    const showUsd = displayCurrency === "USD";
    const free = isFreePlanId(plan.id);
    const priceDisplay =
      plan.id === "enterprise"
        ? "Lets Talk"
        : free
          ? "$0"
          : showUsd
            ? formatUsd(plan.price_usd)
            : formatNgn(plan.price_ngn);

    return (
      <motion.div
        key={plan.id}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className={`rounded-2xl p-6 sm:p-7 border flex flex-col h-full min-h-0 min-w-0 ${
          ui.featured
            ? "border-foreground bg-foreground text-background shadow-elevated relative"
            : "border-border/50 bg-card"
        }`}
      >
        {ui.featured && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background text-foreground text-xs font-semibold">
            Recommended
          </div>
        )}
        <div className="mb-6">
          <h3 className="font-display text-lg font-semibold mb-1">{plan.name}</h3>
          <p className={`text-sm mb-1 ${ui.featured ? "text-background/70" : "text-muted-foreground"}`}>
            {ui.description}
          </p>
          <p className={`text-xs mb-4 ${ui.featured ? "text-background/60" : "text-muted-foreground/80"}`}>
            Good for: {ui.goodFor}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold">{priceDisplay}</span>
            <span className={`text-sm ${ui.featured ? "text-background/60" : "text-muted-foreground"}`}>
              {plan.id === "enterprise" || free ? "" : "/month"}
            </span>
          </div>
          {plan.id !== "enterprise" && (
            <p className={`text-[10px] mt-1 ${ui.featured ? "text-background/50" : "text-muted-foreground"}`}>
              {plan.tryons_per_month >= 0
                ? `${plan.tryons_per_month.toLocaleString()} try-ons / month`
                : "Unlimited try-ons"}
            </p>
          )}
        </div>

        <ul className="space-y-3 flex-1 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <Check
                className={`h-4 w-4 mt-0.5 flex-shrink-0 ${ui.featured ? "text-background/70" : "text-foreground"}`}
              />
              <span className={ui.featured ? "text-background/90" : "text-foreground"}>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className={`w-full mt-auto shrink-0 ${
            ui.featured
              ? "bg-background text-foreground hover:bg-background/90"
              : "gradient-primary text-primary-foreground shadow-soft"
          }`}
          onClick={() => handleSubscribe(plan)}
          disabled={loadingPlan === plan.id}
        >
          {loadingPlan === plan.id ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {ui.cta} <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Pricing</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-6">
              Choose the plan that fits your brand. Pay securely by card or bank when you&apos;re ready.
            </p>

            {providers.flutterwave && (
              <div className="flex flex-col items-center gap-3 max-w-md mx-auto mb-2">
                <select
                  value={checkoutCurrency}
                  onChange={(e) => setCheckoutCurrency(e.target.value as "USD" | "NGN")}
                  className="text-xs border border-border rounded-md bg-background px-3 py-2 min-w-[200px]"
                  aria-label="Checkout currency"
                >
                  <option value="USD">USD (from plan)</option>
                  <option value="NGN">NGN (from plan)</option>
                </select>
              </div>
            )}
          </motion.div>

          {plansLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dbPlans.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Plans aren’t available at the moment. Please check back soon.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-stretch max-w-7xl mx-auto w-full">
              {dbPlans.map((plan, i) => renderPlanCard(plan, i))}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 text-center"
          >
            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              {["Secure by Design", "Privacy Focused", "Paystack · Flutterwave"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
