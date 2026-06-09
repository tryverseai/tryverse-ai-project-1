/**
 * RunwayShowcase — single-model luxury fashion campaign experience.
 *
 * Four frames tell a continuous runway story: the same model progresses
 * across the gallery in four different coloured looks, conveying the
 * TryVerse value proposition (same identity, outfit changes) without text.
 *
 * Animation strategy
 * ─────────────────
 * • Entry: cards fan in from below with a staggered delay (scroll-triggered, once).
 * • Ambient float: each card drifts on a slow, independent sinusoidal y-path
 *   (60 s base duration ± a few seconds per card) using GPU-accelerated
 *   `transform: translateY()` — no layout reflow.
 * • Active pulse: the currently "spotlit" card breathes (subtle scale 1→1.025→1)
 *   on a 6-second loop, cycling through all four cards automatically.
 * • Hover: slight scale-up + shadow enhancement, cursor pointer.
 * • `prefers-reduced-motion`: all motion is disabled.
 */
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import runwayFrame1 from "@/assets/runway-frame-1.jpg";
import runwayFrame2 from "@/assets/runway-frame-2.jpg";
import runwayFrame3 from "@/assets/runway-frame-3.jpg";
import runwayFrame4 from "@/assets/runway-frame-4.jpg";

const FRAMES = [
  {
    src: runwayFrame1,
    alt: "Model in red dress — runway entry walk",
    look: "Look 01",
    label: "Red",
    floatDuration: 60,
    floatDelay: 0,
    entryDelay: 0,
  },
  {
    src: runwayFrame2,
    alt: "Model in black dress — hero portrait",
    look: "Look 02",
    label: "Black",
    floatDuration: 64,
    floatDelay: 3,
    entryDelay: 0.1,
  },
  {
    src: runwayFrame3,
    alt: "Model in blue dress — three-quarter runway walk",
    look: "Look 03",
    label: "Blue",
    floatDuration: 57,
    floatDelay: 7,
    entryDelay: 0.2,
  },
  {
    src: runwayFrame4,
    alt: "Model in green dress — runway exit walk",
    look: "Look 04",
    label: "Green",
    floatDuration: 63,
    floatDelay: 11,
    entryDelay: 0.3,
  },
] as const;

/** How long each card is "spotlit" before cycling to the next (ms). */
const PULSE_INTERVAL_MS = 3200;

export function JewelryShowcase() {
  const shouldReduceMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);

  /** Cycle the spotlight automatically every PULSE_INTERVAL_MS. */
  useEffect(() => {
    if (shouldReduceMotion) return;
    const id = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % FRAMES.length);
    }, PULSE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [shouldReduceMotion]);

  return (
    <section className="py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {FRAMES.map((frame, i) => {
            const isActive = i === activeIdx;
            return (
              /* ── Entry animation wrapper ──────────────────────────── */
              <motion.div
                key={i}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.75,
                  delay: frame.entryDelay,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative"
              >
                {/* ── Ambient float wrapper ─────────────────────────── */}
                <motion.div
                  animate={shouldReduceMotion ? {} : { y: [0, -10, 0] }}
                  transition={
                    shouldReduceMotion
                      ? {}
                      : {
                          duration: frame.floatDuration,
                          delay: frame.floatDelay,
                          repeat: Infinity,
                          repeatType: "loop",
                          ease: "easeInOut",
                        }
                  }
                  className="relative"
                >
                  {/* ── Card ──────────────────────────────────────────── */}
                  <motion.div
                    className="relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer"
                    style={{
                      boxShadow: isActive
                        ? "0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)"
                        : "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
                    }}
                    animate={
                      shouldReduceMotion
                        ? {}
                        : isActive
                        ? { scale: [1, 1.025, 1] }
                        : { scale: 1 }
                    }
                    transition={
                      shouldReduceMotion
                        ? {}
                        : isActive
                        ? {
                            duration: 6,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "easeInOut",
                          }
                        : { duration: 0.5, ease: "easeOut" }
                    }
                    whileHover={
                      shouldReduceMotion
                        ? {}
                        : {
                            scale: 1.04,
                            transition: { duration: 0.35, ease: "easeOut" },
                          }
                    }
                    onClick={() => setActiveIdx(i)}
                  >
                    {/* ── Image ─────────────────────────────────────── */}
                    <img
                      src={frame.src}
                      alt={frame.alt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover object-top"
                      draggable={false}
                    />

                    {/* ── Gradient overlay ──────────────────────────── */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

                    {/* ── Look label ────────────────────────────────── */}
                    <motion.div
                      className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isActive ? 1 : 0.55 }}
                      transition={{ duration: 0.4 }}
                    >
                      <span className="text-white/90 text-[10px] font-medium tracking-[0.18em] uppercase">
                        {frame.look}
                      </span>
                      {/* Active indicator dot */}
                      {isActive && (
                        <motion.span
                          className="w-1.5 h-1.5 rounded-full bg-white"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ duration: 0.25 }}
                        />
                      )}
                    </motion.div>

                    {/* ── Active frame border ring ───────────────────── */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isActive ? 1 : 0 }}
                      transition={{ duration: 0.35 }}
                      style={{ borderColor: "rgba(255,255,255,0.35)" }}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Runway progress bar ─────────────────────────────────────── */}
        {!shouldReduceMotion && (
          <div className="flex justify-center gap-2 mt-6">
            {FRAMES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                aria-label={`View look ${i + 1}`}
                className="relative h-0.5 rounded-full overflow-hidden focus-visible:outline-none"
                style={{ width: i === activeIdx ? 24 : 12, transition: "width 0.35s ease" }}
              >
                <span className="absolute inset-0 rounded-full bg-border" />
                {i === activeIdx && (
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-foreground"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: PULSE_INTERVAL_MS / 1000, ease: "linear" }}
                    key={activeIdx}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
