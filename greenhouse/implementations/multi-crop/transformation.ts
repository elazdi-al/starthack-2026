import { StateTransformation } from '../../state/types';
import { ConcreteState, ConcreteSimulationState, ConcreteGreenhouseState, ConcreteEnvironment } from './types';

// Simple rule-based state transformation
export const simpleTransformation = (time: number): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    
    // Get environment at the specified time
    const env = state.simulation.getEnvironment(time) as ConcreteEnvironment;
    
    let newState = currentState;

    // Adjust global heating based on air temperature
    if (env.airTemperature < 18) {
      newState = updateGreenhouseParam('globalHeatingPower', 5000, time)(newState);
    } else if (env.airTemperature > 25) {
      newState = updateGreenhouseParam('globalHeatingPower', 1000, time)(newState);
    }

    // Adjust CO2 injection based on level
    if (env.co2Level < 800) {
      newState = updateGreenhouseParam('co2InjectionRate', 100, time)(newState);
    } else if (env.co2Level > 1200) {
      newState = updateGreenhouseParam('co2InjectionRate', 20, time)(newState);
    }

    // Adjust tomato watering based on soil moisture
    if (env.tomatoes.soilMoisture < 60) {
      newState = updateCropParam('tomatoes', 'waterPumpRate', 15, time)(newState);
    } else if (env.tomatoes.soilMoisture > 80) {
      newState = updateCropParam('tomatoes', 'waterPumpRate', 5, time)(newState);
    }

    // Adjust carrot watering based on soil moisture
    if (env.carrots.soilMoisture < 55) {
      newState = updateCropParam('carrots', 'waterPumpRate', 12, time)(newState);
    } else if (env.carrots.soilMoisture > 75) {
      newState = updateCropParam('carrots', 'waterPumpRate', 4, time)(newState);
    }

    return newState;
  };
};

// Update a specific greenhouse parameter
export const updateGreenhouseParam = <K extends keyof ConcreteGreenhouseState>(
  paramName: K,
  value: ConcreteGreenhouseState[K],
  time: number
): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    
    // Get environment at the specified time
    const env = state.simulation.getEnvironment(time) as ConcreteEnvironment;
    
    // Clone greenhouse state with updated parameter
    const newGreenhouse = new ConcreteGreenhouseState({
      lightingPower: state.greenhouse.lightingPower,
      globalHeatingPower: state.greenhouse.globalHeatingPower,
      co2InjectionRate: state.greenhouse.co2InjectionRate,
      ventilationRate: state.greenhouse.ventilationRate,
      tomatoes: { ...state.greenhouse.tomatoes },
      carrots: { ...state.greenhouse.carrots },
      [paramName]: value,
    } as any);
    
    // Create new simulation starting from environment at time with updated greenhouse
    const newSimulation = new ConcreteSimulationState(env, newGreenhouse);
    
    return new ConcreteState(newSimulation, newGreenhouse);
  };
};

// Update a crop-specific parameter
export const updateCropParam = <K extends keyof ConcreteGreenhouseState['tomatoes']>(
  crop: 'tomatoes' | 'carrots',
  paramName: K,
  value: ConcreteGreenhouseState['tomatoes'][K],
  time: number
): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    
    // Get environment at the specified time
    const env = state.simulation.getEnvironment(time) as ConcreteEnvironment;
    
    // Clone greenhouse state with updated crop parameter
    const newGreenhouse = new ConcreteGreenhouseState({
      lightingPower: state.greenhouse.lightingPower,
      globalHeatingPower: state.greenhouse.globalHeatingPower,
      co2InjectionRate: state.greenhouse.co2InjectionRate,
      ventilationRate: state.greenhouse.ventilationRate,
      tomatoes: { ...state.greenhouse.tomatoes },
      carrots: { ...state.greenhouse.carrots },
      [crop]: {
        ...state.greenhouse[crop],
        [paramName]: value,
      },
    });
    
    // Create new simulation starting from environment at time with updated greenhouse
    const newSimulation = new ConcreteSimulationState(env, newGreenhouse);
    
    return new ConcreteState(newSimulation, newGreenhouse);
  };
};
