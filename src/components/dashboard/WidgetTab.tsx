import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getCredits } from "@/lib/backendApi";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectStoreWizard } from "@/components/dashboard/ConnectStoreWizard";

export function WidgetTab() {
  const { user } = useAuth();
  const [aiTryOnEnabled, setAiTryOnEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      try {
        const credits = await getCredits();
        setAiTryOnEnabled(credits.isUnlimited || credits.plan !== "free");
      } catch {
        setAiTryOnEnabled(false);
      }
    };
    void fetchUserData();
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <ConnectStoreWizard aiTryOnEnabled={aiTryOnEnabled} userKey={user?.id} />
    </motion.div>
  );
}
