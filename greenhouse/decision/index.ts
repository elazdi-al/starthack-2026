import { EnvironmentState, GreenhouseState } from '../state/types';

// Decision logic: determines new machine outputs based on sensor readings
// TODO: Implement decision logic (AI, rules, optimization, etc.)

export function decide(
  environment: EnvironmentState,
  currentGreenhouse: GreenhouseState
): GreenhouseState {
  // Placeholder: return current state unchanged
  // Future: implement control logic here
  return { ...currentGreenhouse };
}
