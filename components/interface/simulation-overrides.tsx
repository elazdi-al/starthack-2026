"use client";

import * as React from "react";
import { useCentralControl } from "@/components/ui/central-control";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import type { ManualOverrides } from "@/lib/greenhouse-store";

const CONFIG = {
  "External Temp": {
    enabled:     false,
    temperature: [-63, -120, 20, 1] as [number, number, number, number],
  },
  "Solar Radiation": {
    enabled:   false,
    radiation: [590, 0, 800, 10] as [number, number, number, number],
  },
  "Dust Storm": {
    enabled:        false,
    severity:       [0, 0, 1, 0.01] as [number, number, number, number],
    triggerStorm:   { type: "action" as const },
    clearStorm:     { type: "action" as const },
  },
  "Atmosphere": {
    pressureOverride: false,
    pressure:         [600, 400, 800, 10] as [number, number, number, number],
  },
  "Time of Day": {
    locked:   false,
    fraction: [0.5, 0, 1, 0.01] as [number, number, number, number],
  },
} as const;

export function SimulationOverrides() {
  const applyOverrides = useGreenhouseStore((s) => s.applyOverrides);
  const simState = useGreenhouseStore((s) => s.simState);

  const values = useCentralControl("Simulation", CONFIG, {
    onAction: (action) => {
      const current = simState.greenhouse.overrides;
      if (action === "Dust Storm.triggerStorm") {
        applyOverrides({ ...current, dustStormEnabled: true, dustStormSeverity: 0.7 });
      } else if (action === "Dust Storm.clearStorm") {
        applyOverrides({ ...current, dustStormEnabled: false, dustStormSeverity: 0 });
      }
    },
  });

  // Sync dial values → simulation overrides on every change
  React.useEffect(() => {
    const overrides: ManualOverrides = {
      externalTempEnabled:        values["External Temp"].enabled,
      externalTemp:               values["External Temp"].temperature,
      solarRadiationEnabled:      values["Solar Radiation"].enabled,
      solarRadiation:             values["Solar Radiation"].radiation,
      dustStormEnabled:           values["Dust Storm"].enabled,
      dustStormSeverity:          values["Dust Storm"].severity,
      atmosphericPressureEnabled: values["Atmosphere"].pressureOverride,
      atmosphericPressure:        values["Atmosphere"].pressure,
      timeOfDayLocked:            values["Time of Day"].locked,
      timeOfDayFraction:          values["Time of Day"].fraction,
      // Preserve current resource overrides (managed by CentralControlExample)
      waterRecyclingEnabled:      simState.greenhouse.overrides.waterRecyclingEnabled,
      waterRecyclingEfficiency:   simState.greenhouse.overrides.waterRecyclingEfficiency,
      batteryStorageEnabled:      simState.greenhouse.overrides.batteryStorageEnabled,
      batteryStorageKWh:          simState.greenhouse.overrides.batteryStorageKWh,
      foodReservesEnabled:        simState.greenhouse.overrides.foodReservesEnabled,
      foodReservesSols:           simState.greenhouse.overrides.foodReservesSols,
    };
    applyOverrides(overrides);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values["External Temp"].enabled,
    values["External Temp"].temperature,
    values["Solar Radiation"].enabled,
    values["Solar Radiation"].radiation,
    values["Dust Storm"].enabled,
    values["Dust Storm"].severity,
    values["Atmosphere"].pressureOverride,
    values["Atmosphere"].pressure,
    values["Time of Day"].locked,
    values["Time of Day"].fraction,
  ]);

  return null;
}
