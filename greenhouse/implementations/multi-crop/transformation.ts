import type { StateTransformation } from '../../state/types';
import type { ConcreteState, ConcreteGreenhouseState, CropControls, CropType } from './types';
import { ALL_CROP_TYPES } from './types';
import { CROP_PROFILES, createSimulation } from './simulation';

// Deep-clone greenhouse state (spreads each crop's controls)
function cloneGreenhouse(gh: ConcreteGreenhouseState): ConcreteGreenhouseState {
  const crops = {} as Record<CropType, CropControls>;
  for (const ct of ALL_CROP_TYPES) {
    crops[ct] = { ...gh.crops[ct] };
  }
  return { ...gh, crops };
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
  crop: CropType,
  paramName: K,
  value: CropControls[K],
  time: number,
): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    const env = state.simulation.getEnvironment(time);
    const newGreenhouse = cloneGreenhouse(state.greenhouse);
    newGreenhouse.crops[crop] = { ...newGreenhouse.crops[crop], [paramName]: value };
    const simulation = createSimulation(env, newGreenhouse);
    return { simulation, greenhouse: newGreenhouse };
  };
};

// Simple rule-based transformation (adjusts all crops based on their profiles)
export const simpleTransformation = (time: number): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    const env = state.simulation.getEnvironment(time);
    let newState = currentState;

    // Global heating
    if (env.airTemperature < 18) {
      newState = updateGreenhouseParam('globalHeatingPower', 5000, time)(newState);
    } else if (env.airTemperature > 25) {
      newState = updateGreenhouseParam('globalHeatingPower', 1000, time)(newState);
    }

    // CO2
    if (env.co2Level < 800) {
      newState = updateGreenhouseParam('co2InjectionRate', 100, time)(newState);
    } else if (env.co2Level > 1200) {
      newState = updateGreenhouseParam('co2InjectionRate', 20, time)(newState);
    }

    // Per-crop watering based on each crop's optimal moisture
    for (const ct of ALL_CROP_TYPES) {
      const profile = CROP_PROFILES[ct];
      const moisture = env.crops[ct].soilMoisture;
      if (moisture < profile.optimalMoisture - 10) {
        newState = updateCropParam(ct, 'waterPumpRate', 15, time)(newState);
      } else if (moisture > profile.optimalMoisture + 10) {
        newState = updateCropParam(ct, 'waterPumpRate', 4, time)(newState);
      }
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
    crop?: CropType;
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
