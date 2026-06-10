import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { HeroExperience } from "@/components/HeroExperience";
import { EditorialBreak } from "@/components/EditorialBreak";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import runwayFrame2 from "@/assets/runway-frame-2.jpg";
import runwayFrame3 from "@/assets/runway-frame-3.jpg";

const FEATURES = [
  {
    n: "01",
    title: "AI Virtual Try-On",
    body: "Hyper-realistic garment draping and texture mapping tailored to the individual customer photo.",
  },
  {
    n: "02",
    title: "Product Page Integration",
    body: "Embed into Shopify, Magento, or custom headless builds with three lines of code.",
  },
  {
    n: "03",
    title: "Conversion Analytics",
    body: "Track exactly how virtual fitting correlates with purchase intent and revenue lift.",
  },
  {
    n: "04",
    title: "Customer Insights",
    body: "Understand fit preferences and sizing trends across your global customer base.",
  },
  {
    n: "05",
    title: "Brand Dashboard",
    body: "Centralised control over your digital asset catalogue and try-on performance.",
  },
  {
    n: "06",
    title: "Enterprise API",
    body: "Robust endpoints for high-volume designers and global retail infrastructure.",
  },
];

const TRUST = ["Fashion Brands", "Retailers", "Designers", "E-commerce", "Ateliers"];

const BRAND_TIERS = [
  {
    name: "Starter",
    price: "$99",
    cadence: "/mo",
    features: ["1,000 Try-Ons", "Core API", "Standard Dashboard"],
    cta: "Book a Demo",
    href: "/book-demo",
    popular: false,
  },
  {
    name: "Growth",
    price: "$299",
    cadence: "/mo",
    features: ["5,000 Try-Ons", "Advanced Analytics", "Priority Rendering"],
    cta: "Book a Demo",
    href: "/book-demo",
    popular: true,
  },
  {
    name: "Scale",
    price: "$799",
    cadence: "/mo",
    features: ["20,000 Try-Ons", "Dedicated Pipeline", "Team Seats"],
    cta: "Book a Demo",
    href: "/book-demo",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    features: ["Unlimited Usage", "White-label UI", "SLA & Support"],
    cta: "Contact Sales",
    href: "/book-demo",
    popular: false,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground font-body selection:bg-foreground/10">
      <Helmet>
        <title>TryVerse AI — Virtual Try-On for Fashion Brands</title>
        <meta
          name="description"
          content="B2B AI virtual try-on for fashion brands and e-commerce retailers. Embed try-on on your product pages, reduce returns, and increase conversions."
        />
        <link rel="canonical" href="https://tryverseai.com/" />
      </Helmet>

      <LandingNav />

      {/* Hero — full-screen sequential fashion experience */}
      <HeroExperience />

      {/* Editorial break — black dress portrait */}
      <EditorialBreak
        src={runwayFrame2}
        alt="Editorial campaign — model in black dress"
        focal="50% 25%"
      />

      {/* Brand positioning */}
      <section className="relative pt-24 pb-24 md:pt-32 md:pb-32 border-t border-border">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-4xl mb-4">
            <div className="mb-6 inline-flex items-center space-x-2">
              <span className="size-2 rounded-full bg-foreground animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-tighter text-muted-foreground">
                Now Integrated with FASHN AI
              </span>
            </div>
            <h2 className="font-editorial text-5xl md:text-7xl lg:text-8xl font-medium leading-[0.95] tracking-tighter text-balance mb-8">
              Let Customers <span className="italic">Try</span> Before They Buy
            </h2>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <p className="max-w-md text-lg text-muted-foreground leading-relaxed text-pretty">
                Integrate AI virtual try-on into your storefront in minutes. Help customers
                visualise products, reduce returns, and improve conversion across your entire
                catalogue.
              </p>
              <div className="flex flex-wrap gap-4 shrink-0">
                <Link
                  to="/book-demo"
                  className="bg-foreground text-background px-8 py-4 text-xs font-medium uppercase tracking-widest hover:opacity-80 transition-all duration-300"
                >
                  Book a Demo
                </Link>
                <Link
                  to="/auth?signup=business"
                  className="border border-foreground px-8 py-4 text-xs font-medium uppercase tracking-widest hover:bg-foreground hover:text-background transition-all duration-300"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial break — emerald dress */}
      <EditorialBreak
        src={runwayFrame3}
        alt="Editorial campaign — model in blue dress"
        focal="50% 30%"
        height="min(80vh, 900px)"
      />

      {/* Trust strip */}
      <section className="py-12 border-y border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6 text-center">
            Built for
          </p>
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 opacity-60">
            {TRUST.map((t) => (
              <span key={t} className="font-editorial text-lg md:text-xl tracking-wide italic">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32 bg-card">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
              Platform
            </p>
            <h2 className="font-editorial text-4xl md:text-5xl tracking-tight">
              Infrastructure for <span className="italic">visual commerce</span>.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 border border-border">
            {FEATURES.map((f, i) => (
              <div
                key={f.n}
                className={`bg-card p-10 md:p-12 border-b border-r border-border hover:bg-background transition-colors ${
                  i === FEATURES.length - 1 ? "border-b-0" : ""
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground block mb-8">
                  {f.n}
                </span>
                <h3 className="text-2xl font-editorial italic mb-4">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 md:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
                For Brands
              </p>
              <h2 className="font-editorial text-4xl md:text-5xl tracking-tight">
                Ready for the <span className="italic">runway</span>.
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Usage-based overages on every plan. Switch tiers as your catalogue grows.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {BRAND_TIERS.map((t) => (
              <div
                key={t.name}
                className={`p-8 relative ${
                  t.popular
                    ? "border-2 border-foreground bg-card"
                    : "border border-border bg-card/50"
                }`}
              >
                {t.popular && (
                  <div className="absolute top-0 right-0 bg-foreground text-background px-3 py-1 text-[8px] font-mono uppercase tracking-widest -translate-y-1/2 mr-6">
                    Most Popular
                  </div>
                )}
                <p className="font-mono text-[10px] uppercase mb-10">{t.name}</p>
                <div className="mb-8">
                  <span className="text-4xl font-editorial italic">{t.price}</span>
                  <span className="text-xs text-muted-foreground font-mono">{t.cadence}</span>
                </div>
                <ul className="space-y-4 mb-10 text-sm text-muted-foreground">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="size-1 bg-foreground rounded-full" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={t.href}
                  className={`block text-center w-full py-4 text-[10px] font-mono uppercase tracking-widest transition-all ${
                    t.popular
                      ? "bg-foreground text-background hover:opacity-80"
                      : "border border-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 bg-foreground text-background">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-editorial text-4xl md:text-6xl tracking-tight mb-8 text-balance">
            Bring the <span className="italic">fitting room</span> online.
          </h2>
          <p className="text-base md:text-lg opacity-60 mb-12 max-w-xl mx-auto">
            Book a private demo. Access is invitation-only.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/book-demo"
              className="bg-background text-foreground px-8 py-4 text-xs font-medium uppercase tracking-widest hover:opacity-90 transition-all duration-300"
            >
              Book a Demo
            </Link>
            <Link
              to="/auth?signup=business"
              className="border border-background px-8 py-4 text-xs font-medium uppercase tracking-widest hover:bg-background hover:text-foreground transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default Index;
