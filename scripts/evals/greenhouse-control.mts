import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { createInitialState } from '../../greenhouse/implementations/multi-crop';
import { STAGE_TO_GROWTH_INDEX } from '../../greenhouse/implementations/multi-crop';
import type { CropType, GrowthStage } from '../../greenhouse/implementations/multi-crop/types';
import { createInitialCrew } from '../../lib/crew-data';
import type { CropSnapshot, EnvironmentSnapshot, TileCropSnapshot } from '../../lib/greenhouse-store';
import {
  greenhouseControlAssessScorer,
  greenhouseControlScenarioFitScorer,
  greenhouseControlActionSafetyScorer,
  type GreenhouseControlScenarioGroundTruth,
} from '../../mastra/evals/greenhouse-control-scorers';
import { ReasonOutputSchema, SituationReportSchema, greenhouseControlWorkflow } from '../../mastra/workflows/greenhouse-control';
import { mastra } from '../../src/mastra/index';

type EvalCase = {
  name: string;
  snapshot: EnvironmentSnapshot;
  groundTruth: GreenhouseControlScenarioGroundTruth;
  variant: number;
};

type EvalOptions = {
  variantsPerScenario: number;
  concurrency: number;
  threshold: number;
  limit?: number;
  reportDir: string;
};

type EvalRecord = {
  name: string;
  scenarioId: string;
  category: string;
  variant: number;
  traceId?: string;
  status: string;
  assessScore: number;
  actionSafetyScore: number;
  scenarioFitScore: number;
  weightedScore: number;
  pass: boolean;
  summary: string;
  reasoning: string;
  actionCount: number;
  actions: unknown[];
  assessReason?: string;
  actionSafetyReason?: string;
  scenarioFitReason?: string;
};

type ScoreResultLike = {
  score?: number;
  reason?: string;
};

type WorkflowStepLike = {
  status?: string;
  payload?: unknown;
  output?: unknown;
};

type WorkflowResultLike = {
  status: string;
  traceId?: string;
  result?: unknown;
  error?: { message?: string };
  steps?: Record<string, WorkflowStepLike>;
};

type WorkflowOutput = z.infer<typeof ReasonOutputSchema>;
type AssessOutput = z.infer<typeof SituationReportSchema>;

const TOTAL_MISSION_SOLS = 450;
const TRACE_TAG = 'greenhouse-control-eval';
const CROP_NAMES: CropType[] = ['lettuce', 'tomato', 'potato', 'soybean', 'spinach', 'wheat', 'radish', 'kale'];
const STAGE_ORDER: Record<GrowthStage, number> = {
  harvested: 0,
  seed: 1,
  germination: 2,
  vegetative: 3,
  flowering: 4,
  fruiting: 5,
  harvest_ready: 6,
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function actionSummary(actions: unknown[]): string {
  if (actions.length === 0) return 'no actions';
  return actions
    .map((action) => {
      const candidate = action as Record<string, unknown>;
      if (candidate.type === 'greenhouse') return `greenhouse:${candidate.param}=${candidate.value}`;
      if (candidate.type === 'crop') return `crop:${candidate.crop}.${candidate.param}=${candidate.value}`;
      if (candidate.type === 'harvest' || candidate.type === 'replant') return `${candidate.type}:${candidate.crop}`;
      if (candidate.type === 'batch-tile') {
        const plants = Array.isArray(candidate.plants) ? candidate.plants.length : 0;
        const harvests = Array.isArray(candidate.harvests) ? candidate.harvests.length : 0;
        const clears = Array.isArray(candidate.clears) ? candidate.clears.length : 0;
        return `batch-tile[p=${plants},h=${harvests},c=${clears}]`;
      }
      return String(candidate.type ?? 'unknown');
    })
    .join(', ');
}

function parseArgs(argv: string[]): EvalOptions {
  const options: EvalOptions = {
    variantsPerScenario: 3,
    concurrency: 2,
    threshold: 0.75,
    reportDir: 'artifacts/evals/greenhouse-control',
  };

  for (const arg of argv) {
    if (arg.startsWith('--variants=')) options.variantsPerScenario = Number(arg.slice('--variants='.length));
    if (arg.startsWith('--concurrency=')) options.concurrency = Number(arg.slice('--concurrency='.length));
    if (arg.startsWith('--threshold=')) options.threshold = Number(arg.slice('--threshold='.length));
    if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length));
    if (arg.startsWith('--report-dir=')) options.reportDir = arg.slice('--report-dir='.length);
  }

  return options;
}

function buildSnapshot(): EnvironmentSnapshot {
  const initialState = createInitialState();
  const environment = initialState.simulation.getEnvironment(0);
  const greenhouse = initialState.greenhouse;

  const crops: Partial<Record<CropType, CropSnapshot>> = {};
  for (const crop of CROP_NAMES) {
    const source = environment.crops[crop];
    crops[crop] = {
      soilMoisture: round1(source.soilMoisture),
      soilTemperature: round1(source.soilTemperature),
      plantGrowth: round1(source.plantGrowth),
      leafArea: round2(source.leafArea),
      fruitCount: source.fruitCount,
      controls: { ...greenhouse.crops[crop] },
      stage: source.stage,
      stageProgress: round2(source.stageProgress),
      daysSincePlanting: round1(source.daysSincePlanting),
      healthScore: round2(source.healthScore),
      biomassKg: round1(source.biomassKg),
      estimatedYieldKg: round1(source.estimatedYieldKg),
      rootO2Level: round1(source.rootO2Level),
      nutrientEC: round2(source.nutrientEC),
      diseaseRisk: round2(source.diseaseRisk),
      isBolting: source.isBolting,
    };
  }

  const tileCrops: Record<string, TileCropSnapshot> = {};
  for (const [tileId, tile] of Object.entries(environment.tileCrops)) {
    tileCrops[tileId] = {
      tileId,
      cropType: tile.cropType,
      soilMoisture: round1(tile.soilMoisture),
      soilTemperature: round1(tile.soilTemperature),
      plantGrowth: round1(tile.plantGrowth),
      leafArea: round2(tile.leafArea),
      fruitCount: tile.fruitCount,
      stage: tile.stage,
      stageProgress: round2(tile.stageProgress),
      daysSincePlanting: round1(tile.daysSincePlanting),
      healthScore: round2(tile.healthScore),
      biomassKg: round1(tile.biomassKg),
      estimatedYieldKg: round1(tile.estimatedYieldKg),
      rootO2Level: round1(tile.rootO2Level),
      nutrientEC: round2(tile.nutrientEC),
      diseaseRisk: round2(tile.diseaseRisk),
      isBolting: tile.isBolting,
    };
  }

  return {
    missionSol: environment.missionSol,
    totalMissionSols: TOTAL_MISSION_SOLS,
    currentLs: round1(environment.currentLs),
    seasonName: environment.seasonName,
    seasonalSolarFlux: Math.round(environment.seasonalSolarFlux),
    atmosphericPressure: Math.round(environment.atmosphericPressure),
    dustStormRisk: environment.dustStormRisk,
    airTemperature: round1(environment.airTemperature),
    humidity: round1(environment.humidity),
    co2Level: Math.round(environment.co2Level),
    lightLevel: Math.round(environment.lightLevel),
    o2Level: round1(environment.o2Level),
    externalTemp: round1(environment.externalTemp),
    solarRadiation: Math.round(environment.solarRadiation),
    dustStormFactor: round2(environment.dustStormFactor),
    dustStormActive: environment.dustStormFactor < 0.9,
    waterRecyclingEfficiency: round3(environment.waterRecyclingEfficiency),
    solarGenerationKW: round1(environment.solarGenerationKW),
    batteryStorageKWh: round1(environment.batteryStorageKWh),
    batteryCapacityKWh: greenhouse.batteryCapacityKWh,
    energyDeficit: environment.energyDeficit,
    co2SafetyAlert: environment.co2SafetyAlert,
    nutritionalOutput: { ...environment.nutritionalOutput },
    nutritionalCoverage: round3(environment.nutritionalCoverage),
    foodReservesSols: round1(environment.foodReservesSols),
    resources: {
      waterConsumedL: round1(environment.waterConsumedL),
      energyUsedKWh: round1(environment.energyUsedKWh),
      o2ProducedKg: round1(environment.o2ProducedKg),
      totalHarvestKg: 0,
    },
    greenhouseControls: {
      globalHeatingPower: greenhouse.globalHeatingPower,
      co2InjectionRate: greenhouse.co2InjectionRate,
      ventilationRate: greenhouse.ventilationRate,
      lightingPower: greenhouse.lightingPower,
    },
    crops,
    tileCrops,
    tileCounts: buildTileCounts(tileCrops),
    crew: createInitialCrew(),
  };
}

function buildTileCounts(tileCrops: Record<string, TileCropSnapshot>): EnvironmentSnapshot['tileCounts'] {
  const counts: EnvironmentSnapshot['tileCounts'] = {};
  for (const tile of Object.values(tileCrops)) {
    if (!counts[tile.cropType]) counts[tile.cropType] = { total: 0, planted: 0, harvested: 0 };
    counts[tile.cropType]!.total += 1;
    if (tile.stage === 'harvested' || tile.healthScore === 0) {
      counts[tile.cropType]!.harvested += 1;
    } else {
      counts[tile.cropType]!.planted += 1;
    }
  }
  return counts;
}

function recomputeAggregateCrops(snapshot: EnvironmentSnapshot) {
  const nextCrops: Partial<Record<CropType, CropSnapshot>> = {};

  for (const crop of CROP_NAMES) {
    const tiles = Object.values(snapshot.tileCrops).filter(tile => tile.cropType === crop);
    const fallbackControls = snapshot.crops[crop]?.controls ?? {
      waterPumpRate: 8,
      localHeatingPower: 300,
      nutrientConcentration: 2,
      aerationRate: 70,
    };

    if (tiles.length === 0) {
      nextCrops[crop] = {
        soilMoisture: 0,
        soilTemperature: snapshot.airTemperature,
        plantGrowth: 0,
        leafArea: 0,
        fruitCount: 0,
        controls: { ...fallbackControls },
        stage: 'harvested',
        stageProgress: 0,
        daysSincePlanting: 0,
        healthScore: 0,
        biomassKg: 0,
        estimatedYieldKg: 0,
        rootO2Level: 0,
        nutrientEC: 0,
        diseaseRisk: 0,
        isBolting: false,
      };
      continue;
    }

    const representative = tiles.reduce((best, tile) => (
      STAGE_ORDER[tile.stage] > STAGE_ORDER[best.stage] ? tile : best
    ));
    const average = (selector: (tile: TileCropSnapshot) => number) => tiles.reduce((sum, tile) => sum + selector(tile), 0) / tiles.length;

    nextCrops[crop] = {
      soilMoisture: round1(average(tile => tile.soilMoisture)),
      soilTemperature: round1(average(tile => tile.soilTemperature)),
      plantGrowth: round1(average(tile => tile.plantGrowth)),
      leafArea: round2(average(tile => tile.leafArea)),
      fruitCount: Math.round(average(tile => tile.fruitCount)),
      controls: { ...fallbackControls },
      stage: representative.stage,
      stageProgress: round2(average(tile => tile.stageProgress)),
      daysSincePlanting: round1(average(tile => tile.daysSincePlanting)),
      healthScore: round2(average(tile => tile.healthScore)),
      biomassKg: round1(average(tile => tile.biomassKg)),
      estimatedYieldKg: round1(average(tile => tile.estimatedYieldKg)),
      rootO2Level: round1(average(tile => tile.rootO2Level)),
      nutrientEC: round2(average(tile => tile.nutrientEC)),
      diseaseRisk: round2(average(tile => tile.diseaseRisk)),
      isBolting: tiles.some(tile => tile.isBolting),
    };
  }

  snapshot.crops = nextCrops;
  snapshot.tileCounts = buildTileCounts(snapshot.tileCrops);
}

function setNominalEnvironment(snapshot: EnvironmentSnapshot, rng: () => number) {
  snapshot.missionSol = 110 + Math.floor(rng() * 40);
  snapshot.currentLs = round1(130 + rng() * 40);
  snapshot.seasonName = 'northern_summer';
  snapshot.dustStormRisk = 'moderate';
  snapshot.airTemperature = round1(21.5 + rng() * 2);
  snapshot.humidity = round1(64 + rng() * 8);
  snapshot.co2Level = Math.round(900 + rng() * 160);
  snapshot.lightLevel = Math.round(5200 + rng() * 900);
  snapshot.o2Level = round1(20.5 + rng() * 0.5);
  snapshot.externalTemp = round1(-52 + rng() * 8);
  snapshot.solarRadiation = Math.round(430 + rng() * 80);
  snapshot.dustStormFactor = 1;
  snapshot.dustStormActive = false;
  snapshot.waterRecyclingEfficiency = round3(0.92 + rng() * 0.03);
  snapshot.solarGenerationKW = round1(24 + rng() * 8);
  snapshot.batteryStorageKWh = round1(145 + rng() * 30);
  snapshot.batteryCapacityKWh = 200;
  snapshot.energyDeficit = false;
  snapshot.co2SafetyAlert = false;
  snapshot.greenhouseControls = {
    globalHeatingPower: 3200,
    co2InjectionRate: 55,
    ventilationRate: 110,
    lightingPower: 5200,
  };
  snapshot.resources = {
    waterConsumedL: round1(160 + rng() * 40),
    energyUsedKWh: round1(85 + rng() * 25),
    o2ProducedKg: round1(10 + rng() * 3),
    totalHarvestKg: round1(18 + rng() * 6),
  };
  snapshot.nutritionalOutput = {
    caloriesPerDay: Math.round(7_200 + rng() * 1_800),
    proteinGPerDay: Math.round(180 + rng() * 60),
    vitaminC_mgPerDay: Math.round(180 + rng() * 60),
    vitaminA_mcgPerDay: Math.round(1_900 + rng() * 500),
    iron_mgPerDay: Math.round(25 + rng() * 10),
    calcium_mgPerDay: Math.round(2_000 + rng() * 600),
    fiber_gPerDay: Math.round(52 + rng() * 18),
  };
  snapshot.nutritionalCoverage = round3(0.72 + rng() * 0.12);
  snapshot.foodReservesSols = round1(220 + rng() * 80);
}

function seedHealthyGreenhouse(snapshot: EnvironmentSnapshot, rng: () => number) {
  const stageByCrop: Record<CropType, GrowthStage> = {
    lettuce: 'vegetative',
    tomato: 'fruiting',
    potato: 'flowering',
    soybean: 'flowering',
    spinach: 'vegetative',
    wheat: 'flowering',
    radish: 'vegetative',
    kale: 'vegetative',
  };

  const baseProgressByCrop: Record<CropType, number> = {
    lettuce: 0.54,
    tomato: 0.84,
    potato: 0.73,
    soybean: 0.7,
    spinach: 0.49,
    wheat: 0.68,
    radish: 0.57,
    kale: 0.52,
  };

  const baseYieldByCrop: Record<CropType, number> = {
    lettuce: 0.7,
    tomato: 1.9,
    potato: 1.5,
    soybean: 1.1,
    spinach: 0.8,
    wheat: 1.2,
    radish: 0.6,
    kale: 0.9,
  };

  for (const tile of Object.values(snapshot.tileCrops)) {
    const progress = clamp(baseProgressByCrop[tile.cropType] + (rng() - 0.5) * 0.08, 0.3, 0.92);
    tile.stage = stageByCrop[tile.cropType];
    tile.stageProgress = round2(progress);
    tile.daysSincePlanting = round1(28 + progress * 50 + rng() * 6);
    tile.healthScore = round2(0.86 + rng() * 0.11);
    tile.biomassKg = round1(0.8 + progress * 2.2 + rng() * 0.5);
    tile.estimatedYieldKg = round1(baseYieldByCrop[tile.cropType] + rng() * 0.4);
    tile.plantGrowth = round1(STAGE_TO_GROWTH_INDEX[tile.stage] + rng());
    tile.leafArea = round2(0.7 + progress * 2 + rng() * 0.3);
    tile.fruitCount = tile.stage === 'fruiting' ? Math.round(4 + rng() * 8) : tile.stage === 'flowering' ? Math.round(1 + rng() * 3) : 0;
    tile.soilMoisture = round1(58 + rng() * 18);
    tile.soilTemperature = round1(20 + rng() * 4);
    tile.rootO2Level = round1(82 + rng() * 12);
    tile.nutrientEC = round2(1.7 + rng() * 0.7);
    tile.diseaseRisk = round2(rng() * 0.08);
    tile.isBolting = false;
  }

  recomputeAggregateCrops(snapshot);
}

function mutateTiles(snapshot: EnvironmentSnapshot, tileIds: string[], patch: Partial<TileCropSnapshot>) {
  for (const tileId of tileIds) {
    const tile = snapshot.tileCrops[tileId];
    if (!tile) continue;
    Object.assign(tile, patch);
  }
  recomputeAggregateCrops(snapshot);
}

function groupTilesByCrop(snapshot: EnvironmentSnapshot): Record<CropType, string[]> {
  const groups: Record<CropType, string[]> = {
    lettuce: [],
    tomato: [],
    potato: [],
    soybean: [],
    spinach: [],
    wheat: [],
    radish: [],
    kale: [],
  };
  for (const tile of Object.values(snapshot.tileCrops)) groups[tile.cropType].push(tile.tileId);
  return groups;
}

function createBootstrapCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`bootstrap:${variant}`));
  snapshot.missionSol = variant;
  snapshot.currentLs = round1(4 + rng() * 8);
  snapshot.seasonName = 'northern_spring';
  snapshot.dustStormRisk = 'low';
  snapshot.airTemperature = round1(19 + rng() * 2);
  snapshot.humidity = round1(58 + rng() * 6);
  snapshot.co2Level = Math.round(820 + rng() * 110);
  snapshot.lightLevel = Math.round(5000 + rng() * 400);
  snapshot.solarGenerationKW = round1(30 + rng() * 8);
  snapshot.batteryStorageKWh = round1(170 + rng() * 15);
  snapshot.energyDeficit = false;
  snapshot.co2SafetyAlert = false;
  snapshot.nutritionalCoverage = 0;
  snapshot.foodReservesSols = round1(448 - variant * 0.5);
  snapshot.resources.totalHarvestKg = 0;
  snapshot.nutritionalOutput = {
    caloriesPerDay: 0,
    proteinGPerDay: 0,
    vitaminC_mgPerDay: 0,
    vitaminA_mcgPerDay: 0,
    iron_mgPerDay: 0,
    calcium_mgPerDay: 0,
    fiber_gPerDay: 0,
  };

  return {
    name: `bootstrap-empty-greenhouse-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'bootstrap-empty-greenhouse',
      scenarioName: 'Bootstrap Empty Greenhouse',
      category: 'bootstrap',
      variant,
      expectations: {
        requireAnyAction: true,
        requireBatchPlanting: true,
        minPlantCount: 8,
        minDistinctPlantCrops: 4,
        preferredPlantCrops: ['potato', 'soybean', 'wheat', 'kale'],
        minPreferredPlantCrops: 2,
      },
    },
  };
}

function createStableCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`stable:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);

  return {
    name: `stable-steady-state-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'stable-steady-state',
      scenarioName: 'Stable Steady State',
      category: 'stability',
      variant,
      expectations: {
        maxActions: 0,
      },
    },
  };
}

function createHarvestCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`harvest:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);
  const tilesByCrop = groupTilesByCrop(snapshot);

  mutateTiles(snapshot, [
    ...tilesByCrop.lettuce.slice(0, 3),
    ...tilesByCrop.tomato.slice(0, 2),
    ...tilesByCrop.radish.slice(0, 2),
  ], {
    stage: 'harvest_ready',
    stageProgress: 0.99,
    healthScore: 0.93,
    estimatedYieldKg: 2.1,
  });

  snapshot.nutritionalCoverage = round3(0.64 + rng() * 0.05);

  return {
    name: `harvest-wave-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'harvest-wave',
      scenarioName: 'Harvest Wave',
      category: 'operations',
      variant,
      expectations: {
        requireAnyAction: true,
        requireHarvestReadyHandling: true,
      },
    },
  };
}

function createCo2Case(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`co2:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);
  snapshot.co2Level = Math.round(5200 + rng() * 500);
  snapshot.co2SafetyAlert = true;
  snapshot.humidity = round1(70 + rng() * 8);
  snapshot.greenhouseControls.co2InjectionRate = 120;
  snapshot.greenhouseControls.ventilationRate = 80;

  return {
    name: `co2-safety-alert-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'co2-safety-alert',
      scenarioName: 'CO2 Safety Alert',
      category: 'emergency',
      variant,
      expectations: {
        requireAnyAction: true,
        requireCo2Mitigation: true,
      },
    },
  };
}

function createEnergyCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`energy:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);
  snapshot.missionSol = 265 + variant;
  snapshot.currentLs = round1(255 + rng() * 20);
  snapshot.seasonName = 'northern_winter';
  snapshot.dustStormRisk = 'extreme';
  snapshot.dustStormActive = true;
  snapshot.dustStormFactor = round2(0.08 + rng() * 0.1);
  snapshot.solarGenerationKW = round1(0.8 + rng() * 1.2);
  snapshot.batteryStorageKWh = round1(10 + rng() * 10);
  snapshot.energyDeficit = true;
  snapshot.greenhouseControls.lightingPower = 8200;
  snapshot.greenhouseControls.globalHeatingPower = 6200;

  return {
    name: `energy-deficit-dust-storm-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'energy-deficit-dust-storm',
      scenarioName: 'Energy Deficit Dust Storm',
      category: 'emergency',
      variant,
      expectations: {
        requireAnyAction: true,
        requireEnergyMitigation: true,
        forbidEnergyIncrease: true,
      },
    },
  };
}

function createDiseaseCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`disease:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);
  const tilesByCrop = groupTilesByCrop(snapshot);
  mutateTiles(snapshot, [
    ...tilesByCrop.tomato.slice(0, 2),
    ...tilesByCrop.kale.slice(0, 2),
    ...tilesByCrop.soybean.slice(0, 1),
  ], {
    diseaseRisk: 0.82,
    healthScore: 0.34,
    stage: 'fruiting',
  });
  snapshot.humidity = round1(86 + rng() * 4);
  snapshot.nutritionalCoverage = round3(0.58 + rng() * 0.08);

  return {
    name: `disease-hotspots-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'disease-hotspots',
      scenarioName: 'Disease Hotspots',
      category: 'stress',
      variant,
      expectations: {
        requireAnyAction: true,
        requireDiseaseMitigation: true,
      },
    },
  };
}

function createLowNutritionCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`nutrition:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);
  const tilesByCrop = groupTilesByCrop(snapshot);
  mutateTiles(snapshot, [
    ...tilesByCrop.wheat.slice(0, 4),
    ...tilesByCrop.potato.slice(0, 4),
    ...tilesByCrop.soybean.slice(0, 3),
  ], {
    stage: 'harvested',
    stageProgress: 0,
    daysSincePlanting: 0,
    healthScore: 0,
    biomassKg: 0,
    estimatedYieldKg: 0,
    plantGrowth: 0,
    leafArea: 0,
    fruitCount: 0,
    diseaseRisk: 0,
    isBolting: false,
  });

  snapshot.foodReservesSols = round1(18 + rng() * 8);
  snapshot.nutritionalCoverage = round3(0.24 + rng() * 0.08);
  snapshot.nutritionalOutput.caloriesPerDay = Math.round(2_800 + rng() * 800);
  snapshot.nutritionalOutput.proteinGPerDay = Math.round(90 + rng() * 25);

  return {
    name: `low-nutrition-gap-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'low-nutrition-gap',
      scenarioName: 'Low Nutrition Gap',
      category: 'nutrition',
      variant,
      expectations: {
        requireAnyAction: true,
        requireBatchPlanting: true,
        minPlantCount: 6,
        minDistinctPlantCrops: 3,
        preferredPlantCrops: ['potato', 'soybean', 'wheat', 'kale'],
        minPreferredPlantCrops: 2,
      },
    },
  };
}

function createWaterStressCase(variant: number): EvalCase {
  const snapshot = buildSnapshot();
  const rng = makeRng(hashString(`water:${variant}`));
  setNominalEnvironment(snapshot, rng);
  seedHealthyGreenhouse(snapshot, rng);
  const tilesByCrop = groupTilesByCrop(snapshot);
  mutateTiles(snapshot, [
    ...tilesByCrop.potato.slice(0, 3),
    ...tilesByCrop.spinach.slice(0, 2),
  ], {
    soilMoisture: 89,
    nutrientEC: 4.7,
    rootO2Level: 42,
    healthScore: 0.48,
  });
  snapshot.waterRecyclingEfficiency = round3(0.3 + rng() * 0.08);

  return {
    name: `water-recycling-stress-v${variant + 1}`,
    snapshot,
    variant,
    groundTruth: {
      scenarioId: 'water-recycling-stress',
      scenarioName: 'Water Recycling Stress',
      category: 'stress',
      variant,
      expectations: {
        requireAnyAction: true,
        requireWaterMitigation: true,
      },
    },
  };
}

function buildDataset(variantsPerScenario: number): EvalCase[] {
  const cases: EvalCase[] = [];
  for (let variant = 0; variant < variantsPerScenario; variant += 1) {
    cases.push(createBootstrapCase(variant));
    cases.push(createStableCase(variant));
    cases.push(createHarvestCase(variant));
    cases.push(createCo2Case(variant));
    cases.push(createEnergyCase(variant));
    cases.push(createDiseaseCase(variant));
    cases.push(createLowNutritionCase(variant));
    cases.push(createWaterStressCase(variant));
  }
  return cases;
}

function extractWorkflowOutput(targetResult: WorkflowResultLike): { summary: string; reasoning: string; actions: unknown[] } {
  if (targetResult.status !== 'success') {
    return {
      summary: `workflow ${targetResult.status}`,
      reasoning: targetResult.status === 'failed' ? String(targetResult.error?.message ?? 'workflow failed') : `workflow ${targetResult.status}`,
      actions: [],
    };
  }

  const actStep = targetResult.steps?.act;
  const reasonStep = targetResult.steps?.reason;
  const output = actStep?.output ?? reasonStep?.output ?? targetResult.result ?? {};
  const outputRecord = typeof output === 'object' && output !== null ? output as Record<string, unknown> : {};

  return {
    summary: typeof outputRecord.summary === 'string' ? outputRecord.summary : '',
    reasoning: typeof outputRecord.reasoning === 'string' ? outputRecord.reasoning : '',
    actions: Array.isArray(outputRecord.actions) ? outputRecord.actions : [],
  };
}

function computeWeightedScore(assessScore: number, actionSafetyScore: number, scenarioFitScore: number) {
  return round3((assessScore * 0.2) + (actionSafetyScore * 0.3) + (scenarioFitScore * 0.5));
}

function average(values: number[]) {
  return values.length === 0 ? 0 : round3(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreFallback(reason: string): ScoreResultLike {
  return { score: 0, reason };
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let currentIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (currentIndex < items.length) {
        const index = currentIndex;
        currentIndex += 1;
        await worker(items[index]!);
      }
    }),
  );
}

async function evaluateCase(testCase: EvalCase, batchId: string, threshold: number, workflow: typeof greenhouseControlWorkflow) {
  const run = await workflow.createRun({ disableScorers: true });
  const workflowResult = await run.start({
    inputData: testCase.snapshot as unknown as Record<string, unknown>,
    tracingOptions: {
      metadata: {
        evalBatchId: batchId,
        scenarioId: testCase.groundTruth.scenarioId,
        scenarioName: testCase.groundTruth.scenarioName,
        variant: testCase.variant,
      },
      tags: [TRACE_TAG, testCase.groundTruth.category, testCase.groundTruth.scenarioId],
    },
  });

  const resultLike = workflowResult as WorkflowResultLike;
  const output = extractWorkflowOutput(resultLike);
  const assessStep = resultLike.steps?.assess;
  const assessScoreResult =
    assessStep?.status === 'success' && assessStep.output !== undefined
      ? await greenhouseControlAssessScorer.run({
          input: ((assessStep.payload as Record<string, unknown> | undefined) ?? testCase.snapshot as unknown as Record<string, unknown>),
          output: assessStep.output as AssessOutput,
          groundTruth: testCase.groundTruth,
        })
      : scoreFallback('Assess step did not complete successfully.');

  const workflowOutput =
    workflowResult.status === 'success' && workflowResult.result !== undefined
      ? workflowResult.result as WorkflowOutput
      : undefined;

  const actionSafetyScoreResult = workflowOutput
    ? await greenhouseControlActionSafetyScorer.run({
        input: testCase.snapshot as unknown as Record<string, unknown>,
        output: workflowOutput,
        groundTruth: testCase.groundTruth,
      })
    : scoreFallback(workflowResult.status === 'failed' ? String(workflowResult.error?.message ?? 'workflow failed') : `workflow ${workflowResult.status}`);

  const scenarioFitScoreResult = workflowOutput
    ? await greenhouseControlScenarioFitScorer.run({
        input: testCase.snapshot as unknown as Record<string, unknown>,
        output: workflowOutput,
        groundTruth: testCase.groundTruth,
      })
    : scoreFallback(workflowResult.status === 'failed' ? String(workflowResult.error?.message ?? 'workflow failed') : `workflow ${workflowResult.status}`);

  const assessScore = round3(assessScoreResult.score ?? 0);
  const actionSafetyScore = round3(actionSafetyScoreResult.score ?? 0);
  const scenarioFitScore = round3(scenarioFitScoreResult.score ?? 0);
  const weightedScore = computeWeightedScore(assessScore, actionSafetyScore, scenarioFitScore);

  return {
    name: `${testCase.groundTruth.scenarioId}-v${testCase.groundTruth.variant + 1}`,
    scenarioId: testCase.groundTruth.scenarioId,
    category: testCase.groundTruth.category,
    variant: testCase.groundTruth.variant,
    traceId: workflowResult.traceId,
    status: workflowResult.status,
    assessScore,
    actionSafetyScore,
    scenarioFitScore,
    weightedScore,
    pass: weightedScore >= threshold && workflowResult.status === 'success',
    summary: output.summary,
    reasoning: output.reasoning,
    actionCount: output.actions.length,
    actions: output.actions,
    assessReason: assessScoreResult.reason,
    actionSafetyReason: actionSafetyScoreResult.reason,
    scenarioFitReason: scenarioFitScoreResult.reason,
  } satisfies EvalRecord;
}

async function writeReports(reportDir: string, batchId: string, records: EvalRecord[], options: EvalOptions) {
  await mkdir(reportDir, { recursive: true });
  const sortedRecords = [...records].sort((left, right) => left.weightedScore - right.weightedScore);
  const summary = {
    batchId,
    generatedAt: new Date().toISOString(),
    totalRuns: records.length,
    failedRuns: records.filter(record => !record.pass).length,
    threshold: options.threshold,
    averages: {
      assess: average(records.map(record => record.assessScore)),
      actionSafety: average(records.map(record => record.actionSafetyScore)),
      scenarioFit: average(records.map(record => record.scenarioFitScore)),
      weighted: average(records.map(record => record.weightedScore)),
    },
    records: sortedRecords,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = resolve(reportDir, `greenhouse-control-${timestamp}.json`);
  const latestJsonPath = resolve(reportDir, 'latest.json');
  await writeFile(jsonPath, JSON.stringify(summary, null, 2));
  await writeFile(latestJsonPath, JSON.stringify(summary, null, 2));

  const worstCases = sortedRecords.slice(0, Math.min(8, sortedRecords.length));
  const markdown = [
    '# Greenhouse Control Eval Report',
    '',
    `- Batch ID: \`${batchId}\``,
    `- Runs: ${summary.totalRuns}`,
    `- Failed threshold (${options.threshold}): ${summary.failedRuns}`,
    `- Average assess score: ${summary.averages.assess}`,
    `- Average action safety score: ${summary.averages.actionSafety}`,
    `- Average scenario fit score: ${summary.averages.scenarioFit}`,
    `- Average weighted score: ${summary.averages.weighted}`,
    `- Trace tag: \`${TRACE_TAG}\``,
    '',
    '## Weakest Runs',
    '',
    ...worstCases.flatMap((record) => [
      `### ${record.name}`,
      `- Weighted score: ${record.weightedScore}`,
      `- Status: ${record.status}`,
      `- Trace ID: ${record.traceId ?? 'n/a'}`,
      `- Summary: ${record.summary || 'n/a'}`,
      `- Actions: ${actionSummary(record.actions)}`,
      `- Assess: ${record.assessScore} — ${record.assessReason ?? 'n/a'}`,
      `- Action safety: ${record.actionSafetyScore} — ${record.actionSafetyReason ?? 'n/a'}`,
      `- Scenario fit: ${record.scenarioFitScore} — ${record.scenarioFitReason ?? 'n/a'}`,
      '',
    ]),
  ].join('\n');

  const markdownPath = resolve(reportDir, `greenhouse-control-${timestamp}.md`);
  const latestMarkdownPath = resolve(reportDir, 'latest.md');
  await writeFile(markdownPath, markdown);
  await writeFile(latestMarkdownPath, markdown);

  return { jsonPath: latestJsonPath, markdownPath: latestMarkdownPath, summary };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allCases = buildDataset(options.variantsPerScenario);
  const cases = options.limit ? allCases.slice(0, options.limit) : allCases;
  const workflow = mastra.getWorkflow('greenhouseControl') as typeof greenhouseControlWorkflow | undefined;

  if (!workflow) {
    throw new Error('greenhouseControl workflow is not registered on the Mastra instance');
  }

  const batchId = `greenhouse-control-${Date.now()}`;
  const records: EvalRecord[] = [];

  console.log(`Running ${cases.length} greenhouse-control eval cases with batch id ${batchId}`);

  await mapWithConcurrency(cases, options.concurrency, async (testCase) => {
    const record = await evaluateCase(testCase, batchId, options.threshold, workflow);
    records.push(record);
  });

  await mastra.observability.getDefaultInstance()?.flush();

  const { jsonPath, markdownPath, summary } = await writeReports(resolve(process.cwd(), options.reportDir), batchId, records, options);

  console.log(`Average weighted score: ${summary.averages.weighted}`);
  console.log(`Failed runs: ${summary.failedRuns}/${summary.totalRuns}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${markdownPath}`);

  if (summary.failedRuns > 0) {
    process.exitCode = 1;
  }
}

await main();
