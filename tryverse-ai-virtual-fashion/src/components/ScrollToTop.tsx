import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top whenever the route changes.
 * Fixes the issue where navigating between pages (About, Terms, etc.)
 * would show the bottom of the page instead of the top.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
