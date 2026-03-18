// Core types for Mars greenhouse simulation

export interface EnvironmentState {
  // External Mars conditions (read by sensors)
  timestamp: number;
  externalTemperature: number; // Celsius
  solarRadiation: number; // W/m²
  atmosphericPressure: number; // Pa
  dustStormIntensity: number; // 0-1 scale
  marsTime: {
    sol: number; // Mars day
    hour: number; // 0-24
  };
}

export interface GreenhouseState {
  // Controlled internal conditions
  waterSupply: number; // Liters
  lightingIntensity: number; // 0-100%
  heatingPower: number; // Watts
  co2Level: number; // ppm
  humidity: number; // percentage
  soilMoisture: number; // percentage
  plantGrowthStage: number; // 0-100%
}

export interface SimulationConfig {
  updateIntervalMinutes: number;
  initialEnvironment: Partial<EnvironmentState>;
  initialGreenhouse: Partial<GreenhouseState>;
}
