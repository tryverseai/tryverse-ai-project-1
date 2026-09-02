import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GLASS_EASE, glassOuter, glassInnerCard } from "@/lib/glassFrame";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, TrendingUp, ShieldCheck, Code2, Sparkles, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { Helmet } from "react-helmet-async";
import { useSignupChooser } from "@/components/signup/SignupChooserContext";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import partnerMirror from "@/assets/partner-mirror.jpg";

const benefits = [
  { icon: TrendingDown, title: "Reduce Purchase Uncertainty", description: "Help customers better understand how products could look before committing to a purchase." },
  { icon: ShieldCheck, title: "Create More Confident Shoppers", description: "Give customers richer product experiences that make online shopping feel more personal." },
  { icon: Sparkles, title: "Elevate Product Discovery", description: "Turn traditional product pages into interactive experiences that encourage customers to explore." },
  { icon: Code2, title: "Integrate Without Rebuilding", description: "Introduce TryVerse into your existing commerce environment while keeping your current catalog, storefront, and workflows intact." },
];

const reasons = [
  { icon: Sparkles, title: "Transform the Shopping Experience", description: "Turn static product discovery into an interactive experience that helps customers visualize products in a more meaningful way." },
  { icon: ImageIcon, title: "Expand Your Content Capabilities", description: "Create new ways to showcase collections, products, and campaigns across your digital channels." },
  { icon: TrendingUp, title: "Scale With Your Business", description: "Start with the experiences you need today and expand as your customers, catalog, and digital presence grow." },
  { icon: Code2, title: "Integrate Your Way", description: "Bring TryVerse into your existing commerce experience without changing how your catalog or storefront operates." },
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
      <section className="py-10 sm:py-16 md:py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Partner With Us</p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Build the Next Generation of Fashion Commerce
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Give your customers a more visual, interactive way to discover and experience your products. TryVerse
              gives fashion brands the infrastructure to introduce AI-powered experiences into their storefronts —
              helping shoppers understand products with greater confidence and making digital shopping feel more
              personal.
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
                  <Link to="/enterprise-contact">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12">
                      Talk to Enterprise
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* A single photograph — better visualization is the product being sold here, not just the code. */}
      <section aria-label="Why brands partner with TryVerse" className="relative overflow-hidden bg-[hsl(var(--ink))]">
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
          Better visualization. Better discovery. More confident shoppers.
        </p>
      </section>

      {/* The Infrastructure Powering Fashion Visualization */}
      <section className="py-14 sm:py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">For Fashion Brands</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                The Infrastructure Powering Fashion Visualization
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Your catalog already exists. Your storefront already works. TryVerse adds the visualization layer
                that makes digital fashion commerce more interactive. Integrate AI-powered fashion experiences
                directly into your existing customer journey and give shoppers more context before they make a
                purchase.
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
                    <Link to="/enterprise-contact">
                      <Button size="lg" variant="outline">
                        Talk to Enterprise
                      </Button>
                    </Link>
                  </>
                )}
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
