import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, DollarSign, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminRevenue } from "@/lib/backendApi";

interface AdminRevenueTabProps {
  adminKey: string;
}

export function AdminRevenueTab({ adminKey }: AdminRevenueTabProps) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{
    period: { days: number };
    byProvider: Record<string, { count: number; amountNGN: number; amountUSD: number }>;
    dailyRevenue: { date: string; totalNGN: number }[];
    totalTransactions: number;
    recentPayments: Array<{
      id: string;
      user_id: string;
      amount: number;
      currency: string;
      provider: string;
      status: string;
      reference: string | null;
      created_at: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminRevenue(adminKey, days)
      .then((d) => setData(d as unknown as typeof data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [adminKey, days]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const providers = Object.entries(data.byProvider || {});
  const chartData = (data.dailyRevenue || []).map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* By provider */}
      {providers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {providers.map(([name, p]) => (
            <div key={name} className="bg-card rounded-xl border border-border/50 p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium capitalize">{name}</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                ₦{p.amountNGN.toLocaleString()} / ${p.amountUSD.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{p.count} transactions</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6 mb-8">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">Daily revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="totalNGN" stroke="#0ea5e9" fill="rgba(14,165,233,0.2)" name="NGN" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <h3 className="font-display text-lg font-semibold text-foreground px-5 py-4 border-b border-border">Recent payments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Provider</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Ref</th>
              </tr>
            </thead>
            <tbody>
              {(data.recentPayments || []).map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm capitalize">{p.provider}</td>
                  <td className="px-5 py-4 text-sm font-medium">{p.currency} {p.amount.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      p.status === "success" ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{p.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!data.recentPayments || data.recentPayments.length === 0) && (
          <div className="text-center py-12 text-muted-foreground text-sm">No payments yet</div>
        )}
      </div>
    </motion.div>
  );
}
