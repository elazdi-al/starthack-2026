import type { ConcreteEnvironment, ConcreteGreenhouseState, ConcreteState } from './types';
import { createSimulation } from './simulation';

export function createInitialEnvironment(): ConcreteEnvironment {
  return {
    timestamp: Date.now(),
    airTemperature: 20,
    humidity: 60,
    co2Level: 800,
    lightLevel: 5000,
    externalTemp: -63,
    solarRadiation: 590,
    tomatoes: {
      soilMoisture: 70,
      soilTemperature: 22,
      plantGrowth: 0,
      leafArea: 0,
      fruitCount: 0,
    },
    carrots: {
      soilMoisture: 65,
      soilTemperature: 18,
      plantGrowth: 0,
      leafArea: 0,
      fruitCount: 0,
    },
  };
}

export function createInitialGreenhouseState(): ConcreteGreenhouseState {
  return {
    lightingPower: 5000,
    globalHeatingPower: 3000,
    co2InjectionRate: 50,
    ventilationRate: 100,
    tomatoes: {
      waterPumpRate: 10,
      localHeatingPower: 500,
    },
    carrots: {
      waterPumpRate: 8,
      localHeatingPower: 300,
    },
  };
}

export function createInitialState(): ConcreteState {
  const env = createInitialEnvironment();
  const greenhouse = createInitialGreenhouseState();
  const simulation = createSimulation(env, greenhouse);
  return { simulation, greenhouse };
}
