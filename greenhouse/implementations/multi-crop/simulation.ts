import type { SimulationState } from '../../state/types';
import type {
  ConcreteEnvironment, ConcreteGreenhouseState,
  CropEnvironment, CropControls, CropType, GrowthStage,
  SeasonName, DustStormRisk,
} from './types';
import { ALL_CROP_TYPES, GROWTH_STAGES } from './types';
import { CROP_PROFILES, type CropProfile } from './profiles';

export { CROP_PROFILES } from './profiles';

// ─── Mars Constants ─────────────────────────────────────────────────────────────
export const SOL_HOURS = 24.6167;
const MARS_SOLAR_CONSTANT = 590;   // W/m² (mean value over full orbit)
const MARS_MEAN_TEMP = -63;        // °C mean surface temperature
const MARS_YEAR_SOLS = 668.6;      // sols per Martian year
const MARS_ECCENTRICITY = 0.0934;  // orbital eccentricity (much higher than Earth's 0.017)
const MARS_LS_PERIHELION = 251;    // Ls° at perihelion (southern summer / global storm season)
const MARS_MEAN_PRESSURE = 600;    // Pa mean surface pressure

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

// ─── Dust Storm Types ────────────────────────────────────────────────────────────

interface LsDustStorm {
  yearIndex: number;  // which Martian year (0 = year mission starts in, 1 = next year)
  startLs: number;    // solar longitude at storm start (0–360°)
  durationLs: number; // duration in degrees of Ls (5–90°)
  severity: number;   // opacity factor 0–1 (1 = completely opaque)
}

// ─── Seasonal Helpers ────────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert mission-elapsed sols to Ls (solar longitude, 0–360°).
 * Uses a linear approximation — good to within ~5° for seasonal planning.
 */
function solToLs(missionSol: number, missionStartLs: number): number {
  return ((missionStartLs + (missionSol / MARS_YEAR_SOLS) * 360) % 360 + 360) % 360;
}

/**
 * Seasonal solar flux at Mars due to orbital eccentricity.
 * At perihelion (Ls 251°): ~718 W/m².  At aphelion (Ls 71°): ~493 W/m².
 * Formula: S = S_mean × ((1 + e·cos(ν)) / (1 − e²))²
 * where ν = Ls − Ls_perihelion is the true anomaly from perihelion.
 */
function computeSeasonalSolarFlux(ls: number): number {
  const nu = toRad(ls - MARS_LS_PERIHELION);
  const e = MARS_ECCENTRICITY;
  const distanceFactor = (1 + e * Math.cos(nu)) / (1 - e * e);
  return MARS_SOLAR_CONSTANT * distanceFactor * distanceFactor;
}

/**
 * Seasonal temperature offset driven by orbital eccentricity.
 * Mars is ~20°C warmer globally at perihelion (Ls 251°) than at aphelion (Ls 71°).
 * At equatorial latitudes the swing is ±15°C.
 */
function computeSeasonalTempOffset(ls: number): number {
  const nu = toRad(ls - MARS_LS_PERIHELION);
  return 15 * Math.cos(nu);
}

/**
 * Atmospheric pressure variation due to CO₂ condensation/sublimation at poles.
 * Pressure is ~12% below mean at Ls ~150° (south polar cap at maximum)
 * and ~12% above mean at Ls ~330° (north polar cap at maximum).
 */
function computeAtmosphericPressure(ls: number): number {
  return MARS_MEAN_PRESSURE * (1 + 0.12 * Math.cos(toRad(ls - 330)));
}

/**
 * Qualitative dust storm risk based on Ls.
 * Real peak: Ls 250–310° (perihelion season, southern spring/summer).
 */
function computeDustStormRisk(ls: number): DustStormRisk {
  if (ls >= 250 && ls <= 310) return 'extreme';
  if ((ls >= 180 && ls < 250) || (ls > 310 && ls <= 360)) return 'high';
  if (ls >= 140 && ls < 180) return 'moderate';
  return 'low';
}

/**
 * Map Ls to season name (northern hemisphere convention).
 * Ls 0–90°: Northern Spring, 90–180°: Northern Summer,
 * 180–270°: Northern Autumn, 270–360°: Northern Winter.
 */
function computeSeasonName(ls: number): SeasonName {
  if (ls < 90)  return 'northern_spring';
  if (ls < 180) return 'northern_summer';
  if (ls < 270) return 'northern_autumn';
  return 'northern_winter';
}

// ─── Dust Storm Generation ───────────────────────────────────────────────────────

/**
 * Minimal linear congruential generator for deterministic pseudo-randomness.
 * Returns a factory function so each call advances state independently.
 */
function makeLCG(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Generate dust storms for the full mission span (2 Martian years).
 * Storms are concentrated in the perihelion season (Ls 180–360°).
 * Seeded on missionStartLs so each starting configuration produces a
 * distinct but reproducible storm calendar.
 *
 * Regional storms: 2–3 per year, Ls 180–360°, duration 5–30° Ls.
 * Global storm:   ~15% chance per year, Ls 250–310°, duration 60–90° Ls.
 */
function generateMissionDustStorms(missionStartLs: number): LsDustStorm[] {
  const storms: LsDustStorm[] = [];

  for (let yearIdx = 0; yearIdx <= 1; yearIdx++) {
    const rng = makeLCG(yearIdx * 7919 + Math.round(missionStartLs) * 31);

    // Regional storms
    const numRegional = 2 + Math.floor(rng() * 2); // 2 or 3
    for (let i = 0; i < numRegional; i++) {
      // Weight toward Ls 250°–300° using rejection-like bias
      const rawLs = rng() * 180; // 0–180
      // Square the distribution to bias toward higher Ls values within range
      const startLs = 180 + rawLs * rawLs / 180;
      const durationLs = 5 + rng() * 25;
      const severity = 0.1 + rng() * 0.35;
      storms.push({ yearIndex: yearIdx, startLs: startLs % 360, durationLs, severity });
    }

    // Global storm (rare)
    if (rng() < 0.15) {
      const startLs = 250 + rng() * 60;
      const durationLs = 60 + rng() * 30;
      const severity = 0.5 + rng() * 0.4;
      storms.push({ yearIndex: yearIdx, startLs, durationLs, severity });
    }
  }

  return storms;
}

/**
 * Compute dust storm attenuation factor (1.0 = clear, 0.0 = fully opaque).
 * Looks up which Martian year we're in (based on missionSol and missionStartLs)
 * and checks each storm for the storm's current Ls position.
 */
function getDustStormFactor(
  currentLs: number,
  missionSol: number,
  missionStartLs: number,
  storms: LsDustStorm[],
): number {
  // Which Martian year are we in (0-indexed from mission start)?
  const absoluteSol = (missionStartLs / 360) * MARS_YEAR_SOLS + missionSol;
  const yearIndex = Math.floor(absoluteSol / MARS_YEAR_SOLS);
  // Ls within the current Martian year
  const yearLs = currentLs;

  let factor = 1.0;
  for (const storm of storms) {
    if (storm.yearIndex !== yearIndex) continue;
    const endLs = storm.startLs + storm.durationLs;
    if (yearLs >= storm.startLs && yearLs < endLs) {
      const t = (yearLs - storm.startLs) / storm.durationLs;
      const ramp = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      const stormFactor = storm.severity + (1 - storm.severity) * (1 - ramp);
      factor = Math.min(factor, stormFactor);
    }
  }
  return factor;
}

// ─── Main Simulation ────────────────────────────────────────────────────────────

function simulate(
  initialEnv: ConcreteEnvironment,
  greenhouse: ConcreteGreenhouseState,
  time: number,
  dustStorms: LsDustStorm[],
): ConcreteEnvironment {
  const deltaHours = time / 60;

  const simulationMs = initialEnv.timestamp + time * 60_000;
  const missionElapsedHours = initialEnv.missionElapsedHours + deltaHours;
  const missionSol = Math.floor(missionElapsedHours / SOL_HOURS);
  const solFraction = (missionElapsedHours % SOL_HOURS) / SOL_HOURS;

  // ─── Seasonal calculations ───
  const missionStartLs = initialEnv.missionStartLs;
  const currentLs = solToLs(missionSol, missionStartLs);
  const seasonName = computeSeasonName(currentLs);
  const seasonalSolarFlux = computeSeasonalSolarFlux(currentLs);
  const seasonalTempOffset = computeSeasonalTempOffset(currentLs);
  const atmosphericPressure = computeAtmosphericPressure(currentLs);
  const dustStormRisk = computeDustStormRisk(currentLs);

  // ─── Daily cycle + dust ───
  const ov = greenhouse.overrides;

  // Time-of-day: manual lock overrides the computed sol fraction
  const effectiveSolFraction = ov.timeOfDayLocked ? ov.timeOfDayFraction : solFraction;

  // Shift by 0.25 so the peak (sin=1) falls at solFraction=0.5 (noon),
  // dawn at 0.25, dusk at 0.75, and darkness either side.
  const solarFactor = Math.max(0, Math.sin((effectiveSolFraction - 0.25) * 2 * Math.PI));

  // Dust storm: manual override bypasses the seasonal calendar
  const dustStormFactor = ov.dustStormEnabled
    ? Math.max(0, 1 - ov.dustStormSeverity)
    : getDustStormFactor(currentLs, missionSol, missionStartLs, dustStorms);

  // Atmospheric pressure: manual override bypasses seasonal CO₂ cycle
  const effectiveAtmosphericPressure = ov.atmosphericPressureEnabled
    ? ov.atmosphericPressure
    : atmosphericPressure;

  // External temperature: manual override bypasses physics
  const externalTemp = ov.externalTempEnabled
    ? ov.externalTemp
    : MARS_MEAN_TEMP + seasonalTempOffset + 30 * solarFactor + deterministicNoise(simulationMs, 3);

  // Solar radiation: manual override bypasses physics (raw value, ignores dust/day-night)
  const solarRadiation = ov.solarRadiationEnabled
    ? ov.solarRadiation
    : Math.max(0,
        seasonalSolarFlux * solarFactor * dustStormFactor
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

  // ─── CO₂ — modulated slightly by atmospheric pressure ───
  // Higher pressure = slightly higher CO₂ partial pressure for same ppm
  const pressureModifier = effectiveAtmosphericPressure / MARS_MEAN_PRESSURE;
  const C_eq = Math.max(CO2_BASE,
    CO2_BASE
    + greenhouse.co2InjectionRate * K_CO2_INJECT * pressureModifier
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
    solFraction: effectiveSolFraction,
    missionStartLs,
    currentLs,
    seasonName,
    seasonalSolarFlux,
    atmosphericPressure: effectiveAtmosphericPressure,
    dustStormRisk,
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
  const dustStorms = generateMissionDustStorms(initialEnv.missionStartLs);
  return {
    getEnvironment: (time: number) => simulate(initialEnv, greenhouse, time, dustStorms),
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
