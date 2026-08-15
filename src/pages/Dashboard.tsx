import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, BarChart3, Settings, Key, LayoutDashboard, CreditCard, BookOpen, FlaskConical, Sparkles,
  Users, Camera, Terminal, PlugZap, Shirt, Wand2, Film,
} from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { listApiKeys, listWidgetDomains } from "@/lib/backendApi";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Eagerly load the default tab — zero extra latency on first visit
import { TryOnGuideTab } from "@/components/dashboard/TryOnGuideTab";

// Lazy-load all other tabs: each is a separate chunk fetched only when opened. Wrapped in
// lazyWithRetry so a stale chunk reference (e.g. right after a new deploy replaces the hashed
// filenames) triggers one automatic page reload instead of spinning in the Suspense fallback
// forever — this was the "tap a section and it just keeps turning" bug.
const OverviewTab  = lazyWithRetry(() => import("@/components/dashboard/OverviewTab").then((m) => ({ default: m.OverviewTab })), "overview");
const AnalyticsTab = lazyWithRetry(() => import("@/components/dashboard/AnalyticsTab").then((m) => ({ default: m.AnalyticsTab })), "analytics");
const ProductsTab  = lazyWithRetry(() => import("@/components/dashboard/ProductsTab").then((m) => ({ default: m.ProductsTab })), "products");
const ApiKeysTab   = lazyWithRetry(() => import("@/components/dashboard/ApiKeysTab").then((m) => ({ default: m.ApiKeysTab })), "api-keys");
const WidgetTab    = lazyWithRetry(() => import("@/components/dashboard/WidgetTab").then((m) => ({ default: m.WidgetTab })), "widget");
const BillingTab   = lazyWithRetry(() => import("@/components/dashboard/BillingTab").then((m) => ({ default: m.BillingTab })), "billing");
const SettingsTab  = lazyWithRetry(() => import("@/components/dashboard/SettingsTab").then((m) => ({ default: m.SettingsTab })), "settings");
const StudioTab    = lazyWithRetry(() => import("@/components/dashboard/StudioTab").then((m) => ({ default: m.StudioTab })), "studio");

function PersonalizeTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">Personalization unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

const PersonalizeTab = lazy(() =>
  import("@/components/dashboard/PersonalizeTab")
    .then((m) => ({ default: m.PersonalizeTab }))
    .catch(() => ({ default: PersonalizeTabUnavailable }))
);

function AiModelsTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">AI Models unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

// New/premium tabs — lazy-loaded with a `.catch()` fallback, same convention as Personalization above.
const AiModelsTab = lazy(() =>
  import("@/components/dashboard/AiModelsTab")
    .then((m) => ({ default: m.AiModelsTab }))
    .catch(() => ({ default: AiModelsTabUnavailable }))
);

function AiPhotoshootTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">AI Photoshoot unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

const AiPhotoshootTab = lazy(() =>
  import("@/components/dashboard/AiPhotoshootTab")
    .then((m) => ({ default: m.AiPhotoshootTab }))
    .catch(() => ({ default: AiPhotoshootTabUnavailable }))
);

function OutfitBuilderTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">Outfit Builder unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

const OutfitBuilderTab = lazy(() =>
  import("@/components/dashboard/OutfitBuilderTab")
    .then((m) => ({ default: m.OutfitBuilderTab }))
    .catch(() => ({ default: OutfitBuilderTabUnavailable }))
);

function ProductModelTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">AI Model Studio unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

const ProductModelTab = lazy(() =>
  import("@/components/dashboard/ProductModelTab")
    .then((m) => ({ default: m.ProductModelTab }))
    .catch(() => ({ default: ProductModelTabUnavailable }))
);

function VideoTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">AI Video unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

const VideoTab = lazy(() =>
  import("@/components/dashboard/VideoTab")
    .then((m) => ({ default: m.VideoTab }))
    .catch(() => ({ default: VideoTabUnavailable }))
);

const DeveloperDocsTab = lazyWithRetry(
  () => import("@/components/dashboard/DeveloperDocsTab").then((m) => ({ default: m.DeveloperDocsTab })),
  "developer-docs"
);

const GUIDE_TAB = "Try-On guide";
const CONNECT_TAB = "Connect Store";
const DEFAULT_TAB = GUIDE_TAB;

const sidebarItems = [
  { icon: PlugZap, label: CONNECT_TAB },
  { icon: BookOpen, label: GUIDE_TAB },
  { icon: LayoutDashboard, label: "Overview" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Package, label: "Products" },
  { icon: FlaskConical, label: "Personal Studio" },
  { icon: Sparkles, label: "Personalization" },
  { icon: Users, label: "AI Models" },
  { icon: Camera, label: "AI Photoshoot" },
  { icon: Shirt, label: "Outfit Builder" },
  { icon: Wand2, label: "AI Model Studio" },
  { icon: Film, label: "AI Video" },
  { icon: Key, label: "API Keys" },
  { icon: CreditCard, label: "Billing" },
  { icon: Settings, label: "Settings" },
  { icon: Terminal, label: "Developers" },
];

const tabComponents: Record<string, React.ComponentType> = {
  [CONNECT_TAB]: WidgetTab,
  [GUIDE_TAB]: TryOnGuideTab,
  Overview: OverviewTab,
  Analytics: AnalyticsTab,
  Products: ProductsTab,
  "Personal Studio": StudioTab,
  Personalization: PersonalizeTab,
  "AI Models": AiModelsTab,
  "AI Photoshoot": AiPhotoshootTab,
  "Outfit Builder": OutfitBuilderTab,
  "AI Model Studio": ProductModelTab,
  "AI Video": VideoTab,
  "API Keys": ApiKeysTab,
  Billing: BillingTab,
  Settings: SettingsTab,
  Developers: DeveloperDocsTab,
};

/** Minimal spinner shown while a tab chunk is loading */
const TabLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="h-7 w-7 rounded-full border-2 border-muted border-t-foreground animate-spin" />
  </div>
);

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [storeConnected, setStoreConnected] = useState<boolean | null>(null);
  const { user } = useAuth();
  const brandName = user?.user_metadata?.brand_name || "Your Brand";
  // Guards the forced first-visit redirect below so it fires exactly once per account, not on
  // every render — after that, normal tab clicks and deep links behave as usual.
  const appliedInitialLanding = useRef(false);

  // First thing a brand sees after signup: Connect Your Store — until they actually have a key
  // and an allowed domain, in which case the dashboard opens on the normal landing tab.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listApiKeys().catch(() => []), listWidgetDomains().catch(() => ({ domains: [] }))])
      .then(([keys, { domains }]) => {
        if (!cancelled) setStoreConnected(keys.length > 0 && domains.length > 0);
      });
    return () => { cancelled = true; };
  }, [user]);

  // Depend on the primitive string `tabParam` rather than the full URLSearchParams
  // object (which is recreated every render), to avoid spurious effect re-runs.
  useEffect(() => {
    if (storeConnected === null) return; // wait for the connection check before deciding anything

    // Unconditional on first visit: an account that hasn't connected a store always lands on
    // Connect Store, even if the URL/browser history carries a stale ?tab= from a previous
    // account or session in the same browser. Runs once; afterwards tabParam is honored normally.
    if (!appliedInitialLanding.current) {
      appliedInitialLanding.current = true;
      if (!storeConnected) {
        setActiveTab(CONNECT_TAB);
        setSearchParams({ tab: CONNECT_TAB }, { replace: true });
        return;
      }
    }

    if (tabParam && tabComponents[tabParam]) {
      setActiveTab(tabParam);
      return;
    }
    setActiveTab(DEFAULT_TAB);
    setSearchParams({ tab: DEFAULT_TAB }, { replace: true });
  }, [tabParam, setSearchParams, storeConnected]);

  const selectTab = (label: string) => {
    setActiveTab(label);
    setSearchParams({ tab: label }, { replace: true });
  };

  const renderContent = () => {
    const ActiveComponent = tabComponents[activeTab] || TryOnGuideTab;
    return (
      <ErrorBoundary>
        <Suspense fallback={<TabLoader />}>
          <ActiveComponent />
        </Suspense>
      </ErrorBoundary>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-[var(--navbar-height)]">
          <div className="flex">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col w-60 min-h-[calc(100vh-var(--navbar-height))] border-r border-border p-4 pt-6 sticky top-[var(--navbar-height)]">
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Brand Dashboard</p>
              <p className="text-sm font-semibold text-foreground">{brandName}</p>
            </div>
            <nav className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => selectTab(item.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.label
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Mobile tabs */}
          <div className="lg:hidden fixed left-0 right-0 z-30 bg-background border-b border-border overflow-x-auto" style={{ top: 'var(--navbar-height)' }}>
            <div className="flex px-4 py-2 gap-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => selectTab(item.label)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === item.label
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-h-0 p-6 md:p-8 lg:pt-8 pt-[calc(var(--navbar-height)+4rem)]">
            <div className="min-h-[400px]">
              {renderContent()}
            </div>
          </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Dashboard;
