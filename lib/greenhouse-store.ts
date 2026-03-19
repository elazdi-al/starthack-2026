import { create } from "zustand";
import type { CropType } from "../greenhouse/implementations/multi-crop/types";

export type { CropType };

export type TileKind = "crop" | "path";
export type Status = "ok" | "warn" | null;

export type SpeedKey = "x1" | "x2" | "x5" | "x10";

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
    name: "Lettuce",
    scientificName: "Lactuca sativa",
    growthCycleDays: 45,
    optimalTemp: [18, 24],
    lightHours: "16–18 h/day",
    waterPerDay: "0.8 L/m²",
    caloriesPer100g: 15,
    proteinPer100g: 1.4,
    keyNutrients: ["Vitamin A", "Vitamin K", "Folate"],
  },
  tomato: {
    name: "Tomato",
    scientificName: "Solanum lycopersicum",
    growthCycleDays: 80,
    optimalTemp: [20, 28],
    lightHours: "14–18 h/day",
    waterPerDay: "1.5 L/m²",
    caloriesPer100g: 18,
    proteinPer100g: 0.9,
    keyNutrients: ["Vitamin C", "Lycopene", "Potassium"],
  },
  potato: {
    name: "Potato",
    scientificName: "Solanum tuberosum",
    growthCycleDays: 90,
    optimalTemp: [15, 22],
    lightHours: "12–16 h/day",
    waterPerDay: "1.2 L/m²",
    caloriesPer100g: 77,
    proteinPer100g: 2.0,
    keyNutrients: ["Vitamin C", "Potassium", "Vitamin B6"],
  },
  soybean: {
    name: "Soybean",
    scientificName: "Glycine max",
    growthCycleDays: 100,
    optimalTemp: [20, 30],
    lightHours: "14–16 h/day",
    waterPerDay: "1.0 L/m²",
    caloriesPer100g: 173,
    proteinPer100g: 16.6,
    keyNutrients: ["Protein", "Iron", "Calcium"],
  },
  spinach: {
    name: "Spinach",
    scientificName: "Spinacia oleracea",
    growthCycleDays: 40,
    optimalTemp: [15, 22],
    lightHours: "14–16 h/day",
    waterPerDay: "0.7 L/m²",
    caloriesPer100g: 23,
    proteinPer100g: 2.9,
    keyNutrients: ["Iron", "Vitamin A", "Vitamin C"],
  },
  wheat: {
    name: "Wheat",
    scientificName: "Triticum aestivum",
    growthCycleDays: 120,
    optimalTemp: [18, 24],
    lightHours: "16–18 h/day",
    waterPerDay: "1.1 L/m²",
    caloriesPer100g: 340,
    proteinPer100g: 13.2,
    keyNutrients: ["Fiber", "Manganese", "Selenium"],
  },
  radish: {
    name: "Radish",
    scientificName: "Raphanus sativus",
    growthCycleDays: 30,
    optimalTemp: [16, 22],
    lightHours: "12–14 h/day",
    waterPerDay: "0.6 L/m²",
    caloriesPer100g: 16,
    proteinPer100g: 0.7,
    keyNutrients: ["Vitamin C", "Folate", "Potassium"],
  },
  kale: {
    name: "Kale",
    scientificName: "Brassica oleracea var. sabellica",
    growthCycleDays: 55,
    optimalTemp: [15, 24],
    lightHours: "14–16 h/day",
    waterPerDay: "0.9 L/m²",
    caloriesPer100g: 49,
    proteinPer100g: 4.3,
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
  x1: 1,
  x2: 2,
  x5: 5,
  x10: 10,
};

function makeInitialTimestamp(): number {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}

function buildInitialSimulation() {
  const env = createInitialEnvironment();
  env.timestamp = makeInitialTimestamp();
  const greenhouse = createInitialGreenhouseState();
  const simulation = createSimulation(env, greenhouse);
  return { simulation, greenhouse, initialEnv: env };
}

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

  setSpeed: (speed: SpeedKey) => void;
  tick: () => void;
  setGrid: (grid: TileData[][]) => void;
  getEnvironmentSnapshot: () => EnvironmentSnapshot;
}

export interface EnvironmentSnapshot {
  airTemperature: number;
  humidity: number;
  co2Level: number;
  lightLevel: number;
  externalTemp: number;
  solarRadiation: number;
  greenhouseControls: {
    globalHeatingPower: number;
    co2InjectionRate: number;
    ventilationRate: number;
    lightingPower: number;
  };
  tomatoes: {
    soilMoisture: number;
    soilTemperature: number;
    plantGrowth: number;
    leafArea: number;
    fruitCount: number;
    controls: { waterPumpRate: number; localHeatingPower: number };
  };
  carrots: {
    soilMoisture: number;
    soilTemperature: number;
    plantGrowth: number;
    leafArea: number;
    fruitCount: number;
    controls: { waterPumpRate: number; localHeatingPower: number };
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildSnapshot(
  env: ConcreteEnvironment,
  gh: ConcreteGreenhouseState,
): EnvironmentSnapshot {
  return {
    airTemperature: round1(env.airTemperature),
    humidity: round1(env.humidity),
    co2Level: Math.round(env.co2Level),
    lightLevel: Math.round(env.lightLevel),
    externalTemp: round1(env.externalTemp),
    solarRadiation: Math.round(env.solarRadiation),
    greenhouseControls: {
      globalHeatingPower: gh.globalHeatingPower,
      co2InjectionRate: gh.co2InjectionRate,
      ventilationRate: gh.ventilationRate,
      lightingPower: gh.lightingPower,
    },
    tomatoes: {
      soilMoisture: round1(env.tomatoes.soilMoisture),
      soilTemperature: round1(env.tomatoes.soilTemperature),
      plantGrowth: round1(env.tomatoes.plantGrowth),
      leafArea: Math.round(env.tomatoes.leafArea * 100) / 100,
      fruitCount: env.tomatoes.fruitCount,
      controls: { ...gh.tomatoes },
    },
    carrots: {
      soilMoisture: round1(env.carrots.soilMoisture),
      soilTemperature: round1(env.carrots.soilTemperature),
      plantGrowth: round1(env.carrots.plantGrowth),
      leafArea: Math.round(env.carrots.leafArea * 100) / 100,
      fruitCount: env.carrots.fruitCount,
      controls: { ...gh.carrots },
    },
  };
}

const { simulation, greenhouse, initialEnv } = buildInitialSimulation();
const initialEnvironment = simulation.getEnvironment(0);

export const useGreenhouseStore = create<GreenhouseState>((set, get) => ({
  grid: INITIAL_GRID,
  simulationTime: new Date(makeInitialTimestamp()),
  speed: "x1",

  simState: { simulation, greenhouse },
  environment: initialEnvironment,
  elapsedMinutes: 0,

  temperature: initialEnvironment.airTemperature,
  humidity: initialEnvironment.humidity,
  co2Level: initialEnvironment.co2Level,
  lightLevel: initialEnvironment.lightLevel,

  setSpeed: (speed) => set({ speed }),

  tick: () => {
    const { elapsedMinutes, speed, simState } = get();
    const mult = SPEED_MULTIPLIER[speed];
    const nextMinutes = elapsedMinutes + mult / 60;
    const env = simState.simulation.getEnvironment(nextMinutes);
    const simTime = new Date(env.timestamp);

    set({
      elapsedMinutes: nextMinutes,
      environment: env,
      simulationTime: simTime,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
    });
  },

  setGrid: (grid) => set({ grid }),

  getEnvironmentSnapshot: () => {
    const { environment, simState } = get();
    return buildSnapshot(environment, simState.greenhouse);
  },
}));

export function getHourProgress(time: Date): number {
  return time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
}

export function getSkyColors(hour: number): { bg: string; overlay: string } {
  if (hour < 5) {
    return { bg: "#0d1117", overlay: "rgba(10, 15, 30, 0.06)" };
  }
  if (hour < 6.5) {
    const t = (hour - 5) / 1.5;
    return {
      bg: lerpColor("#0d1117", "#2c1810", t),
      overlay: `rgba(50, 30, 20, ${0.04 + t * 0.03})`,
    };
  }
  if (hour < 8) {
    const t = (hour - 6.5) / 1.5;
    return {
      bg: lerpColor("#2c1810", "#faf6f0", t),
      overlay: `rgba(255, 180, 100, ${0.06 - t * 0.04})`,
    };
  }
  if (hour < 11) {
    const t = (hour - 8) / 3;
    return {
      bg: lerpColor("#faf6f0", "#ffffff", t),
      overlay: `rgba(255, 255, 255, ${0.02 - t * 0.02})`,
    };
  }
  if (hour < 15) {
    return { bg: "#ffffff", overlay: "rgba(255, 255, 255, 0)" };
  }
  if (hour < 17.5) {
    const t = (hour - 15) / 2.5;
    return {
      bg: lerpColor("#ffffff", "#fdf8f0", t),
      overlay: `rgba(255, 200, 120, ${t * 0.03})`,
    };
  }
  if (hour < 19.5) {
    const t = (hour - 17.5) / 2;
    return {
      bg: lerpColor("#fdf8f0", "#1a1520", t),
      overlay: `rgba(200, 100, 60, ${0.03 + t * 0.04})`,
    };
  }
  if (hour < 21) {
    const t = (hour - 19.5) / 1.5;
    return {
      bg: lerpColor("#1a1520", "#0d1117", t),
      overlay: `rgba(20, 15, 40, ${0.06 - t * 0.02})`,
    };
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
