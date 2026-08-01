import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Draggable before/after comparison. Pointer, keyboard and touch driven.
 * Pure presentation — takes two image URLs and renders nothing else.
 */
export function BeforeAfter({
  beforeSrc,
  afterSrc,
  beforeLabel = "Original",
  afterLabel = "TryVerse",
  className,
  aspect = "aspect-[3/4]",
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  aspect?: string;
}) {
  const [pos, setPos] = useState(52);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, next)));
  }, []);

  return (
    <div
      ref={frameRef}
      className={cn(
        "group relative select-none overflow-hidden rounded-[var(--radius-xl)] border border-border studio-frame",
        aspect,
        className
      )}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <img
        src={afterSrc}
        alt={`${afterLabel} result`}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={beforeSrc}
          alt={`${beforeLabel} photo`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: frameRef.current?.offsetWidth ? `${frameRef.current.offsetWidth}px` : "100%" }}
        />
      </div>

      <span className="pointer-events-none absolute left-4 top-4 rounded-[var(--radius-pill)] bg-[hsl(var(--ink)/0.72)] px-3 py-1 type-eyebrow text-[hsl(40_16%_95%)] backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-[var(--radius-pill)] bg-[hsl(40_20%_98%/0.85)] px-3 py-1 type-eyebrow text-foreground backdrop-blur-sm">
        {afterLabel}
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-[hsl(40_20%_98%/0.9)] shadow-[0_0_0_1px_hsl(240_6%_7%/0.12)]"
        style={{ left: `${pos}%` }}
      />

      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        aria-label="Compare original photo with TryVerse result"
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />

      <div
        className="pointer-events-none absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-[var(--shadow-card)] transition-transform duration-200 group-hover:scale-105"
        style={{ left: `${pos}%` }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M9 6 5 12l4 6M15 6l4 6-4 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
