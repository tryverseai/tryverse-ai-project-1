import { lazy, Suspense, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, BarChart3, Settings, Key, LayoutDashboard, CreditCard, BookOpen, FlaskConical, Sparkles,
  Users, Camera, Terminal, PlugZap, Shirt, Wand2, Film, LayoutGrid, Images, PanelLeftOpen, PanelLeftClose, Menu, X,
} from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { MobileNavSheet } from "@/components/dashboard/MobileNavSheet";
import { TryOnGuideGate } from "@/components/dashboard/TryOnGuideGate";
import { CreditsBadge } from "@/components/dashboard/CreditsBadge";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { GUIDE_TAB, CONNECT_TAB, hasAcknowledgedTryOnGuide } from "@/lib/dashboardTabs";

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
      <p className="text-sm font-medium text-foreground mb-1">AI Model Studio unavailable</p>
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
      <p className="text-sm font-medium text-foreground mb-1">Product Photography unavailable</p>
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

function MyCreationsTabUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <p className="text-sm font-medium text-foreground mb-1">My Creations unavailable</p>
      <p className="text-xs text-muted-foreground max-w-md text-center">
        This section could not be loaded. Refresh the page or try again in a moment.
      </p>
    </div>
  );
}

const MyCreationsTab = lazy(() =>
  import("@/components/dashboard/MyCreationsTab")
    .then((m) => ({ default: m.MyCreationsTab }))
    .catch(() => ({ default: MyCreationsTabUnavailable }))
);

const DeveloperDocsTab = lazyWithRetry(
  () => import("@/components/dashboard/DeveloperDocsTab").then((m) => ({ default: m.DeveloperDocsTab })),
  "developer-docs"
);

const MyModelsTab = lazyWithRetry(
  () => import("@/components/dashboard/MyModelsTab").then((m) => ({ default: m.MyModelsTab })),
  "my-models"
);

const DEFAULT_TAB = GUIDE_TAB;

/**
 * Information architecture: Overview (workspace/performance) -> Create (active creative
 * workflows) -> Models (creation vs. the user's own saved models — deliberately two destinations,
 * never merged, so a user's generated models are never presented as TryVerse's own library) ->
 * Catalog (product data and the imagery built around it) -> Library (the unified home for
 * everything the user has generated, not folded into any one workflow) -> Platform (onboarding/
 * integration/infrastructure, not creative work) -> Account. Single source of truth for both the
 * desktop sidebar and MobileNavSheet below — add a destination here once, it appears in both.
 */
const sidebarGroups: { section: string; items: { icon: React.ElementType; label: string }[] }[] = [
  {
    section: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Overview" },
      { icon: BarChart3, label: "Analytics" },
    ],
  },
  {
    section: "Create",
    items: [
      { icon: FlaskConical, label: "Personal Studio" },
      { icon: Shirt, label: "Outfit Builder" },
      { icon: Camera, label: "AI Photoshoot" },
      { icon: Film, label: "AI Video" },
    ],
  },
  {
    section: "Models",
    items: [
      { icon: Users, label: "AI Model Studio" },
      { icon: Images, label: "My Models" },
    ],
  },
  {
    section: "Catalog",
    items: [
      { icon: Package, label: "Products" },
      { icon: Wand2, label: "Product Photography" },
    ],
  },
  {
    section: "Library",
    items: [{ icon: LayoutGrid, label: "My Creations" }],
  },
  {
    section: "Platform",
    items: [
      { icon: BookOpen, label: GUIDE_TAB },
      { icon: PlugZap, label: CONNECT_TAB },
      { icon: Terminal, label: "Developers" },
      { icon: Key, label: "API Keys" },
    ],
  },
  {
    section: "Account",
    items: [
      { icon: CreditCard, label: "Billing" },
      { icon: Settings, label: "Settings" },
    ],
  },
];

const sidebarItems = sidebarGroups.flatMap((g) => g.items);

const tabComponents: Record<string, React.ComponentType> = {
  [CONNECT_TAB]: WidgetTab,
  [GUIDE_TAB]: TryOnGuideTab,
  Overview: OverviewTab,
  Analytics: AnalyticsTab,
  Products: ProductsTab,
  "Personal Studio": StudioTab,
  "My Creations": MyCreationsTab,
  "AI Model Studio": AiModelsTab,
  "My Models": MyModelsTab,
  "AI Photoshoot": AiPhotoshootTab,
  "Outfit Builder": OutfitBuilderTab,
  "Product Photography": ProductModelTab,
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Desktop-only collapse state for the left sidebar rail, remembered across visits like a
  // native desktop app (VS Code, Slack) rather than resetting every reload.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tv-dashboard-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("tv-dashboard-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // Storage unavailable (private browsing, etc.) — collapse state just won't persist.
    }
  }, [sidebarCollapsed]);
  const [guideAcknowledged, setGuideAcknowledged] = useState(() => hasAcknowledgedTryOnGuide());
  const { user, signOut } = useAuth();
  // BetaAccessOverlay (terms acceptance / plan selection) is a sibling overlay that mounts on top
  // of this component rather than gating its render — Dashboard is always in the DOM underneath.
  // Showing our own full-screen guide gate before that overlay clears would stack two competing
  // full-screen modals at once, and whichever one's Radix portal mounts later wins the click
  // fight — which starved BetaAccessOverlay's own "I agree" checkbox of pointer events entirely,
  // locking a brand-new user out of onboarding. Wait for BetaAccessOverlay to finish first.
  const dashboardProfile = useQuery(api.profiles.getMyProfile, user ? {} : "skip");
  const betaGateClear = Boolean(
    dashboardProfile &&
      dashboardProfile.terms_of_service_accepted_at &&
      (dashboardProfile.account_type !== "business" || dashboardProfile.plan_selected_at)
  );
  const navigate = useNavigate();
  const brandName = user?.user_metadata?.brand_name || "Your Brand";

  // Depend on the primitive string `tabParam` rather than the full URLSearchParams
  // object (which is recreated every render), to avoid spurious effect re-runs.
  //
  // Try-On Guide is the first page every brand sees (walks them through the workflow before
  // asking them to integrate anything) — Connect Store no longer force-overrides it on first
  // visit, per explicit product direction: the user should understand the workflow before
  // seeing integration instructions.
  useEffect(() => {
    if (tabParam && tabComponents[tabParam]) {
      setActiveTab(tabParam);
      return;
    }
    setActiveTab(DEFAULT_TAB);
    setSearchParams({ tab: DEFAULT_TAB }, { replace: true });
  }, [tabParam, setSearchParams]);

  const selectTab = (label: string) => {
    setActiveTab(label);
    setSearchParams({ tab: label }, { replace: true });
    setMobileNavOpen(false);
  };

  const handleMobileSignOut = async () => {
    setMobileNavOpen(false);
    await signOut();
    navigate("/");
  };

  const ActiveIcon = sidebarItems.find((i) => i.label === activeTab)?.icon;

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
    <CreditsProvider>
      {betaGateClear && !guideAcknowledged && (
        <TryOnGuideGate onAcknowledge={() => setGuideAcknowledged(true)} />
      )}
      <div className="min-h-screen bg-background">
        <Navbar mobileMenuHidden />
        <main className="pt-[var(--navbar-height)]">
          <div className="flex">
          {/* Sidebar — collapses to an icon-only rail on desktop, state remembered via localStorage. */}
          <aside
            className={`hidden lg:flex flex-col ${sidebarCollapsed ? "w-[4.5rem]" : "w-60"} min-h-[calc(100vh-var(--navbar-height))] border-r border-border p-3 pt-6 sticky top-[var(--navbar-height)] transition-[width] duration-300 ease-in-out overflow-hidden`}
          >
            <div className="mb-6 flex flex-col items-start gap-3 px-1">
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Brand Dashboard</p>
                  <p className="text-sm font-semibold text-foreground truncate">{brandName}</p>
                </div>
              )}
              <CreditsBadge onClick={() => selectTab("Billing")} collapsed={sidebarCollapsed} />
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden">
              {sidebarGroups.map((group) => (
                <div key={group.section}>
                  {!sidebarCollapsed && (
                    <p className="px-3 mb-1.5 text-[0.6875rem] font-semibold text-muted-foreground/70 uppercase tracking-wider truncate">
                      {group.section}
                    </p>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => selectTab(item.label)}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-label={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
                          sidebarCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
                        } ${
                          activeTab === item.label
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              className={`mt-3 flex h-9 flex-shrink-0 items-center gap-2 rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground ${
                sidebarCollapsed ? "justify-center px-0" : "px-3"
              }`}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px] flex-shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </aside>

          {/* Mobile tabs — left slide-in panel instead of a dropdown, mirrors the desktop
              sidebar's grouped list one-for-one. */}
          <div className="lg:hidden fixed left-0 right-0 z-30 bg-background border-b border-border" style={{ top: 'var(--navbar-height)' }}>
            <div className="px-4 py-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label={mobileNavOpen ? "Close navigation panel" : "Open navigation panel"}
                aria-expanded={mobileNavOpen}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-all duration-150 hover:bg-muted/70 active:scale-95"
              >
                {mobileNavOpen ? (
                  <X className="h-[18px] w-[18px]" />
                ) : (
                  <Menu className="h-[18px] w-[18px]" />
                )}
              </button>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {ActiveIcon && <ActiveIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                <span className="truncate text-sm font-medium text-foreground">{activeTab}</span>
              </span>
              <CreditsBadge onClick={() => selectTab("Billing")} className="flex-shrink-0" />
            </div>
          </div>

          <MobileNavSheet
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
            brandEyebrow="Brand Dashboard"
            brandName={brandName}
            groups={sidebarGroups}
            activeLabel={activeTab}
            onSelect={selectTab}
            footer={
              <button
                type="button"
                onClick={() => void handleMobileSignOut()}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Sign out
              </button>
            }
          />

          {/* Main content */}
          <div className="flex-1 min-h-0 p-6 md:p-8 lg:pt-8 pt-[calc(var(--navbar-height)+4rem)]">
            <div className="min-h-[400px]">
              {renderContent()}
            </div>
          </div>
          </div>
        </main>
      </div>
    </CreditsProvider>
  );
};

export default Dashboard;
