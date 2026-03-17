import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-1">
            <Link to="/" className="font-display text-lg font-bold text-foreground">
              TryVerse<span className="text-muted-foreground">.AI</span>
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
                { label: "For Brands", href: "/#for-brands" },
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
                { label: "API Docs", href: "/api-docs" },
                { label: "Support", href: "mailto:support@tryverse.ai", external: true },
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Data Processing", href: "/data-processing" },
                { label: "Admin", href: "/admin" },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <p className="font-display text-sm font-semibold text-foreground mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
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
        <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © 2026 TryVerse AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
