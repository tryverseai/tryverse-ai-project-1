import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GLASS_EASE, glassOuter, glassInner, glassInnerCard } from "@/lib/glassFrame";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, TrendingUp, ShieldCheck, Code2, Sparkles, Globe, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const benefits = [
  { icon: TrendingDown, title: "Help Reduce Returns", description: "Customers know how items fit before buying." },
  { icon: TrendingUp, title: "Boost Conversions", description: "Interactive try-on drives purchase confidence." },
  { icon: ShieldCheck, title: "Better Shopping Experience", description: "Delight customers with AI-powered personalization." },
  { icon: Code2, title: "Easy Widget Integration", description: "Embed virtual try-on into your store in minutes." },
];

const reasons = [
  { icon: Sparkles, title: "AI-Powered Try-On", description: "Let shoppers see products on themselves before buying." },
  { icon: Globe, title: "Global Scale", description: "Infrastructure built to scale with brands worldwide." },
  { icon: Zap, title: "Simple Integration", description: "Embed TryVerse into your store with a few lines of code." },
  { icon: Shield, title: "Enterprise Ready", description: "Secure, reliable, and designed for production workloads." },
];

const PartnerWithUs = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Partner With Us — TryVerse AI Virtual Try-On</title>
      <meta name="description" content="Integrate TryVerse AI into your e-commerce store. The infrastructure powering virtual try-on for fashion brands. Reduce returns, boost conversions." />
      <link rel="canonical" href="https://tryverse.ai/partner" />
    </Helmet>
    <Navbar />
    <main className="pt-[var(--navbar-height)] pb-24">
      {/* Bring Your Collection to Life — first */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Partner With Us</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Bring Your Collection to Life
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Partner with TryVerse to give your customers the confidence to buy — and the experience that keeps them coming back.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
            {reasons.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, ease: GLASS_EASE }}
                whileHover={{ y: -4, transition: { duration: 0.65, ease: GLASS_EASE } }}
                className={glassOuter}
              >
                <div className={cn(glassInnerCard, "items-center text-center px-6 py-7 sm:px-7")}>
                  <div className="relative z-[2] w-11 h-11 rounded-xl bg-foreground/[0.06] flex items-center justify-center mb-5 mx-auto group-hover:gradient-primary group-hover:shadow-soft transition-all duration-300">
                    <item.icon className="h-5 w-5 text-foreground group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="relative z-[2] font-display text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="relative z-[2] text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center space-y-4">
            <Link to="/early-access">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12">
                Get Early Access <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Request early access — we&apos;ll reach out with demo options when it fits your brand.
            </p>
          </div>
        </div>
      </section>

      {/* The Infrastructure Powering Virtual Try-On */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
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
                    animate={{ opacity: 1, y: 0 }}
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

              <Link to="/early-access">
                <Button size="lg" className="gradient-primary text-primary-foreground shadow-soft">
                  Get Early Access <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={glassOuter}
            >
              <div className={cn(glassInner, "p-5 sm:p-6")}>
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
    </main>
    <Footer />
  </div>
);

export default PartnerWithUs;
