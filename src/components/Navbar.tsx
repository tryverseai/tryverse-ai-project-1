import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { TryVerseLogo } from "@/components/TryVerseLogo";

const publicLinks = [
  { label: "Platform", href: "/#platform" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Technology", href: "/technology" },
  { label: "Partner with us", href: "/partner" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  /** Solid chrome once the hero has scrolled past; transparent over the hero film. */
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();
  const reduce = useReducedMotion();

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 24);
        setHidden(y > 180 && y > lastY.current);
        lastY.current = y;
        frame = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isRoute = (href: string) => !href.includes("#");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-pill)] focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
      >
        Skip to content
      </a>

      <motion.header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled || open
            ? "border-b border-border bg-background/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        )}
        animate={{ y: hidden && !open ? "-100%" : "0%" }}
        transition={{ duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <nav
          aria-label="Primary"
          className="mx-auto flex h-[var(--navbar-height)] w-full max-w-[78rem] items-center justify-between gap-8 px-6 md:px-10"
        >
          <Link
            to="/"
            onClick={() => location.pathname === "/" && window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex flex-shrink-0 items-center text-foreground transition-opacity duration-200 hover:opacity-70"
            aria-label="TryVerse home"
          >
            <TryVerseLogo height={34} />
          </Link>

          <div className="hidden items-center gap-9 md:flex">
            {publicLinks.map((link) =>
              isRoute(link.href) ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "underline-sweep text-[0.8125rem] font-medium tracking-[-0.005em] transition-colors duration-200",
                    location.pathname === link.href ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="underline-sweep text-[0.8125rem] font-medium tracking-[-0.005em] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link to="/auth?signup=business">
                  <Button size="sm" className="group">
                    Start free
                    <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            className="fixed inset-0 z-40 flex flex-col bg-background pt-[var(--navbar-height)] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-1 flex-col justify-between overflow-y-auto px-6 pb-10 pt-8">
              <ul className="space-y-1">
                {publicLinks.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="border-b border-border"
                  >
                    {isRoute(link.href) ? (
                      <Link
                        to={link.href}
                        onClick={() => setOpen(false)}
                        className="type-title block py-4 text-foreground"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} onClick={() => setOpen(false)} className="type-title block py-4 text-foreground">
                        {link.label}
                      </a>
                    )}
                  </motion.li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3">
                {isAuthenticated ? (
                  <>
                    <Link to="/dashboard" onClick={() => setOpen(false)}>
                      <Button size="lg" className="w-full">
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        void handleSignOut();
                        setOpen(false);
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/auth?signup=business" onClick={() => setOpen(false)}>
                      <Button size="lg" className="w-full">
                        Start free
                      </Button>
                    </Link>
                    <Link to="/auth" onClick={() => setOpen(false)}>
                      <Button variant="outline" size="lg" className="w-full">
                        Log in
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
