import type { ReactNode } from "react";

interface ModelPortraitProps {
  src: string;
  alt: string;
  /** Sets aspect ratio, rounding, border, etc. on the container — the fitting logic below is fixed. */
  className?: string;
  /** Absolutely-positioned overlays (badges, selection state, loading spinner). */
  children?: ReactNode;
}

/**
 * Full-body model portrait, letterboxed on a neutral surface instead of cropped — model source
 * images don't share identical internal framing/whitespace, so object-cover cuts off heads or
 * feet on some of them. object-contain guarantees the whole person stays visible regardless.
 * Shared by Personal Studio's model picker and Admin → Models so framing is consistent everywhere.
 */
export function ModelPortrait({ src, alt, className, children }: ModelPortraitProps) {
  return (
    <div className={`relative bg-muted overflow-hidden ${className ?? ""}`}>
      <img src={src} alt={alt} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-2" />
      {children}
    </div>
  );
}
