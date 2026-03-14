import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, ArrowUpRight, Clock, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Subscription {
  plan_id: string;
  status: string;
  provider: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  reference: string;
  created_at: string;
}

interface Profile {
  widget_activated: boolean;
  free_credits_remaining: number;
  free_credits_total: number;
  monthly_credits_remaining: number;
  monthly_credits_total: number;
  current_plan_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  price_ngn: number;
  tryons_per_month: number;
}

export function BillingTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: sub }, { data: pays }, { data: prof }, { data: plansData }] = await Promise.all([
        supabase.from("subscriptions").select("plan_id, status, provider, current_period_start, current_period_end").eq("user_id", user.id).single(),
        supabase.from("payments").select("id, amount, currency, status, provider, reference, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("widget_activated, free_credits_remaining, free_credits_total, monthly_credits_remaining, monthly_credits_total, current_plan_id").eq("id", user.id).single(),
        supabase.from("plans").select("id, name, price_ngn, tryons_per_month").eq("is_active", true),
      ]);
      setSubscription(sub as Subscription | null);
      setPayments((pays as Payment[]) || []);
      setProfile(prof as unknown as Profile | null);
      setPlans((plansData as Plan[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === profile?.current_plan_id);
  const isActive = subscription?.status === 'active';
  const isUnlimited = (profile?.monthly_credits_total ?? 0) === -1;
  const usedCredits = isUnlimited ? 0 : (profile?.monthly_credits_total ?? 0) - (profile?.monthly_credits_remaining ?? 0);
  const usagePercent = isUnlimited ? 0 : profile?.monthly_credits_total ? Math.round((usedCredits / profile.monthly_credits_total) * 100) : 0;

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const formatAmount = (amount: number, currency: string) => {
    if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
    if (currency === 'USD') return `$${amount.toLocaleString()}`;
    return `${currency} ${amount.toLocaleString()}`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription, credits, and payment history</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Current Plan */}
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-semibold text-foreground">Current Plan</h3>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                <CheckCircle className="h-3 w-3" /> Active
              </span>
            )}
            {!isActive && !profile?.widget_activated && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                Free Trial
              </span>
            )}
          </div>

          {currentPlan ? (
            <div className="space-y-4">
              <div>
                <p className="font-display text-2xl font-bold text-foreground">{currentPlan.name}</p>
                <p className="text-sm text-muted-foreground">₦{currentPlan.price_ngn.toLocaleString()}/month via {subscription?.provider || 'paystack'}</p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Period</p>
                  <p className="font-medium text-foreground">{formatDate(subscription?.current_period_start ?? null)} → {formatDate(subscription?.current_period_end ?? null)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-display text-xl font-bold text-foreground mb-1">Free Trial</p>
              <p className="text-sm text-muted-foreground mb-4">{profile?.free_credits_remaining ?? 0} / {profile?.free_credits_total ?? 3} free try-ons remaining</p>
              <Button onClick={() => navigate("/pricing")} className="gradient-primary text-primary-foreground shadow-soft gap-2">
                <ArrowUpRight className="h-4 w-4" /> Upgrade Plan
              </Button>
            </div>
          )}
        </div>

        {/* Usage */}
        {profile?.widget_activated && (
          <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
            <h3 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Usage This Period
            </h3>
            {isUnlimited ? (
              <p className="text-sm text-muted-foreground">Unlimited try-ons on your Enterprise plan.</p>
            ) : (
              <>
                <div className="flex items-end justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{usedCredits} / {profile?.monthly_credits_total ?? 0} try-ons used</p>
                  <p className="text-sm font-medium text-foreground">{usagePercent}%</p>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all gradient-primary"
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                {usagePercent >= 80 && (
                  <p className="text-xs text-destructive mt-2">
                    ⚠️ You're running low on credits. Consider upgrading your plan.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Upgrade Options */}
        {currentPlan && currentPlan.id !== 'enterprise' && (
          <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
            <h3 className="font-display text-base font-semibold text-foreground mb-4">Upgrade Plan</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {plans.filter(p => p.id !== currentPlan.id && p.id !== 'enterprise').map(plan => (
                <button
                  key={plan.id}
                  onClick={() => navigate("/pricing")}
                  className="text-left p-4 rounded-xl border border-border/50 hover:border-foreground/20 transition-all"
                >
                  <p className="font-display text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">₦{plan.price_ngn.toLocaleString()}/mo · {plan.tryons_per_month === -1 ? 'Unlimited' : plan.tryons_per_month} try-ons</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <h3 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Payment History
          </h3>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${payment.status === 'success' ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                      {payment.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatAmount(payment.amount, payment.currency)}</p>
                      <p className="text-xs text-muted-foreground">{payment.provider} · {payment.reference.slice(0, 16)}...</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
