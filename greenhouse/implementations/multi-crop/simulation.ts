import type { SimulationState } from '../../state/types';
import type {
  ConcreteEnvironment, ConcreteGreenhouseState,
  CropEnvironment, CropControls, CropType, GrowthStage,
} from './types';
import { ALL_CROP_TYPES, GROWTH_STAGES } from './types';
import { CROP_PROFILES, type CropProfile } from './profiles';

export { CROP_PROFILES } from './profiles';

// ─── Mars Constants ─────────────────────────────────────────────────────────────
export const SOL_HOURS = 24.6167;
const MARS_SOLAR_CONSTANT = 590;
const MARS_MEAN_TEMP = -63;

const DUST_STORMS: Array<{ start: number; duration: number; severity: number }> = [
  { start: 45,  duration: 8,  severity: 0.25 },
  { start: 130, duration: 15, severity: 0.15 },
  { start: 210, duration: 5,  severity: 0.35 },
  { start: 290, duration: 20, severity: 0.10 },
  { start: 380, duration: 10, severity: 0.20 },
];

// ─── Thermal / Atmospheric Constants ────────────────────────────────────────────
const THERMAL_BASE   = 8;
const K_HEAT_DIVISOR = 250;
const K_SOLAR        = 0.008;
const K_VENT_TEMP    = 0.015;
const T_TAU          = 2.0;

const K_SOIL_HUMIDITY  = 0.92;
const K_VENT_HUMIDITY  = 0.035;
const H_TAU            = 1.0;

const CO2_BASE       = 400;
const K_CO2_INJECT   = 10;
const K_CO2_PHOTO    = 0.015;
const K_CO2_VENT     = 0.08;
const C_TAU          = 0.8;

const K_LOCAL_HEAT_DIVISOR = 200;
const SOIL_T_TAU           = 1.5;
const MOISTURE_PUMP_COEFF  = 0.45;
const MOISTURE_EVAP_RATE   = 0.055;

const O2_PRODUCTION_FACTOR = 0.00008;

// ─── Main Simulation ────────────────────────────────────────────────────────────

export function simulate(
  initialEnv: ConcreteEnvironment,
  greenhouse: ConcreteGreenhouseState,
  time: number,
): ConcreteEnvironment {
  const deltaHours = time / 60;

  const simulationMs = initialEnv.timestamp + time * 60_000;
  const missionElapsedHours = initialEnv.missionElapsedHours + deltaHours;
  const missionSol = Math.floor(missionElapsedHours / SOL_HOURS);
  const solFraction = (missionElapsedHours % SOL_HOURS) / SOL_HOURS;

  const solarFactor = Math.max(0, Math.sin(solFraction * 2 * Math.PI));
  const dustStormFactor = getDustStormFactor(missionSol);

  const externalTemp = MARS_MEAN_TEMP + 30 * solarFactor + deterministicNoise(simulationMs, 3);
  const solarRadiation = Math.max(0,
    MARS_SOLAR_CONSTANT * solarFactor * dustStormFactor
    + deterministicNoise(simulationMs + 1000, 30),
  );

  // ─── Air temperature ───
  const T_eq = THERMAL_BASE
    + greenhouse.globalHeatingPower / K_HEAT_DIVISOR
    + solarRadiation * K_SOLAR
    - greenhouse.ventilationRate * K_VENT_TEMP;
  const airTemp = exponentialApproach(initialEnv.airTemperature, T_eq, deltaHours, T_TAU);

  // ─── Humidity ───
  const avgSoilMoisture = ALL_CROP_TYPES.reduce(
    (s, ct) => s + initialEnv.crops[ct].soilMoisture, 0,
  ) / ALL_CROP_TYPES.length;
  const H_eq = clamp(0, 100,
    avgSoilMoisture * K_SOIL_HUMIDITY - greenhouse.ventilationRate * K_VENT_HUMIDITY,
  );
  const humidity = clamp(0, 100,
    exponentialApproach(initialEnv.humidity, H_eq, deltaHours, H_TAU),
  );

  // ─── CO₂ ───
  const C_eq = Math.max(CO2_BASE,
    CO2_BASE
    + greenhouse.co2InjectionRate * K_CO2_INJECT
    - greenhouse.lightingPower * K_CO2_PHOTO
    - greenhouse.ventilationRate * K_CO2_VENT,
  );
  const co2Level = Math.max(CO2_BASE,
    exponentialApproach(initialEnv.co2Level, C_eq, deltaHours, C_TAU),
  );

  const lightLevel = greenhouse.lightingPower * 2 + solarRadiation * 5;

  // ─── Per-crop simulation ───
  const crops = {} as Record<CropType, CropEnvironment>;
  let totalLeafArea = 0;
  for (const ct of ALL_CROP_TYPES) {
    crops[ct] = simulateCrop(
      initialEnv.crops[ct], greenhouse.crops[ct],
      airTemp, humidity, co2Level, lightLevel, deltaHours,
      CROP_PROFILES[ct],
    );
    totalLeafArea += crops[ct].leafArea;
  }

  // ─── O₂ ───
  const o2Rate = lightLevel * Math.max(totalLeafArea, 0.1) * O2_PRODUCTION_FACTOR;
  const o2ProducedKg = initialEnv.o2ProducedKg + o2Rate * deltaHours;
  const o2Level = clamp(18, 25, 20.5 + o2Rate * 0.08 - greenhouse.ventilationRate * 0.0005);

  // ─── Resource tracking ───
  const waterRate = ALL_CROP_TYPES.reduce((s, ct) => s + greenhouse.crops[ct].waterPumpRate, 0);
  const waterConsumedL = initialEnv.waterConsumedL + waterRate * deltaHours;

  const energyKW = (
    greenhouse.globalHeatingPower
    + greenhouse.lightingPower
    + ALL_CROP_TYPES.reduce((s, ct) => s + greenhouse.crops[ct].localHeatingPower, 0)
  ) / 1000;
  const energyUsedKWh = initialEnv.energyUsedKWh + energyKW * deltaHours;

  return {
    timestamp: simulationMs,
    missionStartMs: initialEnv.missionStartMs,
    missionElapsedHours,
    missionSol,
    solFraction,
    airTemperature: airTemp,
    humidity,
    co2Level,
    lightLevel,
    o2Level,
    externalTemp,
    solarRadiation,
    dustStormFactor,
    waterConsumedL,
    energyUsedKWh,
    o2ProducedKg,
    crops,
  };
}

export function createSimulation(
  initialEnv: ConcreteEnvironment,
  greenhouse: ConcreteGreenhouseState,
): SimulationState<ConcreteEnvironment> {
  return {
    getEnvironment: (time: number) => simulate(initialEnv, greenhouse, time),
  };
}

// ─── Crop Simulation ────────────────────────────────────────────────────────────

function simulateCrop(
  initial: CropEnvironment,
  controls: CropControls,
  airTemp: number,
  humidity: number,
  co2Level: number,
  lightLevel: number,
  deltaHours: number,
  profile: CropProfile,
): CropEnvironment {
  if (initial.stage === 'harvested') return { ...initial };

  // Soil temperature
  const soilT_eq = airTemp + controls.localHeatingPower / K_LOCAL_HEAT_DIVISOR;
  const soilTemp = exponentialApproach(initial.soilTemperature, soilT_eq, deltaHours, SOIL_T_TAU);

  // Soil moisture
  const moistureGain = controls.waterPumpRate * MOISTURE_PUMP_COEFF;
  const effectiveEvapRate = MOISTURE_EVAP_RATE
    + Math.max(0, airTemp - 15) * 0.001
    + Math.max(0, 100 - humidity) * 0.0003;
  const m_eq = clamp(0, 100, moistureGain / effectiveEvapRate);
  const soilMoisture = clamp(0, 100,
    exponentialApproach(initial.soilMoisture, m_eq, deltaHours, 1 / effectiveEvapRate / 60),
  );

  // Growth rate (smooth Gaussian response)
  const growthRate = calculateGrowthRate(soilTemp, soilMoisture, airTemp, humidity, co2Level, lightLevel, profile);

  // Stress
  const stressRate = calculateStressRate(soilTemp, soilMoisture, airTemp, profile);
  const stressAccumulator = Math.max(0, initial.stressAccumulator + stressRate * deltaHours);
  const healthScore = clamp(0, 1, 1 - stressAccumulator / 100);

  if (healthScore <= 0) {
    return {
      soilMoisture, soilTemperature: soilTemp,
      stage: 'harvested', stageProgress: 0,
      daysSincePlanting: initial.daysSincePlanting + deltaHours / SOL_HOURS,
      healthScore: 0, stressAccumulator,
      biomassKg: 0, estimatedYieldKg: 0,
      plantGrowth: 0, leafArea: 0, fruitCount: 0,
    };
  }

  // Stage progression
  const effectiveHours = growthRate * healthScore * deltaHours;
  const { stage, stageProgress } = advanceGrowthStage(
    initial.stage, initial.stageProgress, effectiveHours, profile,
  );

  const daysSincePlanting = initial.daysSincePlanting + deltaHours / SOL_HOURS;
  const totalProgress = getTotalProgress(stage, stageProgress, profile);
  const maxBiomass = profile.maxYieldKgPerPlant * profile.plantsPerTile;
  const biomassKg = maxBiomass * totalProgress * healthScore;
  const estimatedYieldKg = biomassKg * profile.harvestIndex;

  const plantGrowth = totalProgress * 100;
  const leafArea = totalProgress * profile.plantsPerTile * 0.02;
  const fruitCount = (stage === 'fruiting' || stage === 'harvest_ready')
    ? Math.floor(profile.plantsPerTile * stageProgress * 0.8)
    : 0;

  return {
    soilMoisture, soilTemperature: soilTemp,
    stage, stageProgress, daysSincePlanting,
    healthScore, stressAccumulator,
    biomassKg, estimatedYieldKg,
    plantGrowth, leafArea, fruitCount,
  };
}

// ─── Growth Rate (Gaussian Response Curves) ─────────────────────────────────────

function calculateGrowthRate(
  soilTemp: number,
  soilMoisture: number,
  airTemp: number,
  humidity: number,
  co2Level: number,
  lightLevel: number,
  profile: CropProfile,
): number {
  const tempR     = gaussian(soilTemp, profile.optimalTemp, profile.tempSigma);
  const moistureR = gaussian(soilMoisture, profile.optimalMoisture, profile.moistureSigma);
  const airTempR  = gaussian(airTemp, (profile.optimalTemp + 21) / 2, 6);
  const co2R      = co2Level < 400 ? 0.3 : Math.min(1.2, 0.5 + 0.7 * (co2Level / 1000));
  const lightR    = lightLevel < 1000 ? 0.2 : Math.min(1.3, 0.4 + 0.9 * (lightLevel / 10000));
  const humidityR = gaussian(humidity, 70, 20);

  return tempR * moistureR * airTempR * co2R * lightR * humidityR;
}

// ─── Stress Model ───────────────────────────────────────────────────────────────

function calculateStressRate(
  soilTemp: number,
  soilMoisture: number,
  airTemp: number,
  profile: CropProfile,
): number {
  let stress = 0;

  const tempDev = Math.abs(soilTemp - profile.optimalTemp);
  if (tempDev > profile.tempSigma) stress += (tempDev - profile.tempSigma) * 0.15;

  const moistDev = Math.abs(soilMoisture - profile.optimalMoisture);
  if (moistDev > profile.moistureSigma) stress += (moistDev - profile.moistureSigma) * 0.12;

  if (airTemp < 5)  stress += (5 - airTemp) * 0.3;
  if (airTemp > 35) stress += (airTemp - 35) * 0.3;

  if (stress < 0.1) stress = -0.5;

  return stress;
}

// ─── Stage Progression ──────────────────────────────────────────────────────────

function advanceGrowthStage(
  currentStage: GrowthStage,
  currentProgress: number,
  effectiveHours: number,
  profile: CropProfile,
): { stage: GrowthStage; stageProgress: number } {
  if (currentStage === 'harvest_ready' || currentStage === 'harvested') {
    return { stage: currentStage, stageProgress: Math.min(1, currentProgress) };
  }

  let stage: GrowthStage = currentStage;
  let progress = currentProgress;
  let remaining = effectiveHours;

  while (remaining > 0 && stage !== 'harvest_ready' && stage !== 'harvested') {
    const frac = profile.stageFractions[stage] || 0.1;
    const stageDurationH = frac * profile.growthCycleSols * SOL_HOURS;
    const hoursToComplete = (1 - progress) * stageDurationH;

    if (remaining >= hoursToComplete) {
      remaining -= hoursToComplete;
      const idx = GROWTH_STAGES.indexOf(stage);
      if (idx < GROWTH_STAGES.length - 1) {
        stage = GROWTH_STAGES[idx + 1];
        progress = 0;
      } else {
        progress = 1;
        break;
      }
    } else {
      progress += remaining / stageDurationH;
      remaining = 0;
    }
  }

  return { stage, stageProgress: Math.min(1, progress) };
}

function getTotalProgress(stage: GrowthStage, stageProgress: number, profile: CropProfile): number {
  let total = 0;
  for (const s of GROWTH_STAGES) {
    if (s === stage) {
      total += (profile.stageFractions[s] || 0) * stageProgress;
      break;
    }
    total += profile.stageFractions[s] || 0;
  }
  return Math.min(1, total);
}

// ─── Dust Storms ────────────────────────────────────────────────────────────────

function getDustStormFactor(sol: number): number {
  for (const storm of DUST_STORMS) {
    if (sol >= storm.start && sol < storm.start + storm.duration) {
      const t = (sol - storm.start) / storm.duration;
      const ramp = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      return storm.severity + (1 - storm.severity) * (1 - ramp);
    }
  }
  return 1.0;
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

function gaussian(value: number, mean: number, sigma: number): number {
  return Math.exp(-0.5 * ((value - mean) / sigma) ** 2);
}

function exponentialApproach(initial: number, target: number, deltaHours: number, tau: number): number {
  if (tau <= 0) return target;
  return target + (initial - target) * Math.exp(-deltaHours / tau);
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function deterministicNoise(seed: number, range: number): number {
  const x = Math.sin(seed * 0.001) * 10000;
  return ((x - Math.floor(x)) - 0.5) * range;
}
