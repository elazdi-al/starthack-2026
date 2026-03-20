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
  const solFraction = useGreenhouseStore((s) => s.environment.solFraction);
  const tick = useGreenhouseStore((s) => s.tick);
  const skipTime = useGreenhouseStore((s) => s.skipTime);
  const missionSol = useGreenhouseStore((s) => s.missionSol);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const isHydrated = useHydrated();

  useEffect(() => {
    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tick]);

  // Derive Mars time-of-day from solFraction (0 = midnight, 0.5 = noon)
  const totalMarsMinutes = solFraction * 24 * 60;
  const marsHour = Math.floor(totalMarsMinutes / 60);
  const marsMinute = Math.floor(totalMarsMinutes % 60);

  let timeDisplay: string;

  if (timeFormat === "12h") {
    const period = marsHour >= 12 ? "PM" : "AM";
    const h12 = marsHour % 12 || 12;
    const mm = String(marsMinute).padStart(2, "0");
    timeDisplay = isHydrated ? `${h12}:${mm} ${period}` : "--:-- --";
  } else {
    const hh = String(marsHour).padStart(2, "0");
    const mm = String(marsMinute).padStart(2, "0");
    timeDisplay = isHydrated ? `${hh}:${mm}` : "--:--";
  }

  return (
    <div className="relative flex items-center gap-1">
      <div className="rounded-lg flex justify-center items-center h-10 px-3 bg-[var(--dial-surface)]">
        <p className="type-ui text-[var(--dial-text-primary)] font-medium whitespace-nowrap">
          <AnimatedParameterValue
            value={isHydrated ? `Sol ${missionSol} ${timeDisplay}` : "Sol -- --:--"}
            debounceMs={72}
          />
        </p>
      </div>
      {SKIP_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => skipTime(opt.minutes)}
          title={`Skip ${opt.label}`}
          className="rounded-lg flex items-center justify-center h-10 px-2.5 bg-[var(--dial-surface)] hover:bg-[var(--dial-surface-hover)] transition-colors type-ui text-[var(--dial-text-primary)] font-medium"
        >
          +{opt.label}
        </button>
      ))}
    </div>
  );
}
