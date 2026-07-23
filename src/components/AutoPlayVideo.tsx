import { useEffect, useRef } from "react";

interface AutoPlayVideoProps {
  src: string;
  poster?: string;
  className?: string;
}

export function AutoPlayVideo({ src, poster, className }: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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
