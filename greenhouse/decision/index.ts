import { EnvironmentState, GreenhouseState } from '../state/types';

// Decision function type: determines new machine outputs based on sensor readings
export type DecideFunction = (
  environment: EnvironmentState,
  currentGreenhouse: GreenhouseState
) => GreenhouseState;
