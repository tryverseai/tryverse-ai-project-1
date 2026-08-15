import { useEffect, useRef, useState } from "react";

interface AutoPlayVideoProps {
  src: string;
  poster?: string;
  /** Used only for the fallback <img> shown if the video fails to load — video itself has no alt text (it's muted/decorative motion). */
  posterAlt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AutoPlayVideo({ src, poster, posterAlt, className, style }: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Force play on mount
    const tryPlay = () => {
      video.play().catch(() => {});
    };

    // Try immediately
    tryPlay();

    // Also try after a short delay for mobile
    const timeout = setTimeout(tryPlay, 100);

    // Listen for visibility changes to resume
    const handleVisibility = () => {
      if (!document.hidden) tryPlay();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Intersection observer to play when in view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) tryPlay();
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(video);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
    };
  }, []);

  if (failed && poster) {
    // Video failed to load/decode — fall back to the static poster image outright rather than
    // leaving a broken/blank <video> element in place.
    return <img src={poster} alt={posterAlt ?? ""} className={className} style={style} />;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      poster={poster}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      // @ts-ignore - webkit attribute for iOS
      webkit-playsinline="true"
      x-webkit-airplay="deny"
      disablePictureInPicture
      disableRemotePlayback
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
