import { ConcreteEnvironment, ConcreteGreenhouseState, ConcreteSimulationState, ConcreteState } from './types';

// Create initial environment with default values
export function createInitialEnvironment(): ConcreteEnvironment {
  return new ConcreteEnvironment({
    timestamp: Date.now(),
    airTemperature: 20, // Celsius
    humidity: 60, // percentage
    co2Level: 800, // ppm
    lightLevel: 5000, // lux
    externalTemp: -63, // Mars outside
    solarRadiation: 590, // W/m²
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
  });
}

// Create initial greenhouse state with default values
export function createInitialGreenhouseState(): ConcreteGreenhouseState {
  return new ConcreteGreenhouseState({
    lightingPower: 5000, // Watts
    globalHeatingPower: 3000, // Watts
    co2InjectionRate: 50, // ppm/hour
    ventilationRate: 100, // m³/hour
    tomatoes: {
      waterPumpRate: 10, // L/hour
      localHeatingPower: 500, // Watts
    },
    carrots: {
      waterPumpRate: 8, // L/hour
      localHeatingPower: 300, // Watts
    },
  });
}

// Create initial simulation state
export function createInitialSimulationState(): ConcreteSimulationState {
  const env = createInitialEnvironment();
  const greenhouse = createInitialGreenhouseState();
  return new ConcreteSimulationState(env, greenhouse);
}

// Create initial complete state
export function createInitialState(): ConcreteState {
  const simulation = createInitialSimulationState();
  const greenhouse = createInitialGreenhouseState();
  return new ConcreteState(simulation, greenhouse);
}
