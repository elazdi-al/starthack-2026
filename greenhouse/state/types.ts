// Sensor readings - everything measured about the greenhouse
export interface Environment {}

// Machine outputs (what we control)
export interface GreenhouseState {}

// Simulation - can be queried at any time t to get environment readings.
// The generic parameter allows implementations to return typed environments.
export interface SimulationState<E extends Environment = Environment> {
  getEnvironment(time: number): E;
}

// Complete state - combines simulation and greenhouse controls
export interface State {
  simulation: SimulationState;
  greenhouse: GreenhouseState;
}

// State transformation - pure function from state to state
export type StateTransformation = (state: State) => State;
