import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const ResetPassword = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Reset password</h1>
        <p className="text-muted-foreground mb-8">
          Not available in local-session mode. Use the auth page and sign in with your email — passwords are not stored.
        </p>
        <Button asChild>
          <Link to="/auth">Go to sign in</Link>
        </Button>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
