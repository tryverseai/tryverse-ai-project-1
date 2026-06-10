import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface EditorialBreakProps {
  src: string;
  alt: string;
  height?: string;
  focal?: string;
}

export function EditorialBreak({
  src,
  alt,
  height = "min(100vh, 1100px)",
  focal = "center",
}: EditorialBreakProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1.02, 1.08]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0.85]);

  return (
    <section
      ref={ref}
      aria-label={alt}
      className="relative w-screen overflow-hidden bg-background"
      style={{
        height,
        marginLeft: "calc(-50vw + 50%)",
        marginRight: "calc(-50vw + 50%)",
        width: "100vw",
      }}
    >
      <motion.div style={{ y, scale, opacity }} className="absolute inset-0">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: focal }}
        />
      </motion.div>
    </section>
  );
}
