"use client";

import { ThermometerSimple } from "@phosphor-icons/react/dist/ssr";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

export function TemperatureWidget() {
  const temperature = useGreenhouseStore((s) => s.temperature);

  return (
    <div className="bg-black rounded-lg flex justify-center items-center h-10 px-3 gap-1.5">
      <ThermometerSimple size={16} weight="fill" className="text-white" />
      <p className="text-white text-base whitespace-nowrap leading-5 font-mono tabular-nums">
        {temperature.toFixed(1)}°C
      </p>
    </div>
  );
}
