import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountChoice = "individual" | "business" | "";

interface SignupAccountTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pre-auth step: choose Individual vs Business, then continue to /auth with signup query locked.
 */
export function SignupAccountTypeModal({ open, onOpenChange }: SignupAccountTypeModalProps) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<AccountChoice>("");

  const proceed = () => {
    if (kind !== "individual" && kind !== "business") return;
    onOpenChange(false);
    navigate(kind === "individual" ? "/auth?signup=individual" : "/auth?signup=business");
    setKind("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setKind("");
      }}
    >
      <DialogContent className="sm:max-w-md border-border/80 bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Are you signing up as a Business or Individual?</DialogTitle>
          <DialogDescription>Select an account type to continue. You can complete sign up on the next screen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="signup-account-type">Account type</Label>
          <Select
            value={kind === "" ? undefined : kind}
            onValueChange={(v) => setKind(v as AccountChoice)}
            required
          >
            <SelectTrigger id="signup-account-type" className="h-11">
              <SelectValue placeholder="Choose one…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gradient-primary text-primary-foreground"
            disabled={kind !== "individual" && kind !== "business"}
            onClick={proceed}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
