import { Link } from "react-router-dom";
import { SocialIcons } from "@/components/SocialIcons";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { Reveal } from "@/components/motion/Reveal";

type FooterLink = { label: string; href: string; cookieSettings?: boolean; external?: boolean };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Enterprise", href: "/#platform" },
      { label: "Partner with us", href: "/partner" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Book a demo", href: "/book-demo" },
      { label: "Support", href: "/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Data processing", href: "/data-processing" },
      { label: "Cookie policy", href: "/cookie-policy" },
      { label: "Acceptable use", href: "/acceptable-use" },
      { label: "Cookie settings", href: "#", cookieSettings: true },
    ],
  },
];

function FooterAnchor({ link }: { link: FooterLink }) {
  const cls =
    "underline-sweep inline-block text-[0.8125rem] text-[hsl(40_16%_95%/0.6)] transition-colors duration-200 hover:text-[hsl(40_16%_95%)]";

  if (link.cookieSettings) {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("tryverse-reset-cookie-consent"))}
        className={cls}
      >
        {link.label}
      </button>
    );
  }
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {link.label}
      </a>
    );
  }
  if (link.href.startsWith("/")) {
    return (
      <Link to={link.href} className={cls}>
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.href} className={cls}>
      {link.label}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[hsl(40_16%_95%/0.12)] bg-[hsl(var(--ink))]">
      <div className="mx-auto w-full max-w-[78rem] px-6 md:px-10">
        <div className="grid gap-12 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
          <div>
            <Link to="/" className="inline-flex transition-opacity hover:opacity-70">
              <TryVerseLogo height={30} invert />
            </Link>
            <p className="type-caption mt-4 max-w-xs text-pretty text-[hsl(40_16%_95%/0.55)]">
              AI infrastructure for fashion visualization. Virtual try-on, AI model photography, and campaign
              content — from a single platform, embedded directly in your storefront.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="type-eyebrow mb-5 text-[hsl(40_16%_95%/0.45)]">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-5 border-t border-[hsl(40_16%_95%/0.12)] py-8 sm:flex-row">
          <span className="type-caption text-[hsl(40_16%_95%/0.5)]">
            © {new Date().getFullYear()} TryVerse AI. All rights reserved.
          </span>
          <SocialIcons linkClassName="text-[hsl(40_16%_95%/0.55)] hover:text-[hsl(40_16%_95%)]" />
        </div>

        {/* Oversized wordmark — the type is the graphic. Last element on the page, deliberately. */}
        <Reveal className="overflow-hidden border-t border-[hsl(40_16%_95%/0.12)] py-12 md:py-16">
          <p
            aria-hidden="true"
            className="select-none font-display leading-[0.8] tracking-[-0.045em] text-[hsl(40_16%_95%)]"
            style={{ fontSize: "clamp(4rem, 17vw, 15rem)" }}
          >
            TryVerse
          </p>
        </Reveal>
      </div>
    </footer>
  );
}
