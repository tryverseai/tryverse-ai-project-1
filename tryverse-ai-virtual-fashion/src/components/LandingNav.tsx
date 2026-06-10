import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { TryVerseLogo } from "@/components/TryVerseLogo";

export function LandingNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const overlay = isHome && !scrolled;

  const navBg = overlay
    ? "bg-transparent"
    : "bg-background/90 backdrop-blur-md border-b border-border";
  const fg = overlay ? "text-white" : "text-foreground";
  const fgMuted = overlay
    ? "text-white/80 hover:text-white"
    : "text-muted-foreground hover:text-foreground";
  const ctaBase = overlay
    ? "bg-white text-black hover:bg-white/90"
    : "bg-foreground text-background hover:opacity-80";

  const navLinks = [
    { label: "Platform", href: "/#features" },
    { label: "Partner with us", href: "/partner" },
    { label: "About", href: "/about" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-500",
        navBg,
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6 md:px-12">
        {/* Logo */}
        <Link
          to="/"
          onClick={() => {
            if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={cn("flex items-center transition-opacity hover:opacity-90", fg)}
        >
          {overlay ? (
            <TryVerseLogo height={48} invert />
          ) : (
            <TryVerseLogo height={48} />
          )}
        </Link>

        {/* Desktop nav links */}
        <div
          className={cn(
            "hidden md:flex items-center space-x-8 text-[10px] font-mono uppercase tracking-[0.28em]",
            fgMuted,
          )}
        >
          {navLinks.map((link) =>
            link.href.startsWith("/#") ? (
              <a key={link.href} href={link.href} className="transition-colors">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} to={link.href} className="transition-colors">
                {link.label}
              </Link>
            ),
          )}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className={cn(
                  "text-[10px] font-mono uppercase tracking-[0.28em] transition-colors",
                  fgMuted,
                )}
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.28em] transition-colors",
                  fgMuted,
                )}
              >
                <LogOut className="h-3 w-3" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className={cn(
                  "text-[10px] font-mono uppercase tracking-[0.28em] transition-colors",
                  fgMuted,
                )}
              >
                Login
              </Link>
              <Link
                to="/book-demo"
                className={cn(
                  "px-5 py-2.5 text-[10px] font-mono uppercase tracking-[0.28em] transition-colors duration-300",
                  ctaBase,
                )}
              >
                Book a Demo
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className={cn("md:hidden p-2 -mr-2 rounded-md", fgMuted)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden bg-background border-b border-border transition-all duration-300 ease-out",
          mobileOpen
            ? "max-h-[85vh] opacity-100"
            : "max-h-0 opacity-0 pointer-events-none",
        )}
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          {navLinks.map((link) =>
            link.href.startsWith("/#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {link.label}
              </Link>
            ),
          )}
          <div className="pt-2 flex flex-col gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 text-center text-[10px] font-mono uppercase tracking-widest bg-foreground text-background"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                    setMobileOpen(false);
                  }}
                  className="w-full py-3 text-center text-[10px] font-mono uppercase tracking-widest border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 text-center text-[10px] font-mono uppercase tracking-widest border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/book-demo"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 text-center text-[10px] font-mono uppercase tracking-widest bg-foreground text-background hover:opacity-80 transition-opacity"
                >
                  Book a Demo
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
