import type { SimulationState } from '../../state/types';
import type { ConcreteEnvironment, ConcreteGreenhouseState, CropEnvironment, CropControls, CropType } from './types';
import { ALL_CROP_TYPES } from './types';

// Optimal growing parameters per crop (used by the growth-rate model)
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

/**
 * Pure simulation function. Computes greenhouse environment at a given time
 * based on initial conditions and greenhouse controls.
 *
 * Stateless and deterministic — safe to call from any context (frontend, agent,
 * server) at any time without side effects.
 */
export function simulate(
  initialEnv: ConcreteEnvironment,
  greenhouse: ConcreteGreenhouseState,
  time: number,
): ConcreteEnvironment {
  const deltaHours = time / 60;

  // Mars external conditions (derived from simulation time for determinism)
  const simulationMs = initialEnv.timestamp + time * 60_000;
  const timeOfDay = ((simulationMs / 3_600_000) % 24 + 24) % 24;
  const solarFactor = Math.max(0, Math.sin((timeOfDay / 24) * 2 * Math.PI));
  const externalTemp = -63 + 30 * solarFactor + deterministicNoise(simulationMs, 3);
  const solarRadiation = 590 * solarFactor + deterministicNoise(simulationMs + 1000, 30);

  // Global air temperature
  let airTemp = initialEnv.airTemperature;
  airTemp += (greenhouse.globalHeatingPower / 1000) * deltaHours;
  airTemp += (solarRadiation / 500) * deltaHours;
  airTemp -= (airTemp - externalTemp) * 0.05 * deltaHours;
  airTemp -= greenhouse.ventilationRate * 0.01 * deltaHours;

  // Average soil moisture across all crops
  const avgSoilMoisture = ALL_CROP_TYPES.reduce(
    (sum, ct) => sum + initialEnv.crops[ct].soilMoisture, 0,
  ) / ALL_CROP_TYPES.length;

  // Humidity
  let humidity = initialEnv.humidity;
  humidity += (avgSoilMoisture - humidity) * 0.1 * deltaHours;
  humidity -= greenhouse.ventilationRate * 0.05 * deltaHours;
  humidity = Math.max(0, Math.min(100, humidity));

  // CO2 level
  let co2Level = initialEnv.co2Level;
  co2Level += greenhouse.co2InjectionRate * deltaHours;
  co2Level -= (greenhouse.lightingPower / 100) * deltaHours;
  co2Level -= greenhouse.ventilationRate * 0.5 * deltaHours;
  co2Level = Math.max(400, co2Level);

  // Light level
  const lightLevel = greenhouse.lightingPower * 2 + solarRadiation * 5;

  // Simulate each crop
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

/**
 * Creates a SimulationState wrapping the pure simulate function.
 * The returned object captures initial conditions and controls, providing
 * getEnvironment(time) that the rest of the system expects.
 */
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
  let soilTemp = initial.soilTemperature;
  soilTemp += (controls.localHeatingPower / 500) * deltaHours;
  soilTemp += (airTemp - soilTemp) * 0.2 * deltaHours;

  let soilMoisture = initial.soilMoisture;
  soilMoisture += controls.waterPumpRate * deltaHours * 0.5;
  soilMoisture -= 2 * deltaHours;
  soilMoisture = Math.max(0, Math.min(100, soilMoisture));

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

/** Deterministic noise based on time seed, replacing Math.random(). */
function deterministicNoise(seed: number, range: number): number {
  const x = Math.sin(seed * 0.001) * 10000;
  return ((x - Math.floor(x)) - 0.5) * range;
}
