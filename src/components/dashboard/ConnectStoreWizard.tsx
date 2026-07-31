import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  Store,
  PartyPopper,
  ArrowRight,
  ShoppingBag,
  PlugZap,
  Globe2,
  Terminal,
  RefreshCw,
  ChevronDown,
  CircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOrCreateApiKey, regenerateApiKey, widgetBackendPublicUrl, type ApiKeyRecord } from "@/lib/backendApi";
import { posthogCapture } from "@/lib/posthog";

type PlatformId = "shopify" | "woocommerce" | "magento" | "bigcommerce" | "headless" | "custom-api";

interface PlatformOption {
  id: PlatformId;
  label: string;
  icon: typeof Store;
  note: string;
}

const PLATFORMS: PlatformOption[] = [
  { id: "shopify", label: "Shopify", icon: ShoppingBag, note: "Add your key in your Shopify app settings — no theme code to edit." },
  { id: "woocommerce", label: "WooCommerce", icon: Store, note: "Add your key in the WooCommerce plugin settings." },
  { id: "magento", label: "Magento", icon: PlugZap, note: "Add your key in your Magento module configuration." },
  { id: "bigcommerce", label: "BigCommerce", icon: Store, note: "Add your key in your BigCommerce app settings." },
  { id: "headless", label: "Headless Commerce", icon: Globe2, note: "Use your key from your storefront's server layer." },
  { id: "custom-api", label: "Custom API", icon: Terminal, note: "Call TryVerse directly from your own stack." },
];

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

interface ConnectStoreWizardProps {
  /** Called once a platform is chosen, so the parent can reflect "connected" status. */
  onConnected?: () => void;
}

/**
 * Effortless onboarding: Create Account -> API Key Generated Automatically -> Copy Key ->
 * Select Platform -> Connect -> Run first Try-On -> Done. No manual "Generate key" step, no
 * embed code shown up front — the raw request format is one click away for engineers, not the
 * default view.
 */
export function ConnectStoreWizard({ onConnected }: ConnectStoreWizardProps) {
  const [apiKey, setApiKey] = useState<ApiKeyRecord | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId | null>(null);
  const [connected, setConnected] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const backendUrl = widgetBackendPublicUrl();

  // "API Key Generated Automatically" — no button, no wait for the customer to ask for one.
  useEffect(() => {
    let cancelled = false;
    getOrCreateApiKey()
      .then((key) => { if (!cancelled) setApiKey(key); })
      .catch(() => { if (!cancelled) toast.error("Could not set up your API key — refresh to try again"); })
      .finally(() => { if (!cancelled) setKeyLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  const handleConnect = (platformId: PlatformId) => {
    setSelectedPlatform(platformId);
    setConnected(true);
    posthogCapture("connect_store_platform_selected", { platform: platformId });
    onConnected?.();
  };

  const platform = PLATFORMS.find((p) => p.id === selectedPlatform) || null;
  const keyValue = apiKey?.key_value ?? "";

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-card p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Connect your store</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Estimated setup time: 2 minutes</p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            connected ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground bg-muted"
          }`}
        >
          {connected ? <Check className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
          {connected ? "Connected" : "Not connected"}
        </div>
      </div>

      <div className="space-y-8">
        {/* Your API key — automatic, always visible, no "Generate" click required */}
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">Your API key</h3>
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
        </div>

        {/* Choose your platform */}
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground mb-3">Choose your platform</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleConnect(p.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                  selectedPlatform === p.id
                    ? "border-foreground bg-foreground/[0.03] shadow-card"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <p.icon className="h-5 w-5 text-foreground" />
                <span className="text-xs font-medium text-foreground">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Connect confirmation + optional technical detail */}
        {platform && (
          <div className="space-y-3">
            <div className="bg-muted/50 border border-border/50 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
                <platform.icon className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{platform.label} connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">{platform.note}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              Advanced: view request format
            </button>
            {showAdvanced && (
              <pre className="p-4 rounded-lg bg-muted/30 text-xs text-foreground font-mono leading-relaxed overflow-x-auto">
                <code>{`POST ${backendUrl}/api/widget/request
x-api-key: ${keyValue || "tv_live_..."}
Content-Type: application/json

{
  "personImagePath": "...",
  "productImagePath": "...",
  "category": "clothing"
}`}</code>
              </pre>
            )}

            <p className="text-xs text-muted-foreground">
              Requests only work from domains you&apos;ve allow-listed below.
            </p>
          </div>
        )}

        {/* Run your first try-on */}
        {connected && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-3 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center">
                  <PartyPopper className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">You&apos;re connected</p>
                  <p className="text-xs text-muted-foreground">Run a test try-on to confirm everything works.</p>
                </div>
              </div>
              <Link to="/widget-preview">
                <Button className="gradient-primary text-primary-foreground shadow-soft gap-2">
                  Run your first Try-On <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
