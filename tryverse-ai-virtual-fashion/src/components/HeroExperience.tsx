import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import runwayFrame1 from "@/assets/runway-frame-1.jpg";
import runwayFrame2 from "@/assets/runway-frame-2.jpg";
import runwayFrame3 from "@/assets/runway-frame-3.jpg";
import runwayFrame4 from "@/assets/runway-frame-4.jpg";
import { TryVerseLogo } from "@/components/TryVerseLogo";

const LOOKS = [runwayFrame1, runwayFrame2, runwayFrame4, runwayFrame3];

type Stage = 0 | 1 | 2 | 3;

export function HeroExperience() {
  const [stage, setStage] = useState<Stage>(0);
  const [look, setLook] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 24, mass: 0.4 });

  const imgY = useTransform(smooth, [0, 1], ["0%", "18%"]);
  const imgScale = useTransform(smooth, [0, 1], [1, 1.08]);
  const titleProgress = useTransform(smooth, [0, 0.35], [0, 1]);
  const titleOpacity = useTransform(titleProgress, [0, 1], [0, 1]);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1400);
    const t2 = setTimeout(() => setStage(2), 2200);
    const t3 = setTimeout(() => setStage(3), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (stage < 3) return;
    const id = setInterval(() => {
      setLook((l) => (l + 1) % LOOKS.length);
    }, 5200);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    LOOKS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="TryVerse AI"
      className="relative w-full bg-background overflow-hidden"
      style={{ minHeight: "100svh" }}
    >
      {/* Stage 0: centred logo intro */}
      <AnimatePresence>
        {stage === 0 && (
          <motion.div
            key="intro-logo"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.5 } }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-background"
          >
            <TryVerseLogo height={80} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image card: small reveal → full-bleed */}
      <motion.div
        aria-hidden={stage < 1}
        initial={false}
        animate={
          stage === 1
            ? {
                opacity: 1,
                width: "min(240px, 56vw)",
                height: "min(320px, 70vw)",
                top: "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                borderRadius: 4,
              }
            : stage >= 2
              ? {
                  opacity: 1,
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  x: 0,
                  y: 0,
                  borderRadius: 0,
                }
              : { opacity: 0 }
        }
        transition={{
          duration: stage === 2 ? 1.5 : 0.9,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="absolute z-10 overflow-hidden bg-card ring-1 ring-black/5"
      >
        <motion.div
          style={{ y: stage === 3 ? imgY : 0, scale: stage === 3 ? imgScale : 1 }}
          className="absolute inset-0"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={look}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <motion.img
                src={LOOKS[look]}
                alt=""
                animate={{
                  scale: [1, 1.018, 1.008, 1.022, 1],
                  x: [0, -3, 1, -2, 0],
                  y: [0, -2, 1, -1, 0],
                }}
                transition={{
                  duration: 11,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 h-full w-full object-cover object-top will-change-transform"
                loading="eager"
                draggable={false}
              />
              <motion.div
                aria-hidden
                animate={{ opacity: [0.0, 0.06, 0.0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-foreground mix-blend-overlay"
              />
            </motion.div>
          </AnimatePresence>

          {/* Radial vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 35% 40%, transparent 45%, rgba(0,0,0,0.28) 100%)",
            }}
          />
          {/* Bottom gradient for text legibility */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        </motion.div>
      </motion.div>

      {/* Stage 3: editorial overlay */}
      <AnimatePresence>
        {stage === 3 && (
          <motion.div
            key="hero-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            <div className="relative h-full mx-auto max-w-[1600px] px-6 md:px-12">
              {/* Top-left status tag */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="absolute top-24 left-6 md:left-12 flex items-center gap-3 text-white/85"
              >
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
                  AI Virtual Try-On · Enterprise
                </span>
              </motion.div>

              {/* Top-right editorial meta */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="hidden md:flex absolute top-24 right-12 flex-col items-end gap-2 text-white/70"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
                  Spring / Summer · 26
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em]">N° 001</span>
              </motion.div>

              {/* Editorial wordmark — lower-left */}
              <motion.div
                style={{ opacity: titleOpacity }}
                animate={{ opacity: stage === 3 ? 1 : 0, y: 0 }}
                initial={{ y: 30 }}
                transition={{ delay: 0.2, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-6 md:left-12 bottom-16 md:bottom-12 max-w-[92vw]"
              >
                <h1
                  className="font-editorial font-medium text-white leading-[0.82] tracking-[-0.04em] text-balance"
                  style={{ fontSize: "clamp(4.5rem, 17vw, 18rem)" }}
                >
                  TryVerse
                  <span className="italic font-light"> AI</span>
                </h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.0, duration: 0.9 }}
                  className="mt-4 md:mt-6 max-w-md font-mono text-[10px] md:text-xs uppercase tracking-[0.28em] text-white/75"
                >
                  One person · Endless wardrobes · Instantly rendered
                </motion.p>
              </motion.div>

              {/* Bottom-right scroll hint */}
              <div className="absolute bottom-6 right-6 md:right-12 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
                Scroll ↓
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
