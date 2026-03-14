import { motion } from "framer-motion";

const integrations = [
  "Shopify", "WooCommerce", "Magento", "BigCommerce", "Custom Stores", "Headless Commerce"
];

export function TrustedBy() {
  return (
    <section className="py-16 border-y border-border/40">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-[0.2em] mb-10">
            Works with your favorite platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {integrations.map((name) => (
              <span
                key={name}
                className="font-display text-lg md:text-xl font-semibold text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors cursor-default select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
