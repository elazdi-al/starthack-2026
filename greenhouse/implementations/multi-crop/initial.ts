import type { CropType, ConcreteEnvironment, ConcreteGreenhouseState, ConcreteState, CropControls } from './types';
import { ALL_CROP_TYPES } from './types';
import { CROP_PROFILES, createSimulation } from './simulation';

// Default controls per crop (water and heating tuned to each crop's needs)
const DEFAULT_CROP_CONTROLS: Record<CropType, CropControls> = {
  lettuce:  { waterPumpRate: 8,  localHeatingPower: 300 },
  tomato:   { waterPumpRate: 12, localHeatingPower: 500 },
  potato:   { waterPumpRate: 10, localHeatingPower: 200 },
  soybean:  { waterPumpRate: 8,  localHeatingPower: 400 },
  spinach:  { waterPumpRate: 7,  localHeatingPower: 200 },
  wheat:    { waterPumpRate: 9,  localHeatingPower: 300 },
  radish:   { waterPumpRate: 6,  localHeatingPower: 250 },
  kale:     { waterPumpRate: 8,  localHeatingPower: 250 },
};

export function createInitialEnvironment(): ConcreteEnvironment {
  const crops = {} as Record<CropType, { soilMoisture: number; soilTemperature: number; plantGrowth: number; leafArea: number; fruitCount: number }>;
  for (const ct of ALL_CROP_TYPES) {
    const profile = CROP_PROFILES[ct];
    crops[ct] = {
      soilMoisture: profile.optimalMoisture,
      soilTemperature: profile.optimalTemp,
      plantGrowth: 0,
      leafArea: 0,
      fruitCount: 0,
    };
  }

  return {
    timestamp: Date.now(),
    airTemperature: 20,
    humidity: 60,
    co2Level: 800,
    lightLevel: 5000,
    externalTemp: -63,
    solarRadiation: 590,
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
    crops,
  };
}

export function createInitialState(): ConcreteState {
  const env = createInitialEnvironment();
  const greenhouse = createInitialGreenhouseState();
  const simulation = createSimulation(env, greenhouse);
  return { simulation, greenhouse };
}
