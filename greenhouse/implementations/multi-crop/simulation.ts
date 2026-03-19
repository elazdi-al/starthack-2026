import type { SimulationState } from '../../state/types';
import type {
  ConcreteEnvironment, ConcreteGreenhouseState,
  CropEnvironment, CropControls, CropType, GrowthStage,
  SeasonName, DustStormRisk, NutritionalOutput, TileCropEnvironment,
} from './types';
import { ALL_CROP_TYPES, GROWTH_STAGES, CREW_DAILY_TARGETS } from './types';
import { CROP_PROFILES, type CropProfile } from './profiles';
import { aggregateTileCrops } from './crop-utils';

export { CROP_PROFILES } from './profiles';

// ─── Mars Constants ─────────────────────────────────────────────────────────────
export const SOL_HOURS = 24.6167;
const MARS_SOLAR_CONSTANT = 590;   // W/m² (mean value over full orbit)
const MARS_MEAN_TEMP = -63;        // °C mean surface temperature
const MARS_YEAR_SOLS = 668.6;      // sols per Martian year
const MARS_ECCENTRICITY = 0.0934;  // orbital eccentricity (much higher than Earth's 0.017)
const MARS_LS_PERIHELION = 251;    // Ls° at perihelion (southern summer / global storm season)
const MARS_MEAN_PRESSURE = 650;    // Pa mean surface pressure (KB: 6–7 mbar)

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

// ─── Energy & Water Constants ────────────────────────────────────────────────────
const WATER_RECYCLING_DECAY_PER_SOL = 0.00015;   // natural filter degradation/sol
const WATER_RECYCLING_STORM_PENALTY  = 0.0004;   // extra decay per sol during dust storm
const EC_EVAP_RATE_BASE              = 0.0008;   // mS/cm per hour natural concentration drift
const DISEASE_HUMIDITY_THRESHOLD     = 80;        // % above which disease risk builds
const DISEASE_BUILD_RATE             = 0.003;     // risk units per hour at max humidity
const DISEASE_CLEAR_RATE             = 0.001;     // risk units cleared per hour when humidity low
const ROOT_O2_TAU                    = 3.0;       // hours time-constant for root O₂ change
const GRAVITY_GROWTH_PENALTY         = 0.05;      // 5 % growth reduction from 0.38g effects

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

// ─── Nutritional Output ──────────────────────────────────────────────────────────

function calculateNutritionalOutput(crops: Record<CropType, CropEnvironment>): NutritionalOutput {
  let caloriesPerDay = 0, proteinGPerDay = 0, vitaminC_mgPerDay = 0;
  let vitaminA_mcgPerDay = 0, iron_mgPerDay = 0, calcium_mgPerDay = 0, fiber_gPerDay = 0;

  for (const ct of ALL_CROP_TYPES) {
    const profile = CROP_PROFILES[ct];
    const crop = crops[ct];
    // Daily contribution: estimated yield available / growth cycle sols (daily harvest rate)
    const dailyYieldKg = crop.estimatedYieldKg / Math.max(1, profile.growthCycleSols);
    caloriesPerDay     += dailyYieldKg * profile.caloriesPerKg;
    proteinGPerDay     += dailyYieldKg * profile.proteinPerKg;
    vitaminC_mgPerDay  += dailyYieldKg * profile.vitaminC_mgPerKg;
    vitaminA_mcgPerDay += dailyYieldKg * profile.vitaminA_mcgPerKg;
    iron_mgPerDay      += dailyYieldKg * profile.iron_mgPerKg;
    calcium_mgPerDay   += dailyYieldKg * profile.calcium_mgPerKg;
    fiber_gPerDay      += dailyYieldKg * profile.fiber_gPerKg;
  }

  return { caloriesPerDay, proteinGPerDay, vitaminC_mgPerDay, vitaminA_mcgPerDay, iron_mgPerDay, calcium_mgPerDay, fiber_gPerDay };
}

function calculateNutritionalCoverage(output: NutritionalOutput): number {
  const calCov     = Math.min(1, output.caloriesPerDay    / CREW_DAILY_TARGETS.calories);
  const protCov    = Math.min(1, output.proteinGPerDay    / CREW_DAILY_TARGETS.proteinG);
  const vitCCov    = Math.min(1, output.vitaminC_mgPerDay / CREW_DAILY_TARGETS.vitaminC_mg);
  const vitACov    = Math.min(1, output.vitaminA_mcgPerDay/ CREW_DAILY_TARGETS.vitaminA_mcg);
  const ironCov    = Math.min(1, output.iron_mgPerDay     / CREW_DAILY_TARGETS.iron_mg);
  // Weighted: calories 35%, protein 30%, micronutrients 35%
  return calCov * 0.35 + protCov * 0.30 + (vitCCov + vitACov + ironCov) / 3 * 0.35;
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

  const effectiveSolFraction = ov.timeOfDayLocked ? ov.timeOfDayFraction : solFraction;
  const solarFactor = Math.max(0, Math.sin((effectiveSolFraction - 0.25) * 2 * Math.PI));

  const dustStormFactor = ov.dustStormEnabled
    ? Math.max(0, 1 - ov.dustStormSeverity)
    : getDustStormFactor(currentLs, missionSol, missionStartLs, dustStorms);

  const effectiveAtmosphericPressure = ov.atmosphericPressureEnabled
    ? ov.atmosphericPressure
    : atmosphericPressure;

  const externalTemp = ov.externalTempEnabled
    ? ov.externalTemp
    : MARS_MEAN_TEMP + seasonalTempOffset + 30 * solarFactor + deterministicNoise(simulationMs, 3);

  const solarRadiation = ov.solarRadiationEnabled
    ? ov.solarRadiation
    : Math.max(0,
        seasonalSolarFlux * solarFactor * dustStormFactor
        + deterministicNoise(simulationMs + 1000, 30),
      );

  // ─── Energy Budget ───
  const solarGenerationKW = greenhouse.maxSolarGenerationKW * solarFactor * dustStormFactor;
  const cropLocalHeatKW   = ALL_CROP_TYPES.reduce((s, ct) => s + greenhouse.crops[ct].localHeatingPower, 0) / 1000;
  const powerDemandKW     = (greenhouse.globalHeatingPower + greenhouse.lightingPower) / 1000 + cropLocalHeatKW;
  const netPowerKW        = solarGenerationKW - powerDemandKW;
  let   batteryStorageKWh = clamp(0, greenhouse.batteryCapacityKWh,
    initialEnv.batteryStorageKWh + netPowerKW * deltaHours,
  );
  const energyDeficit     = batteryStorageKWh <= 0 && netPowerKW < 0;
  // Effective lighting/heating when in deficit: scale down by available energy ratio
  const energyAvailRatio  = energyDeficit
    ? clamp(0.2, 1, solarGenerationKW / Math.max(0.1, powerDemandKW))
    : 1;

  // ─── Water Recycling Efficiency ───
  const deltaPerSol        = deltaHours / SOL_HOURS;
  const stormPenalty       = dustStormFactor < 0.8 ? WATER_RECYCLING_STORM_PENALTY : 0;
  const waterRecyclingEfficiency = clamp(0.30, 0.99,
    initialEnv.waterRecyclingEfficiency - (WATER_RECYCLING_DECAY_PER_SOL + stormPenalty) * deltaPerSol,
  );
  // Irrigation effectiveness: scales with recycling — below 85% the water supply shrinks
  const irrigationEffectiveness = waterRecyclingEfficiency / 0.95;

  // ─── Air temperature (modified by energy availability) ───
  const effectiveHeating = greenhouse.globalHeatingPower * energyAvailRatio;
  const effectiveLighting = greenhouse.lightingPower * energyAvailRatio;
  const T_eq = THERMAL_BASE
    + effectiveHeating / K_HEAT_DIVISOR
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
  const pressureModifier = effectiveAtmosphericPressure / MARS_MEAN_PRESSURE;
  const C_eq = Math.max(CO2_BASE,
    CO2_BASE
    + greenhouse.co2InjectionRate * K_CO2_INJECT * pressureModifier
    - effectiveLighting * K_CO2_PHOTO
    - greenhouse.ventilationRate * K_CO2_VENT,
  );
  const co2Level = Math.max(CO2_BASE,
    exponentialApproach(initialEnv.co2Level, C_eq, deltaHours, C_TAU),
  );
  const co2SafetyAlert = co2Level > 1500;

  const lightLevel = effectiveLighting * 2 + solarRadiation * 5;

  // ─── Per-tile crop simulation (individual entities with genetic variance) ───
  const tileCrops: Record<string, TileCropEnvironment> = {};
  let totalLeafArea = 0;

  if (initialEnv.tileCrops && Object.keys(initialEnv.tileCrops).length > 0) {
    // Simulate each tile as an independent entity
    for (const [tileId, tileCrop] of Object.entries(initialEnv.tileCrops)) {
      const ct = tileCrop.cropType;
      const profile = CROP_PROFILES[ct];
      const controls = greenhouse.crops[ct]; // controls are still per-type

      const simulated = simulateTileCrop(
        tileCrop, controls,
        airTemp, humidity, co2Level, lightLevel, deltaHours,
        profile, irrigationEffectiveness,
      );
      tileCrops[tileId] = simulated;
      totalLeafArea += simulated.leafArea;
    }
  }

  // Aggregate per-type for backward compat (agents, nutrition panel, progress)
  const crops = Object.keys(tileCrops).length > 0
    ? aggregateTileCrops(tileCrops)
    : (() => {
        // Fallback: no tileCrops — use legacy per-type simulation
        const c = {} as Record<CropType, CropEnvironment>;
        for (const ct of ALL_CROP_TYPES) {
          c[ct] = simulateCrop(
            initialEnv.crops[ct], greenhouse.crops[ct],
            airTemp, humidity, co2Level, lightLevel, deltaHours,
            CROP_PROFILES[ct], irrigationEffectiveness,
          );
          totalLeafArea += c[ct].leafArea;
        }
        return c;
      })();

  // ─── O₂ ───
  const o2Rate = lightLevel * Math.max(totalLeafArea, 0.1) * O2_PRODUCTION_FACTOR;
  const o2ProducedKg = initialEnv.o2ProducedKg + o2Rate * deltaHours;
  const o2Level = clamp(18, 25, 20.5 + o2Rate * 0.08 - greenhouse.ventilationRate * 0.0005);

  // ─── Resource tracking ───
  const waterRate = ALL_CROP_TYPES.reduce((s, ct) => s + greenhouse.crops[ct].waterPumpRate, 0);
  const waterConsumedL = initialEnv.waterConsumedL + waterRate * irrigationEffectiveness * deltaHours;

  const energyKW = powerDemandKW;
  const energyUsedKWh = initialEnv.energyUsedKWh + energyKW * deltaHours;

  // ─── Nutritional output ───
  const nutritionalOutput = calculateNutritionalOutput(crops);
  const greenhouseCoverage = calculateNutritionalCoverage(nutritionalOutput);

  // ─── Food reserves ───
  // Pre-packaged food depletes at 1 sol per sol elapsed.
  // Greenhouse harvests supplement reserves (each sol of greenhouse coverage saves reserves).
  // foodReservesSols represents how many sols of full crew nutrition remain in storage.
  const deltaSols = deltaHours / SOL_HOURS;
  const reserveDepletion = deltaSols * Math.max(0, 1 - greenhouseCoverage); // greenhouse output offsets depletion
  const foodReservesSols = Math.max(0, initialEnv.foodReservesSols - reserveDepletion);

  // Effective nutritional coverage: if greenhouse covers X% and reserves exist, crew is fed
  const nutritionalCoverage = foodReservesSols > 0
    ? Math.min(1, greenhouseCoverage + (1 - greenhouseCoverage)) // reserves fill the gap → 1.0
    : greenhouseCoverage; // reserves exhausted — crew depends entirely on greenhouse

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
    waterRecyclingEfficiency,
    solarGenerationKW,
    batteryStorageKWh,
    energyDeficit,
    co2SafetyAlert,
    nutritionalOutput,
    nutritionalCoverage,
    foodReservesSols,
    crops,
    tileCrops,
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
  irrigationEffectiveness: number,
): CropEnvironment {
  if (initial.stage === 'harvested') return { ...initial };

  // Soil temperature
  const soilT_eq = airTemp + controls.localHeatingPower / K_LOCAL_HEAT_DIVISOR;
  const soilTemp = exponentialApproach(initial.soilTemperature, soilT_eq, deltaHours, SOIL_T_TAU);

  // Soil moisture (scaled by irrigation effectiveness from water recycling)
  const moistureGain = controls.waterPumpRate * MOISTURE_PUMP_COEFF * irrigationEffectiveness;
  const effectiveEvapRate = MOISTURE_EVAP_RATE
    + Math.max(0, airTemp - 15) * 0.001
    + Math.max(0, 100 - humidity) * 0.0003;
  const m_eq = clamp(0, 100, moistureGain / effectiveEvapRate);
  const soilMoisture = clamp(0, 100,
    exponentialApproach(initial.soilMoisture, m_eq, deltaHours, 1 / effectiveEvapRate / 60),
  );

  // ─── Root O₂ (hypoxia model) ───
  const overwaterFraction = Math.max(0, soilMoisture - 80) / 20; // 0 at 80%, 1 at 100%
  const aerationBenefit   = controls.aerationRate / 100;
  const rootO2Target      = clamp(10, 100, 95 - overwaterFraction * 65 + aerationBenefit * 25);
  const rootO2Level       = clamp(5, 100,
    exponentialApproach(initial.rootO2Level, rootO2Target, deltaHours, ROOT_O2_TAU),
  );

  // ─── Nutrient EC (electrical conductivity) ───
  // Evaporation concentrates nutrients; control target pulls toward set EC
  const ecEvapConcentration = EC_EVAP_RATE_BASE * Math.max(1, airTemp / 20) * deltaHours;
  const ecTarget = controls.nutrientConcentration;
  const nutrientEC = clamp(0.3, 6.5,
    exponentialApproach(initial.nutrientEC, ecTarget, deltaHours, 6.0) + ecEvapConcentration,
  );

  // ─── Disease risk (humidity-driven pathogen accumulation) ───
  const humidityExcess   = Math.max(0, humidity - DISEASE_HUMIDITY_THRESHOLD) / (100 - DISEASE_HUMIDITY_THRESHOLD);
  const diseaseBuildup   = humidityExcess * DISEASE_BUILD_RATE * profile.diseaseSusceptibility * deltaHours;
  const diseaseClearance = Math.max(0, (DISEASE_HUMIDITY_THRESHOLD - humidity) / DISEASE_HUMIDITY_THRESHOLD)
    * DISEASE_CLEAR_RATE * deltaHours;
  const diseaseRisk      = clamp(0, 1, initial.diseaseRisk + diseaseBuildup - diseaseClearance);

  // ─── Bolting ───
  const aboveThreshold           = airTemp > profile.boltingTempThreshold;
  const boltingHoursAccumulated  = clamp(0, profile.boltingHoursToTrigger * 2,
    initial.boltingHoursAccumulated + (aboveThreshold ? deltaHours : -deltaHours * 0.3),
  );
  const isBolting = boltingHoursAccumulated >= profile.boltingHoursToTrigger;

  // ─── Growth rate (smooth Gaussian response + new modifiers) ───
  const growthRate = calculateGrowthRate(
    soilTemp, soilMoisture, airTemp, humidity, co2Level, lightLevel,
    nutrientEC, rootO2Level, diseaseRisk, isBolting, profile,
  );

  // ─── Stress ───
  const stressRate = calculateStressRate(soilTemp, soilMoisture, airTemp, nutrientEC, rootO2Level, diseaseRisk, profile);
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
      rootO2Level, nutrientEC, diseaseRisk, isBolting, boltingHoursAccumulated,
    };
  }

  // Stage progression — bolting forces rapid advance at heavily reduced yield
  const boltingSpeedMult   = isBolting ? 3.0 : 1.0;
  const effectiveHours     = growthRate * healthScore * (1 - GRAVITY_GROWTH_PENALTY) * boltingSpeedMult * deltaHours;
  const { stage, stageProgress } = advanceGrowthStage(
    initial.stage, initial.stageProgress, effectiveHours, profile,
  );

  const daysSincePlanting = initial.daysSincePlanting + deltaHours / SOL_HOURS;
  const totalProgress     = getTotalProgress(stage, stageProgress, profile);
  const maxBiomass        = profile.maxYieldKgPerPlant * profile.plantsPerTile;
  // Bolting reduces harvestable yield significantly; disease also cuts yield
  const boltingYieldPenalty  = isBolting ? 0.25 : 1.0;
  const diseaseYieldPenalty  = 1 - diseaseRisk * 0.6;
  const biomassKg            = maxBiomass * totalProgress * healthScore * diseaseYieldPenalty;
  const estimatedYieldKg     = biomassKg * profile.harvestIndex * boltingYieldPenalty;

  const plantGrowth = totalProgress * 100;
  const leafArea    = totalProgress * profile.plantsPerTile * 0.02;
  const fruitCount  = (stage === 'fruiting' || stage === 'harvest_ready')
    ? Math.floor(profile.plantsPerTile * stageProgress * 0.8)
    : 0;

  return {
    soilMoisture, soilTemperature: soilTemp,
    stage, stageProgress, daysSincePlanting,
    healthScore, stressAccumulator,
    biomassKg, estimatedYieldKg,
    plantGrowth, leafArea, fruitCount,
    rootO2Level, nutrientEC, diseaseRisk, isBolting, boltingHoursAccumulated,
  };
}

// ─── Per-Tile Crop Simulation (genetically modulated) ────────────────────────

/**
 * Simulates a single tile crop instance, modulating profile parameters
 * by the tile's genetic factors. The core physics are identical to
 * simulateCrop, but optimalTemp, optimalMoisture, growth rate, bolting
 * threshold, stress resilience, water needs, and yield potential are all
 * perturbed by per-individual genetic multipliers.
 */
function simulateTileCrop(
  initial: TileCropEnvironment,
  controls: CropControls,
  airTemp: number,
  humidity: number,
  co2Level: number,
  lightLevel: number,
  deltaHours: number,
  baseProfile: CropProfile,
  irrigationEffectiveness: number,
): TileCropEnvironment {
  if (initial.stage === 'harvested') return { ...initial };

  // Build a genetically-modulated profile for this individual
  const g = initial;
  const profile: CropProfile = {
    ...baseProfile,
    optimalTemp: baseProfile.optimalTemp * g.geneticOptimalTempFactor,
    optimalMoisture: baseProfile.optimalMoisture * g.geneticOptimalMoistureFactor,
    growthCycleSols: baseProfile.growthCycleSols / g.geneticGrowthRateFactor,
    maxYieldKgPerPlant: baseProfile.maxYieldKgPerPlant * g.geneticMaxYieldFactor,
    boltingTempThreshold: baseProfile.boltingTempThreshold * g.geneticBoltingThresholdFactor,
    waterLPerHourBase: baseProfile.waterLPerHourBase / g.geneticWaterEfficiencyFactor,
  };

  // Delegate to the base simulateCrop with the modulated profile
  const baseCropEnv = simulateCrop(
    initial, controls, airTemp, humidity, co2Level, lightLevel, deltaHours,
    profile, irrigationEffectiveness,
  );

  // Modulate stress resilience: scale the stress accumulator growth
  // Higher stressResilienceFactor → less stress accumulation
  const resilienceAdjustedStress = baseCropEnv.stressAccumulator / g.geneticStressResilienceFactor;
  const resilienceAdjustedHealth = clamp(0, 1, 1 - resilienceAdjustedStress / 100);

  return {
    ...baseCropEnv,
    stressAccumulator: resilienceAdjustedStress,
    healthScore: resilienceAdjustedHealth,
    tileId: initial.tileId,
    cropType: initial.cropType,
    geneticSeed: initial.geneticSeed,
    geneticOptimalTempFactor: initial.geneticOptimalTempFactor,
    geneticOptimalMoistureFactor: initial.geneticOptimalMoistureFactor,
    geneticGrowthRateFactor: initial.geneticGrowthRateFactor,
    geneticMaxYieldFactor: initial.geneticMaxYieldFactor,
    geneticBoltingThresholdFactor: initial.geneticBoltingThresholdFactor,
    geneticStressResilienceFactor: initial.geneticStressResilienceFactor,
    geneticWaterEfficiencyFactor: initial.geneticWaterEfficiencyFactor,
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
  nutrientEC: number,
  rootO2Level: number,
  diseaseRisk: number,
  isBolting: boolean,
  profile: CropProfile,
): number {
  const tempR     = gaussian(soilTemp, profile.optimalTemp, profile.tempSigma);
  const moistureR = gaussian(soilMoisture, profile.optimalMoisture, profile.moistureSigma);
  const airTempR  = gaussian(airTemp, (profile.optimalTemp + 21) / 2, 6);
  const co2R      = co2Level < 400 ? 0.3 : Math.min(1.2, 0.5 + 0.7 * (co2Level / 1000));

  // Photoinhibition: light above saturation point damages chlorophyll
  const rawLightR = lightLevel < 1000 ? 0.2 : Math.min(1.3, 0.4 + 0.9 * (lightLevel / 10000));
  const photoinhibition = lightLevel > profile.lightSaturationPoint
    ? 1 - Math.min(0.6, (lightLevel - profile.lightSaturationPoint) / profile.lightSaturationPoint * 0.5)
    : 1;
  const lightR = rawLightR * photoinhibition;

  const humidityR = gaussian(humidity, 70, 20);

  // Nutrient EC: optimal 1.5–2.5, stress outside range (sensitivity-weighted)
  const ecDev      = nutrientEC < 1.5 ? (1.5 - nutrientEC) / 1.0
                   : nutrientEC > 2.5 ? (nutrientEC - 2.5) / 1.5
                   : 0;
  const nutrientR  = Math.max(0.1, 1 - ecDev * profile.nutrientSensitivity * 0.7);

  // Root O₂: below 70% starts impairing uptake (sensitivity-weighted)
  const rootO2R    = rootO2Level > 70 ? 1.0
                   : Math.max(0.1, 0.1 + (rootO2Level / 70) * 0.9 * profile.rootO2Sensitivity
                       + (1 - profile.rootO2Sensitivity) * 0.9);

  // Disease: reduces photosynthetic capacity
  const diseaseR   = 1 - diseaseRisk * 0.5;

  // Bolting crops grow faster (toward seed production) but produce poor yield — handled in caller
  const boltingR   = isBolting ? 1.5 : 1.0;

  return tempR * moistureR * airTempR * co2R * lightR * humidityR * nutrientR * rootO2R * diseaseR * boltingR;
}

// ─── Stress Model ───────────────────────────────────────────────────────────────

function calculateStressRate(
  soilTemp: number,
  soilMoisture: number,
  airTemp: number,
  nutrientEC: number,
  rootO2Level: number,
  diseaseRisk: number,
  profile: CropProfile,
): number {
  let stress = 0;

  const tempDev = Math.abs(soilTemp - profile.optimalTemp);
  if (tempDev > profile.tempSigma) stress += (tempDev - profile.tempSigma) * 0.15;

  const moistDev = Math.abs(soilMoisture - profile.optimalMoisture);
  if (moistDev > profile.moistureSigma) stress += (moistDev - profile.moistureSigma) * 0.12;

  if (airTemp < 5)  stress += (5 - airTemp) * 0.3;
  if (airTemp > 35) stress += (airTemp - 35) * 0.3;

  // Salinity stress (high EC)
  if (nutrientEC > 3.0) stress += (nutrientEC - 3.0) * profile.nutrientSensitivity * 0.4;
  // Nutrient deficiency stress (low EC)
  if (nutrientEC < 1.0) stress += (1.0 - nutrientEC) * profile.nutrientSensitivity * 0.25;

  // Root hypoxia stress
  if (rootO2Level < 50) stress += (50 - rootO2Level) / 50 * profile.rootO2Sensitivity * 0.3;

  // Disease stress
  stress += diseaseRisk * 0.2;

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
