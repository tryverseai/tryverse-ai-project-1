// Regression coverage for a real bug: a tab switched away for longer than the idle window and
// then switched back never actually logged out, because `visibilitychange` was treated as user
// activity and reset the idle clock right before the next check could see the staleness. Elapsed
// time must now be judged against wall-clock time, unaffected by whether the tab was visible.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleSessionLogout } from "./useIdleSessionLogout";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useIdleSessionLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onIdle after idleMs of no activity while the tab stays visible", async () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleSessionLogout(true, 60_000, onIdle));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does not fire while genuine activity keeps resetting the clock", async () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleSessionLogout(true, 60_000, onIdle));

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
        window.dispatchEvent(new MouseEvent("mousemove"));
      });
    }
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("REGRESSION: a tab hidden for longer than idleMs still logs out when it becomes visible again, instead of silently resetting", async () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleSessionLogout(true, 60_000, onIdle));

    // Tab goes to the background. Time passes well beyond idleMs while hidden — the interval's
    // checks may or may not run (browsers throttle background timers), but wall-clock time still
    // advances regardless.
    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    // The bug: switching back used to be treated as activity and reset the clock, so this never
    // fired. It must fire now, right at the moment visibility returns.
    await act(async () => {
      setVisibility("visible");
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does NOT log out on a normal tab switch within the idle window", async () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleSessionLogout(true, 60_000, onIdle));

    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    await act(async () => {
      setVisibility("visible");
    });

    expect(onIdle).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", async () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleSessionLogout(false, 60_000, onIdle));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });
});
