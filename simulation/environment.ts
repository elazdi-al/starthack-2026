import { EnvironmentState } from './types';

// Simulates Mars environmental conditions
export class MarsEnvironment {
  private state: EnvironmentState;

  constructor(initial?: Partial<EnvironmentState>) {
    this.state = {
      timestamp: Date.now(),
      externalTemperature: -63, // Average Mars temp
      solarRadiation: 590, // Mars solar constant
      atmosphericPressure: 600, // Typical Mars pressure
      dustStormIntensity: 0,
      marsTime: {
        sol: 1,
        hour: 12,
      },
      ...initial,
    };
  }

  getState(): EnvironmentState {
    return { ...this.state };
  }

  // Update environment based on Mars conditions
  update(deltaMinutes: number): void {
    this.state.timestamp = Date.now();
    
    // Update Mars time
    const deltaHours = deltaMinutes / 60;
    this.state.marsTime.hour += deltaHours;
    
    if (this.state.marsTime.hour >= 24.65) { // Mars day is ~24.65 hours
      this.state.marsTime.sol += 1;
      this.state.marsTime.hour -= 24.65;
    }

    // Simulate day/night temperature cycle
    const hourAngle = (this.state.marsTime.hour / 24.65) * 2 * Math.PI;
    const tempVariation = 30 * Math.sin(hourAngle);
    this.state.externalTemperature = -63 + tempVariation + this.randomVariation(5);

    // Solar radiation follows day cycle
    const solarFactor = Math.max(0, Math.sin(hourAngle));
    this.state.solarRadiation = 590 * solarFactor + this.randomVariation(50);

    // Atmospheric pressure varies slightly
    this.state.atmosphericPressure = 600 + this.randomVariation(20);

    // Random dust storm events (rare)
    if (Math.random() < 0.01) {
      this.state.dustStormIntensity = Math.min(1, this.state.dustStormIntensity + 0.1);
    } else {
      this.state.dustStormIntensity = Math.max(0, this.state.dustStormIntensity - 0.05);
    }
  }

  private randomVariation(range: number): number {
    return (Math.random() - 0.5) * range;
  }
}
