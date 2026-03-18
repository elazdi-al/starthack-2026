import { GreenhouseState } from './types';

// Initial machine outputs
export function createInitialGreenhouse(): GreenhouseState {
  return {
    waterPumpRate: 10, // L/hour
    lightingPower: 5000, // Watts
    heatingPower: 3000, // Watts
    co2InjectionRate: 50, // ppm/hour
    ventilationRate: 100, // m³/hour
  };
}
