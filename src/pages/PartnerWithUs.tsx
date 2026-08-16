import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GLASS_EASE, glassOuter, glassInner, glassInnerCard } from "@/lib/glassFrame";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, TrendingUp, ShieldCheck, Code2, Sparkles, Globe, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { Helmet } from "react-helmet-async";
import { useSignupChooser } from "@/components/signup/SignupChooserContext";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import partnerMirror from "@/assets/partner-mirror.jpg";

const benefits = [
  { icon: TrendingDown, title: "Reduce Purchase Uncertainty", description: "Help customers visualize products before committing." },
  { icon: TrendingUp, title: "Increase Conversion Rates", description: "Visual experiences help shoppers make faster buying decisions." },
  { icon: ShieldCheck, title: "Elevate Customer Experience", description: "Transform static product pages into interactive shopping experiences." },
  { icon: Code2, title: "Flexible Integration", description: "Ship with our SDK and API, or embed the widget — whatever fits your stack." },
];

const reasons = [
  { icon: Sparkles, title: "AI-Powered Try-On", description: "Let shoppers see products on themselves before buying." },
  { icon: Globe, title: "Global Scale", description: "Infrastructure built to scale with brands worldwide." },
  { icon: Zap, title: "Flexible Integration", description: "Connect TryVerse through APIs, SDKs, and commerce integrations built for modern fashion platforms." },
  { icon: Shield, title: "Enterprise Ready", description: "Secure, reliable, and designed for production workloads." },
];

const PartnerWithUs = () => {
  const { openSignupChooser } = useSignupChooser();
  return (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Partner With Us — TryVerse AI Infrastructure for Fashion Visualization</title>
      <meta name="description" content="Integrate TryVerse's fashion visualization platform into your commerce stack. Virtual try-on, AI model photography, and outfit visualization through APIs and SDKs." />
      <link rel="canonical" href="https://tryverseai.com/partner" />
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              {FEATURE_FLAGS.INVITE_ONLY_MODE ? (
                <>
                  <Button type="button" size="lg" className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12" onClick={() => openSignupChooser()}>
                    Sign Up <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link to="/book-demo">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12">
                      Book a Demo
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button type="button" size="lg" className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12" onClick={() => openSignupChooser()}>
                    Sign Up <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link to="/pricing">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12">
                      View pricing
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* A single photograph — confidence is the product being sold here, not just the code. */}
      <section aria-label="The confidence TryVerse sells" className="relative overflow-hidden bg-[hsl(var(--ink))]">
        <ParallaxImage
          src={partnerMirror}
          alt="A shopper checking her reflection in a mirror before going out"
          className="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]"
          distance={8}
          scaleFrom={1.1}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[hsl(var(--ink))] to-transparent"
          aria-hidden="true"
        />
        <p className="pointer-events-none absolute bottom-6 left-6 type-eyebrow text-[hsl(40_16%_95%/0.75)] md:bottom-8 md:left-10">
          The confidence your customers buy for
        </p>
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
                The Infrastructure Powering Fashion Visualization
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Integrate TryVerse into your commerce stack through APIs, SDKs, and storefront integrations. Deliver
                fashion visualization experiences directly inside your shopping journey without changing how your
                catalog works.
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

              <div className="flex flex-col sm:flex-row gap-3">
                {FEATURE_FLAGS.INVITE_ONLY_MODE ? (
                  <>
                    <Button type="button" size="lg" className="gradient-primary text-primary-foreground shadow-soft" onClick={() => openSignupChooser()}>
                      Sign Up <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Link to="/book-demo">
                      <Button size="lg" variant="outline">
                        Book a Demo
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Button type="button" size="lg" className="gradient-primary text-primary-foreground shadow-soft" onClick={() => openSignupChooser()}>
                      Sign Up <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Link to="/pricing">
                      <Button size="lg" variant="outline">
                        View pricing
                      </Button>
                    </Link>
                  </>
                )}
              </div>
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
                <p className="text-muted-foreground mb-2">{"// Server-side, with the TryVerse SDK"}</p>
                <p className="text-foreground">
                  <span className="text-foreground/70">import</span> {"{ TryVerse }"} <span className="text-foreground/70">from</span> <span className="text-foreground/60">"@tryverseai/sdk"</span>;
                </p>
                <p className="text-foreground mt-3">
                  <span className="text-foreground/70">const</span> tryverse = <span className="text-foreground/70">new</span> TryVerse();
                </p>
                <p className="text-foreground mt-3">
                  <span className="text-foreground/70">const</span> {"{ resultUrl }"} = <span className="text-foreground/70">await</span> tryverse.tryOn({"{"}
                </p>
                <p className="text-muted-foreground pl-4">personImage: <span className="text-foreground/60">shopperPhoto</span>,</p>
                <p className="text-muted-foreground pl-4">productImage: <span className="text-foreground/60">'PRODUCT_URL'</span>,</p>
                <p className="text-foreground">{"})"};</p>
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
};

export default PartnerWithUs;
