import { motion, useReducedMotion } from "framer-motion";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import jewelryNecklace from "@/assets/jewelry-necklace.jpg";
import jewelrySunglasses from "@/assets/jewelry-sunglasses.jpg";
import jewelryHands from "@/assets/jewelry-hands.jpg";
import jewelryEarrings from "@/assets/jewelry-earrings.jpg";
import jewelryNecklaceVideo from "@/assets/jewelry-necklace-video.mp4";
import jewelrySunglassesVideo from "@/assets/jewelry-sunglasses-video.mp4";
import jewelryHandsVideo from "@/assets/jewelry-hands-video.mp4";
import jewelryEarringsVideo from "@/assets/jewelry-earrings-video.mp4";

const photos = [
  { video: jewelryNecklaceVideo, poster: jewelryNecklace, alt: "Gold pendant necklace on model" },
  { video: jewelrySunglassesVideo, poster: jewelrySunglasses, alt: "Model wearing sunglasses and gold earrings" },
  { video: jewelryHandsVideo, poster: jewelryHands, alt: "Hands adorned with gold rings and bracelets" },
  { video: jewelryEarringsVideo, poster: jewelryEarrings, alt: "Model wearing gold hoop earrings" },
];

/** Floating durations staggered per card so each drifts independently. */
const FLOAT_DURATIONS = [60, 63, 57, 65];
/** Vertical travel (px) — subtle so there is no layout shift. */
const FLOAT_AMPLITUDE = 10;

export function JewelryShowcase() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {photos.map((photo, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
              className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30 aspect-[3/4]"
            >
              {/* Continuous float layer — separate from the entry animation */}
              <motion.div
                className="w-full h-full"
                animate={
                  shouldReduceMotion
                    ? {}
                    : { y: [0, -FLOAT_AMPLITUDE, 0] }
                }
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
                <AutoPlayVideo
                  src={photo.video}
                  poster={photo.poster}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
