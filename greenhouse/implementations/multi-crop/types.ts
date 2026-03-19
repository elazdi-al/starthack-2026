import type { Environment, GreenhouseState, SimulationState, State } from '../../state/types';

// Crop-specific environment readings
export interface CropEnvironment {
  soilMoisture: number; // percentage
  soilTemperature: number; // Celsius
  plantGrowth: number; // 0-100%
  leafArea: number; // m²
  fruitCount: number;
}

// Crop-specific machine outputs
export interface CropControls {
  waterPumpRate: number; // L/hour
  localHeatingPower: number; // Watts
}

// Environment with per-crop data
export interface ConcreteEnvironment extends Environment {
  timestamp: number;
  airTemperature: number; // Celsius
  humidity: number; // percentage
  co2Level: number; // ppm
  lightLevel: number; // lux
  externalTemp: number; // Mars outside temp
  solarRadiation: number; // W/m²
  tomatoes: CropEnvironment;
  carrots: CropEnvironment;
}

// Greenhouse controls with per-crop settings
export interface ConcreteGreenhouseState extends GreenhouseState {
  lightingPower: number; // Watts
  globalHeatingPower: number; // Watts
  co2InjectionRate: number; // ppm/hour
  ventilationRate: number; // m³/hour
  tomatoes: CropControls;
  carrots: CropControls;
}

// Complete state — simulation is typed to return ConcreteEnvironment,
// so callers get full type information without casting.
export interface ConcreteState extends State {
  simulation: SimulationState<ConcreteEnvironment>;
  greenhouse: ConcreteGreenhouseState;
}
