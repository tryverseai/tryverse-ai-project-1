import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { glassOuter, glassInner } from "@/lib/glassFrame";
import { ArrowRight, TrendingDown, TrendingUp, ShieldCheck, Code2 } from "lucide-react";
import { Link } from "react-router-dom";

const benefits = [
  { icon: TrendingDown, title: "Help Reduce Returns", description: "Customers know how items fit before buying." },
  { icon: TrendingUp, title: "Boost Conversions", description: "Interactive try-on drives purchase confidence." },
  { icon: ShieldCheck, title: "Better Shopping Experience", description: "Delight customers with AI-powered personalization." },
  { icon: Code2, title: "Easy Widget Integration", description: "Embed virtual try-on into your store in minutes." },
];

export function ForBrandsSection() {
  return (
    <section id="for-brands" className="py-24 md:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">For Fashion Brands</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
              The Infrastructure Powering Virtual Try-On
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Integrate TryVerse AI into your e-commerce store, marketplace, or mobile app. Our widget handles the heavy lifting so you can focus on selling.
            </p>

            <div className="grid sm:grid-cols-2 gap-5 mb-8">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <b.icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <Link to="/pricing">
              <Button className="gradient-primary text-primary-foreground shadow-soft">
                Partner With Us <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={glassOuter}
          >
            <div className={cn(glassInner, "p-5 sm:p-6")}>
            {/* Widget installation snippet */}
            <div className="rounded-xl bg-foreground/[0.03] p-5 font-mono text-sm">
              <p className="text-muted-foreground mb-2">{"<!-- Add to your product page -->"}</p>
              <p className="text-foreground">
                {"<"}<span className="text-foreground/70">script</span> src=<span className="text-foreground/60">"https://tryverse.ai/widget.js"</span>{">"}
              </p>
              <p className="text-foreground">{"</"}<span className="text-foreground/70">script</span>{">"}</p>
              <p className="text-foreground mt-3">
                {"<"}<span className="text-foreground/70">button</span> onclick=<span className="text-foreground/60">"TryVerse.open({"{"}</span>
              </p>
              <p className="text-muted-foreground pl-4">apiKey: <span className="text-foreground/60">'YOUR_API_KEY'</span>,</p>
              <p className="text-muted-foreground pl-4">productImage: <span className="text-foreground/60">'PRODUCT_URL'</span></p>
              <p className="text-foreground"><span className="text-foreground/60">{"}"})</span>{"\">"}</p>
              <p className="text-foreground pl-2">Try It On</p>
              <p className="text-foreground">{"</"}<span className="text-foreground/70">button</span>{">"}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Powered", value: "AI" },
                { label: "Latency", value: "<1s" },
                { label: "Uptime", value: "99%" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 rounded-xl bg-foreground/[0.04]">
                  <p className="font-display text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
