"use client";

import { ThermometerSimple } from "@phosphor-icons/react/dist/ssr";
import { AnimatedParameterValue } from "@/components/ui/animated-parameter-value";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { useSettingsStore, formatTemperature } from "@/lib/settings-store";
import { useHydrated } from "@/lib/use-hydrated";

export function TemperatureWidget() {
  const temperature = useGreenhouseStore((s) => s.temperature);
  const tempUnit = useSettingsStore((s) => s.tempUnit);
  const isHydrated = useHydrated();

  return (
    <div className="rounded-lg flex justify-center items-center h-10 px-3 gap-1.5 bg-neutral-900 text-white dark:bg-white/8 dark:text-white/90">
      <ThermometerSimple size={16} weight="fill" />
      <p className="text-base whitespace-nowrap leading-5 font-mono tabular-nums">
        {isHydrated ? (
          <AnimatedParameterValue value={formatTemperature(temperature, tempUnit)} debounceMs={72} />
        ) : "--"}
      </p>
    </div>
  );
}
