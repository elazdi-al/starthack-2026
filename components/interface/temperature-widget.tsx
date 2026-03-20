"use client";

import { ThermometerSimple } from "@phosphor-icons/react/dist/ssr";
import { AnimatedParameterValue } from "@/components/ui/animated-parameter-value";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { useSettingsStore, formatTemperature } from "@/lib/settings-store";
import { useHydrated } from "@/lib/use-hydrated";

export function TemperatureWidget() {
  const temperature = useGreenhouseStore((s) => s.environment.externalTemp);
  const tempUnit = useSettingsStore((s) => s.tempUnit);
  const isHydrated = useHydrated();

  return (
    <div className="rounded-lg flex justify-center items-center h-10 px-3 gap-1.5 bg-[var(--dial-surface)]">
      <ThermometerSimple size={16} weight="fill" className="text-[var(--dial-text-primary)]" />
      <p className="type-ui text-[var(--dial-text-primary)] font-medium whitespace-nowrap">
        {isHydrated ? (
          <AnimatedParameterValue value={formatTemperature(temperature, tempUnit)} debounceMs={72} />
        ) : "--"}
      </p>
    </div>
  );
}
