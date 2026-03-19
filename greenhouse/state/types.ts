// Sensor readings - everything measured about the greenhouse
export abstract class Environment {}

// Machine outputs (what we control)
export abstract class GreenhouseState {}

// Simulation - represents the current simulation state
// A simulation is created from initial environment and greenhouse state
// and can be queried at any time t (0 to infinity) to get the environment at that time
export abstract class SimulationState {
  abstract getEnvironment(time: number): Environment;
}

// Complete state - combines current simulation and greenhouse machine outputs
export abstract class State {
  abstract simulation: SimulationState;
  abstract greenhouse: GreenhouseState;
}

// State transformation - takes a state and returns a new state
export type StateTransformation = (state: State) => State;
