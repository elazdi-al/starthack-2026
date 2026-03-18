// Sensor readings (what sensors measure)
export interface EnvironmentState {
  timestamp: number;
  temperature: number; // Celsius (inside greenhouse)
  humidity: number; // percentage
  co2Level: number; // ppm
  soilMoisture: number; // percentage
  lightLevel: number; // lux
  plantGrowth: number; // 0-100%
  externalTemp: number; // Mars outside temp
  solarRadiation: number; // W/m²
}

// Machine outputs (what we control)
export interface GreenhouseState {
  waterPumpRate: number; // L/hour
  lightingPower: number; // Watts
  heatingPower: number; // Watts
  co2InjectionRate: number; // ppm/hour
  ventilationRate: number; // m³/hour
}
