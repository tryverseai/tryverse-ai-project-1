import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  initializePaystackPayment,
  initializeFlutterwavePayment,
  getPaymentProviders,
} from "@/lib/backendApi";
import { captureSentryException } from "@/lib/sentry";
import { assignTrustedPaymentCheckoutUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/utils";
import { Helmet } from "react-helmet-async";

type PricingAudience = "individual" | "business";

type PlanRow = {
  id: string;
  name: string;
  price_ngn: number;
  price_usd: number;
  tryons_per_month: number;
  features: unknown;
};

/** Fallback catalog row when Convex has no matching plan document yet. */
const FALLBACK_PRO: PlanRow = {
  id: "pro",
  name: "Pro",
  price_ngn: 15000,
  price_usd: 10,
  tryons_per_month: 75,
  features: [
    "50–100 try-ons / month",
    "HD images",
    "No watermark",
    "Download images",
  ],
};

const FALLBACK_CREATOR: PlanRow = {
  id: "creator",
  name: "Creator",
  price_ngn: 30000,
  price_usd: 20,
  tryons_per_month: 250,
  features: [
    "200–300 try-ons / month",
    "HD + better realism",
    "Generate marketing images",
    "Priority processing",
  ],
};

/** Static catalog (no browser Convex client). */
const STATIC_PLAN_CATALOG: PlanRow[] = [
  {
    id: "free",
    name: "Free",
    price_ngn: 0,
    price_usd: 0,
    tryons_per_month: 5,
    features: [
      "5 try-ons/month on free pool (individual) · 10 on signup (brands)",
      "Watermark",
      "Basic quality",
    ],
  },
  FALLBACK_PRO,
  FALLBACK_CREATOR,
  {
    id: "starter",
    name: "Starter",
    price_ngn: 150000,
    price_usd: 150,
    tryons_per_month: 150,
    features: [
      "100–200 try-ons",
      "50–100 products",
      "HD images",
      "Pilot-friendly limits",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price_ngn: 200000,
    price_usd: 250,
    tryons_per_month: 750,
    features: [
      "500–1000 try-ons",
      "100–500 products",
      "Analytics",
      "API & widget embed",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price_ngn: 0,
    price_usd: 0,
    tryons_per_month: -1,
    features: ["Custom SLA", "Dedicated infrastructure", "Negotiated limits"],
  },
];

const FREE_IDS = new Set(["free", "free_trial", "trial"]);

type PlanUiEntry = {
  description: string;
  goodFor: string;
  featured: boolean;
  cta: string;
  /** Headline when “NGN” pricing is selected (matches checkout when paying in NGN). */
  displayPriceNgn?: string;
  /** Headline when “USD” pricing is selected (matches checkout when paying in USD). */
  displayPriceUsd?: string;
};

/** Enriches DB plans with on-page marketing copy (not stored in DB). */
const PLAN_UI: Record<string, PlanUiEntry> = {
  free: {
    description: "Start with the free try-on pool for your account type.",
    goodFor: "Exploring TryVerse",
    featured: false,
    cta: "Get started",
  },
  free_trial: {
    description: "Start with the free try-on pool for your account type.",
    goodFor: "Exploring TryVerse",
    featured: false,
    cta: "Get started",
  },
  trial: {
    description: "Start with the free try-on pool for your account type.",
    goodFor: "Exploring TryVerse",
    featured: false,
    cta: "Get started",
  },
  pro: {
    description: "50–100 try-ons, HD images, no watermark, downloads — for everyday creators.",
    goodFor: "Creators · Fashion lovers",
    featured: false,
    cta: "Upgrade to Pro",
    displayPriceNgn: "₦15,000",
    displayPriceUsd: "$10",
  },
  creator: {
    description: "200–300 try-ons with stronger realism, marketing images, and priority processing.",
    goodFor: "Influencers · Content creators",
    featured: true,
    cta: "Go Creator",
    displayPriceNgn: "₦30,000",
    displayPriceUsd: "~$20",
  },
  starter: {
    description: "100–200 try-ons and room for 50–100 products — entry for small brands.",
    goodFor: "Small brands · Pilot programmes",
    featured: false,
    cta: "Get Starter",
    displayPriceNgn: "₦150,000",
    displayPriceUsd: "$150",
  },
  growth: {
    description: "500–1000 try-ons, 100–500 products, analytics, API/widget, and marketing content at scale.",
    goodFor: "Growing brands · Performance teams",
    featured: true,
    cta: "Get Growth",
    displayPriceNgn: "₦200,000",
    displayPriceUsd: "$250",
  },
  enterprise: {
    description:
      "AI video generation, custom models, SLA, and dedicated infrastructure — negotiated to fit your stack.",
    goodFor: "Retail · Marketplaces · Agencies",
    featured: false,
    cta: "Let's talk",
  },
};

const B2C_ORDER = ["free", "pro", "creator"] as const;
const B2B_ORDER = ["free", "starter", "growth", "enterprise"] as const;

function firstFreePlan(all: PlanRow[]): PlanRow | undefined {
  return all.find((p) => FREE_IDS.has(p.id));
}

function parseFeatures(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features.filter((x): x is string => typeof x === "string");
  }
  return [];
}

function withWidgetEmbed(plan: PlanRow): PlanRow {
  if (plan.id !== "growth" && plan.id !== "enterprise") return plan;
  const list = parseFeatures(plan.features);
  if (list.some((f) => /widget embed/i.test(f))) return plan;
  return { ...plan, features: ["Widget embed", ...list] };
}

/**
 * Resolves slot ids to rows. `free` slot accepts free | free_trial | trial from DB.
 * Pro/Creator use DB row or static fallback so Individuals always shows three tiers.
 */
function resolvePlansForAudience(all: PlanRow[], audience: PricingAudience): PlanRow[] {
  const order = audience === "individual" ? B2C_ORDER : B2B_ORDER;
  return order
    .map((slotId): PlanRow | null => {
      if (slotId === "free") {
        const row = firstFreePlan(all);
        if (row) return withWidgetEmbed({ ...row, name: "Free" });
        return {
          id: "free",
          name: "Free",
          price_ngn: 0,
          price_usd: 0,
          tryons_per_month: 5,
          features: [
            "5 try-ons/month on free pool (individual) · 10 on signup (brands)",
            "Watermark",
            "Basic quality",
          ],
        };
      }
      const row = all.find((p) => p.id === slotId);
      if (row) return withWidgetEmbed(row);
      if (slotId === "pro") return FALLBACK_PRO;
      if (slotId === "creator") return FALLBACK_CREATOR;
      return null;
    })
    .filter((p): p is PlanRow => p != null);
}

function isFreePlanId(id: string): boolean {
  return id === "free" || id === "free_trial" || id === "trial";
}

const Pricing = () => {
  const navigate = useNavigate();
  const [audience] = useState<PricingAudience>("business");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [providers, setProviders] = useState({
    paystack: false,
    flutterwave: false,
  });
  const [checkoutCurrency, setCheckoutCurrency] = useState<"USD" | "NGN">("USD");

  // Single source of truth for pricing — the same `plans` table the backend charges from
  // (see backend/src/routes/payment.ts). STATIC_PLAN_CATALOG is only a display fallback for
  // the brief moment before this query resolves (or if it ever returns empty), never a second
  // copy of the actual prices — those must never be able to drift apart again.
  const livePlans = useQuery(api.plans.listActivePlans);
  const plansLoading = livePlans === undefined;
  const dbPlans: PlanRow[] =
    livePlans && livePlans.length > 0 ? (livePlans as unknown as PlanRow[]) : STATIC_PLAN_CATALOG;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await getPaymentProviders();
        if (cancelled) return;
        setProviders(p);
        if (p.flutterwave) setCheckoutCurrency("USD");
        else if (p.paystack) setCheckoutCurrency("NGN");
      } catch {
        if (!cancelled) {
          toast.error("Could not load payment providers");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async (plan: PlanRow) => {
    if (plan.id === "enterprise") {
      navigate("/book-demo");
      return;
    }

    if (plan.id === "free" || plan.id === "free_trial" || plan.id === "trial") {
      navigate("/dashboard");
      toast.success("You're on the free tier — opening your dashboard.");
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
        const rawUrl = data?.authorization_url;
        if (typeof rawUrl !== "string") throw new Error("No payment URL received");
        assignTrustedPaymentCheckoutUrl(rawUrl, "paystack");
      } else {
        const data = await initializeFlutterwavePayment(plan.id, effectiveCurrency, callbackUrl);
        const rawUrl = data?.authorization_url;
        if (typeof rawUrl !== "string") throw new Error("No payment URL received");
        assignTrustedPaymentCheckoutUrl(rawUrl, "flutterwave");
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

  const visiblePlans = resolvePlansForAudience(dbPlans, audience);

  const renderPlanCard = (plan: PlanRow, i: number) => {
    const baseUi = PLAN_UI[plan.id] || {
      description: "",
      goodFor: "Teams",
      featured: false,
      cta: "Get Started",
    };

    const freeOverride =
      isFreePlanId(plan.id)
        ? audience === "individual"
          ? {
              description: "5 try-ons on the free pool, watermark, basic quality — built for sharing.",
              goodFor: "Virality · Fashion discovery",
            }
          : {
              description: "10 try-ons on signup for your brand, watermark, basic quality — perfect for a pilot.",
              goodFor: "Small brands testing fit AI",
            }
        : {};

    const ui: PlanUiEntry = { ...baseUi, ...freeOverride };

    const features = isFreePlanId(plan.id)
      ? audience === "individual"
        ? ["5 try-ons", "Watermark", "Basic quality"]
        : ["10 try-ons", "Watermark", "Basic quality"]
      : parseFeatures(plan.features);
    const showUsd = displayCurrency === "USD";
    const free = isFreePlanId(plan.id);
    const hasDualCurrencyHeadline =
      Boolean(ui.displayPriceNgn && ui.displayPriceUsd) && plan.id !== "enterprise";

    const priceDisplay =
      plan.id === "enterprise"
        ? "Let's talk"
        : free
          ? showUsd
            ? "$0"
            : "₦0"
          : hasDualCurrencyHeadline
            ? showUsd
              ? ui.displayPriceUsd!
              : ui.displayPriceNgn!
            : showUsd
              ? formatUsd(plan.price_usd)
              : formatNgn(plan.price_ngn);

    return (
      <motion.div
        key={`${audience}-${plan.id}`}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className={cn(
          "rounded-2xl p-6 sm:p-7 border flex flex-col h-full min-h-0 min-w-0",
          ui.featured
            ? "border-foreground bg-foreground text-background shadow-elevated relative"
            : "border-border/50 bg-card"
        )}
      >
        {ui.featured && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background text-foreground text-xs font-semibold">
            Recommended
          </div>
        )}
        <div className="mb-6">
          <h3 className="font-display text-lg font-semibold mb-1">{free ? "Free" : plan.name}</h3>
          <p className={cn("text-sm mb-1", ui.featured ? "text-background/70" : "text-muted-foreground")}>{ui.description}</p>
          <p className={cn("text-xs mb-4", ui.featured ? "text-background/60" : "text-muted-foreground/80")}>
            Good for: {ui.goodFor}
          </p>
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="font-display text-3xl sm:text-4xl font-bold leading-tight">{priceDisplay}</span>
            <span className={cn("text-sm", ui.featured ? "text-background/60" : "text-muted-foreground")}>
              {plan.id === "enterprise" || free ? "" : "/month"}
            </span>
          </div>
        </div>

        <ul className="space-y-3 flex-1 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <Check
                className={cn("h-4 w-4 mt-0.5 flex-shrink-0", ui.featured ? "text-background/70" : "text-foreground")}
              />
              <span className={ui.featured ? "text-background/90" : "text-foreground"}>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className={cn(
            "w-full mt-auto shrink-0",
            ui.featured ? "bg-background text-foreground hover:bg-background/90" : "gradient-primary text-primary-foreground shadow-soft"
          )}
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
      <Helmet>
        <title>Pricing — TryVerse AI Infrastructure for Fashion Visualization</title>
        <meta
          name="description"
          content="Plans for fashion brands using TryVerse's fashion visualization platform — virtual try-on, AI model photography, and outfit visualization, from free to enterprise."
        />
        <link rel="canonical" href="https://tryverseai.com/pricing" />
      </Helmet>
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 md:mb-14"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Pricing</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              Plans for fashion brands
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              Scale fashion visualization for your storefront — virtual try-on, AI photography, and more — start
              with 10 free try-ons, then upgrade when you&apos;re ready.
            </p>

            {(providers.flutterwave || providers.paystack) && (
              <div className="flex flex-col items-center gap-2 max-w-md mx-auto mb-2">
                <label htmlFor="pricing-currency" className="text-xs text-muted-foreground">
                  Show prices &amp; pay in
                </label>
                <select
                  id="pricing-currency"
                  value={checkoutCurrency}
                  onChange={(e) => setCheckoutCurrency(e.target.value as "USD" | "NGN")}
                  className="text-xs border border-border rounded-md bg-background px-3 py-2 min-w-[220px]"
                  aria-label="Pricing and checkout currency"
                >
                  <option value="USD" disabled={!providers.flutterwave}>
                    USD
                  </option>
                  <option value="NGN" disabled={!providers.paystack && !providers.flutterwave}>
                    NGN
                  </option>
                </select>
              </div>
            )}
          </motion.div>

          {plansLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : visiblePlans.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Plans aren’t available at the moment. Please check back soon.
            </p>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 gap-5 lg:gap-6 items-stretch max-w-7xl mx-auto w-full",
                audience === "individual" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
              )}
            >
              {visiblePlans.map((plan, i) => renderPlanCard(plan, i))}
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
