"use client";

import { useEffect } from "react";
import { useGreenhouseStore, TICK_INTERVAL_MS } from "@/lib/greenhouse-store";
import { useSettingsStore } from "@/lib/settings-store";
import { SkipForward } from "@phosphor-icons/react";

export function ClockWidget() {
  const time = useGreenhouseStore((s) => s.simulationTime);
  const tick = useGreenhouseStore((s) => s.tick);
  const skipToNextSol = useGreenhouseStore((s) => s.skipToNextSol);
  const missionSol = useGreenhouseStore((s) => s.missionSol);
  const timeFormat = useSettingsStore((s) => s.timeFormat);

  useEffect(() => {
    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tick]);

  let timeDisplay: string;
  if (timeFormat === "12h") {
    const h = time.getHours();
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mm = String(time.getMinutes()).padStart(2, "0");
    timeDisplay = `${h12}:${mm} ${period}`;
  } else {
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    timeDisplay = `${hh}:${mm}`;
  }

  return (
    <div className="relative flex items-center gap-1">
      <div className="rounded-lg flex justify-center items-center h-10 px-3 gap-2 bg-neutral-900 text-white dark:bg-white/8 dark:text-white/90">
        <span className="text-[11px] font-medium text-white/50 whitespace-nowrap font-mono">
          Sol {missionSol}
        </span>
        <span className="text-white/20">|</span>
        <p className="text-base whitespace-nowrap leading-5 font-mono tabular-nums tracking-wide">
          {timeDisplay}
        </p>
      </div>
      <button
        type="button"
        onClick={skipToNextSol}
        title="Skip to next sol"
        className="rounded-lg flex items-center justify-center h-10 w-10 bg-neutral-900 text-white/60 dark:bg-white/8 dark:text-white/60 hover:text-white hover:bg-neutral-700 dark:hover:bg-white/15 transition-colors"
      >
        <SkipForward size={16} weight="fill" />
      </button>
    </div>
  );
}
