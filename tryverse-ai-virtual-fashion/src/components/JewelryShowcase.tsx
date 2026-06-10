import { motion, useReducedMotion } from "framer-motion";
import galleryBlackGirlPortrait from "@/assets/gallery-black-girl-portrait.jpg";
import jewelrySunglasses from "@/assets/jewelry-sunglasses.jpg";
import galleryWhiteGirlBlack from "@/assets/gallery-white-girl-black.jpg";
import jewelryEarrings from "@/assets/jewelry-earrings.jpg";

const FRAMES = [
  {
    src: galleryBlackGirlPortrait,
    alt: "Model portrait — virtual try-on reference",
  },
  {
    src: jewelrySunglasses,
    alt: "Model wearing sunglasses and gold earrings",
  },
  {
    src: galleryWhiteGirlBlack,
    alt: "Model in black top — virtual try-on",
  },
  {
    src: jewelryEarrings,
    alt: "Model wearing gold hoop earrings",
  },
] as const;

const FLOAT_DURATIONS = [60, 63, 57, 65];
const FLOAT_AMPLITUDE = 10;

export function JewelryShowcase() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="py-16 md:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {FRAMES.map((frame, i) => (
            <motion.div
              key={i}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
              className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30 aspect-[3/4]"
            >
              <motion.div
                className="w-full h-full"
                animate={shouldReduceMotion ? {} : { y: [0, -FLOAT_AMPLITUDE, 0] }}
                transition={
                  shouldReduceMotion
                    ? {}
                    : {
                        duration: FLOAT_DURATIONS[i],
                        repeat: Infinity,
                        repeatType: "loop",
                        ease: "easeInOut",
                        delay: i * 4,
                      }
                }
              >
                <img
                  src={frame.src}
                  alt={frame.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover object-top"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent pointer-events-none" />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
