import { MarsEnvironment } from './environment';
import { Greenhouse } from './greenhouse';
import { SimulationConfig } from './types';

// Main simulation orchestrator
export class MarsGreenhouseSimulator {
  private environment: MarsEnvironment;
  private greenhouse: Greenhouse;
  private intervalMinutes: number;
  private intervalId?: NodeJS.Timeout;

  constructor(config?: Partial<SimulationConfig>) {
    this.intervalMinutes = config?.updateIntervalMinutes || 5;
    this.environment = new MarsEnvironment(config?.initialEnvironment);
    this.greenhouse = new Greenhouse(config?.initialGreenhouse);
  }

  // Get current simulation state
  getFullState() {
    return {
      environment: this.environment.getState(),
      greenhouse: this.greenhouse.getState(),
    };
  }

  // Manual single update
  step(): void {
    this.environment.update(this.intervalMinutes);
    this.greenhouse.update(this.intervalMinutes, this.environment.getState());
  }

  // Start automatic updates
  start(onUpdate?: (state: ReturnType<typeof this.getFullState>) => void): void {
    if (this.intervalId) {
      console.warn('Simulation already running');
      return;
    }

    this.intervalId = setInterval(() => {
      this.step();
      if (onUpdate) {
        onUpdate(this.getFullState());
      }
    }, this.intervalMinutes * 60 * 1000);

    console.log(`Simulation started (updates every ${this.intervalMinutes} minutes)`);
  }

  // Stop automatic updates
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Simulation stopped');
    }
  }

  // Greenhouse control methods
  setWaterSupply(liters: number): void {
    this.greenhouse.setWaterSupply(liters);
  }

  setLightingIntensity(intensity: number): void {
    this.greenhouse.setLightingIntensity(intensity);
  }

  setHeatingPower(watts: number): void {
    this.greenhouse.setHeatingPower(watts);
  }

  setCO2Level(ppm: number): void {
    this.greenhouse.setCO2Level(ppm);
  }
}
