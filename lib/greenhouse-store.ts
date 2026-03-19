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
  harvestTile as harvestTileTransform,
  plantTile as plantTileTransform,
  clearTile as clearTileTransform,
} from "@/greenhouse/implementations/multi-crop/transformation";

export type { CropType, GrowthStage, SeasonName, DustStormRisk, ManualOverrides };

// ─── Agent Decision Log ──────────────────────────────────────────────────────────

export interface AgentAction {
  type: "greenhouse" | "crop" | "harvest" | "replant" | "harvest-tile" | "plant-tile" | "clear-tile";
  param?: string;
  value?: number;
  crop?: string;
  tileId?: string;
}

export interface AgentDecision {
  id: string;
  sol: number;
  elapsedMinutes: number;
  time: string;
  summary: string;
  reasoning: string;
  actions: AgentAction[];
  actionCount: number;
}

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
  stage?: GrowthStage;
  sensor?: boolean;
  crop?: CropType;
  tileId?: string;  // unique tile identifier for per-tile crop state (e.g. "lettuce_0_0")
}

// ─── 12×9 Greenhouse Layout ─────────────────────────────────────────────────
// Organised into 8 crop rectangles separated by clear paths.
//
//  Cols:  0  1  2  3  4  5 |6| 7  8  9  10 11
//  Row 0: Lettuce (3×3)    |p| Tomato (3×3)         Potato (3×2 right)
//  Row 1:                  |p|                       ...
//  Row 2:                  |p|                       ...
//  Row 3: p  p  p  p  p  p  p  p  p  p  p  p       <- horizontal path
//  Row 4: Soybean (3×2)    |p| Spinach (3×2)        Wheat (3×2 right)
//  Row 5:                  |p|                       ...
//  Row 6: p  p  p  p  p  p  p  p  p  p  p  p       <- horizontal path
//  Row 7: Radish (3×2)     |p| Kale (3×2)           (more Soybean 3×2)
//  Row 8:                  |p|                       ...

const P: TileData = { kind: "path", growth: 0, water: 0, status: null };
const PS: TileData = { kind: "path", growth: 0, water: 0, status: null, sensor: true };

function ct(crop: CropType, row: number, col: number, growth: number, water: number, status: Status = "ok"): TileData {
  return { kind: "crop", growth, water, status, crop, tileId: `${crop}_${row}_${col}` };
}

const INITIAL_GRID: TileData[][] = [
  // Row 0: Lettuce | path | Tomato | path | Potato
  [
    ct("lettuce",0,0, 0,0), ct("lettuce",0,1, 0,0), ct("lettuce",0,2, 0,0),
    P,
    ct("tomato",0,4, 0,0), ct("tomato",0,5, 0,0),
    P,
    ct("potato",0,7, 0,0), ct("potato",0,8, 0,0), ct("potato",0,9, 0,0),
    P,
    ct("wheat",0,11, 0,0),
  ],
  // Row 1
  [
    ct("lettuce",1,0, 0,0), ct("lettuce",1,1, 0,0), ct("lettuce",1,2, 0,0),
    P,
    ct("tomato",1,4, 0,0), ct("tomato",1,5, 0,0),
    PS,
    ct("potato",1,7, 0,0), ct("potato",1,8, 0,0), ct("potato",1,9, 0,0),
    P,
    ct("wheat",1,11, 0,0),
  ],
  // Row 2
  [
    ct("lettuce",2,0, 0,0), ct("lettuce",2,1, 0,0), ct("lettuce",2,2, 0,0),
    P,
    ct("tomato",2,4, 0,0), ct("tomato",2,5, 0,0),
    P,
    ct("potato",2,7, 0,0), ct("potato",2,8, 0,0), ct("potato",2,9, 0,0),
    P,
    ct("wheat",2,11, 0,0),
  ],
  // Row 3: horizontal path
  [P, P, P, P, P, P, PS, P, P, P, P, P],
  // Row 4: Soybean | path | Spinach | path | Wheat
  [
    ct("soybean",4,0, 0,0), ct("soybean",4,1, 0,0), ct("soybean",4,2, 0,0),
    P,
    ct("spinach",4,4, 0,0), ct("spinach",4,5, 0,0),
    P,
    ct("wheat",4,7, 0,0), ct("wheat",4,8, 0,0), ct("wheat",4,9, 0,0),
    P,
    ct("kale",4,11, 0,0),
  ],
  // Row 5
  [
    ct("soybean",5,0, 0,0), ct("soybean",5,1, 0,0), ct("soybean",5,2, 0,0),
    P,
    ct("spinach",5,4, 0,0), ct("spinach",5,5, 0,0),
    P,
    ct("wheat",5,7, 0,0), ct("wheat",5,8, 0,0), ct("wheat",5,9, 0,0),
    PS,
    ct("kale",5,11, 0,0),
  ],
  // Row 6: horizontal path
  [P, P, P, P, P, P, P, PS, P, P, P, P],
  // Row 7: Radish | path | Kale | path | extra Soybean
  [
    ct("radish",7,0, 0,0), ct("radish",7,1, 0,0), ct("radish",7,2, 0,0),
    P,
    ct("kale",7,4, 0,0), ct("kale",7,5, 0,0),
    P,
    ct("soybean",7,7, 0,0), ct("radish",7,8, 0,0), ct("spinach",7,9, 0,0),
    P,
    ct("tomato",7,11, 0,0),
  ],
  // Row 8
  [
    ct("radish",8,0, 0,0), ct("radish",8,1, 0,0), ct("radish",8,2, 0,0),
    P,
    ct("kale",8,4, 0,0), ct("kale",8,5, 0,0),
    P,
    ct("soybean",8,7, 0,0), ct("radish",8,8, 0,0), ct("spinach",8,9, 0,0),
    P,
    ct("tomato",8,11, 0,0),
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
  controls: { waterPumpRate: number; localHeatingPower: number; nutrientConcentration: number; aerationRate: number };
  stage: GrowthStage;
  stageProgress: number;
  daysSincePlanting: number;
  healthScore: number;
  biomassKg: number;
  estimatedYieldKg: number;
  rootO2Level: number;
  nutrientEC: number;
  diseaseRisk: number;
  isBolting: boolean;
}

/** Per-tile crop snapshot — agents can monitor individual entities. */
export interface TileCropSnapshot {
  tileId: string;
  cropType: CropType;
  soilMoisture: number;
  soilTemperature: number;
  plantGrowth: number;
  leafArea: number;
  fruitCount: number;
  stage: GrowthStage;
  stageProgress: number;
  daysSincePlanting: number;
  healthScore: number;
  biomassKg: number;
  estimatedYieldKg: number;
  rootO2Level: number;
  nutrientEC: number;
  diseaseRisk: number;
  isBolting: boolean;
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
  // Extended realism
  waterRecyclingEfficiency: number;
  solarGenerationKW: number;
  batteryStorageKWh: number;
  batteryCapacityKWh: number;
  energyDeficit: boolean;
  co2SafetyAlert: boolean;
  nutritionalOutput: import("@/greenhouse/implementations/multi-crop/types").NutritionalOutput;
  nutritionalCoverage: number;
  foodReservesSols: number;
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
  /** Per-tile crop states — agents can monitor and act on individual entities. */
  tileCrops: Record<string, TileCropSnapshot>;
  /** Summary: count of tiles per crop type (helps agents decide planting allocation). */
  tileCounts: Partial<Record<CropType, { total: number; planted: number; harvested: number }>>;
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
  focusedCrop: CropType | null;

  // Autonomous agent tick
  lastTickSimMinutes: number;
  tickInFlight: boolean;
  autonomousEnabled: boolean;
  agentDecisions: AgentDecision[];

  setSpeed: (speed: SpeedKey) => void;
  setFocusedCrop: (crop: CropType | null) => void;
  tick: () => void;
  skipTime: (minutes: number) => void;
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
  doHarvestTile: (tileId: string) => void;
  doPlantTile: (tileId: string, crop: CropType) => void;
  doClearTile: (tileId: string) => void;
  setAutonomousEnabled: (enabled: boolean) => void;
  autonomousTick: () => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function syncGridFromEnv(grid: TileData[][], env: ConcreteEnvironment): TileData[][] {
  return grid.map((row) =>
    row.map((tile) => {
      if (tile.kind !== "crop" || !tile.crop) return tile;
      // Prefer per-tile state if available; fall back to aggregate per-type
      const tileCrop = tile.tileId ? env.tileCrops?.[tile.tileId] : undefined;
      const c: CropEnvironment = tileCrop ?? env.crops[tile.crop];
      // Update crop type if tile has been reassigned to a different crop
      const effectiveCrop = tileCrop ? tileCrop.cropType : tile.crop;
      return {
        ...tile,
        crop: effectiveCrop,
        growth: STAGE_TO_GROWTH_INDEX[c.stage],
        stage: c.stage,
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
      rootO2Level: round1(ce.rootO2Level),
      nutrientEC: Math.round(ce.nutrientEC * 100) / 100,
      diseaseRisk: Math.round(ce.diseaseRisk * 100) / 100,
      isBolting: ce.isBolting,
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
    waterRecyclingEfficiency: Math.round(env.waterRecyclingEfficiency * 1000) / 1000,
    solarGenerationKW: round1(env.solarGenerationKW),
    batteryStorageKWh: round1(env.batteryStorageKWh),
    batteryCapacityKWh: gh.batteryCapacityKWh,
    energyDeficit: env.energyDeficit,
    co2SafetyAlert: env.co2SafetyAlert,
    nutritionalOutput: env.nutritionalOutput,
    nutritionalCoverage: Math.round(env.nutritionalCoverage * 1000) / 1000,
    foodReservesSols: Math.round(env.foodReservesSols * 10) / 10,
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
    tileCrops: buildTileCropSnapshots(env),
    tileCounts: buildTileCounts(env),
  };
}

/** Build per-tile snapshots from the simulation's tileCrops data. */
function buildTileCropSnapshots(env: ConcreteEnvironment): Record<string, TileCropSnapshot> {
  const result: Record<string, TileCropSnapshot> = {};
  if (!env.tileCrops) return result;
  for (const [tileId, tc] of Object.entries(env.tileCrops)) {
    result[tileId] = {
      tileId: tc.tileId,
      cropType: tc.cropType,
      soilMoisture: round1(tc.soilMoisture),
      soilTemperature: round1(tc.soilTemperature),
      plantGrowth: round1(tc.plantGrowth),
      leafArea: Math.round(tc.leafArea * 100) / 100,
      fruitCount: tc.fruitCount,
      stage: tc.stage,
      stageProgress: Math.round(tc.stageProgress * 100) / 100,
      daysSincePlanting: round1(tc.daysSincePlanting),
      healthScore: Math.round(tc.healthScore * 100) / 100,
      biomassKg: round1(tc.biomassKg),
      estimatedYieldKg: round1(tc.estimatedYieldKg),
      rootO2Level: round1(tc.rootO2Level),
      nutrientEC: Math.round(tc.nutrientEC * 100) / 100,
      diseaseRisk: Math.round(tc.diseaseRisk * 100) / 100,
      isBolting: tc.isBolting,
    };
  }
  return result;
}

/** Build summary counts of tiles per crop type. */
function buildTileCounts(env: ConcreteEnvironment): EnvironmentSnapshot['tileCounts'] {
  const counts: EnvironmentSnapshot['tileCounts'] = {};
  if (!env.tileCrops) return counts;
  for (const tc of Object.values(env.tileCrops)) {
    const ct = tc.cropType;
    if (!counts[ct]) counts[ct] = { total: 0, planted: 0, harvested: 0 };
    counts[ct]!.total++;
    if (tc.stage === 'harvested' || tc.healthScore === 0) {
      counts[ct]!.harvested++;
    } else {
      counts[ct]!.planted++;
    }
  }
  return counts;
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
  focusedCrop: null,

  lastTickSimMinutes: 0,
  tickInFlight: false,
  autonomousEnabled: true,
  agentDecisions: [],

  setSpeed: (speed) => set({ speed }),
  setFocusedCrop: (crop) => set({ focusedCrop: crop }),

  skipTime: (minutes) => {
    const { elapsedMinutes, simState, grid, events } = get();
    const targetMinutes = elapsedMinutes + minutes;
    const env = simState.simulation.getEnvironment(elapsedMinutes);
    const nextEnv = simState.simulation.getEnvironment(targetMinutes);
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
      elapsedMinutes: targetMinutes,
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
    // Freeze time while the agent is thinking so a speed change mid-tick
    // doesn't cause the simulation to jump when actions are applied.
    if (get().tickInFlight) return;
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
    if (env.energyDeficit && !get().environment.energyDeficit) {
      newEvents.push({
        sol: env.missionSol, type: "resource_warning", severity: "critical",
        message: "Energy deficit — battery depleted, non-critical systems throttled",
      });
    }
    if (env.co2SafetyAlert && !get().environment.co2SafetyAlert) {
      newEvents.push({
        sol: env.missionSol, type: "resource_warning", severity: "critical",
        message: `CO₂ safety threshold exceeded: ${Math.round(env.co2Level)} ppm — crew health at risk`,
      });
    }
    if (env.waterRecyclingEfficiency < 0.75 && get().environment.waterRecyclingEfficiency >= 0.75) {
      newEvents.push({
        sol: env.missionSol, type: "resource_warning", severity: "warning",
        message: `Water recycling efficiency dropped to ${Math.round(env.waterRecyclingEfficiency * 100)}% — irrigation compromised`,
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

    // Fire autonomous agent tick every 2 simulation hours (120 minutes)
    const { lastTickSimMinutes, tickInFlight, autonomousEnabled } = get();
    if (autonomousEnabled && !tickInFlight && nextMinutes - lastTickSimMinutes >= 120) {
      get().autonomousTick();
    }
  },

  setGrid: (grid) => set({ grid }),

  getEnvironmentSnapshot: () => {
    const { environment, simState, totalHarvestKg } = get();
    return buildSnapshot(environment, simState.greenhouse, totalHarvestKg);
  },

  applyParameterChanges: (changes) => {
    const { simState, elapsedMinutes } = get();
    let currentState: ConcreteState = simState;

    // Pass elapsedMinutes only to the first transform so it advances
    // time once. Subsequent changes use 0 to avoid double-advancing.
    let timeConsumed = false;
    for (const change of changes) {
      const t = timeConsumed ? 0 : elapsedMinutes;
      if (change.type === "greenhouse") {
        currentState = updateGreenhouseParam(
          change.param as keyof ConcreteGreenhouseState,
          change.value as ConcreteGreenhouseState[keyof ConcreteGreenhouseState],
          t,
        )(currentState) as ConcreteState;
      } else if (change.type === "crop" && change.crop) {
        currentState = updateCropParam(
          change.crop as CropType,
          change.param as keyof CropControls,
          change.value,
          t,
        )(currentState) as ConcreteState;
      }
      timeConsumed = true;
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

  doHarvestTile: (tileId) => {
    const { simState, elapsedMinutes, events, totalHarvestKg } = get();
    const { state: newState, yieldKg } = harvestTileTransform(simState, tileId, elapsedMinutes);
    const env = newState.simulation.getEnvironment(0);
    const tileCrop = env.tileCrops[tileId];
    const cropName = tileCrop?.cropType ?? 'unknown';

    const newEvents: SimEvent[] = [...events, {
      sol: env.missionSol, type: "harvest", severity: "info",
      message: `Harvested tile ${tileId} (${cropName}): ${yieldKg.toFixed(1)} kg`,
      crop: cropName as CropType, data: { yieldKg, tileId },
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

  doPlantTile: (tileId, crop) => {
    const { simState, elapsedMinutes, events } = get();
    const newState = plantTileTransform(simState, tileId, crop, elapsedMinutes);
    const env = newState.simulation.getEnvironment(0);

    // Update the grid tile's crop type to reflect the new planting
    const newGrid = get().grid.map((row) =>
      row.map((tile) => {
        if (tile.tileId === tileId) {
          return { ...tile, crop };
        }
        return tile;
      }),
    );

    const newEvents: SimEvent[] = [...events, {
      sol: env.missionSol, type: "replant", severity: "info",
      message: `Planted ${crop} on tile ${tileId}`,
      crop, data: { tileId },
    }];

    set({
      simState: newState,
      elapsedMinutes: 0,
      environment: env,
      temperature: env.airTemperature,
      humidity: env.humidity,
      co2Level: env.co2Level,
      lightLevel: env.lightLevel,
      grid: syncGridFromEnv(newGrid, env),
      events: newEvents,
    });
  },

  doClearTile: (tileId) => {
    const { simState, elapsedMinutes, events } = get();
    const tileCropBefore = simState.simulation.getEnvironment(elapsedMinutes).tileCrops[tileId];
    const cropName = tileCropBefore?.cropType ?? 'unknown';
    const newState = clearTileTransform(simState, tileId, elapsedMinutes);
    const env = newState.simulation.getEnvironment(0);

    const newEvents: SimEvent[] = [...events, {
      sol: env.missionSol, type: "harvest", severity: "info",
      message: `Cleared tile ${tileId} (${cropName})`,
      crop: cropName as CropType, data: { tileId },
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

  setAutonomousEnabled: (enabled) => set({ autonomousEnabled: enabled }),

  autonomousTick: async () => {
    const { tickInFlight, elapsedMinutes, environment, simState, totalHarvestKg, events } = get();
    if (tickInFlight) return;

    set({ tickInFlight: true, lastTickSimMinutes: elapsedMinutes });

    try {
      const snapshot = buildSnapshot(environment, simState.greenhouse, totalHarvestKg);

      const res = await fetch('/api/agent-tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      if (!res.ok) return;

      const data = await res.json() as {
        ok: boolean;
        summary?: string;
        reasoning?: string;
        actions?: Array<{
          type: "greenhouse" | "crop" | "harvest" | "replant" | "harvest-tile" | "plant-tile" | "clear-tile";
          param?: string;
          value?: number;
          crop?: string;
          tileId?: string;
        }>;
      };

      if (!data.ok || !data.actions) return;

      // Record decision and push to event log
      const currentEnv = get().environment;
      const simTime = get().simulationTime;
      const hh = String(simTime.getHours()).padStart(2, "0");
      const mm = String(simTime.getMinutes()).padStart(2, "0");
      const decision: AgentDecision = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sol: currentEnv.missionSol,
        elapsedMinutes,
        time: `${hh}:${mm}`,
        summary: data.summary ?? 'Autonomous tick completed',
        reasoning: data.reasoning ?? '',
        actions: data.actions as AgentAction[],
        actionCount: data.actions.length,
      };
      const agentEvents: SimEvent[] = [...get().events, {
        sol: currentEnv.missionSol,
        type: "agent_action",
        severity: "info",
        message: `[Agent] ${decision.summary}`,
      }];
      set({
        agentDecisions: [decision, ...get().agentDecisions].slice(0, 50),
        events: agentEvents,
      });

      // Apply harvests, replants, and tile-level actions first, then parameter changes
      for (const action of data.actions) {
        if (action.type === "harvest" && action.crop) {
          get().doHarvest(action.crop as CropType);
        } else if (action.type === "replant" && action.crop) {
          get().doReplant(action.crop as CropType);
        } else if (action.type === "harvest-tile" && action.tileId) {
          get().doHarvestTile(action.tileId);
        } else if (action.type === "plant-tile" && action.tileId && action.crop) {
          get().doPlantTile(action.tileId, action.crop as CropType);
        } else if (action.type === "clear-tile" && action.tileId) {
          get().doClearTile(action.tileId);
        }
      }

      const paramChanges = data.actions
        .filter((a) => a.type === "greenhouse" || a.type === "crop")
        .map((a) => ({
          type: a.type as "greenhouse" | "crop",
          param: a.param!,
          value: a.value!,
          crop: a.crop,
        }));

      if (paramChanges.length > 0) {
        get().applyParameterChanges(paramChanges);
      }
    } catch (err) {
      console.error('[autonomousTick] error:', err);
    } finally {
      set({ tickInFlight: false, lastTickSimMinutes: get().elapsedMinutes });
    }
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
