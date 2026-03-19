import type {
  CropType, ConcreteEnvironment, ConcreteGreenhouseState, ConcreteState,
  CropControls, CropEnvironment, GrowthStage, TileCropEnvironment,
} from './types';
import { ALL_CROP_TYPES, GROWTH_STAGES } from './types';
import { CROP_PROFILES } from './profiles';
import { createSimulation, SOL_HOURS } from './simulation';

const DEFAULT_CROP_CONTROLS: Record<CropType, CropControls> = {
  lettuce:  { waterPumpRate: 8,  localHeatingPower: 300, nutrientConcentration: 1.8, aerationRate: 70 },
  tomato:   { waterPumpRate: 12, localHeatingPower: 500, nutrientConcentration: 2.2, aerationRate: 65 },
  potato:   { waterPumpRate: 10, localHeatingPower: 200, nutrientConcentration: 2.0, aerationRate: 60 },
  soybean:  { waterPumpRate: 8,  localHeatingPower: 400, nutrientConcentration: 1.9, aerationRate: 65 },
  spinach:  { waterPumpRate: 7,  localHeatingPower: 200, nutrientConcentration: 1.7, aerationRate: 70 },
  wheat:    { waterPumpRate: 9,  localHeatingPower: 300, nutrientConcentration: 2.0, aerationRate: 60 },
  radish:   { waterPumpRate: 6,  localHeatingPower: 250, nutrientConcentration: 1.6, aerationRate: 65 },
  kale:     { waterPumpRate: 8,  localHeatingPower: 250, nutrientConcentration: 1.8, aerationRate: 70 },
};

/**
 * Staggered start: each crop begins at a different progression through its
 * growth cycle so the greenhouse looks active on first load and harvests
 * are distributed across the mission timeline.
 */
const INITIAL_PROGRESS: Record<CropType, number> = {
  lettuce:  0.50,
  tomato:   0.35,
  potato:   0.30,
  soybean:  0.32,
  spinach:  0.62,
  wheat:    0.18,
  radish:   0.68,
  kale:     0.42,
};

// ─── Seeded pseudo-random (mulberry32) ───────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

/** Box-Muller transform for Gaussian samples from a seeded uniform RNG. */
function gaussianSample(rng: () => number, mean: number, stddev: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

/** Hash a string into a 32-bit integer (FNV-1a). */
function hashTileId(tileId: string): number {
  let h = 2166136261;
  for (let i = 0; i < tileId.length; i++) {
    h ^= tileId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ─── Per-tile genetic identity generation ────────────────────────────────────

interface GeneticFactors {
  optimalTempFactor: number;
  optimalMoistureFactor: number;
  growthRateFactor: number;
  maxYieldFactor: number;
  boltingThresholdFactor: number;
  stressResilienceFactor: number;
  waterEfficiencyFactor: number;
}

function generateGeneticFactors(seed: number, ct: CropType): GeneticFactors {
  const gv = CROP_PROFILES[ct].geneticVariance;
  const rng = makeRng(seed);
  return {
    optimalTempFactor:       Math.max(0.80, gaussianSample(rng, 1.0, gv.optimalTempCV)),
    optimalMoistureFactor:   Math.max(0.80, gaussianSample(rng, 1.0, gv.optimalMoistureCV)),
    growthRateFactor:        Math.max(0.70, gaussianSample(rng, 1.0, gv.growthRateCV)),
    maxYieldFactor:          Math.max(0.60, gaussianSample(rng, 1.0, gv.maxYieldCV)),
    boltingThresholdFactor:  Math.max(0.85, gaussianSample(rng, 1.0, gv.boltingThresholdCV)),
    stressResilienceFactor:  Math.max(0.70, gaussianSample(rng, 1.0, gv.stressResilienceCV)),
    waterEfficiencyFactor:   Math.max(0.75, gaussianSample(rng, 1.0, gv.waterEfficiencyCV)),
  };
}

// ─── Crop building ───────────────────────────────────────────────────────────

function buildCropAtProgress(ct: CropType, fraction: number): CropEnvironment {
  const profile = CROP_PROFILES[ct];

  let accumulated = 0;
  let stage: GrowthStage = 'seed';
  let stageProgress = 0;

  for (const s of GROWTH_STAGES) {
    const sf = profile.stageFractions[s] || 0;
    if (accumulated + sf > fraction) {
      stage = s;
      stageProgress = (fraction - accumulated) / sf;
      break;
    }
    accumulated += sf;
    stage = s;
    stageProgress = 1;
  }

  const daysSincePlanting = fraction * profile.growthCycleSols;
  const totalProgress = fraction;
  const maxBiomass = profile.maxYieldKgPerPlant * profile.plantsPerTile;
  const biomassKg = maxBiomass * totalProgress;
  const estimatedYieldKg = biomassKg * profile.harvestIndex;

  return {
    soilMoisture: profile.optimalMoisture,
    soilTemperature: profile.optimalTemp,
    stage,
    stageProgress,
    daysSincePlanting,
    healthScore: 1,
    stressAccumulator: 0,
    biomassKg,
    estimatedYieldKg,
    plantGrowth: totalProgress * 100,
    leafArea: totalProgress * profile.plantsPerTile * 0.02,
    fruitCount: (stage === 'fruiting' || stage === 'harvest_ready')
      ? Math.floor(profile.plantsPerTile * stageProgress * 0.8)
      : 0,
    rootO2Level: 90,
    nutrientEC: 2.0,
    diseaseRisk: 0,
    isBolting: false,
    boltingHoursAccumulated: 0,
  };
}

/**
 * Build a per-tile crop instance with genetic variance.
 * The tileId hashes to a deterministic seed, so each tile's genetics are
 * reproducible across restarts but unique per tile position.
 *
 * The genetic factors perturb the initial conditions:
 *  - Progress offset: ±5% of base progress (different plants mature at slightly different rates)
 *  - Soil moisture jitter: ±3% of optimal (micro-environment variation)
 *  - Health: 0.92–1.0 (some seedlings start slightly weaker)
 *  - Stress accumulator: 0–0.8 (background micro-stresses from transport/handling)
 */
function buildTileCropAtProgress(
  tileId: string,
  ct: CropType,
  baseFraction: number,
): TileCropEnvironment {
  const seed = hashTileId(tileId);
  const genetics = generateGeneticFactors(seed, ct);

  // Use a second RNG for initial condition jitter (separate from genetic RNG)
  const jitterRng = makeRng(seed ^ 0xdeadbeef);

  // Perturb progress: ±5% of base (so tiles of same crop are at slightly different stages)
  const progressJitter = (jitterRng() - 0.5) * 0.10; // ±5%
  const fraction = Math.max(0, Math.min(0.99, baseFraction + progressJitter));

  // Build base environment at the perturbed progress
  const base = buildCropAtProgress(ct, fraction);
  const profile = CROP_PROFILES[ct];

  // Perturb initial conditions
  const moistureJitter = (jitterRng() - 0.5) * 6; // ±3 percentage points
  const healthJitter = jitterRng() * 0.08;         // lose 0–8% initial health
  const stressJitter = jitterRng() * 0.8;          // background micro-stress 0–0.8

  return {
    ...base,
    tileId,
    cropType: ct,
    geneticSeed: seed,
    soilMoisture: Math.max(10, Math.min(100, profile.optimalMoisture + moistureJitter)),
    healthScore: Math.max(0.85, 1 - healthJitter),
    stressAccumulator: stressJitter,
    rootO2Level: 85 + jitterRng() * 10,    // 85–95 instead of flat 90
    nutrientEC: 1.8 + jitterRng() * 0.4,   // 1.8–2.2 instead of flat 2.0
    diseaseRisk: jitterRng() * 0.03,        // 0–3% background pathogen load
    geneticOptimalTempFactor: genetics.optimalTempFactor,
    geneticOptimalMoistureFactor: genetics.optimalMoistureFactor,
    geneticGrowthRateFactor: genetics.growthRateFactor,
    geneticMaxYieldFactor: genetics.maxYieldFactor,
    geneticBoltingThresholdFactor: genetics.boltingThresholdFactor,
    geneticStressResilienceFactor: genetics.stressResilienceFactor,
    geneticWaterEfficiencyFactor: genetics.waterEfficiencyFactor,
  };
}

/**
 * Canonical tile layout. Matches the INITIAL_GRID in greenhouse-store.ts.
 * 12×9 grid with 8 crop rectangles separated by clear paths.
 * Each entry is [tileId, cropType]. Path tiles are omitted.
 */
export const TILE_CROP_LAYOUT: Array<{ tileId: string; cropType: CropType }> = [
  // Row 0: Lettuce (cols 0–2) | Tomato (cols 4–5) | Potato (cols 7–9) | Wheat (col 11)
  { tileId: 'lettuce_0_0', cropType: 'lettuce' },
  { tileId: 'lettuce_0_1', cropType: 'lettuce' },
  { tileId: 'lettuce_0_2', cropType: 'lettuce' },
  { tileId: 'tomato_0_4',  cropType: 'tomato' },
  { tileId: 'tomato_0_5',  cropType: 'tomato' },
  { tileId: 'potato_0_7',  cropType: 'potato' },
  { tileId: 'potato_0_8',  cropType: 'potato' },
  { tileId: 'potato_0_9',  cropType: 'potato' },
  { tileId: 'wheat_0_11',  cropType: 'wheat' },
  // Row 1
  { tileId: 'lettuce_1_0', cropType: 'lettuce' },
  { tileId: 'lettuce_1_1', cropType: 'lettuce' },
  { tileId: 'lettuce_1_2', cropType: 'lettuce' },
  { tileId: 'tomato_1_4',  cropType: 'tomato' },
  { tileId: 'tomato_1_5',  cropType: 'tomato' },
  { tileId: 'potato_1_7',  cropType: 'potato' },
  { tileId: 'potato_1_8',  cropType: 'potato' },
  { tileId: 'potato_1_9',  cropType: 'potato' },
  { tileId: 'wheat_1_11',  cropType: 'wheat' },
  // Row 2
  { tileId: 'lettuce_2_0', cropType: 'lettuce' },
  { tileId: 'lettuce_2_1', cropType: 'lettuce' },
  { tileId: 'lettuce_2_2', cropType: 'lettuce' },
  { tileId: 'tomato_2_4',  cropType: 'tomato' },
  { tileId: 'tomato_2_5',  cropType: 'tomato' },
  { tileId: 'potato_2_7',  cropType: 'potato' },
  { tileId: 'potato_2_8',  cropType: 'potato' },
  { tileId: 'potato_2_9',  cropType: 'potato' },
  { tileId: 'wheat_2_11',  cropType: 'wheat' },
  // Row 3: all paths — no crop tiles
  // Row 4: Soybean (cols 0–2) | Spinach (cols 4–5) | Wheat (cols 7–9) | Kale (col 11)
  { tileId: 'soybean_4_0', cropType: 'soybean' },
  { tileId: 'soybean_4_1', cropType: 'soybean' },
  { tileId: 'soybean_4_2', cropType: 'soybean' },
  { tileId: 'spinach_4_4', cropType: 'spinach' },
  { tileId: 'spinach_4_5', cropType: 'spinach' },
  { tileId: 'wheat_4_7',   cropType: 'wheat' },
  { tileId: 'wheat_4_8',   cropType: 'wheat' },
  { tileId: 'wheat_4_9',   cropType: 'wheat' },
  { tileId: 'kale_4_11',   cropType: 'kale' },
  // Row 5
  { tileId: 'soybean_5_0', cropType: 'soybean' },
  { tileId: 'soybean_5_1', cropType: 'soybean' },
  { tileId: 'soybean_5_2', cropType: 'soybean' },
  { tileId: 'spinach_5_4', cropType: 'spinach' },
  { tileId: 'spinach_5_5', cropType: 'spinach' },
  { tileId: 'wheat_5_7',   cropType: 'wheat' },
  { tileId: 'wheat_5_8',   cropType: 'wheat' },
  { tileId: 'wheat_5_9',   cropType: 'wheat' },
  { tileId: 'kale_5_11',   cropType: 'kale' },
  // Row 6: all paths — no crop tiles
  // Row 7: Radish (cols 0–2) | Kale (cols 4–5) | Soybean (col 7) + Radish (col 8) + Spinach (col 9) | Tomato (col 11)
  { tileId: 'radish_7_0',  cropType: 'radish' },
  { tileId: 'radish_7_1',  cropType: 'radish' },
  { tileId: 'radish_7_2',  cropType: 'radish' },
  { tileId: 'kale_7_4',    cropType: 'kale' },
  { tileId: 'kale_7_5',    cropType: 'kale' },
  { tileId: 'soybean_7_7', cropType: 'soybean' },
  { tileId: 'radish_7_8',  cropType: 'radish' },
  { tileId: 'spinach_7_9', cropType: 'spinach' },
  { tileId: 'tomato_7_11', cropType: 'tomato' },
  // Row 8
  { tileId: 'radish_8_0',  cropType: 'radish' },
  { tileId: 'radish_8_1',  cropType: 'radish' },
  { tileId: 'radish_8_2',  cropType: 'radish' },
  { tileId: 'kale_8_4',    cropType: 'kale' },
  { tileId: 'kale_8_5',    cropType: 'kale' },
  { tileId: 'soybean_8_7', cropType: 'soybean' },
  { tileId: 'radish_8_8',  cropType: 'radish' },
  { tileId: 'spinach_8_9', cropType: 'spinach' },
  { tileId: 'tomato_8_11', cropType: 'tomato' },
];

/**
 * Aggregate per-tile states into per-type averages.
 * Used to keep backward-compatible `crops: Record<CropType, CropEnvironment>`.
 */
function aggregateTileCrops(tileCrops: Record<string, TileCropEnvironment>): Record<CropType, CropEnvironment> {
  const sums: Record<string, { total: CropEnvironment; count: number }> = {};

  for (const tile of Object.values(tileCrops)) {
    const ct = tile.cropType;
    if (!sums[ct]) {
      sums[ct] = { total: { ...tile }, count: 1 };
    } else {
      const t = sums[ct].total;
      t.soilMoisture += tile.soilMoisture;
      t.soilTemperature += tile.soilTemperature;
      t.healthScore += tile.healthScore;
      t.stressAccumulator += tile.stressAccumulator;
      t.biomassKg += tile.biomassKg;
      t.estimatedYieldKg += tile.estimatedYieldKg;
      t.plantGrowth += tile.plantGrowth;
      t.leafArea += tile.leafArea;
      t.fruitCount += tile.fruitCount;
      t.rootO2Level += tile.rootO2Level;
      t.nutrientEC += tile.nutrientEC;
      t.diseaseRisk += tile.diseaseRisk;
      t.daysSincePlanting += tile.daysSincePlanting;
      t.stageProgress += tile.stageProgress;
      t.boltingHoursAccumulated += tile.boltingHoursAccumulated;
      sums[ct].count++;
    }
  }

  const result = {} as Record<CropType, CropEnvironment>;
  for (const ct of ALL_CROP_TYPES) {
    if (!sums[ct]) {
      // Fallback: no tiles of this type — build default
      result[ct] = buildCropAtProgress(ct, INITIAL_PROGRESS[ct]);
      continue;
    }
    const { total: t, count: n } = sums[ct];
    result[ct] = {
      soilMoisture: t.soilMoisture / n,
      soilTemperature: t.soilTemperature / n,
      // Use the most advanced tile's stage for the aggregate
      stage: t.stage,
      stageProgress: t.stageProgress / n,
      daysSincePlanting: t.daysSincePlanting / n,
      healthScore: t.healthScore / n,
      stressAccumulator: t.stressAccumulator / n,
      biomassKg: t.biomassKg / n,
      estimatedYieldKg: t.estimatedYieldKg / n,
      plantGrowth: t.plantGrowth / n,
      leafArea: t.leafArea / n,
      fruitCount: Math.round(t.fruitCount / n),
      rootO2Level: t.rootO2Level / n,
      nutrientEC: t.nutrientEC / n,
      diseaseRisk: t.diseaseRisk / n,
      isBolting: t.isBolting,
      boltingHoursAccumulated: t.boltingHoursAccumulated / n,
    };
  }
  return result;
}

export { aggregateTileCrops };

/**
 * Ls (solar longitude) at mission start.
 * 0° = Northern Spring Equinox (start of Martian year).
 * The mission begins during northern spring, before the dust storm season.
 */
export const MISSION_START_LS = 0;

export function createInitialEnvironment(): ConcreteEnvironment {
  // Build per-tile crop instances with genetic variance
  const tileCrops: Record<string, TileCropEnvironment> = {};
  for (const { tileId, cropType } of TILE_CROP_LAYOUT) {
    tileCrops[tileId] = buildTileCropAtProgress(tileId, cropType, INITIAL_PROGRESS[cropType]);
  }

  // Build aggregate per-type for backward compat
  const crops = aggregateTileCrops(tileCrops);

  const now = Date.now();

  return {
    timestamp: now,
    missionStartMs: now,
    missionElapsedHours: 0,
    missionSol: 0,
    solFraction: 0,
    missionStartLs: MISSION_START_LS,
    currentLs: MISSION_START_LS,
    seasonName: 'northern_spring',
    seasonalSolarFlux: 564,  // W/m² at Ls 0° (spring equinox; aphelion is at Ls 71°)
    atmosphericPressure: 600,
    dustStormRisk: 'low',
    airTemperature: 20,
    humidity: 60,
    co2Level: 800,
    lightLevel: 5000,
    o2Level: 20.9,
    externalTemp: -63,
    solarRadiation: 590,
    dustStormFactor: 1,
    waterConsumedL: 0,
    energyUsedKWh: 0,
    o2ProducedKg: 0,
    waterRecyclingEfficiency: 0.95,
    solarGenerationKW: 0,
    batteryStorageKWh: 150,
    energyDeficit: false,
    co2SafetyAlert: false,
    nutritionalOutput: {
      caloriesPerDay: 0,
      proteinGPerDay: 0,
      vitaminC_mgPerDay: 0,
      vitaminA_mcgPerDay: 0,
      iron_mgPerDay: 0,
      calcium_mgPerDay: 0,
      fiber_gPerDay: 0,
    },
    nutritionalCoverage: 0,
    crops,
    tileCrops,
  };
}

export function createInitialGreenhouseState(): ConcreteGreenhouseState {
  const crops = {} as Record<CropType, CropControls>;
  for (const ct of ALL_CROP_TYPES) {
    crops[ct] = { ...DEFAULT_CROP_CONTROLS[ct] };
  }

  return {
    lightingPower: 5000,
    globalHeatingPower: 3000,
    co2InjectionRate: 50,
    ventilationRate: 100,
    maxSolarGenerationKW: 50,
    batteryCapacityKWh: 200,
    crops,
    overrides: {
      externalTempEnabled:        false,
      externalTemp:               -63,
      solarRadiationEnabled:      false,
      solarRadiation:             590,
      dustStormEnabled:           false,
      dustStormSeverity:          0,
      atmosphericPressureEnabled: false,
      atmosphericPressure:        600,
      timeOfDayLocked:            false,
      timeOfDayFraction:          0.5,
    },
  };
}

export function createInitialState(): ConcreteState {
  const env = createInitialEnvironment();
  const greenhouse = createInitialGreenhouseState();
  const simulation = createSimulation(env, greenhouse);
  return { simulation, greenhouse };
}
