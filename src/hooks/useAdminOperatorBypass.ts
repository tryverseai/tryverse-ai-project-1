import { useState, useEffect } from "react";
import {
  checkAdminSession,
  ADMIN_OPERATOR_BYPASS_CACHE_KEY,
  ADMIN_SESSION_PROBE_KEY,
} from "@/lib/backendApi";

/**
 * Operators with a valid `/api/admin` session cookie may use dashboard + wrong account-type routes for testing.
 * Probes once per tab (`ADMIN_SESSION_PROBE_KEY`) so regular users don't pay repeated round-trips.
 */
export function useAdminOperatorBypass(): { bypass: boolean; checking: boolean } {
  const [bypass, setBypass] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    try {
      if (
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(ADMIN_OPERATOR_BYPASS_CACHE_KEY) === "1"
      ) {
        setBypass(true);
        setChecking(false);
        return;
      }
      const probe = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ADMIN_SESSION_PROBE_KEY) : null;
      if (probe === "no") {
        setBypass(false);
        setChecking(false);
        return;
      }
    } catch {
      /* ignore */
    }

    void checkAdminSession().then((ok) => {
      if (cancelled) return;
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(ADMIN_SESSION_PROBE_KEY, ok ? "yes" : "no");
          if (ok) sessionStorage.setItem(ADMIN_OPERATOR_BYPASS_CACHE_KEY, "1");
          else sessionStorage.removeItem(ADMIN_OPERATOR_BYPASS_CACHE_KEY);
        }
      } catch {
        /* ignore */
      }
      setBypass(ok);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { bypass, checking };
}
