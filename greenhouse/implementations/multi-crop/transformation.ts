import type { StateTransformation } from '../../state/types';
import type { ConcreteState, ConcreteGreenhouseState, CropControls } from './types';
import { createSimulation } from './simulation';

// Deep-clone greenhouse state (spreads crop controls to avoid shared refs)
function cloneGreenhouse(gh: ConcreteGreenhouseState): ConcreteGreenhouseState {
  return { ...gh, tomatoes: { ...gh.tomatoes }, carrots: { ...gh.carrots } };
}

// Update a global greenhouse parameter
export const updateGreenhouseParam = <K extends keyof ConcreteGreenhouseState>(
  paramName: K,
  value: ConcreteGreenhouseState[K],
  time: number,
): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    const env = state.simulation.getEnvironment(time);
    const newGreenhouse = {
      ...cloneGreenhouse(state.greenhouse),
      [paramName]: value,
    } as ConcreteGreenhouseState;
    const simulation = createSimulation(env, newGreenhouse);
    return { simulation, greenhouse: newGreenhouse };
  };
};

// Update a crop-specific parameter
export const updateCropParam = <K extends keyof CropControls>(
  crop: 'tomatoes' | 'carrots',
  paramName: K,
  value: CropControls[K],
  time: number,
): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    const env = state.simulation.getEnvironment(time);
    const newGreenhouse: ConcreteGreenhouseState = {
      ...cloneGreenhouse(state.greenhouse),
      [crop]: { ...state.greenhouse[crop], [paramName]: value },
    };
    const simulation = createSimulation(env, newGreenhouse);
    return { simulation, greenhouse: newGreenhouse };
  };
};

// Simple rule-based transformation
export const simpleTransformation = (time: number): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    const env = state.simulation.getEnvironment(time);
    let newState = currentState;

    if (env.airTemperature < 18) {
      newState = updateGreenhouseParam('globalHeatingPower', 5000, time)(newState);
    } else if (env.airTemperature > 25) {
      newState = updateGreenhouseParam('globalHeatingPower', 1000, time)(newState);
    }

    if (env.co2Level < 800) {
      newState = updateGreenhouseParam('co2InjectionRate', 100, time)(newState);
    } else if (env.co2Level > 1200) {
      newState = updateGreenhouseParam('co2InjectionRate', 20, time)(newState);
    }

    if (env.tomatoes.soilMoisture < 60) {
      newState = updateCropParam('tomatoes', 'waterPumpRate', 15, time)(newState);
    } else if (env.tomatoes.soilMoisture > 80) {
      newState = updateCropParam('tomatoes', 'waterPumpRate', 5, time)(newState);
    }

    if (env.carrots.soilMoisture < 55) {
      newState = updateCropParam('carrots', 'waterPumpRate', 12, time)(newState);
    } else if (env.carrots.soilMoisture > 75) {
      newState = updateCropParam('carrots', 'waterPumpRate', 4, time)(newState);
    }

    return newState;
  };
};

// Apply a sequence of transformations (used by the agent tool and callers)
export function applyTransformations(
  initialState: ConcreteState,
  time: number,
  transformations: Array<{
    type: 'greenhouse' | 'crop';
    param: string;
    value: number;
    crop?: 'tomatoes' | 'carrots';
  }>,
): ConcreteState {
  let state = initialState;

  for (const t of transformations) {
    if (t.type === 'greenhouse') {
      state = updateGreenhouseParam(
        t.param as keyof ConcreteGreenhouseState,
        t.value as ConcreteGreenhouseState[keyof ConcreteGreenhouseState],
        time,
      )(state) as ConcreteState;
    } else if (t.type === 'crop' && t.crop) {
      state = updateCropParam(
        t.crop,
        t.param as keyof CropControls,
        t.value,
        time,
      )(state) as ConcreteState;
    }
  }

  return state;
}
