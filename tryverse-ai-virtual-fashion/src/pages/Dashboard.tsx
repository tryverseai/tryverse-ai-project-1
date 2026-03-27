import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, BarChart3, Settings, Key, Code, LayoutDashboard, CreditCard
} from "lucide-react";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { ApiKeysTab } from "@/components/dashboard/ApiKeysTab";
import { WidgetTab } from "@/components/dashboard/WidgetTab";
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab";
import { ProductsTab } from "@/components/dashboard/ProductsTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { BillingTab } from "@/components/dashboard/BillingTab";
import { ErrorBoundary } from "@/components/ErrorBoundary";
const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Package, label: "Products" },
  { icon: Key, label: "API Keys" },
  { icon: Code, label: "Widget" },
  { icon: CreditCard, label: "Billing" },
  { icon: Settings, label: "Settings" },
];

const tabComponents: Record<string, React.FC> = {
  Overview: OverviewTab,
  Analytics: AnalyticsTab,
  Products: ProductsTab,
  "API Keys": ApiKeysTab,
  Widget: WidgetTab,
  Billing: BillingTab,
  Settings: SettingsTab,
};

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("Overview");
  const { user } = useAuth();
  const brandName = user?.user_metadata?.brand_name || "Your Brand";

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabComponents[tab]) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const selectTab = (label: string) => {
    setActiveTab(label);
    setSearchParams({ tab: label }, { replace: true });
  };

  const renderContent = () => {
    const ActiveComponent = tabComponents[activeTab] || OverviewTab;
    return (
      <ErrorBoundary>
        <ActiveComponent />
      </ErrorBoundary>
    );
  };

  return (
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
  );
};

export default Dashboard;
