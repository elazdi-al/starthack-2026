"use client";

import { useEffect } from "react";
import { AnimatedParameterValue } from "@/components/ui/animated-parameter-value";
import { useGreenhouseStore, TICK_INTERVAL_MS } from "@/lib/greenhouse-store";
import { SOL_HOURS } from "@/greenhouse/implementations/multi-crop";
import { useSettingsStore } from "@/lib/settings-store";
import { useHydrated } from "@/lib/use-hydrated";

const SKIP_OPTIONS = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "1 Sol", minutes: SOL_HOURS * 60 },
] as const;

export function ClockWidget() {
  const time = useGreenhouseStore((s) => s.simulationTime);
  const tick = useGreenhouseStore((s) => s.tick);
  const skipTime = useGreenhouseStore((s) => s.skipTime);
  const missionSol = useGreenhouseStore((s) => s.missionSol);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const isHydrated = useHydrated();

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
    timeDisplay = isHydrated ? `${h12}:${mm} ${period}` : "--:-- --";
  } else {
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    timeDisplay = isHydrated ? `${hh}:${mm}` : "--:--";
  }

  return (
    <div className="relative flex items-center gap-1">
      <div className="rounded-lg flex justify-center items-center h-10 px-3 gap-2 bg-neutral-900 text-white dark:bg-white/8 dark:text-white/90">
        <span className="text-[11px] font-medium text-white/50 whitespace-nowrap font-mono">
          {isHydrated ? (
            <AnimatedParameterValue value={`Sol ${missionSol}`} debounceMs={72} />
          ) : "Sol --"}
        </span>
        <span className="text-white/20">|</span>
        <p className="text-base whitespace-nowrap leading-5 font-mono tabular-nums tracking-wide">
          <AnimatedParameterValue value={timeDisplay} debounceMs={72} />
        </p>
      </div>
      {SKIP_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => skipTime(opt.minutes)}
          title={`Skip ${opt.label}`}
          className="rounded-lg flex items-center justify-center h-10 px-2.5 bg-neutral-900 text-white/60 dark:bg-white/8 dark:text-white/60 hover:text-white hover:bg-neutral-700 dark:hover:bg-white/15 transition-colors text-[11px] font-medium font-mono"
        >
          +{opt.label}
        </button>
      ))}
    </div>
  );
}
