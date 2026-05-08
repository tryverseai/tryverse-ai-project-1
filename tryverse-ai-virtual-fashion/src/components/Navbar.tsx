import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useSignupChooser } from "@/components/signup/SignupChooserContext";

const publicLinks = [
  { label: "Product", href: "/#features" },
  { label: "Partner with us", href: "/partner" },
  { label: "About", href: "/about" },
];

const SPRING_TRANSITION = { type: "spring" as const, stiffness: 260, damping: 22 };

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { openSignupChooser } = useSignupChooser();
  const [isCompact, setIsCompact] = useState(false);
  /** Narrow “focus” layout only on md+ — on mobile full width avoids broken menu / tap targets */
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false
  );
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, signOut } = useAuth();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => setIsDesktop(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;
    const THROTTLE_MS = 120;
    const updateCompact = () => {
      if (!isDesktop) {
        setIsCompact(false);
        ticking.current = false;
        return;
      }
      const now = Date.now();
      if (now - lastUpdate < THROTTLE_MS) {
        ticking.current = false;
        return;
      }
      lastUpdate = now;
      const currentY = window.scrollY;
      if (currentY <= 20) {
        setIsCompact(false);
      } else if (currentY > lastScrollY.current) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
      lastScrollY.current = currentY;
      ticking.current = false;
    };
    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        rafId = requestAnimationFrame(updateCompact);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isDesktop]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const isRoute = (href: string) => !href.includes("#");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-md border-b border-border/40"
      initial={false}
      animate={{
        boxShadow: isCompact
          ? "0 4px 20px -4px rgba(0,0,0,0.12)"
          : "0 1px 0 0 rgba(0,0,0,0.06)",
      }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.div
        className="mx-auto flex items-center justify-between px-6 min-h-[56px] md:min-h-[72px] py-3 md:py-4"
        animate={{
          maxWidth: isDesktop ? (isCompact ? 720 : 1280) : "100%",
        }}
        transition={SPRING_TRANSITION}
        style={{ width: "100%" }}
      >
        <Link
          to="/"
          onClick={() => {
            if (location.pathname === "/") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex items-center flex-shrink-0 text-foreground hover:opacity-90 transition-opacity"
          style={{ maxWidth: "none", overflow: "visible" }}
        >
          <TryVerseLogo height={105} />
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {publicLinks.map((link) =>
            isRoute(link.href) ? (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors whitespace-nowrap px-1 ${
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap px-1"
              >
                {link.label}
              </a>
            )
          )}
        </div>

        <motion.div
          className="hidden md:flex items-center"
          animate={{ gap: isCompact ? 6 : 12 }}
          transition={SPRING_TRANSITION}
        >
          {isAuthenticated ? (
            <>
              <Link to="/studio">
                <Button variant="ghost" size="sm" className="text-sm">
                  Try-On Studio
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="text-sm">
                  Dashboard
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-sm gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </Button>
            </>
          ) : FEATURE_FLAGS.INVITE_ONLY_MODE ? (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm">
                  Log In
                </Button>
              </Link>
              <Button type="button" variant="outline" size="sm" className="text-sm" onClick={() => openSignupChooser()}>
                Sign Up
              </Button>
              <Link to="/book-demo">
                <Button size="sm" className="gradient-primary text-primary-foreground text-sm shadow-soft">
                  Book a Demo
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm">
                  Log In
                </Button>
              </Link>
              <Button type="button" size="sm" className="gradient-primary text-primary-foreground text-sm shadow-soft" onClick={() => openSignupChooser()}>
                Sign Up
              </Button>
            </>
          )}
        </motion.div>

        <button
          type="button"
          className="md:hidden p-2 -mr-2 rounded-md hover:bg-muted/80 text-foreground"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </motion.div>

      {/* CSS transition menu — avoids framer “height: auto” glitches on mobile */}
      <div
        className={cn(
          "md:hidden overflow-hidden bg-background border-b border-border transition-all duration-300 ease-out",
          open ? "max-h-[85vh] opacity-100 border-border" : "max-h-0 opacity-0 border-transparent pointer-events-none"
        )}
      >
        <div className="px-6 py-4 flex flex-col gap-3">
          {publicLinks.map((link) =>
            isRoute(link.href) ? (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-2"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-2"
              >
                {link.label}
              </a>
            )
          )}
          {isAuthenticated ? (
            <>
              <Link to="/studio" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full mt-2">
                  Try-On Studio
                </Button>
              </Link>
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button className="gradient-primary text-primary-foreground w-full">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  void handleSignOut();
                  setOpen(false);
                }}
                className="w-full gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </Button>
            </>
          ) : FEATURE_FLAGS.INVITE_ONLY_MODE ? (
            <>
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full mt-2">
                  Log In
                </Button>
              </Link>
              <Button type="button" variant="outline" className="w-full" onClick={() => { setOpen(false); openSignupChooser(); }}>
                Sign Up
              </Button>
              <Link to="/book-demo" onClick={() => setOpen(false)}>
                <Button className="gradient-primary text-primary-foreground w-full">
                  Book a Demo
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full mt-2">
                  Log In
                </Button>
              </Link>
              <Button type="button" className="gradient-primary text-primary-foreground w-full" onClick={() => { setOpen(false); openSignupChooser(); }}>
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
