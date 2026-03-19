"use client";

import { useEffect } from "react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { useSettingsStore } from "@/lib/settings-store";

export function ClockWidget() {
  const time = useGreenhouseStore((s) => s.simulationTime);
  const tick = useGreenhouseStore((s) => s.tick);
  const timeFormat = useSettingsStore((s) => s.timeFormat);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  let display: string;
  if (timeFormat === "12h") {
    const h = time.getHours();
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mm = String(time.getMinutes()).padStart(2, "0");
    display = `${h12}:${mm} ${period}`;
  } else {
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    display = `${hh}:${mm}`;
  }

  return (
    <div className="relative">
      <div className="rounded-lg flex justify-center items-center min-w-30 h-10 px-3 bg-neutral-900 text-white dark:bg-white/8 dark:text-white/90">
        <p className="text-base whitespace-nowrap leading-5 font-mono tabular-nums tracking-wide">
          {display}
        </p>
      </div>
    </div>
  );
}
