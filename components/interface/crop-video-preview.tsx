"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CropType, GrowthStage } from "@/lib/greenhouse-store";

/**
 * The 6 visible lifecycle stages in order.  "harvested" is excluded —
 * it maps to the final frame (plant dead / fully dried).
 */
const LIFECYCLE_STAGES: GrowthStage[] = [
  "seed",
  "germination",
  "vegetative",
  "flowering",
  "fruiting",
  "harvest_ready",
];

/**
 * Convert a (stage, stageProgress) pair into a 0–1 lifecycle fraction
 * that maps linearly onto the 8-second video timeline.
 *
 * Each of the 6 stages occupies an equal 1/6 slice of the video.
 *   seed           → 0.000 – 0.167
 *   germination    → 0.167 – 0.333
 *   vegetative     → 0.333 – 0.500
 *   flowering      → 0.500 – 0.667
 *   fruiting       → 0.667 – 0.833
 *   harvest_ready  → 0.833 – 1.000
 *   harvested      → 1.0 (final frame)
 */
function stageToLifecycleFraction(
  stage: GrowthStage,
  stageProgress: number,
): number {
  if (stage === "harvested") return 1;
  const idx = LIFECYCLE_STAGES.indexOf(stage);
  if (idx === -1) return 0;
  const sliceSize = 1 / LIFECYCLE_STAGES.length;
  return Math.min(1, idx * sliceSize + stageProgress * sliceSize);
}

// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_DURATION = 8; // Veo generates 8-second videos

/**
 * Shows a single frame from a crop's lifecycle video that corresponds
 * exactly to its current growth stage + progress within that stage.
 *
 * Shows a loading indicator while the media is pending and falls back
 * to `children` only when the video is unavailable.
 */
const CropVideoPreview = memo(function CropVideoPreview({
  crop,
  stage,
  stageProgress,
  children,
}: {
  crop: CropType;
  /** Current growth stage of the plant. */
  stage: GrowthStage;
  /** 0–1 progress within the current stage. */
  stageProgress: number;
  children?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const prevCropRef = useRef(crop);

  const src = `/videos/crops/${crop}.mp4`;

  // Reset state when the crop (and therefore video source) changes
  if (prevCropRef.current !== crop) {
    prevCropRef.current = crop;
    setReady(false);
    setError(false);
  }

  const handleLoaded = useCallback(() => setReady(true), []);
  const handleError = useCallback(() => setError(true), []);

  // Seek to the correct frame whenever stage/progress changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const fraction = stageToLifecycleFraction(stage, stageProgress);
    const duration = video.duration || VIDEO_DURATION;
    // Stay slightly inside bounds to avoid blank edge frames
    const targetTime = Math.max(0, Math.min(fraction * duration, duration - 0.04));
    video.currentTime = targetTime;
  }, [stage, stageProgress, ready]);

  if (error) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-white dark:bg-neutral-900">
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        onLoadedData={handleLoaded}
        onError={handleError}
        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ pointerEvents: "none" }}
      />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-black/28 dark:text-white/28">
            <div className="h-7 w-7 animate-spin rounded-full border border-black/10 border-t-black/28 dark:border-white/10 dark:border-t-white/36" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
              Loading
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export { CropVideoPreview };
