"use client";

import { memo, useCallback, useState } from "react";
import type { CropType, GrowthStage } from "@/lib/greenhouse-store";

/**
 * Shows a static image from a crop's lifecycle that corresponds
 * to its current growth stage.
 *
 * Pre-extracted frames live at `/images/crops/{crop}-{stage}.jpg`.
 * Falls back to `children` (the SVG preview) only on error.
 * Image is visible immediately (no fade-in delay).
 */
const CropVideoPreview = memo(function CropVideoPreview({
  crop,
  stage,
  stageProgress: _stageProgress,
  children,
}: {
  crop: CropType;
  /** Current growth stage of the plant. */
  stage: GrowthStage;
  /** 0–1 progress within the current stage (unused for static images). */
  stageProgress: number;
  children?: React.ReactNode;
}) {
  const [error, setError] = useState(false);
  const handleError = useCallback(() => setError(true), []);

  const src = `/images/crops/${crop}-${stage}.jpg`;

  if (error) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-white dark:bg-neutral-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${crop} at ${stage} stage`}
        onError={handleError}
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
});

export { CropVideoPreview };
