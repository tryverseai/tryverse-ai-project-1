interface TryVerseLogoProps {
  className?: string;
  height?: number;
  /** Use on dark backgrounds to show logo in white */
  invert?: boolean;
}

export function TryVerseLogo({ className = "", height = 48, invert = false }: TryVerseLogoProps) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{
        maxWidth: "none",
        overflow: "visible",
        ...(invert && { filter: "invert(1)" }),
      }}
    >
      <img
        src="/tryverse-logo.png"
        alt="TryVerse"
        className={`tryverse-logo-img ${className}`}
        style={{
          ...(height != null ? { height: `${height}px` } : {}),
          width: "auto",
          display: "block",
          // The source file has a baked-in white background rather than transparency.
          // Multiply dissolves that white into whatever sits behind it (photo, gradient,
          // page background) while keeping the dark mark solid — skipped when inverted,
          // since that variant already targets a dark background directly.
          ...(!invert && { mixBlendMode: "multiply" }),
        }}
      />
    </div>
  );
}
