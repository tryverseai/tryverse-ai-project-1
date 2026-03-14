import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const publicLinks = [
  { label: "Product", href: "/#features" },
  { label: "For Brands", href: "/#for-brands" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const isRoute = (href: string) => !href.includes("#");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-xl font-bold tracking-tight text-foreground">
          TryVerse<span className="text-muted-foreground">.AI</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {publicLinks.map((link) =>
            isRoute(link.href) ? (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors ${
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
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
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
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

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
    </nav>
  );
}
