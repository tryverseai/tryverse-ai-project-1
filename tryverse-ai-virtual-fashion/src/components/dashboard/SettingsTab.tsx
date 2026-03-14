import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [original, setOriginal] = useState<Profile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("brand_name, website_url, contact_email, widget_show_models, widget_fit_recommendations, widget_auto_detect, widget_collect_analytics")
        .eq("id", user.id)
        .single();
      if (data) {
        const p = data as Profile;
        setProfile(p);
        setOriginal(p);
      } else if (error) {
        console.error(error);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        brand_name: profile.brand_name,
        website_url: profile.website_url,
        contact_email: profile.contact_email,
        widget_show_models: profile.widget_show_models,
        widget_fit_recommendations: profile.widget_fit_recommendations,
        widget_auto_detect: profile.widget_auto_detect,
        widget_collect_analytics: profile.widget_collect_analytics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } else {
      toast.success("Settings saved successfully");
      setOriginal(profile);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setProfile(original);
  };

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(original);

  const toggles = [
    { key: "widget_show_models" as const, label: "Show AI Model Selection", desc: "Allow shoppers to choose AI models instead of uploading photos" },
    { key: "widget_fit_recommendations" as const, label: "Enable Fit Recommendations", desc: "Display AI size and fit suggestions alongside try-on results" },
    { key: "widget_auto_detect" as const, label: "Auto-detect Product Type", desc: "Automatically detect if the product is clothing, jewelry, or glasses" },
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your brand profile and widget configuration</p>
      </div>

      <div className="space-y-8 max-w-2xl">
        {/* Brand Info */}
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">Brand Information</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Brand Name</label>
              <Input value={profile.brand_name} onChange={(e) => setProfile({ ...profile, brand_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Website URL</label>
              <Input value={profile.website_url} onChange={(e) => setProfile({ ...profile, website_url: e.target.value })} placeholder="https://yourbrand.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contact Email</label>
              <Input value={profile.contact_email} onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Widget Config */}
        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">Widget Configuration</h3>
          <div className="space-y-5">
            {toggles.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch
                  checked={profile[item.key]}
                  onCheckedChange={(checked) => setProfile({ ...profile, [item.key]: checked })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="gradient-primary text-primary-foreground shadow-soft gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={!hasChanges}>Cancel</Button>
        </div>
      </div>
    </motion.div>
  );
}
