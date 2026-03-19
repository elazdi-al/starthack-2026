"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CropType } from "@/lib/greenhouse-store";

const VIDEO_DURATION = 8; // Veo generates 8-second videos

/**
 * Renders a single frame from a crop lifecycle video at the position
 * corresponding to the plant's current life percentage.
 *
 * lifePercent: 0 = seed, 1 = end of life / death
 *
 * The video is paused and seeked to `lifePercent * duration`.
 * Falls back to `children` (the SVG preview) if the video fails to load.
 */
const CropVideoPreview = memo(function CropVideoPreview({
  crop,
  lifePercent,
  children,
}: {
  crop: CropType;
  lifePercent: number;
  children?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const src = `/videos/crops/${crop}.mp4`;

  const handleLoaded = useCallback(() => {
    setReady(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  // Seek to the correct frame whenever lifePercent changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const clamped = Math.max(0, Math.min(1, lifePercent));
    const duration = video.duration || VIDEO_DURATION;
    // Map 0–1 to 0–duration, but stay slightly inside bounds to avoid
    // edge-frame artifacts
    const targetTime = clamped * (duration - 0.05);
    video.currentTime = Math.max(0, targetTime);
  }, [lifePercent, ready]);

  if (error) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[16px]">
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        onLoadedData={handleLoaded}
        onError={handleError}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ pointerEvents: "none" }}
      />
      {/* Fallback while loading */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
});

export { CropVideoPreview };
