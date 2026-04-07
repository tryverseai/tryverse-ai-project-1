import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isConvexDataEnabled } from "@/lib/convexData";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

interface Profile {
  brand_name: string;
  website_url: string;
  contact_email: string;
  widget_show_models: boolean;
  widget_fit_recommendations: boolean;
  widget_auto_detect: boolean;
  widget_collect_analytics: boolean;
}

const defaultProfile: Profile = {
  brand_name: "",
  website_url: "",
  contact_email: "",
  widget_show_models: true,
  widget_fit_recommendations: true,
  widget_auto_detect: false,
  widget_collect_analytics: true,
};

export function SettingsTab() {
  const { user } = useAuth();
  const convexOn = isConvexDataEnabled();
  const { profile: cxProfile, loading: cxLoading } = useSyncedConvexProfile();
  const updateSettingsCv = useMutation(api.profiles.updateSettings);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [original, setOriginal] = useState<Profile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!convexOn) {
      setLoading(false);
      return;
    }
    if (cxLoading) {
      setLoading(true);
      return;
    }
    setLoading(false);
    if (!cxProfile) return;
    const p: Profile = {
      brand_name: cxProfile.brand_name ?? "",
      website_url: cxProfile.website_url ?? "",
      contact_email: cxProfile.contact_email ?? "",
      widget_show_models: cxProfile.widget_show_models ?? true,
      widget_fit_recommendations: cxProfile.widget_fit_recommendations ?? true,
      widget_auto_detect: cxProfile.widget_auto_detect ?? false,
      widget_collect_analytics: cxProfile.widget_collect_analytics ?? true,
    };
    setProfile(p);
    setOriginal(p);
  }, [user, convexOn, cxProfile, cxLoading]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateSettingsCv({
        brand_name: profile.brand_name,
        website_url: profile.website_url,
        contact_email: profile.contact_email,
        widget_show_models: profile.widget_show_models,
        widget_fit_recommendations: profile.widget_fit_recommendations,
        widget_auto_detect: profile.widget_auto_detect,
        widget_collect_analytics: profile.widget_collect_analytics,
      });
      toast.success("Settings saved successfully");
      setOriginal(profile);
    } catch (e) {
      toast.error("Failed to save settings");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(original);
  };

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(original);

  if (!convexOn) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Set <code className="rounded bg-muted px-1">VITE_CONVEX_URL</code> to edit workspace settings.
      </div>
    );
  }

  const toggles = [
    { key: "widget_show_models" as const, label: "Show AI Model Selection", desc: "Allow shoppers to choose AI models instead of uploading photos" },
    { key: "widget_fit_recommendations" as const, label: "Enable Fit Recommendations", desc: "Display AI size and fit suggestions alongside try-on results" },
    { key: "widget_auto_detect" as const, label: "Auto-detect Product Type", desc: "Automatically detect clothing, jewelry, or glasses" },
    { key: "widget_collect_analytics" as const, label: "Collect Anonymous Analytics", desc: "Track widget usage for performance insights" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-2xl">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Workspace settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Brand details and widget defaults</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Brand name</label>
          <Input className="mt-1.5" value={profile.brand_name} onChange={(e) => setProfile({ ...profile, brand_name: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Website</label>
          <Input className="mt-1.5" value={profile.website_url} onChange={(e) => setProfile({ ...profile, website_url: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Contact email</label>
          <Input className="mt-1.5" type="email" value={profile.contact_email} onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Widget</h3>
        {toggles.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 rounded-lg border border-border/50 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
            </div>
            <Switch checked={profile[t.key]} onCheckedChange={(v) => setProfile({ ...profile, [t.key]: v })} />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !hasChanges} className="gradient-primary text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={!hasChanges || saving}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
