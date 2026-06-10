import { Link } from "react-router-dom";
import { TryVerseLogo } from "@/components/TryVerseLogo";

export function LandingFooter() {
  return (
    <footer className="py-20 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          {/* Brand block */}
          <div className="max-w-xs">
            <Link to="/" className="inline-flex items-center hover:opacity-90 transition-opacity mb-6">
              <TryVerseLogo height={44} />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The future of fashion is virtual. Elevate your brand with the industry's most
              advanced AI try-on engine.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest mb-6 text-foreground">
                Company
              </h4>
              <ul className="space-y-4 text-xs text-muted-foreground">
                <li>
                  <Link to="/about" className="hover:text-foreground transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/book-demo" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link to="/partner" className="hover:text-foreground transition-colors">
                    Partners
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest mb-6 text-foreground">
                Product
              </h4>
              <ul className="space-y-4 text-xs text-muted-foreground">
                <li>
                  <a href="/#features" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link to="/widget-guide" className="hover:text-foreground transition-colors">
                    API
                  </Link>
                </li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h4 className="font-mono text-[10px] uppercase tracking-widest mb-6 text-foreground">
                Get Access
              </h4>
              <Link
                to="/book-demo"
                className="inline-block bg-foreground text-background px-4 py-2.5 text-[10px] font-mono font-medium uppercase tracking-widest hover:opacity-80 transition-opacity"
              >
                Book a Demo
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-20 pt-8 border-t border-border flex flex-col sm:flex-row gap-4 justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          <span>© {new Date().getFullYear()} TryVerse AI. All rights reserved.</span>
          <div className="flex space-x-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to="/data-processing" className="hover:text-foreground transition-colors">
              Security
            </Link>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("tryverse-reset-cookie-consent"))
              }
              className="hover:text-foreground transition-colors text-left"
            >
              Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
