"use client";

import { useGreenhouseStore } from "@/lib/greenhouse-store";
import type { DustStormRisk, SeasonName } from "@/lib/greenhouse-store";

const SEASON_LABELS: Record<SeasonName, string> = {
  northern_spring: "N. Spring",
  northern_summer: "N. Summer",
  northern_autumn: "N. Autumn",
  northern_winter: "N. Winter",
};

const RISK_COLORS: Record<DustStormRisk, string> = {
  low:      "text-emerald-400",
  moderate: "text-yellow-400",
  high:     "text-orange-400",
  extreme:  "text-red-400",
};

const RISK_LABELS: Record<DustStormRisk, string> = {
  low:      "Low",
  moderate: "Moderate",
  high:     "High",
  extreme:  "Extreme",
};

export function SeasonWidget() {
  const currentLs      = useGreenhouseStore((s) => s.currentLs);
  const seasonName     = useGreenhouseStore((s) => s.seasonName);
  const dustStormRisk  = useGreenhouseStore((s) => s.dustStormRisk);
  const dustStormActive = useGreenhouseStore((s) => s.dustStormActive);

  return (
    <div className="rounded-lg flex flex-col justify-center min-w-30 h-10 px-3 bg-neutral-900 text-white dark:bg-white/8 dark:text-white/90">
      <div className="flex items-center gap-2 leading-none">
        <span className="text-[11px] font-mono tabular-nums text-white/60 whitespace-nowrap">
          Ls {currentLs.toFixed(1)}°
        </span>
        <span className="text-[11px] font-medium text-white/90 whitespace-nowrap">
          {SEASON_LABELS[seasonName]}
        </span>
        {dustStormActive ? (
          <span className="text-[10px] font-semibold text-red-400 whitespace-nowrap animate-pulse">
            STORM
          </span>
        ) : (
          <span className={`text-[10px] font-medium whitespace-nowrap ${RISK_COLORS[dustStormRisk]}`}>
            {RISK_LABELS[dustStormRisk]} risk
          </span>
        )}
      </div>
    </div>
  );
}
