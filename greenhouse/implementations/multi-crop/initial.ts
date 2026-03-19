import type {
  CropType, ConcreteEnvironment, ConcreteGreenhouseState, ConcreteState,
  CropControls, CropEnvironment, GrowthStage,
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
 * Ls (solar longitude) at mission start.
 * 0° = Northern Spring Equinox (start of Martian year).
 * The mission begins during northern spring, before the dust storm season.
 */
export const MISSION_START_LS = 0;

export function createInitialEnvironment(): ConcreteEnvironment {
  const crops = {} as Record<CropType, CropEnvironment>;
  for (const ct of ALL_CROP_TYPES) {
    crops[ct] = buildCropAtProgress(ct, INITIAL_PROGRESS[ct]);
  }

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
