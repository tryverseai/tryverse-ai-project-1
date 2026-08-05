import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Vertical drift in percent of the frame height. */
  distance?: number;
  /** Start slightly soft and resolve to sharp as the frame enters. */
  blurIn?: boolean;
  /** Slow scale-out for a breathing, cinematic feel. */
  scaleFrom?: number;
  priority?: boolean;
  overlay?: ReactNode;
};

/**
 * Campaign plate: an image that drifts, sharpens and settles as it crosses the viewport.
 * Transform/filter only, spring-damped, and completely inert under reduced motion.
 */
export function ParallaxImage({
  src,
  alt,
  className,
  imgClassName,
  distance = 10,
  blurIn = true,
  scaleFrom = 1.12,
  priority = false,
  overlay,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const eased = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.35 });

  const y = useTransform(eased, [0, 1], reduce ? ["0%", "0%"] : [`${-distance}%`, `${distance}%`]);
  const scale = useTransform(eased, [0, 0.5, 1], reduce ? [1, 1, 1] : [scaleFrom, 1.02, scaleFrom * 0.98]);
  const filter = useTransform(eased, [0, 0.28, 1], reduce || !blurIn ? ["none", "none", "none"] : ["blur(14px)", "blur(0px)", "blur(0px)"]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        style={{ y, scale, filter }}
        className={cn("h-full w-full object-cover will-change-transform", imgClassName)}
      />
      {overlay}
    </div>
  );
}

/**
 * Reveals an image from behind a wipe: the frame's clip opens while the picture
 * counter-scales, so the subject appears to be uncovered rather than faded in.
 */
export function MaskedImage({
  src,
  alt,
  className,
  imgClassName,
  delay = 0,
  from = "bottom",
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  delay?: number;
  from?: "bottom" | "left";
}) {
  const reduce = useReducedMotion();
  const hidden =
    from === "left" ? { clipPath: "inset(0 100% 0 0)" } : { clipPath: "inset(100% 0 0 0)" };

  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      initial={reduce ? { opacity: 0 } : hidden}
      whileInView={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: reduce ? 0.3 : 1.15, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        initial={reduce ? false : { scale: 1.18 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={{ duration: reduce ? 0 : 1.5, delay, ease: [0.16, 1, 0.3, 1] }}
        className={cn("h-full w-full object-cover will-change-transform", imgClassName)}
      />
    </motion.div>
  );
}
