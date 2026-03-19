"use client";

import { useEffect } from "react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

export function ClockWidget() {
  const time = useGreenhouseStore((s) => s.simulationTime);
  const tick = useGreenhouseStore((s) => s.tick);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");

  return (
    <div className="relative">
      <div className="bg-black rounded-lg flex justify-center items-center w-30 h-10">
        <p className="text-white text-base whitespace-nowrap leading-5 font-mono tabular-nums tracking-wide">
          {hh}:{mm}
        </p>
      </div>
    </div>
  );
}
