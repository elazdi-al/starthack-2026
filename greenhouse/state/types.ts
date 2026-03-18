// Sensor readings (what sensors measure)
export abstract class EnvironmentState {
  abstract timestamp: number;
  abstract temperature: number; // Celsius (inside greenhouse)
  abstract humidity: number; // percentage
  abstract co2Level: number; // ppm
  abstract soilMoisture: number; // percentage
  abstract lightLevel: number; // lux
  abstract plantGrowth: number; // 0-100%
  abstract externalTemp: number; // Mars outside temp
  abstract solarRadiation: number; // W/m²
}

// Machine outputs (what we control)
export abstract class GreenhouseState {
  abstract waterPumpRate: number; // L/hour
  abstract lightingPower: number; // Watts
  abstract heatingPower: number; // Watts
  abstract co2InjectionRate: number; // ppm/hour
  abstract ventilationRate: number; // m³/hour
}
