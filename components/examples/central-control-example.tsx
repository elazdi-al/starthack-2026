"use client";

import * as React from "react";
import { DialStore } from "@/components/ui/central-control";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import type { CropType, ManualOverrides } from "@/lib/greenhouse-store";

const ALL_CROPS: CropType[] = [
  "lettuce", "tomato", "potato", "soybean", "spinach", "wheat", "radish", "kale",
];

const CROP_LABELS: Record<CropType, string> = {
  lettuce: "Lettuce", tomato: "Tomato", potato: "Potato", soybean: "Soybean",
  spinach: "Spinach", wheat: "Wheat", radish: "Radish", kale: "Kale",
};

export const PANEL = {
  ext:   "sim-ext",
  gh:    "sim-gh",
  crops: "sim-crops",
} as const;

const GH_PARAMS = [
  "globalHeatingPower", "co2InjectionRate", "ventilationRate",
  "lightingPower", "maxSolarGenerationKW", "batteryCapacityKWh",
] as const;

const CROP_PARAMS = [
  "waterPumpRate", "localHeatingPower", "nutrientConcentration", "aerationRate",
] as const;

type ExtParamDef = {
  key: string;
  enabledKey: keyof ManualOverrides;
  valueKey: keyof ManualOverrides;
};

const EXT_PARAMS: ExtParamDef[] = [
  { key: "externalTemp",   enabledKey: "externalTempEnabled",        valueKey: "externalTemp" },
  { key: "solarRadiation", enabledKey: "solarRadiationEnabled",      valueKey: "solarRadiation" },
  { key: "dustStorm",      enabledKey: "dustStormEnabled",           valueKey: "dustStormSeverity" },
  { key: "pressure",       enabledKey: "atmosphericPressureEnabled", valueKey: "atmosphericPressure" },
  { key: "timeOfDay",      enabledKey: "timeOfDayLocked",           valueKey: "timeOfDayFraction" },
];

let pushingFromSim = false;

function r1(n: number) { return Math.round(n * 10) / 10; }
function r2(n: number) { return Math.round(n * 100) / 100; }
function ri(n: number) { return Math.round(n); }

export function CentralControlExample() {
  const externalTemp = useGreenhouseStore((s) => s.environment.externalTemp);
  const solarRadiation = useGreenhouseStore((s) => s.environment.solarRadiation);
  const simState = useGreenhouseStore((s) => s.simState);
  const applyParameterChanges = useGreenhouseStore((s) => s.applyParameterChanges);
  const applyOverrides = useGreenhouseStore((s) => s.applyOverrides);

  const selectedCropRef = React.useRef<CropType>("lettuce");
  const setFocusedCrop = useGreenhouseStore((s) => s.setFocusedCrop);
  const prevExtRef = React.useRef<Record<string, number>>({});

  // ── Register all three panels on mount ──────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount with initial snapshot
  React.useEffect(() => {
    const initEnv = useGreenhouseStore.getState().environment;
    const gh = simState.greenhouse;
    const overrides = gh.overrides;

    // ─ External Parameters ─
    const extInitial: Record<string, number> = {
      externalTemp:   r1(initEnv.externalTemp),
      solarRadiation: ri(initEnv.solarRadiation),
      dustStorm:      r2(overrides.dustStormSeverity),
      pressure:       ri(overrides.atmosphericPressure),
      timeOfDay:      r2(overrides.timeOfDayFraction),
    };
    prevExtRef.current = { ...extInitial };

    DialStore.registerPanel(PANEL.ext, "External", {
      externalTemp:   [extInitial.externalTemp,   -120, 20, 1],
      solarRadiation: [extInitial.solarRadiation, 0, 800, 10],
      dustStorm:      [extInitial.dustStorm,      0, 1, 0.01],
      pressure:       [extInitial.pressure,       400, 800, 10],
      timeOfDay:      [extInitial.timeOfDay,      0, 1, 0.01],
    });

    // ─ Greenhouse Parameters ─
    DialStore.registerPanel(PANEL.gh, "Greenhouse", {
      globalHeatingPower:   [gh.globalHeatingPower, 0, 10000, 100],
      co2InjectionRate:     [gh.co2InjectionRate, 0, 200, 1],
      ventilationRate:      [gh.ventilationRate, 0, 500, 1],
      lightingPower:        [gh.lightingPower, 0, 10000, 100],
      maxSolarGenerationKW: [gh.maxSolarGenerationKW, 10, 200, 1],
      batteryCapacityKWh:   [gh.batteryCapacityKWh, 50, 1000, 10],
    });

    // ─ Crop Parameters ─
    const crop = selectedCropRef.current;
    const c = gh.crops[crop];
    DialStore.registerPanel(PANEL.crops, "Crops", {
      cropType: {
        type: "select" as const,
        options: ALL_CROPS.map((cr) => ({ value: cr, label: CROP_LABELS[cr] })),
        default: crop,
      },
      waterPumpRate:         [c.waterPumpRate, 0, 30, 0.5],
      localHeatingPower:     [c.localHeatingPower, 0, 3000, 50],
      nutrientConcentration: [c.nutrientConcentration, 0.5, 5, 0.1],
      aerationRate:          [c.aerationRate, 0, 100, 1],
    });

    return () => {
      DialStore.unregisterPanel(PANEL.ext);
      DialStore.unregisterPanel(PANEL.gh);
      DialStore.unregisterPanel(PANEL.crops);
      setFocusedCrop(null);
    };
  }, []);

  // ── Push live environment values to External sliders ────────────────────
  React.useEffect(() => {
    pushingFromSim = true;
    const v = DialStore.getValues(PANEL.ext);
    const o = useGreenhouseStore.getState().simState.greenhouse.overrides;

    const push = (key: string, val: number) => {
      if (v[key] !== val) DialStore.updateValue(PANEL.ext, key, val);
      prevExtRef.current[key] = val;
    };

    // Only push natural sim values for params whose override is NOT active
    if (!o.externalTempEnabled)   push("externalTemp", r1(externalTemp));
    if (!o.solarRadiationEnabled) push("solarRadiation", ri(solarRadiation));
    // dustStorm, pressure, timeOfDay are control inputs — no natural sim push

    pushingFromSim = false;
  }, [externalTemp, solarRadiation]);

  // ── External params → overrides (auto-enable on user change) ───────────
  React.useEffect(() => {
    return DialStore.subscribe(PANEL.ext, () => {
      if (pushingFromSim) return;
      const v = DialStore.getValues(PANEL.ext);
      const prev = prevExtRef.current;
      const currentOverrides = useGreenhouseStore.getState().simState.greenhouse.overrides;
      const next: ManualOverrides = { ...currentOverrides };
      let changed = false;

      for (const { key, enabledKey, valueKey } of EXT_PARAMS) {
        const newVal = v[key] as number;
        if (newVal !== undefined && newVal !== prev[key]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (next as any)[enabledKey] = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (next as any)[valueKey] = newVal;
          changed = true;
        }
      }

      // Update prev tracking
      for (const { key } of EXT_PARAMS) {
        prevExtRef.current[key] = v[key] as number;
      }

      if (changed) applyOverrides(next);
    });
  }, [applyOverrides]);

  // ── Push greenhouse param changes back to sliders (e.g. from agent) ──
  React.useEffect(() => {
    const gh = simState.greenhouse;
    pushingFromSim = true;
    const v = DialStore.getValues(PANEL.gh);
    for (const p of GH_PARAMS) {
      if (v[p] !== undefined && v[p] !== gh[p]) {
        DialStore.updateValue(PANEL.gh, p, gh[p]);
      }
    }
    pushingFromSim = false;
  }, [simState]);

  // ── Push crop param changes back to sliders (e.g. from agent) ───────
  React.useEffect(() => {
    const crop = selectedCropRef.current;
    const c = simState.greenhouse.crops[crop];
    if (!c) return;
    pushingFromSim = true;
    const v = DialStore.getValues(PANEL.crops);
    for (const p of CROP_PARAMS) {
      if (v[p] !== undefined && v[p] !== c[p]) {
        DialStore.updateValue(PANEL.crops, p, c[p]);
      }
    }
    pushingFromSim = false;
  }, [simState]);

  // ── Greenhouse controls → simulation ────────────────────────────────────
  React.useEffect(() => {
    return DialStore.subscribe(PANEL.gh, () => {
      if (pushingFromSim) return;
      const v = DialStore.getValues(PANEL.gh);
      const gh = useGreenhouseStore.getState().simState.greenhouse;
      const changes: Array<{ type: "greenhouse"; param: string; value: number }> = [];
      for (const p of GH_PARAMS) {
        const val = v[p] as number;
        if (val !== undefined && val !== gh[p]) {
          changes.push({ type: "greenhouse", param: p, value: val });
        }
      }
      if (changes.length > 0) applyParameterChanges(changes);
    });
  }, [applyParameterChanges]);

  // ── Crop controls + crop switching ──────────────────────────────────────
  React.useEffect(() => {
    return DialStore.subscribe(PANEL.crops, () => {
      if (pushingFromSim) return;
      const v = DialStore.getValues(PANEL.crops);

      // Handle crop type switching
      const selectedCrop = v["cropType"] as CropType;
      if (selectedCrop && selectedCrop !== selectedCropRef.current) {
        selectedCropRef.current = selectedCrop;
        setFocusedCrop(selectedCrop);
        const gh = useGreenhouseStore.getState().simState.greenhouse;
        const c = gh.crops[selectedCrop];
        pushingFromSim = true;
        DialStore.updateValue(PANEL.crops, "waterPumpRate", c.waterPumpRate);
        DialStore.updateValue(PANEL.crops, "localHeatingPower", c.localHeatingPower);
        DialStore.updateValue(PANEL.crops, "nutrientConcentration", c.nutrientConcentration);
        DialStore.updateValue(PANEL.crops, "aerationRate", c.aerationRate);
        pushingFromSim = false;
        return;
      }

      // Push slider changes to simulation for the selected crop
      const crop = selectedCropRef.current;
      const gh = useGreenhouseStore.getState().simState.greenhouse;
      const changes: Array<{ type: "crop"; crop: string; param: string; value: number }> = [];
      for (const p of CROP_PARAMS) {
        const val = v[p] as number;
        if (val !== undefined && val !== gh.crops[crop][p]) {
          changes.push({ type: "crop", crop, param: p, value: val });
        }
      }
      if (changes.length > 0) applyParameterChanges(changes);
    });
  }, [applyParameterChanges]);

  return null;
}
