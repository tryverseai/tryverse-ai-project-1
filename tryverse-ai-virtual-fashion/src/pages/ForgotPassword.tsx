import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/** Password reset via email is not used in local-session mode. */
const ForgotPassword = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="font-display text-xl font-bold text-foreground mb-8 block">
          TryVerse<span className="text-muted-foreground">.AI</span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Password reset</h1>
        <p className="text-muted-foreground mb-8">
          TryVerse is using a simple local sign-in: pick any email on the auth page — no password or reset flow.
        </p>
        <Button asChild className="w-full">
          <Link to="/auth">Back to sign in</Link>
        </Button>
        <p className="text-sm text-muted-foreground text-center mt-6">
          <Link to="/auth" className="inline-flex items-center gap-1 text-foreground font-medium hover:underline">
            <ArrowLeft className="h-3 w-3" /> Auth
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
