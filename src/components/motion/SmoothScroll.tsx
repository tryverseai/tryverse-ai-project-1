import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Global smooth scroll. Mounted once at the app root.
 *
 * Deliberately conservative: it defers entirely to `prefers-reduced-motion`, never
 * hijacks anchor jumps, and runs on rAF so framer-motion's scroll listeners stay in sync.
 */
export function SmoothScroll() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    // Touch devices already have native momentum; wrapping it degrades the feel.
    if (window.matchMedia("(hover: none)").matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
