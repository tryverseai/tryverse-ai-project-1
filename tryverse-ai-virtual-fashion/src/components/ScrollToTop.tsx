import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top whenever the route changes.
 * Defers scroll to next frame to avoid blocking initial paint.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
