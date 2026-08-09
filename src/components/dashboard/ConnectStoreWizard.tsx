import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Store,
  ShoppingBag,
  PlugZap,
  Globe2,
  Code2,
  RefreshCw,
  CircleDashed,
  Sparkles,
  LifeBuoy,
  CalendarClock,
  ArrowRight,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOrCreateApiKey, regenerateApiKey, listWidgetDomains, type ApiKeyRecord } from "@/lib/backendApi";
import { posthogCapture } from "@/lib/posthog";

type PlatformId = "shopify" | "woocommerce" | "magento" | "bigcommerce" | "headless" | "custom";

interface PlatformOption {
  id: PlatformId;
  label: string;
  icon: typeof Store;
}

const PLATFORMS: PlatformOption[] = [
  { id: "shopify", label: "Shopify", icon: ShoppingBag },
  { id: "woocommerce", label: "WooCommerce", icon: Store },
  { id: "magento", label: "Magento", icon: PlugZap },
  { id: "bigcommerce", label: "BigCommerce", icon: Store },
  { id: "headless", label: "Headless Commerce", icon: Globe2 },
  { id: "custom", label: "Custom Website", icon: Code2 },
];

const PLATFORM_STORAGE_KEY = "tryverse.selectedPlatform";

function CopyField({ label, value, eventName }: { label: string; value: string; eventName: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied`);
    posthogCapture(eventName, { source: "connect_store_wizard" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5 text-xs h-7">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="px-4 py-3 text-sm font-mono text-foreground break-all">{value}</p>
    </div>
  );
}

function StatusDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${done ? "text-foreground" : "text-muted-foreground/60"}`}>
      {done ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

interface ConnectStoreWizardProps {
  /** True once the account's plan includes AI Virtual Try-On. */
  aiTryOnEnabled: boolean;
  /** Current user's id — namespaces the locally-persisted platform choice so it can't leak
   *  between accounts that share a browser (e.g. an agency switching between client logins). */
  userKey?: string;
  /** Called when the customer wants to try the capability themselves in-dashboard. */
  onTryItYourself?: () => void;
}

/**
 * Phase 1 is API-first: TryVerse doesn't have a real Shopify/WooCommerce app, OAuth, or
 * auto-installation yet. This screen never implies otherwise — it gets the customer to the one
 * thing that's actually true (a working API key + a stated platform) and hands the rest to
 * their developer or TryVerse's own implementation team. Nothing here claims "Connected."
 */
export function ConnectStoreWizard({ aiTryOnEnabled, userKey, onTryItYourself }: ConnectStoreWizardProps) {
  const [apiKey, setApiKey] = useState<ApiKeyRecord | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null);
  const [domainCount, setDomainCount] = useState<number | null>(null);

  const storageKey = userKey ? `${PLATFORM_STORAGE_KEY}.${userKey}` : null;

  useEffect(() => {
    let cancelled = false;
    getOrCreateApiKey()
      .then((key) => { if (!cancelled) setApiKey(key); })
      .catch(() => { if (!cancelled) toast.error("Could not set up your API key — refresh to try again"); })
      .finally(() => { if (!cancelled) setKeyLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listWidgetDomains()
      .then((res) => { if (!cancelled) setDomainCount(res.domains.length); })
      .catch(() => { /* nudge is best-effort; don't block the wizard on it */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageKey) {
      setSelectedPlatform(null);
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      setSelectedPlatform(stored && PLATFORMS.some((p) => p.id === stored) ? (stored as PlatformId) : null);
    } catch {
      setSelectedPlatform(null);
    }
  }, [storageKey]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    posthogCapture("api_key_regenerate_clicked", { source: "connect_store_wizard" });
    try {
      const key = await regenerateApiKey();
      setApiKey(key);
      toast.success("New key generated — the old one no longer works");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate the key");
    } finally {
      setRegenerating(false);
    }
  };

  const choosePlatform = (id: PlatformId) => {
    setSelectedPlatform(id);
    if (storageKey) {
      try { window.localStorage.setItem(storageKey, id); } catch { /* ignore */ }
    }
    posthogCapture("connect_store_platform_selected", { platform: id });
  };

  const keyValue = apiKey?.key_value ?? "";
  const platform = PLATFORMS.find((p) => p.id === selectedPlatform) || null;
  const integrationReady = Boolean(apiKey) && Boolean(selectedPlatform);

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-card p-6 md:p-8">
      <div className="mb-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Connect your store</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Get your API key and platform ready — your developer (or ours) completes the integration.
        </p>
      </div>

      {/* Honest status strip — every dot reflects something genuinely true right now */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8 pb-6 border-b border-border/50">
        <StatusDot done label="Business Account Created" />
        <StatusDot done label="Email Verified" />
        <StatusDot done={aiTryOnEnabled} label="Plan Activated" />
        <StatusDot done={Boolean(apiKey)} label="API Key Ready" />
        <StatusDot done={Boolean(selectedPlatform)} label="Platform Selected" />
        <StatusDot done={integrationReady} label="Integration Ready" />
      </div>

      <div className="space-y-8">
        {/* API key — automatic, always visible, the only credential the customer ever handles */}
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            Your API Key
            <span className="font-normal text-muted-foreground text-xs">Automatically generated</span>
          </h3>
          {keyLoading ? (
            <div className="h-16 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
          ) : (
            <div className="space-y-2">
              <CopyField label="API Key" value={keyValue} eventName="widget_credential_copied" />
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Regenerating…" : "Regenerate key"}
              </button>
            </div>
          )}
          {!aiTryOnEnabled && (
            <p className="text-xs text-muted-foreground mt-3">
              <Link to="/pricing" className="text-foreground underline underline-offset-2">Choose a plan</Link> to activate AI Virtual Try-On on your account.
            </p>
          )}
          {Boolean(apiKey) && domainCount === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 mt-3">
              <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                No allowed domain yet — the storefront widget won't run on your site until you add one in{" "}
                <span className="font-medium">Developers → Allowed domains</span>. Server-side calls (the SDK,
                your own backend) aren't affected.
              </p>
            </div>
          )}
        </div>

        {/* Platform selection */}
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">
            {platform ? "Selected Platform" : "Choose your platform"}
          </h3>

          <AnimatePresence mode="wait">
            {platform ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-foreground/[0.06] flex items-center justify-center">
                    <platform.icon className="h-4 w-4 text-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{platform.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(null);
                    if (storageKey) {
                      try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Change
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => choosePlatform(p.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 text-center transition-all hover:border-border"
                  >
                    <p.icon className="h-5 w-5 text-foreground" />
                    <span className="text-xs font-medium text-foreground">{p.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Next step — the honest hand-off, shown once there's something to hand off */}
        {integrationReady && (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-5">
            <h3 className="font-display text-sm font-semibold text-foreground mb-2">Next Step</h3>
            <p className="text-sm text-foreground">
              Share your API key with your developer to complete your {platform?.label} integration.
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Once integrated, your customers will be able to experience AI Virtual Try-On directly on your storefront.
            </p>
            <Link
              to="/dashboard/business?tab=Developers"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground mt-4 hover:opacity-70 transition-opacity"
            >
              View Developer Documentation <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* White-glove — a concierge option, not an admission the platform is unfinished */}
        <div className="rounded-xl border border-border/50 p-5">
          <h3 className="font-display text-sm font-semibold text-foreground mb-1.5">Need Help Integrating?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Don&apos;t have a developer? Our implementation team can help your business integrate TryVerse into your
            storefront quickly and professionally.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/support">
              <Button variant="outline" className="gap-2">
                <LifeBuoy className="h-4 w-4" /> Contact Our Integration Team
              </Button>
            </Link>
            <Link to="/book-demo">
              <Button variant="outline" className="gap-2">
                <CalendarClock className="h-4 w-4" /> Schedule an Integration Call
              </Button>
            </Link>
          </div>
        </div>

        {onTryItYourself && (
          <button
            type="button"
            onClick={onTryItYourself}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Want to see it in action first? Try it yourself in the dashboard.
          </button>
        )}
      </div>
    </div>
  );
}
