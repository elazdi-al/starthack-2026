import { GreenhouseState, EnvironmentState } from './types';

// Manages greenhouse internal systems
export class Greenhouse {
  private state: GreenhouseState;

  constructor(initial?: Partial<GreenhouseState>) {
    this.state = {
      waterSupply: 1000, // Liters
      lightingIntensity: 80, // percentage
      heatingPower: 5000, // Watts
      co2Level: 1200, // ppm (elevated for plant growth)
      humidity: 65, // percentage
      soilMoisture: 70, // percentage
      plantGrowthStage: 0, // 0-100%
      ...initial,
    };
  }

  getState(): GreenhouseState {
    return { ...this.state };
  }

  // Update greenhouse controls
  setWaterSupply(liters: number): void {
    this.state.waterSupply = Math.max(0, liters);
  }

  setLightingIntensity(intensity: number): void {
    this.state.lightingIntensity = Math.max(0, Math.min(100, intensity));
  }

  setHeatingPower(watts: number): void {
    this.state.heatingPower = Math.max(0, watts);
  }

  setCO2Level(ppm: number): void {
    this.state.co2Level = Math.max(0, ppm);
  }

  // Simulate greenhouse dynamics based on environment
  update(deltaMinutes: number, environment: EnvironmentState): void {
    // Water consumption by plants
    const waterConsumption = 0.5 * deltaMinutes; // L per minute
    this.state.waterSupply = Math.max(0, this.state.waterSupply - waterConsumption);

    // Soil moisture depends on water supply
    if (this.state.waterSupply > 0) {
      this.state.soilMoisture = Math.min(100, this.state.soilMoisture + 0.1 * deltaMinutes);
    } else {
      this.state.soilMoisture = Math.max(0, this.state.soilMoisture - 0.5 * deltaMinutes);
    }

    // Humidity correlates with soil moisture
    this.state.humidity = 40 + (this.state.soilMoisture * 0.3);

    // CO2 depletes as plants photosynthesize (during light periods)
    if (this.state.lightingIntensity > 0) {
      this.state.co2Level = Math.max(400, this.state.co2Level - 2 * deltaMinutes);
    }

    // Plant growth depends on optimal conditions
    const growthRate = this.calculateGrowthRate(environment);
    this.state.plantGrowthStage = Math.min(100, this.state.plantGrowthStage + growthRate * deltaMinutes);
  }

  private calculateGrowthRate(environment: EnvironmentState): number {
    // Optimal conditions yield faster growth
    let rate = 0.01; // Base rate per minute

    // Light factor
    if (this.state.lightingIntensity > 60) rate *= 1.5;
    else if (this.state.lightingIntensity < 30) rate *= 0.5;

    // Water factor
    if (this.state.soilMoisture > 50 && this.state.soilMoisture < 80) rate *= 1.3;
    else if (this.state.soilMoisture < 30) rate *= 0.3;

    // CO2 factor
    if (this.state.co2Level > 1000) rate *= 1.2;
    else if (this.state.co2Level < 600) rate *= 0.7;

    // Dust storm penalty
    if (environment.dustStormIntensity > 0.5) rate *= 0.8;

    return rate;
  }
}
