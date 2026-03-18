import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { initializePaystackPayment, initializeFlutterwavePayment } from "@/lib/backendApi";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "₦150,000",
    priceUsd: "$100",
    priceValue: 150000,
    priceValueUsd: 100,
    period: "/month",
    description: "For emerging brands testing virtual try-on.",
    features: [
      "Up to 100 products",
      "100 try-ons/month",
      "Basic fit prediction",
      "Widget embed",
      "Email support",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "₦500,000",
    priceUsd: "$350",
    priceValue: 500000,
    priceValueUsd: 350,
    period: "/month",
    description: "For scaling brands serious about conversion.",
    features: [
      "Up to 1,000 products",
      "1,000 try-ons/month",
      "Advanced fit prediction",
      "AI marketing content",
      "Catalog import (URL)",
      "Priority support",
      "Analytics dashboard",
    ],
    cta: "Get Started",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceUsd: "Custom",
    priceValue: 0,
    priceValueUsd: 0,
    period: "",
    description: "For global brands needing full infrastructure.",
    features: [
      "Unlimited products",
      "Unlimited try-ons",
      "AI video generation",
      "Custom model training",
      "Dedicated API access",
      "SLA & uptime guarantee",
      "Dedicated account manager",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    featured: false,
  },
];

type PaymentProvider = "paystack" | "flutterwave";

const Pricing = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("paystack");

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (plan.id === 'enterprise') {
      window.open('mailto:sales@tryverse.ai?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    if (!user || !session) {
      toast.error("Please sign in to subscribe");
      navigate("/auth");
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const callbackUrl = `${window.location.origin}/dashboard`;
      if (provider === 'paystack') {
        const data = await initializePaystackPayment(plan.id, plan.priceValue, callbackUrl);
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error('No payment URL received');
        }
      } else {
        const data = await initializeFlutterwavePayment(
          plan.id,
          plan.priceValueUsd || plan.priceValue,
          plan.priceValueUsd ? 'USD' : 'NGN',
          callbackUrl
        );
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error('No payment URL received');
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || "Failed to initialize payment. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
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
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Start with a free trial. Scale as you grow. No hidden fees.
            </p>

            {/* Payment Method Selector */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Pay with:</span>
              <div className="inline-flex items-center rounded-full border border-border/50 p-1 bg-muted/30">
                <button
                  onClick={() => setProvider("paystack")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    provider === "paystack"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🇳🇬 Paystack (NGN)
                </button>
                <button
                  onClick={() => setProvider("flutterwave")}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    provider === "flutterwave"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🌍 Flutterwave (Multi-currency)
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {provider === "paystack" ? "Nigerian Naira payments via Paystack" : "Pay in USD, GHS, KES, ZAR and more via Flutterwave"}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-7 border ${
                  plan.featured
                    ? "border-foreground bg-foreground text-background shadow-elevated relative"
                    : "border-border/50 bg-card"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background text-foreground text-xs font-semibold">
                    Recommended
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-display text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className={`text-sm mb-4 ${plan.featured ? "text-background/70" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold">
                      {provider === "flutterwave" && plan.priceUsd !== "Custom" ? plan.priceUsd : plan.price}
                    </span>
                    <span className={`text-sm ${plan.featured ? "text-background/60" : "text-muted-foreground"}`}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${plan.featured ? "text-background/70" : "text-foreground"}`} />
                      <span className={plan.featured ? "text-background/90" : "text-foreground"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.featured
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
                      {plan.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 text-center"
          >
            <p className="text-sm text-muted-foreground mb-6">
              All plans include a 14-day free trial · Cancel anytime
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              {["Secure by Design", "High Availability", "Privacy Focused", "Responsive Support"].map((item) => (
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
