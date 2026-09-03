import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** Dashboard idle-logout window. The separate admin panel session (backend `services/adminSession.ts`) has its own, shorter TTL — the two are no longer required to match. */
export const DEFAULT_APP_SESSION_IDLE_MS = 15 * 60 * 1000;

/**
 * Signs the user out after `idleMs` with no detected activity.
 *
 * Elapsed time is measured against wall-clock time since the last real interaction, and evaluated
 * both on a periodic tick AND immediately when the tab becomes visible again — never reset just by
 * the tab becoming visible. A `visibilitychange`-only "mark as active" here was the exact prior bug:
 * a user who switched away for well over `idleMs` and then switched back never actually saw a
 * logout, because that switch itself was treated as activity and reset the clock before the next
 * check ever ran. Genuine idleness now survives a tab being hidden, minimized, or the OS sleeping —
 * only real input (mouse/keyboard/touch/scroll/click) counts as activity.
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

    const checkIdle = () => {
      if (!enabled) return;
      const quietFor = Date.now() - lastActivityRef.current;
      if (quietFor >= idleMs && !firedRef.current) {
        firedRef.current = true;
        toast.info("You've been signed out after a period of inactivity.");
        void Promise.resolve(onIdle()).catch(() => {
          firedRef.current = false;
        });
      }
    };

    // Becoming visible again is NOT activity — it's exactly the moment a long-idle tab needs to be
    // checked, not reset. A tab that comes back to life after longer than idleMs must log out here,
    // rather than silently getting a fresh clock.
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkIdle();
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

    // Runs unconditionally (not gated on tab visibility) — Date.now() elapsed time is accurate
    // whether or not the tab is in the foreground; browsers throttle background timers but still
    // fire them, and visibilitychange above catches the return-to-tab case immediately either way.
    const CHECK_MS = 15_000;
    const tid = window.setInterval(checkIdle, CHECK_MS);

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
