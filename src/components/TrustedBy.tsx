import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Brand colors from official guidelines. Magento/Amazon: CDN + local fallback. Wix, Canva, Figma, etc.: assets in /public/logos.
const integrations = [
  { name: "Shopify", logo: "https://cdn.simpleicons.org/shopify/7AB55C" },
  { name: "WooCommerce", logo: "https://cdn.simpleicons.org/woocommerce/96588A" },
  { name: "Magento", logo: "https://static.cdnlogo.com/logos/m/21/magento.svg", fallback: "/logos/magento.svg" },
  { name: "BigCommerce", logo: "https://cdn.simpleicons.org/bigcommerce/0F834D" },
  { name: "Wix", logo: "/logos/wix.png" },
  { name: "Squarespace", logo: "https://cdn.simpleicons.org/squarespace/333333" },
  { name: "PrestaShop", logo: "https://cdn.simpleicons.org/prestashop/DF0067" },
  { name: "Webflow", logo: "https://cdn.simpleicons.org/webflow/146EF5" },
  { name: "Framer", logo: "https://cdn.simpleicons.org/framer/0055FF" },
  { name: "Canva", logo: "/logos/canva.png" },
  { name: "Figma", logo: "/logos/figma.png" },
  { name: "WordPress", logo: "/logos/wordpress.png" },
  { name: "Hostinger", logo: "/logos/hostinger.png" },
  { name: "Amazon", logo: "https://static.cdnlogo.com/logos/a/83/amazon-com.svg", fallback: "/logos/amazon.svg" },
];

/**
 * Map horizontal screen position → depth + scale + yaw so logos follow a shallow
 * circular arc (like a watch band): largest / closest at viewport center, smaller / further at edges.
 */
function bandTransform(cx: number, viewportCenterX: number, halfViewportW: number) {
  const tRaw = (cx - viewportCenterX) / Math.max(halfViewportW, 1);
  const t = Math.max(-1, Math.min(1, tRaw));
  // Circular falloff: w=1 at center, w=0 at left/right (cos(±π/2)=0)
  const w = Math.cos((Math.PI / 2) * t);
  // Medium band: slight depth without shrinking edge logos too much
  const scale = 0.9 + 0.1 * w;
  const translateZ = 48 * w;
  const rotateY = t * -16;
  return { scale, translateZ, rotateY };
}

export function TrustedBy() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(reduce.matches);
    const onChange = () => setReducedMotion(reduce.matches);
    reduce.addEventListener("change", onChange);
    let raf = 0;

    const tick = () => {
      const vw = window.innerWidth;
      const centerX = vw / 2;
      const halfW = vw / 2;

      itemRefs.current.forEach((el) => {
        if (!el) return;
        if (reduce.matches) {
          el.style.transform = "";
          return;
        }
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const { scale, translateZ, rotateY } = bandTransform(cx, centerX, halfW);
        el.style.transform = `translateZ(${translateZ}px) scale(${scale}) rotateY(${rotateY}deg)`;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      reduce.removeEventListener("change", onChange);
    };
  }, []);

  // Reduced motion: show one static, wrapped row instead of the duplicated infinite-scroll strip.
  const items = reducedMotion ? integrations : [...integrations, ...integrations];

  return (
    <section className="py-16 border-y border-border/40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-[0.2em] mb-10">
            Works with the stacks brands use
          </p>

          {/* Extra vertical padding so translateZ doesn’t clip against overflow */}
          <div className="trusted-by-stage relative w-full overflow-hidden py-7 sm:py-8">
            <div
              className={cn(
                "trusted-by-track flex will-change-transform",
                reducedMotion ? "w-full flex-wrap justify-center" : "w-max animate-marquee"
              )}
            >
              {items.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className="trusted-by-logo-item flex items-center justify-center shrink-0 mx-3.5 sm:mx-4 w-28 h-14 sm:w-[7.5rem] sm:h-[3.625rem]"
                >
                  <img
                    src={item.logo}
                    alt={item.name}
                    className="h-9 w-auto max-w-full max-h-full object-contain sm:h-11 pointer-events-none select-none"
                    onError={(e) => {
                      if (item.fallback) {
                        e.currentTarget.src = item.fallback;
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
