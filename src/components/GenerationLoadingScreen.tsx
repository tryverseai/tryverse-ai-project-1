import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TryVerseLogo } from "@/components/TryVerseLogo";

const DEFAULT_STAGES = [
  "Analyzing your photo",
  "Detecting body shape and pose",
  "Preparing garment fit",
  "Rendering realistic try-on",
  "Finalizing your look",
];

const STAGE_INTERVAL_MS = 3200;
/** Simulated progress eases toward this ceiling and holds — there's no real per-request
 *  progress signal from the backend (poll-based queued/processing/completed only), so this
 *  never claims to be more than "almost there" until the parent actually has a result. */
const SIMULATED_PROGRESS_CEILING = 92;

export interface GenerationPreviewItem {
  label: string;
  imageUrl: string;
}

interface GenerationLoadingScreenProps {
  /** Selected products shown as a strip below the loading area, when available. */
  previewItems?: GenerationPreviewItem[];
  /** Overrides the default "Creating your virtual try-on" headline. */
  title?: string;
  /** Rotating status captions shown below the headline. Defaults to the try-on pipeline's stages. */
  stages?: string[];
  className?: string;
}

export function GenerationLoadingScreen({ previewItems, title, stages, className }: GenerationLoadingScreenProps) {
  const activeStages = stages && stages.length > 0 ? stages : DEFAULT_STAGES;
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(4);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, activeStages.length - 1));
    }, STAGE_INTERVAL_MS);

    // Ease-out curve toward the ceiling — fast at first (feels responsive), slows down the
    // longer generation runs (never looks stuck, never falsely claims completion).
    const progressTimer = setInterval(() => {
      const elapsedS = (Date.now() - startRef.current) / 1000;
      const eased = SIMULATED_PROGRESS_CEILING * (1 - Math.exp(-elapsedS / 14));
      setProgress(Math.max(4, Math.min(SIMULATED_PROGRESS_CEILING, Math.round(eased))));
    }, 300);

    return () => {
      clearInterval(stageTimer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-8 rounded-2xl border border-border bg-[hsl(var(--ink))] px-6 py-14 text-center sm:py-20 ${className ?? ""}`}
    >
      <motion.div
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <TryVerseLogo height={28} invert />
      </motion.div>

      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold text-white sm:text-2xl">
          {title ?? "Creating your virtual try-on"}
        </h3>
        <div className="h-6 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={stageIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-sm text-white/60"
            >
              {activeStages[stageIndex]}…
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-white/70 to-white"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {previewItems && previewItems.length > 0 && (
        <div className="flex items-center gap-3 pt-2">
          {previewItems.map((item) => (
            <div
              key={item.label + item.imageUrl}
              className="h-14 w-14 overflow-hidden rounded-lg border border-white/15 bg-white/5"
              title={item.label}
            >
              <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
