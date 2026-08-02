import { motion, useScroll, useSpring } from "framer-motion";

/** Hairline reading-progress rule pinned under the navbar. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed left-0 top-0 z-[60] h-px w-full origin-left bg-foreground/70"
    />
  );
}
