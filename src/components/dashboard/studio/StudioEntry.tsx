import { motion } from "framer-motion";
import { Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudioEntryProps {
  onUploadPhoto: () => void;
  onChooseModel: () => void;
}

/** Personal Studio's landing screen — one editorial moment, two ways in, no dashboard clutter. */
export function StudioEntry({ onUploadPhoto, onChooseModel }: StudioEntryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-[hsl(var(--ink))] px-6 py-16 text-center sm:py-24"
    >
      <div className="relative mx-auto max-w-md space-y-6">
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">
          Experience it on You
        </h2>
        <p className="text-sm text-white/60 sm:text-base">
          Upload a photo or pick a model, then see any garment on them in seconds.
        </p>
        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="w-full gap-2 rounded-full gradient-primary text-primary-foreground shadow-soft sm:w-auto"
            onClick={onUploadPhoto}
          >
            <Upload className="h-4 w-4" />
            Upload a photo
          </Button>
          <Button
            size="lg"
            variant="onInk"
            className="w-full gap-2 rounded-full sm:w-auto"
            onClick={onChooseModel}
          >
            <Users className="h-4 w-4" />
            Choose a virtual model
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
