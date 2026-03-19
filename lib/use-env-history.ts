"use client";

import * as React from "react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

/** Snapshot of key env values at a point in time */
export interface EnvHistoryPoint {
  sol: number;
  minutes: number;
  temperature: number;
  humidity: number;
  co2: number;
  light: number;
  o2: number;
  solarKW: number;
  batteryKWh: number;
  harvestKg: number;
  caloriesPerDay: number;
  nutritionalCoverage: number;
}

const MAX_POINTS = 60;

/**
 * Samples greenhouse store values every N simulation-minutes,
 * building up a rolling time-series buffer for charts.
 */
export function useEnvHistory(intervalMinutes = 30): EnvHistoryPoint[] {
  const [history, setHistory] = React.useState<EnvHistoryPoint[]>([]);
  const lastRecorded = React.useRef(0);

  const elapsedMinutes = useGreenhouseStore((s) => s.elapsedMinutes);
  const temperature = useGreenhouseStore((s) => s.temperature);
  const humidity = useGreenhouseStore((s) => s.humidity);
  const co2Level = useGreenhouseStore((s) => s.co2Level);
  const lightLevel = useGreenhouseStore((s) => s.lightLevel);
  const missionSol = useGreenhouseStore((s) => s.missionSol);
  const env = useGreenhouseStore((s) => s.environment);

  React.useEffect(() => {
    if (elapsedMinutes - lastRecorded.current < intervalMinutes) return;
    lastRecorded.current = elapsedMinutes;

    const point: EnvHistoryPoint = {
      sol: missionSol,
      minutes: elapsedMinutes,
      temperature,
      humidity,
      co2: co2Level,
      light: lightLevel,
      o2: env.o2Level,
      solarKW: env.solarGenerationKW,
      batteryKWh: env.batteryStorageKWh,
      harvestKg: useGreenhouseStore.getState().totalHarvestKg,
      caloriesPerDay: env.nutritionalOutput.caloriesPerDay,
      nutritionalCoverage: env.nutritionalCoverage,
    };

    setHistory((prev) => {
      const next = [...prev, point];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [elapsedMinutes, intervalMinutes, temperature, humidity, co2Level, lightLevel, missionSol, env]);

  return history;
}
