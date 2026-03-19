"use client";

import { ThermometerSimple } from "@phosphor-icons/react/dist/ssr";

export function TemperatureWidget() {
  return (
    <div className="bg-black rounded-lg flex justify-center items-center h-10 px-3 gap-1.5">
      <ThermometerSimple size={16} weight="fill" className="text-white" />
      <p className="text-white text-base whitespace-nowrap leading-5">22°C</p>
    </div>
  );
}
