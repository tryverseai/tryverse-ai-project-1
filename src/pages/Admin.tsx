import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Lock,
  Unlock,
  Loader2,
  Shield,
  LayoutDashboard,
  Users,
  Zap,
  CreditCard,
  Cpu,
  Settings,
  FileText,
  Key,
  ScrollText,
  BarChart3,
  Images,
  PanelLeftOpen,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileNavSheet } from "@/components/dashboard/MobileNavSheet";
import {
  getStoredAdminKey,
  clearStoredAdminKey,
  adminLogin,
  adminLogout,
  checkAdminSession,
} from "@/lib/backendApi";
import { toast } from "sonner";
import { AdminOverviewTab } from "@/components/admin/AdminOverviewTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminTryonsTab } from "@/components/admin/AdminTryonsTab";
import { AdminQueueTab } from "@/components/admin/AdminQueueTab";
import { AdminRevenueTab } from "@/components/admin/AdminRevenueTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import { AdminApiKeysTab } from "@/components/admin/AdminApiKeysTab";
import { AdminLogsTab } from "@/components/admin/AdminLogsTab";
import { AdminAuditTab } from "@/components/admin/AdminAuditTab";
import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminModelLibraryTab } from "@/components/admin/AdminModelLibraryTab";
import { AdminAiUsageTab } from "@/components/admin/AdminAiUsageTab";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Users" },
  { icon: Zap, label: "Try-ons" },
  { icon: Cpu, label: "Queue" },
  { icon: CreditCard, label: "Revenue" },
  { icon: Sparkles, label: "AI Usage" },
  { icon: Key, label: "API & Widget" },
  { icon: Images, label: "Models" },
  { icon: Settings, label: "Settings" },
  { icon: ScrollText, label: "Logs" },
  { icon: FileText, label: "Audit" },
];

const Admin = () => {
  const [adminKey, setAdminKey] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tv-admin-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("tv-admin-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // Storage unavailable (private browsing, etc.) — collapse state just won't persist.
    }
  }, [sidebarCollapsed]);
  const ActiveIcon = sidebarItems.find((i) => i.label === activeTab)?.icon;

  useEffect(() => {
    // On mount: verify the HttpOnly session cookie is still valid without
    // ever exposing the key to JavaScript. Falls back to sessionStorage flag
    // for the synchronous "is UI unlocked" check, then async-confirms with the server.
    const localFlag = getStoredAdminKey();
    if (!localFlag) {
      setStoredKey(null);
      return;
    }
    // Verify with server (session may have expired server-side)
    void checkAdminSession().then((valid) => {
      if (!valid) {
        clearStoredAdminKey();
        setStoredKey(null);
        toast.info("Admin session expired. Please sign in again.");
      } else {
        setStoredKey('session');
      }
    });
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) {
      setError("Please enter the admin key");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // adminLogin POSTs the key to the backend which validates it and sets an
      // HttpOnly session cookie. The key is never stored in JS memory after this.
      await adminLogin(adminKey);
      setStoredKey('session'); // sentinel — UI knows we're logged in; key is NOT stored
      setAdminKey("");
      toast.success("Admin access granted");
    } catch (err) {
      const msg =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Invalid admin key";
      setError(msg);
      toast.error(msg.length > 180 ? `${msg.slice(0, 177)}…` : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    void adminLogout(); // revokes server session + clears cookie
    clearStoredAdminKey();
    setStoredKey(null);
    toast.success("Logged out");
  };

  const renderContent = () => {
    if (!storedKey) return null;
    switch (activeTab) {
      case "Overview":
        return <AdminOverviewTab adminKey={storedKey} />;
      case "Analytics":
        return <AdminAnalyticsTab adminKey={storedKey} />;
      case "Users":
        return <AdminUsersTab adminKey={storedKey} />;
      case "Try-ons":
        return <AdminTryonsTab adminKey={storedKey} />;
      case "Queue":
        return <AdminQueueTab adminKey={storedKey} />;
      case "Revenue":
        return <AdminRevenueTab adminKey={storedKey} />;
      case "AI Usage":
        return <AdminAiUsageTab adminKey={storedKey} />;
      case "API & Widget":
        return <AdminApiKeysTab adminKey={storedKey} />;
      case "Models":
        return <AdminModelLibraryTab adminKey={storedKey} />;
      case "Settings":
        return <AdminSettingsTab adminKey={storedKey} />;
      case "Logs":
        return <AdminLogsTab adminKey={storedKey} />;
      case "Audit":
        return <AdminAuditTab adminKey={storedKey} />;
      default:
        return <AdminOverviewTab adminKey={storedKey} />;
    }
  };

  if (!storedKey) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-28 pb-20">
          <div className="max-w-md mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border/50 p-8 shadow-card"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-foreground">Admin Access</h1>
                  <p className="text-sm text-muted-foreground">Enter your admin key to continue</p>
                </div>
              </div>
              <form onSubmit={handleUnlock} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Admin key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="font-mono"
                  autoFocus
                  disabled={loading}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                  Unlock
                </Button>
              </form>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
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
                <div className="flex w-full items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Platform Admin</p>
                    <p className="text-sm font-semibold text-foreground truncate">TryVerse</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLock} className="gap-1.5 h-8 flex-shrink-0 text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    Lock
                  </Button>
                </div>
              )}
              {sidebarCollapsed && (
                <Button variant="ghost" size="sm" onClick={handleLock} title="Lock" className="h-9 w-9 p-0 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </Button>
              )}
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(item.label)}
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

          {/* Mobile: minimal icon toggle + left slide-in nav panel (fixed below navbar) */}
          <div className="lg:hidden fixed top-20 left-0 right-0 z-20 bg-background border-b border-border">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label={mobileNavOpen ? "Close navigation panel" : "Open navigation panel"}
                aria-expanded={mobileNavOpen}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-all duration-150 hover:bg-muted/70 active:scale-95"
              >
                {mobileNavOpen ? (
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                ) : (
                  <PanelLeftOpen className="h-[18px] w-[18px]" />
                )}
              </button>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {ActiveIcon && <ActiveIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
                <span className="truncate text-sm font-medium text-foreground">{activeTab}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={handleLock} className="gap-1.5 h-8 flex-shrink-0">
                <Lock className="h-3.5 w-3.5" />
                Lock
              </Button>
            </div>
          </div>

          <MobileNavSheet
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
            brandEyebrow="Platform Admin"
            brandName="TryVerse"
            groups={[{ section: "Admin", items: sidebarItems }]}
            activeLabel={activeTab}
            onSelect={(label) => { setActiveTab(label); setMobileNavOpen(false); }}
          />

          {/* Main content */}
          <div className="flex-1 p-6 md:p-8 lg:pt-8 pt-[calc(var(--navbar-height)+3rem)]">
            {renderContent()}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
