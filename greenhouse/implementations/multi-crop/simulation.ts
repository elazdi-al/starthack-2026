import type { SimulationState } from '../../state/types';
import type { ConcreteEnvironment, ConcreteGreenhouseState, CropEnvironment, CropControls, CropType } from './types';
import { ALL_CROP_TYPES } from './types';

export const CROP_PROFILES: Record<CropType, { optimalTemp: number; optimalMoisture: number }> = {
  lettuce:  { optimalTemp: 21, optimalMoisture: 70 },
  tomato:   { optimalTemp: 24, optimalMoisture: 70 },
  potato:   { optimalTemp: 18, optimalMoisture: 65 },
  soybean:  { optimalTemp: 25, optimalMoisture: 65 },
  spinach:  { optimalTemp: 18, optimalMoisture: 65 },
  wheat:    { optimalTemp: 21, optimalMoisture: 60 },
  radish:   { optimalTemp: 19, optimalMoisture: 60 },
  kale:     { optimalTemp: 19, optimalMoisture: 65 },
};

// ─── Greenhouse Thermal Model ─────────────────────────────────────────────────
// Sealed, pressurized Mars greenhouse. Environmental parameters follow
// exponential approach to thermal/chemical equilibrium:
//   X(t) = X_eq + (X₀ - X_eq) · e^(−t/τ)
// This produces realistic progressive changes when machine parameters
// are adjusted — no instantaneous jumps.
// ──────────────────────────────────────────────────────────────────────────────

// Temperature equilibrium: T_eq = T_base + heating/K_heat + solar·K_solar − vent·K_vent
const THERMAL_BASE = 8;
const K_HEAT_DIVISOR = 250;
const K_SOLAR = 0.008;
const K_VENT_TEMP = 0.015;
const T_TAU = 2.0; // hours

// Humidity equilibrium: H_eq = avgMoisture·K_soil − vent·K_vent_h
const K_SOIL_HUMIDITY = 0.92;
const K_VENT_HUMIDITY = 0.035;
const H_TAU = 1.0;

// CO₂ equilibrium: C_eq = base + inject·K_inj − light·K_photo − vent·K_co2v
const CO2_BASE = 400;
const K_CO2_INJECT = 10;
const K_CO2_PHOTO = 0.015;
const K_CO2_VENT = 0.08;
const C_TAU = 0.8;

// Soil temperature: approaches air temp + local heating offset
const K_LOCAL_HEAT_DIVISOR = 200;
const SOIL_T_TAU = 1.5;

// Soil moisture: exponential approach to watering/evaporation equilibrium
const MOISTURE_PUMP_COEFF = 0.45;
const MOISTURE_EVAP_RATE = 0.055;

/**
 * Pure simulation function. Computes greenhouse environment at a given time
 * based on initial conditions and greenhouse controls.
 *
 * All environmental parameters (temperature, humidity, CO₂) follow exponential
 * approach to their respective equilibrium values, producing realistic
 * progressive responses to control changes.
 */
export function simulate(
  initialEnv: ConcreteEnvironment,
  greenhouse: ConcreteGreenhouseState,
  time: number,
): ConcreteEnvironment {
  const deltaHours = time / 60;

  // Mars external conditions (deterministic from timestamp)
  const simulationMs = initialEnv.timestamp + time * 60_000;
  const timeOfDay = ((simulationMs / 3_600_000) % 24 + 24) % 24;
  const solarFactor = Math.max(0, Math.sin((timeOfDay / 24) * 2 * Math.PI));
  const externalTemp = -63 + 30 * solarFactor + deterministicNoise(simulationMs, 3);
  const solarRadiation = Math.max(0, 590 * solarFactor + deterministicNoise(simulationMs + 1000, 30));

  // ─── Air Temperature (exponential approach to equilibrium) ───
  const T_eq = THERMAL_BASE
    + greenhouse.globalHeatingPower / K_HEAT_DIVISOR
    + solarRadiation * K_SOLAR
    - greenhouse.ventilationRate * K_VENT_TEMP;
  const airTemp = exponentialApproach(initialEnv.airTemperature, T_eq, deltaHours, T_TAU);

  // ─── Humidity (exponential approach) ───
  const avgSoilMoisture = ALL_CROP_TYPES.reduce(
    (sum, ct) => sum + initialEnv.crops[ct].soilMoisture, 0,
  ) / ALL_CROP_TYPES.length;
  const H_eq = clamp(0, 100,
    avgSoilMoisture * K_SOIL_HUMIDITY - greenhouse.ventilationRate * K_VENT_HUMIDITY,
  );
  const humidity = clamp(0, 100,
    exponentialApproach(initialEnv.humidity, H_eq, deltaHours, H_TAU),
  );

  // ─── CO₂ Level (exponential approach) ───
  const C_eq = Math.max(CO2_BASE,
    CO2_BASE
    + greenhouse.co2InjectionRate * K_CO2_INJECT
    - greenhouse.lightingPower * K_CO2_PHOTO
    - greenhouse.ventilationRate * K_CO2_VENT,
  );
  const co2Level = Math.max(CO2_BASE,
    exponentialApproach(initialEnv.co2Level, C_eq, deltaHours, C_TAU),
  );

  // Light level (responds instantly — no thermal mass)
  const lightLevel = greenhouse.lightingPower * 2 + solarRadiation * 5;

  // Per-crop simulation
  const crops = {} as Record<CropType, CropEnvironment>;
  for (const ct of ALL_CROP_TYPES) {
    crops[ct] = simulateCrop(
      initialEnv.crops[ct],
      greenhouse.crops[ct],
      airTemp, humidity, co2Level, lightLevel, deltaHours,
      CROP_PROFILES[ct],
    );
  }

  return {
    timestamp: simulationMs,
    airTemperature: airTemp,
    humidity,
    co2Level,
    lightLevel,
    externalTemp,
    solarRadiation,
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

function simulateCrop(
  initial: CropEnvironment,
  controls: CropControls,
  airTemp: number,
  humidity: number,
  co2Level: number,
  lightLevel: number,
  deltaHours: number,
  params: { optimalTemp: number; optimalMoisture: number },
): CropEnvironment {
  // Soil temperature: exponential approach to air temp + local heating offset
  const soilT_eq = airTemp + controls.localHeatingPower / K_LOCAL_HEAT_DIVISOR;
  const soilTemp = exponentialApproach(initial.soilTemperature, soilT_eq, deltaHours, SOIL_T_TAU);

  // Soil moisture: exponential approach to watering/evaporation equilibrium
  // dm/dt = pumpGain - evapRate·m → m_eq = pumpGain/evapRate
  const moistureGain = controls.waterPumpRate * MOISTURE_PUMP_COEFF;
  const effectiveEvapRate = MOISTURE_EVAP_RATE
    + Math.max(0, airTemp - 15) * 0.001
    + Math.max(0, 100 - humidity) * 0.0003;
  const m_eq = clamp(0, 100, moistureGain / effectiveEvapRate);
  const soilMoisture = clamp(0, 100,
    exponentialApproach(initial.soilMoisture, m_eq, deltaHours, 1 / effectiveEvapRate / 60),
  );

  // Growth rate — multiplicative factors from environmental fitness
  const growthRate = calculateGrowthRate(
    soilTemp, soilMoisture, airTemp, humidity, co2Level, lightLevel, params,
  );
  const plantGrowth = Math.min(100, initial.plantGrowth + growthRate * deltaHours);
  const leafArea = initial.leafArea + (plantGrowth / 100) * 0.1 * deltaHours;

  let fruitCount = initial.fruitCount;
  if (plantGrowth > 50) {
    fruitCount += 0.05 * deltaHours * (plantGrowth / 100);
  }

  return {
    soilMoisture,
    soilTemperature: soilTemp,
    plantGrowth,
    leafArea,
    fruitCount: Math.floor(fruitCount),
  };
}

function calculateGrowthRate(
  soilTemp: number,
  soilMoisture: number,
  airTemp: number,
  humidity: number,
  co2Level: number,
  lightLevel: number,
  params: { optimalTemp: number; optimalMoisture: number },
): number {
  let rate = 0.5;

  const tempDiff = Math.abs(soilTemp - params.optimalTemp);
  if (tempDiff < 3) rate *= 1.5;
  else if (tempDiff > 10) rate *= 0.3;

  const moistureDiff = Math.abs(soilMoisture - params.optimalMoisture);
  if (moistureDiff < 10) rate *= 1.3;
  else if (moistureDiff > 30) rate *= 0.2;

  if (airTemp >= 18 && airTemp <= 25) rate *= 1.2;
  else if (airTemp < 10 || airTemp > 35) rate *= 0.4;

  if (co2Level > 1000) rate *= 1.2;
  else if (co2Level < 600) rate *= 0.7;

  if (lightLevel > 8000) rate *= 1.4;
  else if (lightLevel < 3000) rate *= 0.5;

  if (humidity >= 60 && humidity <= 80) rate *= 1.2;
  else if (humidity < 40) rate *= 0.6;

  return rate;
}

/** Exponential approach: value → target with time constant tau (hours). */
function exponentialApproach(initial: number, target: number, deltaHours: number, tau: number): number {
  if (tau <= 0) return target;
  return target + (initial - target) * Math.exp(-deltaHours / tau);
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Deterministic noise based on time seed, replacing Math.random(). */
function deterministicNoise(seed: number, range: number): number {
  const x = Math.sin(seed * 0.001) * 10000;
  return ((x - Math.floor(x)) - 0.5) * range;
}
