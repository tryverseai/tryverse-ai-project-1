import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCredits } from "@/lib/backendApi";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  reference: string;
  created_at: string;
}

export function BillingTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile: remoteProfile, loading: profileLoading } = useSyncedConvexProfile();
  const [loading, setLoading] = useState(true);
  const [payments] = useState<Payment[]>([]);
  const [credits, setCredits] = useState<Awaited<ReturnType<typeof getCredits>> | null>(null);

  useEffect(() => {
    if (!user) return;
    if (profileLoading) {
      setLoading(true);
      return;
    }
    void getCredits()
      .then(setCredits)
      .catch(() => {
        setCredits(null);
        toast.error("Could not load credits");
      })
      .finally(() => setLoading(false));
  }, [user, profileLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const freeRem = credits?.freeCreditsRemaining ?? Number(remoteProfile?.free_credits_remaining ?? 0);
  const freeTot = credits?.freeCreditsTotal ?? Number(remoteProfile?.free_credits_total ?? 0);
  const monthlyRem = credits?.monthlyCreditsRemaining ?? Number(remoteProfile?.monthly_credits_remaining ?? 0);
  const monthlyTot = credits?.monthlyCreditsTotal ?? Number(remoteProfile?.monthly_credits_total ?? 0);
  const planId = credits?.plan ?? String(remoteProfile?.plan_id ?? "free");
  const widgetOn = Boolean(remoteProfile?.widget_activated);
  const isUnlimited = monthlyTot === -1;
  const usedCredits = isUnlimited ? 0 : monthlyTot - monthlyRem;
  const usagePercent = isUnlimited || !monthlyTot ? 0 : Math.round((usedCredits / monthlyTot) * 100);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const formatAmount = (amount: number, currency: string) => {
    if (currency === "NGN") return `₦${amount.toLocaleString()}`;
    if (currency === "USD") return `$${amount.toLocaleString()}`;
    return `${currency} ${amount.toLocaleString()}`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Credits and subscription (payments list via API soon)</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-semibold text-foreground">Current plan</h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {planId}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Free pool: {freeRem} / {freeTot}
            {!credits?.isUnlimited && monthlyTot > 0 ? (
              <>
                <br />
                This cycle: {monthlyRem} / {monthlyTot}
              </>
            ) : null}
            {credits?.isUnlimited ? (
              <>
                <br />
                Unlimited try-ons on your plan.
              </>
            ) : null}
          </p>
          <Button onClick={() => navigate("/pricing")} className="gradient-primary text-primary-foreground shadow-soft gap-2">
            <ArrowUpRight className="h-4 w-4" /> View plans
          </Button>
        </div>

        {widgetOn && monthlyTot > 0 && !credits?.isUnlimited && (
          <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
            <h3 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Usage this period
            </h3>
            <div className="flex items-end justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                {usedCredits} / {monthlyTot} try-ons used
              </p>
              <p className="text-sm font-medium text-foreground">{usagePercent}%</p>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all gradient-primary"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <h3 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Payment history
          </h3>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        payment.status === "success" ? "bg-emerald-500/10" : "bg-destructive/10"
                      }`}
                    >
                      {payment.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {formatAmount(payment.amount, payment.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.provider} · {payment.reference.slice(0, 16)}...
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payments recorded in this view yet.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
