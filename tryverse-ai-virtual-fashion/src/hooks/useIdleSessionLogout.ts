import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Matches `SESSION_TTL_MS` in backend `services/adminSession.ts` (15 minutes). */
export const DEFAULT_APP_SESSION_IDLE_MS = 15 * 60 * 1000;

/**
 * Signs the user out after `idleMs` with no detected activity (aligned with admin session policy).
 */
export function useIdleSessionLogout(
  enabled: boolean,
  idleMs: number,
  onIdle: () => void | Promise<void>
): void {
  const lastActivityRef = useRef(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    firedRef.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || idleMs <= 0) return;

    const mark = () => {
      lastActivityRef.current = Date.now();
      firedRef.current = false;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") mark();
    };

    const listenerOpts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("mousedown", mark, listenerOpts);
    window.addEventListener("mousemove", mark, listenerOpts);
    window.addEventListener("keydown", mark, listenerOpts);
    window.addEventListener("touchstart", mark, listenerOpts);
    window.addEventListener("scroll", mark, listenerOpts);
    window.addEventListener("wheel", mark, listenerOpts);
    window.addEventListener("click", mark, listenerOpts);
    window.addEventListener("visibilitychange", onVisibility, { capture: true });

    const CHECK_MS = 15_000;
    const tid = window.setInterval(() => {
      if (!enabled) return;
      if (document.visibilityState !== "visible") return;

      const quietFor = Date.now() - lastActivityRef.current;
      if (quietFor >= idleMs && !firedRef.current) {
        firedRef.current = true;
        toast.info("You've been signed out after a period of inactivity.");
        void Promise.resolve(onIdle()).catch(() => {
          firedRef.current = false;
        });
      }
    }, CHECK_MS);

    return () => {
      window.removeEventListener("mousedown", mark, { capture: true });
      window.removeEventListener("mousemove", mark, { capture: true });
      window.removeEventListener("keydown", mark, { capture: true });
      window.removeEventListener("touchstart", mark, { capture: true });
      window.removeEventListener("scroll", mark, { capture: true });
      window.removeEventListener("wheel", mark, { capture: true });
      window.removeEventListener("click", mark, { capture: true });
      window.removeEventListener("visibilitychange", onVisibility, { capture: true });
      window.clearInterval(tid);
    };
  }, [enabled, idleMs, onIdle]);
}
