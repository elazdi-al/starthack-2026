import { create } from "zustand";
import {
  createInitialEnvironment,
  createInitialGreenhouseState,
  createSimulation,
  SOL_HOURS,
  CROP_PROFILES,
  STAGE_TO_GROWTH_INDEX,
} from "@/greenhouse/implementations/multi-crop";
import type {
  CropType,
  CropEnvironment,
  ConcreteEnvironment,
  ConcreteGreenhouseState,
  ConcreteState,
  CropControls,
  GrowthStage,
  SeasonName,
  DustStormRisk,
  ManualOverrides,
  SimEvent,
  NutritionalOutput,
  MissionResources,
} from "@/greenhouse/implementations/multi-crop/types";
import {
  updateGreenhouseParam,
  updateCropParam,
  updateOverrides as updateOverridesTransform,
  harvestCrop as harvestCropTransform,
  replantCrop as replantCropTransform,
} from "@/greenhouse/implementations/multi-crop/transformation";

export type { CropType, GrowthStage, SeasonName, DustStormRisk, ManualOverrides };

// ─── UI Types ───────────────────────────────────────────────────────────────────

export type TileKind = "crop" | "path";
export type Status = "ok" | "warn" | null;
export type SpeedKey = "x1" | "x2" | "x5" | "x10" | "x20" | "x50" | "x100" | "x1000" | "x5000" | "x10000";
export const TICK_INTERVAL_MS = 16; // ~60fps
export const TOTAL_MISSION_SOLS = 450;

export interface CropInfo {
  name: string;
  scientificName: string;
  growthCycleDays: number;
  optimalTemp: [number, number];
  lightHours: string;
  waterPerDay: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  keyNutrients: string[];
}

export const CROP_DB: Record<CropType, CropInfo> = {
  lettuce: {
    name: "Lettuce", scientificName: "Lactuca sativa", growthCycleDays: 45,
    optimalTemp: [18, 24], lightHours: "16–18 h/day", waterPerDay: "0.8 L/m²",
    caloriesPer100g: 15, proteinPer100g: 1.4,
    keyNutrients: ["Vitamin A", "Vitamin K", "Folate"],
  },
  tomato: {
    name: "Tomato", scientificName: "Solanum lycopersicum", growthCycleDays: 80,
    optimalTemp: [20, 28], lightHours: "14–18 h/day", waterPerDay: "1.5 L/m²",
    caloriesPer100g: 18, proteinPer100g: 0.9,
    keyNutrients: ["Vitamin C", "Lycopene", "Potassium"],
  },
  potato: {
    name: "Potato", scientificName: "Solanum tuberosum", growthCycleDays: 90,
    optimalTemp: [15, 22], lightHours: "12–16 h/day", waterPerDay: "1.2 L/m²",
    caloriesPer100g: 77, proteinPer100g: 2.0,
    keyNutrients: ["Vitamin C", "Potassium", "Vitamin B6"],
  },
  soybean: {
    name: "Soybean", scientificName: "Glycine max", growthCycleDays: 100,
    optimalTemp: [20, 30], lightHours: "14–16 h/day", waterPerDay: "1.0 L/m²",
    caloriesPer100g: 173, proteinPer100g: 16.6,
    keyNutrients: ["Protein", "Iron", "Calcium"],
  },
  spinach: {
    name: "Spinach", scientificName: "Spinacia oleracea", growthCycleDays: 40,
    optimalTemp: [15, 22], lightHours: "14–16 h/day", waterPerDay: "0.7 L/m²",
    caloriesPer100g: 23, proteinPer100g: 2.9,
    keyNutrients: ["Iron", "Vitamin A", "Vitamin C"],
  },
  wheat: {
    name: "Wheat", scientificName: "Triticum aestivum", growthCycleDays: 120,
    optimalTemp: [18, 24], lightHours: "16–18 h/day", waterPerDay: "1.1 L/m²",
    caloriesPer100g: 340, proteinPer100g: 13.2,
    keyNutrients: ["Fiber", "Manganese", "Selenium"],
  },
  radish: {
    name: "Radish", scientificName: "Raphanus sativus", growthCycleDays: 30,
    optimalTemp: [16, 22], lightHours: "12–14 h/day", waterPerDay: "0.6 L/m²",
    caloriesPer100g: 16, proteinPer100g: 0.7,
    keyNutrients: ["Vitamin C", "Folate", "Potassium"],
  },
  kale: {
    name: "Kale", scientificName: "Brassica oleracea var. sabellica", growthCycleDays: 55,
    optimalTemp: [15, 24], lightHours: "14–16 h/day", waterPerDay: "0.9 L/m²",
    caloriesPer100g: 49, proteinPer100g: 4.3,
    keyNutrients: ["Vitamin K", "Vitamin C", "Calcium"],
  },
};

export interface TileData {
  kind: TileKind;
  growth: number;
  water: number;
  status: Status;
  sensor?: boolean;
  crop?: CropType;
}

const INITIAL_GRID: TileData[][] = [
  [
    { kind: "crop", growth: 3, water: 78, status: "ok", crop: "lettuce" },
    { kind: "crop", growth: 4, water: 92, status: "ok", crop: "tomato" },
    { kind: "crop", growth: 2, water: 65, status: "ok", crop: "spinach" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "crop", growth: 5, water: 88, status: "ok", crop: "soybean" },
    { kind: "crop", growth: 3, water: 72, status: "ok", crop: "wheat" },
    { kind: "crop", growth: 4, water: 95, status: "ok", crop: "kale" },
  ],
  [
    { kind: "crop", growth: 5, water: 95, status: "ok", crop: "potato" },
    { kind: "crop", growth: 3, water: 80, status: "ok", crop: "lettuce" },
    { kind: "crop", growth: 0, water: 0, status: null, crop: "radish" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 2, water: 60, status: "ok", crop: "radish" },
    { kind: "crop", growth: 5, water: 90, status: "ok", crop: "tomato" },
    { kind: "crop", growth: 1, water: 82, status: "ok", crop: "spinach" },
  ],
  [
    { kind: "crop", growth: 2, water: 55, status: "ok", crop: "wheat" },
    { kind: "crop", growth: 5, water: 70, status: "warn", crop: "soybean" },
    { kind: "crop", growth: 1, water: 90, status: "ok", crop: "kale" },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 4, water: 75, status: "ok", crop: "lettuce" },
    { kind: "crop", growth: 0, water: 0, status: null, crop: "potato" },
    { kind: "crop", growth: 5, water: 70, status: "warn", crop: "potato" },
  ],
  [
    { kind: "crop", growth: 4, water: 82, status: "ok", crop: "tomato" },
    { kind: "crop", growth: 1, water: 65, status: "ok", crop: "spinach" },
    { kind: "crop", growth: 3, water: 78, status: "ok", crop: "potato" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "crop", growth: 3, water: 80, status: "ok", crop: "wheat" },
    { kind: "crop", growth: 4, water: 55, status: "warn", crop: "radish" },
    { kind: "crop", growth: 1, water: 88, status: "ok", crop: "soybean" },
  ],
  [
    { kind: "crop", growth: 3, water: 90, status: "ok", crop: "kale" },
    { kind: "crop", growth: 5, water: 85, status: "ok", crop: "kale" },
    { kind: "crop", growth: 4, water: 72, status: "ok", crop: "tomato" },
    { kind: "path", growth: 0, water: 0, status: null },
    { kind: "path", growth: 0, water: 0, status: null, sensor: true },
    { kind: "crop", growth: 1, water: 92, status: "ok", crop: "spinach" },
    { kind: "crop", growth: 3, water: 78, status: "ok", crop: "soybean" },
    { kind: "crop", growth: 2, water: 65, status: "ok", crop: "wheat" },
  ],
];

const SPEED_MULTIPLIER: Record<SpeedKey, number> = {
  x1: 1, x2: 2, x5: 5, x10: 10, x20: 20, x50: 50, x100: 100, x1000: 1000, x5000: 5000, x10000: 10000,
};

// ─── Snapshot Types ─────────────────────────────────────────────────────────────

export interface CropSnapshot {
  soilMoisture: number;
  soilTemperature: number;
  plantGrowth: number;
  leafArea: number;
  fruitCount: number;
  controls: { waterPumpRate: number; localHeatingPower: number };
  stage: GrowthStage;
  stageProgress: number;
  daysSincePlanting: number;
  healthScore: number;
  biomassKg: number;
  estimatedYieldKg: number;
}

export interface EnvironmentSnapshot {
  missionSol: number;
  totalMissionSols: number;
  currentLs: number;
  seasonName: SeasonName;
  seasonalSolarFlux: number;
  atmosphericPressure: number;
  dustStormRisk: DustStormRisk;
  airTemperature: number;
  humidity: number;
  co2Level: number;
  lightLevel: number;
  o2Level: number;
  externalTemp: number;
  solarRadiation: number;
  dustStormFactor: number;
  dustStormActive: boolean;
  resources: {
    waterConsumedL: number;
    energyUsedKWh: number;
    o2ProducedKg: number;
    totalHarvestKg: number;
  };
  greenhouseControls: {
    globalHeatingPower: number;
    co2InjectionRate: number;
    ventilationRate: number;
    lightingPower: number;
  };
  crops: Partial<Record<CropType, CropSnapshot>>;
}

// ─── Store Interface ────────────────────────────────────────────────────────────

export interface GreenhouseState {
  grid: TileData[][];
  simulationTime: Date;
  speed: SpeedKey;

  simState: ConcreteState;
  environment: ConcreteEnvironment;
  elapsedMinutes: number;

  temperature: number;
  humidity: number;
  co2Level: number;
  lightLevel: number;

  missionSol: number;
  currentLs: number;
  seasonName: SeasonName;
  dustStormRisk: DustStormRisk;
  dustStormActive: boolean;
  events: SimEvent[];
  totalHarvestKg: number;

  setSpeed: (speed: SpeedKey) => void;
  tick: () => void;
  skipToNextSol: () => void;
  setGrid: (grid: TileData[][]) => void;
  getEnvironmentSnapshot: () => EnvironmentSnapshot;
  applyParameterChanges: (
    changes: Array<{
      type: "greenhouse" | "crop";
      param: string;
      value: number;
      crop?: string;
    }>,
  ) => void;
  applyOverrides: (overrides: ManualOverrides) => void;
  doHarvest: (crop: CropType) => void;
  doReplant: (crop: CropType) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function syncGridFromEnv(grid: TileData[][], env: ConcreteEnvironment): TileData[][] {
  return grid.map((row) =>
    row.map((tile) => {
      if (tile.kind !== "crop" || !tile.crop) return tile;
      const c = env.crops[tile.crop];
      return {
        ...tile,
        growth: STAGE_TO_GROWTH_INDEX[c.stage],
        water: Math.round(c.soilMoisture),
        status: c.healthScore > 0.7 ? ("ok" as const) : c.healthScore > 0 ? ("warn" as const) : null,
      };
    }),
  );
}

function buildSnapshot(
  env: ConcreteEnvironment,
  gh: ConcreteGreenhouseState,
  totalHarvestKg: number,
): EnvironmentSnapshot {
  const crops: EnvironmentSnapshot["crops"] = {};
  for (const [key, ce] of Object.entries(env.crops) as [CropType, CropEnvironment][]) {
    crops[key] = {
      soilMoisture: round1(ce.soilMoisture),
      soilTemperature: round1(ce.soilTemperature),
      plantGrowth: round1(ce.plantGrowth),
      leafArea: Math.round(ce.leafArea * 100) / 100,
      fruitCount: ce.fruitCount,
      controls: { ...gh.crops[key] },
      stage: ce.stage,
      stageProgress: Math.round(ce.stageProgress * 100) / 100,
      daysSincePlanting: round1(ce.daysSincePlanting),
      healthScore: Math.round(ce.healthScore * 100) / 100,
      biomassKg: round1(ce.biomassKg),
      estimatedYieldKg: round1(ce.estimatedYieldKg),
    };
  }

  return {
    missionSol: env.missionSol,
    totalMissionSols: TOTAL_MISSION_SOLS,
    currentLs: Math.round(env.currentLs * 10) / 10,
    seasonName: env.seasonName,
    seasonalSolarFlux: Math.round(env.seasonalSolarFlux),
    atmosphericPressure: Math.round(env.atmosphericPressure),
    dustStormRisk: env.dustStormRisk,
    airTemperature: round1(env.airTemperature),
    humidity: round1(env.humidity),
    co2Level: Math.round(env.co2Level),
    lightLevel: Math.round(env.lightLevel),
    o2Level: round1(env.o2Level),
    externalTemp: round1(env.externalTemp),
    solarRadiation: Math.round(env.solarRadiation),
    dustStormFactor: Math.round(env.dustStormFactor * 100) / 100,
    dustStormActive: env.dustStormFactor < 0.9,
    resources: {
      waterConsumedL: round1(env.waterConsumedL),
      energyUsedKWh: round1(env.energyUsedKWh),
      o2ProducedKg: round1(env.o2ProducedKg),
      totalHarvestKg: round1(totalHarvestKg),
    },
    greenhouseControls: {
      globalHeatingPower: gh.globalHeatingPower,
      co2InjectionRate: gh.co2InjectionRate,
      ventilationRate: gh.ventilationRate,
      lightingPower: gh.lightingPower,
    },
    crops,
  };
}

// ─── Store ──────────────────────────────────────────────────────────────────────

function buildInitialSimulation() {
  const env = createInitialEnvironment();
  const greenhouse = createInitialGreenhouseState();
  const simulation = createSimulation(env, greenhouse);
  return { simulation, greenhouse, initialEnv: env };
}

const { simulation, greenhouse, initialEnv } = buildInitialSimulation();
const initialEnvironment = simulation.getEnvironment(0);
const initialGrid = syncGridFromEnv(INITIAL_GRID, initialEnvironment);

export const useGreenhouseStore = create<GreenhouseState>((set, get) => ({
  grid: initialGrid,
  simulationTime: new Date(initialEnvironment.timestamp),
  speed: "x1",

  simState: { simulation, greenhouse },
  environment: initialEnvironment,
  elapsedMinutes: 0,

  temperature: initialEnvironment.airTemperature,
  humidity: initialEnvironment.humidity,
  co2Level: initialEnvironment.co2Level,
  lightLevel: initialEnvironment.lightLevel,

  missionSol: initialEnvironment.missionSol,
  currentLs: initialEnvironment.currentLs,
  seasonName: initialEnvironment.seasonName,
  dustStormRisk: initialEnvironment.dustStormRisk,
  dustStormActive: initialEnvironment.dustStormFactor < 0.9,
  events: [],
  totalHarvestKg: 0,

  setSpeed: (speed) => set({ speed }),

  skipToNextSol: () => {
    const { elapsedMinutes, simState, grid, events } = get();
    const env = simState.simulation.getEnvironment(elapsedMinutes);
    const nextSolMinutes = (env.missionSol + 1) * SOL_HOURS * 60;
    const nextEnv = simState.simulation.getEnvironment(nextSolMinutes);
    const simTime = new Date(nextEnv.timestamp);

    const newEvents = [...events];
    const nowDust = nextEnv.dustStormFactor < 0.9;
    const wasDust = env.dustStormFactor < 0.9;
    if (nowDust && !wasDust) {
      newEvents.push({
        sol: nextEnv.missionSol, type: "dust_storm_start", severity: "warning",
        message: `Dust storm detected — solar output reduced to ${Math.round(nextEnv.dustStormFactor * 100)}%`,
      });
    } else if (!nowDust && wasDust) {
      newEvents.push({
        sol: nextEnv.missionSol, type: "dust_storm_end", severity: "info",
        message: "Dust storm has cleared — solar output returning to normal",
      });
    }

    set({
      elapsedMinutes: nextSolMinutes,
      environment: nextEnv,
      simulationTime: simTime,
      grid: syncGridFromEnv(grid, nextEnv),
      temperature: nextEnv.airTemperature,
      humidity: nextEnv.humidity,
      co2Level: nextEnv.co2Level,
      lightLevel: nextEnv.lightLevel,
      missionSol: nextEnv.missionSol,
      currentLs: nextEnv.currentLs,
      seasonName: nextEnv.seasonName,
      dustStormRisk: nextEnv.dustStormRisk,
      dustStormActive: nowDust,
      events: newEvents,
    });
  },

  tick: () => {
    const { elapsedMinutes, speed, simState, grid, events, missionSol: prevSol } = get();
    const mult = SPEED_MULTIPLIER[speed];
    const nextMinutes = elapsedMinutes + mult * TICK_INTERVAL_MS / 60000;
    const env = simState.simulation.getEnvironment(nextMinutes);
    const simTime = new Date(env.timestamp);
    const newGrid = syncGridFromEnv(grid, env);

    const newEvents = [...events];
    const nowDust = env.dustStormFactor < 0.9;
    const wasDust = get().dustStormActive;
    if (nowDust && !wasDust) {
      newEvents.push({
        sol: env.missionSol, type: "dust_storm_start", severity: "warning",
        message: `Dust storm detected — solar output reduced to ${Math.round(env.dustStormFactor * 100)}%`,
      });
    } else if (!nowDust && wasDust) {
      newEvents.push({
        sol: env.missionSol, type: "dust_storm_end", severity: "info",
        message: "Dust storm has cleared — solar output returning to normal",
      });
    }

    set({
      elapsedMinutes: nextMinutes,
      environment: env,
      simulationTime: simTime,
      grid: newGrid,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
      missionSol: env.missionSol,
      currentLs: env.currentLs,
      seasonName: env.seasonName,
      dustStormRisk: env.dustStormRisk,
      dustStormActive: nowDust,
      events: newEvents,
    });
  },

  setGrid: (grid) => set({ grid }),

  getEnvironmentSnapshot: () => {
    const { environment, simState, totalHarvestKg } = get();
    return buildSnapshot(environment, simState.greenhouse, totalHarvestKg);
  },

  applyParameterChanges: (changes) => {
    const { simState, elapsedMinutes } = get();
    let currentState: ConcreteState = simState;

    for (const change of changes) {
      if (change.type === "greenhouse") {
        currentState = updateGreenhouseParam(
          change.param as keyof ConcreteGreenhouseState,
          change.value as ConcreteGreenhouseState[keyof ConcreteGreenhouseState],
          elapsedMinutes,
        )(currentState) as ConcreteState;
      } else if (change.type === "crop" && change.crop) {
        currentState = updateCropParam(
          change.crop as CropType,
          change.param as keyof CropControls,
          change.value,
          elapsedMinutes,
        )(currentState) as ConcreteState;
      }
    }

    const env = currentState.simulation.getEnvironment(0);
    set({
      simState: currentState,
      elapsedMinutes: 0,
      environment: env,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
      grid: syncGridFromEnv(get().grid, env),
    });
  },

  applyOverrides: (overrides) => {
    const { simState, elapsedMinutes } = get();
    const newState = updateOverridesTransform(overrides, elapsedMinutes)(simState) as ConcreteState;
    const env = newState.simulation.getEnvironment(0);
    set({
      simState: newState,
      elapsedMinutes: 0,
      environment: env,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
      missionSol: env.missionSol,
      currentLs: env.currentLs,
      seasonName: env.seasonName,
      dustStormRisk: env.dustStormRisk,
      dustStormActive: env.dustStormFactor < 0.9,
      grid: syncGridFromEnv(get().grid, env),
    });
  },

  doHarvest: (crop) => {
    const { simState, elapsedMinutes, events, totalHarvestKg } = get();
    const { state: newState, yieldKg } = harvestCropTransform(simState, crop, elapsedMinutes);
    const env = newState.simulation.getEnvironment(0);

    const newEvents: SimEvent[] = [...events, {
      sol: env.missionSol, type: "harvest", severity: "info",
      message: `Harvested ${crop}: ${yieldKg.toFixed(1)} kg`,
      crop, data: { yieldKg },
    }];

    set({
      simState: newState,
      elapsedMinutes: 0,
      environment: env,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
      grid: syncGridFromEnv(get().grid, env),
      events: newEvents,
      totalHarvestKg: totalHarvestKg + yieldKg,
    });
  },

  doReplant: (crop) => {
    const { simState, elapsedMinutes, events } = get();
    const newState = replantCropTransform(simState, crop, elapsedMinutes);
    const env = newState.simulation.getEnvironment(0);

    const newEvents: SimEvent[] = [...events, {
      sol: env.missionSol, type: "replant", severity: "info",
      message: `Replanted ${crop} — new growth cycle started`,
      crop,
    }];

    set({
      simState: newState,
      elapsedMinutes: 0,
      environment: env,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
      grid: syncGridFromEnv(get().grid, env),
      events: newEvents,
    });
  },
}));

// ─── Display Helpers ────────────────────────────────────────────────────────────

export function getHourProgress(time: Date): number {
  return time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
}

export function getSkyColors(hour: number): { bg: string; overlay: string } {
  if (hour < 5) return { bg: "#0d1117", overlay: "rgba(10, 15, 30, 0.06)" };
  if (hour < 6.5) {
    const t = (hour - 5) / 1.5;
    return { bg: lerpColor("#0d1117", "#2c1810", t), overlay: `rgba(50, 30, 20, ${0.04 + t * 0.03})` };
  }
  if (hour < 8) {
    const t = (hour - 6.5) / 1.5;
    return { bg: lerpColor("#2c1810", "#faf6f0", t), overlay: `rgba(255, 180, 100, ${0.06 - t * 0.04})` };
  }
  if (hour < 11) {
    const t = (hour - 8) / 3;
    return { bg: lerpColor("#faf6f0", "#ffffff", t), overlay: `rgba(255, 255, 255, ${0.02 - t * 0.02})` };
  }
  if (hour < 15) return { bg: "#ffffff", overlay: "rgba(255, 255, 255, 0)" };
  if (hour < 17.5) {
    const t = (hour - 15) / 2.5;
    return { bg: lerpColor("#ffffff", "#fdf8f0", t), overlay: `rgba(255, 200, 120, ${t * 0.03})` };
  }
  if (hour < 19.5) {
    const t = (hour - 17.5) / 2;
    return { bg: lerpColor("#fdf8f0", "#1a1520", t), overlay: `rgba(200, 100, 60, ${0.03 + t * 0.04})` };
  }
  if (hour < 21) {
    const t = (hour - 19.5) / 1.5;
    return { bg: lerpColor("#1a1520", "#0d1117", t), overlay: `rgba(20, 15, 40, ${0.06 - t * 0.02})` };
  }
  return { bg: "#0d1117", overlay: "rgba(10, 15, 30, 0.06)" };
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.substring(0, 2), 16),
    Number.parseInt(h.substring(2, 4), 16),
    Number.parseInt(h.substring(4, 6), 16),
  ];
}
