import { Environment, GreenhouseState } from '../state/types';

// Decision function type: determines new machine outputs based on sensor readings
export type DecideFunction = (
  environment: Environment,
  currentGreenhouse: GreenhouseState
) => GreenhouseState;
