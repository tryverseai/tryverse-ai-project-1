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

export function TrustedBy() {
  const duplicated = [...integrations, ...integrations];

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

          <div className="relative w-full overflow-hidden">
            <div className="flex w-max animate-marquee will-change-transform">
              {duplicated.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="flex items-center justify-center shrink-0 mx-3 sm:mx-4 w-24 h-12 opacity-90 hover:opacity-100 transition-opacity duration-300"
                >
                  <img
                    src={item.logo}
                    alt={item.name}
                    className="h-8 w-auto object-contain"
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
