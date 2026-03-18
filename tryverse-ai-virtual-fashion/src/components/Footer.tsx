import { Link } from "react-router-dom";
import { SocialIcons } from "@/components/SocialIcons";
import { TryVerseLogo } from "@/components/TryVerseLogo";

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-1">
            <Link to="/" className="inline-flex text-foreground hover:opacity-90 transition-opacity">
              <TryVerseLogo height={40} />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-xs">
              The AI infrastructure powering virtual try-on for global fashion commerce.
            </p>
          </div>
          {[
            {
              title: "Product",
              links: [
                { label: "Features", href: "/#features" },
                { label: "Partner with us", href: "/partner" },
                { label: "How It Works", href: "/#how-it-works" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About", href: "/about" },
                { label: "Careers", href: "#" },
                { label: "Press", href: "#" },
              ],
            },
            {
              title: "Resources",
              links: [
                { label: "Widget Guide", href: "/widget-guide" },
                { label: "Support", href: "/support" },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Data Processing", href: "/data-processing" },
                { label: "Cookie Settings", href: "#", cookieSettings: true },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <p className="font-display text-sm font-semibold text-foreground mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"cookieSettings" in link && link.cookieSettings ? (
                      <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("tryverse-reset-cookie-consent"))}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    ) : "external" in link && link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </a>
                    ) : link.href.startsWith("/") ? (
                      <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">© 2026 TryVerse AI. All rights reserved.</span>
          <SocialIcons />
        </div>
      </div>
    </footer>
  );
}
