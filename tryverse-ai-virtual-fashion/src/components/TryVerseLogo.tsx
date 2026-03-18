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
          height: `${height}px`,
          width: "auto",
          display: "block",
        }}
      />
    </div>
  );
}
