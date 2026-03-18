import { EnvironmentState } from './types';

// Initial sensor readings
export function createInitialEnvironment(): EnvironmentState {
  return {
    timestamp: Date.now(),
    temperature: 20, // Inside greenhouse
    humidity: 60,
    co2Level: 800,
    soilMoisture: 70,
    lightLevel: 5000, // lux
    plantGrowth: 0,
    externalTemp: -63, // Mars outside
    solarRadiation: 590,
  };
}
