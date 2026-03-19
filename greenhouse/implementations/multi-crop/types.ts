import type { Environment, GreenhouseState, SimulationState, State } from '../../state/types';

export type CropType = "lettuce" | "tomato" | "potato" | "soybean" | "spinach" | "wheat" | "radish" | "kale";

export const ALL_CROP_TYPES: CropType[] = [
  "lettuce", "tomato", "potato", "soybean", "spinach", "wheat", "radish", "kale",
];

// Crop-specific environment readings (sensor data)
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

// Environment with per-crop sensor data
export interface ConcreteEnvironment extends Environment {
  timestamp: number;
  airTemperature: number; // Celsius
  humidity: number; // percentage
  co2Level: number; // ppm
  lightLevel: number; // lux
  externalTemp: number; // Mars outside temp
  solarRadiation: number; // W/m²
  crops: Record<CropType, CropEnvironment>;
}

// Greenhouse controls with per-crop settings
export interface ConcreteGreenhouseState extends GreenhouseState {
  lightingPower: number; // Watts
  globalHeatingPower: number; // Watts
  co2InjectionRate: number; // ppm/hour
  ventilationRate: number; // m³/hour
  crops: Record<CropType, CropControls>;
}

// Complete state
export interface ConcreteState extends State {
  simulation: SimulationState<ConcreteEnvironment>;
  greenhouse: ConcreteGreenhouseState;
}
