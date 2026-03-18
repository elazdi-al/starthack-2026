import { EnvironmentState, GreenhouseState } from '../state/types';

// Simulation function type: returns an interpolation function
// The returned function takes time (0-1) and returns the state at that point in the transition
export type SimulateFunction = (
  currentEnv: EnvironmentState,
  greenhouse: GreenhouseState,
  deltaMinutes: number
) => (time: number) => EnvironmentState;

