import { motion } from "framer-motion";
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

export function JewelryShowcase() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs font-medium text-muted-foreground uppercase tracking-[0.2em]"
          >
            Accessories & Jewelry Try-On
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="mt-2 text-sm italic text-muted-foreground"
          >
            Coming Soon
          </motion.p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {photos.map((photo, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: "easeOut" }}
              whileHover={{ scale: 1.03 }}
              className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30 aspect-[3/4]"
            >
              <AutoPlayVideo
                src={photo.video}
                poster={photo.poster}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
