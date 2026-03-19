import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { TryVerseLogo } from "@/components/TryVerseLogo";

const publicLinks = [
  { label: "Product", href: "/#features" },
  { label: "Partner with us", href: "/partner" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;
    const THROTTLE_MS = 120;
    const updateCompact = () => {
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
    const attach = () => window.addEventListener("scroll", handleScroll, { passive: true });
    const id = requestAnimationFrame(attach);
    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const isRoute = (href: string) => !href.includes("#");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const spring = { type: "spring" as const, stiffness: 260, damping: 22 };

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
          maxWidth: isCompact ? 720 : 1280,
        }}
        transition={spring}
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
          <TryVerseLogo className="h-11 md:h-[110px]" />
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
          transition={spring}
        >
          {user ? (
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
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm">
                  Log In
                </Button>
              </Link>
              <Link to="/auth?signup=true">
                <Button size="sm" className="gradient-primary text-primary-foreground text-sm shadow-soft">
                  Start Free
                </Button>
              </Link>
            </>
          )}
        </motion.div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-background border-b border-border"
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
              {user ? (
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
                  <Button variant="outline" onClick={() => { handleSignOut(); setOpen(false); }} className="w-full gap-1.5">
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </Button>
                </>
              ) : (
                <Link to="/auth?signup=true" onClick={() => setOpen(false)}>
                  <Button className="gradient-primary text-primary-foreground w-full mt-2">
                    Start Free
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
