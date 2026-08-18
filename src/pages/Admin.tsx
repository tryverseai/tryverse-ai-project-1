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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Users" },
  { icon: Zap, label: "Try-ons" },
  { icon: Cpu, label: "Queue" },
  { icon: CreditCard, label: "Revenue" },
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
      <Navbar />
      <main className="pt-[var(--navbar-height)]">
        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col w-60 min-h-[calc(100vh-var(--navbar-height))] border-r border-border p-4 pt-6 sticky top-[var(--navbar-height)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Platform Admin</p>
                <p className="text-sm font-semibold text-foreground">TryVerse</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLock} className="gap-1.5 h-8 text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Lock
              </Button>
            </div>
            <nav className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(item.label)}
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

          {/* Mobile: header + tabs (fixed below navbar) */}
          <div className="lg:hidden fixed top-20 left-0 right-0 z-20 bg-background border-b border-border">
            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-sm font-semibold text-foreground">Platform Admin</p>
              <Button variant="ghost" size="sm" onClick={handleLock} className="gap-1.5 h-8">
                <Lock className="h-3.5 w-3.5" />
                Lock
              </Button>
            </div>
            <div className="flex px-4 pb-2 gap-1 overflow-x-auto">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(item.label)}
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
          <div className="flex-1 p-6 md:p-8 lg:pt-8 pt-[calc(var(--navbar-height)+4rem)]">
            {renderContent()}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
