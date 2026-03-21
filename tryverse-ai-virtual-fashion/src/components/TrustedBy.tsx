import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Brand colors from official guidelines. Magento: fallback to local SVG if CDN fails.
const integrations = [
  { name: "Shopify", logo: "https://cdn.simpleicons.org/shopify/7AB55C" },
  { name: "WooCommerce", logo: "https://cdn.simpleicons.org/woocommerce/96588A" },
  { name: "Magento", logo: "https://static.cdnlogo.com/logos/m/21/magento.svg", fallback: "/logos/magento.svg" },
  { name: "BigCommerce", logo: "https://cdn.simpleicons.org/bigcommerce/0F834D" },
  { name: "Wix", logo: "https://cdn.simpleicons.org/wix/0C6EFC" },
  { name: "Squarespace", logo: "https://cdn.simpleicons.org/squarespace/333333" },
  { name: "PrestaShop", logo: "https://cdn.simpleicons.org/prestashop/DF0067" },
  { name: "Webflow", logo: "https://cdn.simpleicons.org/webflow/146EF5" },
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
  const scale = 0.74 + 0.26 * w;
  const translateZ = 52 * w;
  const rotateY = t * -20;
  return { scale, translateZ, rotateY };
}

export function TrustedBy() {
  const duplicated = [...integrations, ...integrations];
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="py-16 border-y border-border/40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-[0.2em] mb-10">
            Works with your favorite platforms
          </p>

          {/* Extra vertical padding so translateZ doesn’t clip against overflow */}
          <div className="trusted-by-stage relative w-full overflow-hidden py-6 sm:py-8">
            <div className="trusted-by-track flex w-max animate-marquee will-change-transform">
              {duplicated.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className="trusted-by-logo-item flex items-center justify-center shrink-0 mx-3 sm:mx-4 w-24 h-12"
                >
                  <img
                    src={item.logo}
                    alt={item.name}
                    className="h-8 w-auto max-w-full object-contain pointer-events-none select-none"
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
