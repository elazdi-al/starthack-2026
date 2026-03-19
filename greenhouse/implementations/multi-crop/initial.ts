import type {
  CropType, ConcreteEnvironment, ConcreteGreenhouseState, ConcreteState,
  CropControls, CropEnvironment, GrowthStage, TileCropEnvironment,
} from './types';
import { ALL_CROP_TYPES } from './types';
import { CROP_PROFILES } from './profiles';
import { createSimulation, SOL_HOURS } from './simulation';
import {
  makeRng, hashTileId, generateGeneticFactors, buildCropAtProgress, aggregateTileCrops,
} from './crop-utils';

// Re-export everything from crop-utils so existing consumers don't break
export {
  makeRng, gaussianSample, hashTileId, generateGeneticFactors, buildCropAtProgress, aggregateTileCrops,
  type GeneticFactors,
} from './crop-utils';

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
 * Initial food reserves: the crew arrives with pre-packaged food sufficient
 * for the entire 450-sol mission. The greenhouse supplements this supply.
 * As crops are harvested, reserves are extended. As sols pass, reserves deplete.
 */
export const INITIAL_FOOD_RESERVES_SOLS = 450;

/**
 * All crops start unplanted — the agent's first decision is choosing
 * which crops to plant. Progress 0 with 'harvested' stage means empty tile.
 */
const INITIAL_PROGRESS: Record<CropType, number> = {
  lettuce:  0,
  tomato:   0,
  potato:   0,
  soybean:  0,
  spinach:  0,
  wheat:    0,
  radish:   0,
  kale:     0,
};

// ─── Per-tile crop building ──────────────────────────────────────────────────

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

  // Unplanted tile — return empty/harvested state with genetic identity
  if (baseFraction <= 0) {
    const base = buildCropAtProgress(ct, 0);
    return {
      ...base,
      tileId,
      cropType: ct,
      geneticSeed: seed,
      geneticOptimalTempFactor: genetics.optimalTempFactor,
      geneticOptimalMoistureFactor: genetics.optimalMoistureFactor,
      geneticGrowthRateFactor: genetics.growthRateFactor,
      geneticMaxYieldFactor: genetics.maxYieldFactor,
      geneticBoltingThresholdFactor: genetics.boltingThresholdFactor,
      geneticStressResilienceFactor: genetics.stressResilienceFactor,
      geneticWaterEfficiencyFactor: genetics.waterEfficiencyFactor,
    };
  }

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
  { tileId: '0_0', cropType: 'lettuce' },
  { tileId: '0_1', cropType: 'lettuce' },
  { tileId: '0_2', cropType: 'lettuce' },
  { tileId: '0_4', cropType: 'tomato' },
  { tileId: '0_5', cropType: 'tomato' },
  { tileId: '0_7', cropType: 'potato' },
  { tileId: '0_8', cropType: 'potato' },
  { tileId: '0_9', cropType: 'potato' },
  { tileId: '0_11', cropType: 'wheat' },
  // Row 1
  { tileId: '1_0', cropType: 'lettuce' },
  { tileId: '1_1', cropType: 'lettuce' },
  { tileId: '1_2', cropType: 'lettuce' },
  { tileId: '1_4', cropType: 'tomato' },
  { tileId: '1_5', cropType: 'tomato' },
  { tileId: '1_7', cropType: 'potato' },
  { tileId: '1_8', cropType: 'potato' },
  { tileId: '1_9', cropType: 'potato' },
  { tileId: '1_11', cropType: 'wheat' },
  // Row 2
  { tileId: '2_0', cropType: 'lettuce' },
  { tileId: '2_1', cropType: 'lettuce' },
  { tileId: '2_2', cropType: 'lettuce' },
  { tileId: '2_4', cropType: 'tomato' },
  { tileId: '2_5', cropType: 'tomato' },
  { tileId: '2_7', cropType: 'potato' },
  { tileId: '2_8', cropType: 'potato' },
  { tileId: '2_9', cropType: 'potato' },
  { tileId: '2_11', cropType: 'wheat' },
  // Row 3: all paths — no crop tiles
  // Row 4: Soybean (cols 0–2) | Spinach (cols 4–5) | Wheat (cols 7–9) | Kale (col 11)
  { tileId: '4_0', cropType: 'soybean' },
  { tileId: '4_1', cropType: 'soybean' },
  { tileId: '4_2', cropType: 'soybean' },
  { tileId: '4_4', cropType: 'spinach' },
  { tileId: '4_5', cropType: 'spinach' },
  { tileId: '4_7', cropType: 'wheat' },
  { tileId: '4_8', cropType: 'wheat' },
  { tileId: '4_9', cropType: 'wheat' },
  { tileId: '4_11', cropType: 'kale' },
  // Row 5
  { tileId: '5_0', cropType: 'soybean' },
  { tileId: '5_1', cropType: 'soybean' },
  { tileId: '5_2', cropType: 'soybean' },
  { tileId: '5_4', cropType: 'spinach' },
  { tileId: '5_5', cropType: 'spinach' },
  { tileId: '5_7', cropType: 'wheat' },
  { tileId: '5_8', cropType: 'wheat' },
  { tileId: '5_9', cropType: 'wheat' },
  { tileId: '5_11', cropType: 'kale' },
  // Row 6: all paths — no crop tiles
  // Row 7: Radish (cols 0–2) | Kale (cols 4–5) | Soybean (col 7) + Radish (col 8) + Spinach (col 9) | Tomato (col 11)
  { tileId: '7_0', cropType: 'radish' },
  { tileId: '7_1', cropType: 'radish' },
  { tileId: '7_2', cropType: 'radish' },
  { tileId: '7_4', cropType: 'kale' },
  { tileId: '7_5', cropType: 'kale' },
  { tileId: '7_7', cropType: 'soybean' },
  { tileId: '7_8', cropType: 'radish' },
  { tileId: '7_9', cropType: 'spinach' },
  { tileId: '7_11', cropType: 'tomato' },
  // Row 8
  { tileId: '8_0', cropType: 'radish' },
  { tileId: '8_1', cropType: 'radish' },
  { tileId: '8_2', cropType: 'radish' },
  { tileId: '8_4', cropType: 'kale' },
  { tileId: '8_5', cropType: 'kale' },
  { tileId: '8_7', cropType: 'soybean' },
  { tileId: '8_8', cropType: 'radish' },
  { tileId: '8_9', cropType: 'spinach' },
  { tileId: '8_11', cropType: 'tomato' },
];

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

  // Start the mission at noon (solFraction = 0.5) on Sol 0
  const initialElapsedHours = SOL_HOURS * 0.5;

  return {
    timestamp: now,
    missionStartMs: now,
    missionElapsedHours: initialElapsedHours,
    missionSol: 0,
    solFraction: 0.5,
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
    foodReservesSols: INITIAL_FOOD_RESERVES_SOLS,
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
      waterRecyclingEnabled:      false,
      waterRecyclingEfficiency:   0.95,
      batteryStorageEnabled:      false,
      batteryStorageKWh:          200,
      foodReservesEnabled:        false,
      foodReservesSols:           450,
    },
  };
}

export function createInitialState(): ConcreteState {
  const env = createInitialEnvironment();
  const greenhouse = createInitialGreenhouseState();
  const simulation = createSimulation(env, greenhouse);
  return { simulation, greenhouse };
}
