import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

type Slide = { src: string; alt: string };

/** Card width fits the viewport on phones instead of being clipped by it; spacing scales with it so neighbours still peek in at the same proportion. */
function useResponsiveCardMetrics() {
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const measure = () => setWidth(Math.min(560, window.innerWidth * 0.84));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return { cardWidth: width, spacing: width * 0.6 };
}

/**
 * One floating card. Its position along the arc is entirely a function of
 * `offset` = its own index minus the current (continuous, scroll-driven) active
 * index — so cards smoothly interpolate through center as the user scrolls,
 * rather than snapping between discrete states.
 */
function VoyagerCard({
  slide,
  i,
  activeIndex,
  reduce,
  cardWidth,
  spacing,
}: {
  slide: Slide;
  i: number;
  activeIndex: MotionValue<number>;
  reduce: boolean;
  cardWidth: number;
  spacing: number;
}) {
  const x = useTransform(activeIndex, (v) => {
    const offset = i - v;
    return `calc(-50% + ${offset * spacing}px)`;
  });
  const rotateY = useTransform(activeIndex, (v) => {
    const offset = i - v;
    return reduce ? 0 : Math.max(-38, Math.min(38, offset * -32));
  });
  const scale = useTransform(activeIndex, (v) => {
    const offset = Math.abs(i - v);
    return Math.max(0.72, 1 - offset * 0.16);
  });
  const opacity = useTransform(activeIndex, (v) => {
    const offset = Math.abs(i - v);
    return Math.max(0, 1 - offset * 0.45);
  });
  const zIndex = useTransform(activeIndex, (v) => Math.round(100 - Math.abs(i - v) * 10));

  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        y: "-50%",
        x,
        rotateY,
        scale,
        opacity,
        zIndex,
        width: cardWidth,
      }}
      className="pointer-events-none aspect-[1280/1220] overflow-hidden rounded-[1.25rem] border border-border bg-secondary shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
    >
      <img src={slide.src} alt={slide.alt} loading="lazy" decoding="async" className="h-full w-full object-contain" />
    </motion.div>
  );
}

/**
 * Scroll-pinned 3D carousel: the stage stays fixed while scroll position drives
 * a continuous "active index" across the slide set, curving neighbours away in
 * perspective. No carousel state, no arrows — the scrollbar is the only control.
 */
export function VoyagerShowcase({ slides }: { slides: Slide[] }) {
  const reduce = Boolean(useReducedMotion());
  const ref = useRef<HTMLDivElement>(null);
  const n = slides.length;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const activeIndex = useTransform(scrollYProgress, [0, 1], [0, n - 1]);
  const { cardWidth, spacing } = useResponsiveCardMetrics();

  return (
    <div ref={ref} className="relative" style={{ height: `${n * 62}vh` }}>
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
        <div className="relative h-[min(78vh,620px)] w-full md:h-[min(68vh,620px)]" style={{ perspective: 1600 }}>
          {slides.map((slide, i) => (
            <VoyagerCard
              key={slide.src}
              slide={slide}
              i={i}
              activeIndex={activeIndex}
              reduce={reduce}
              cardWidth={cardWidth}
              spacing={spacing}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
