import type { StateTransformation } from '../../state/types';
import type {
  ConcreteState, ConcreteGreenhouseState, CropControls, CropType, CropEnvironment, ManualOverrides,
} from './types';
import { ALL_CROP_TYPES } from './types';
import { CROP_PROFILES, createSimulation } from './simulation';

function cloneGreenhouse(gh: ConcreteGreenhouseState): ConcreteGreenhouseState {
  const crops = {} as Record<CropType, CropControls>;
  for (const ct of ALL_CROP_TYPES) {
    crops[ct] = { ...gh.crops[ct] };
  }
  return {
    ...gh,
    crops,
    overrides: { ...gh.overrides },
    maxSolarGenerationKW: gh.maxSolarGenerationKW,
    batteryCapacityKWh: gh.batteryCapacityKWh,
  };
}

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

/** Apply a full set of manual overrides, rebuilding the simulation from the current snapshot. */
export const updateOverrides = (
  overrides: ManualOverrides,
  time: number,
): StateTransformation => {
  return (currentState) => {
    const state = currentState as ConcreteState;
    const env = state.simulation.getEnvironment(time);
    const newGreenhouse = { ...cloneGreenhouse(state.greenhouse), overrides };
    const simulation = createSimulation(env, newGreenhouse);
    return { simulation, greenhouse: newGreenhouse };
  };
};

/** Harvest a crop and return updated state + yield information. */
export function harvestCrop(
  state: ConcreteState,
  crop: CropType,
  time: number,
): { state: ConcreteState; yieldKg: number } {
  const env = state.simulation.getEnvironment(time);
  const cropEnv = env.crops[crop];

  const yieldKg = cropEnv.estimatedYieldKg;

  const newCrops = { ...env.crops };
  newCrops[crop] = {
    ...cropEnv,
    stage: 'harvested' as const,
    stageProgress: 0,
    biomassKg: 0,
    estimatedYieldKg: 0,
    plantGrowth: 0,
    leafArea: 0,
    fruitCount: 0,
  };

  // Also update all tiles of this crop type
  const newTileCrops = { ...env.tileCrops };
  for (const [tileId, tile] of Object.entries(newTileCrops)) {
    if (tile.cropType === crop) {
      newTileCrops[tileId] = {
        ...tile,
        stage: 'harvested' as const,
        stageProgress: 0,
        biomassKg: 0,
        estimatedYieldKg: 0,
        plantGrowth: 0,
        leafArea: 0,
        fruitCount: 0,
      };
    }
  }

  const newEnv = { ...env, crops: newCrops, tileCrops: newTileCrops };
  const simulation = createSimulation(newEnv, state.greenhouse);
  return { state: { simulation, greenhouse: state.greenhouse }, yieldKg };
}

/** Replant a harvested crop back to seed stage. */
export function replantCrop(
  state: ConcreteState,
  crop: CropType,
  time: number,
): ConcreteState {
  const env = state.simulation.getEnvironment(time);
  const cropEnv = env.crops[crop];

  const newCrops = { ...env.crops };
  newCrops[crop] = {
    soilMoisture: cropEnv.soilMoisture,
    soilTemperature: cropEnv.soilTemperature,
    stage: 'seed' as const,
    stageProgress: 0,
    daysSincePlanting: 0,
    healthScore: 1,
    stressAccumulator: 0,
    biomassKg: 0,
    estimatedYieldKg: 0,
    plantGrowth: 0,
    leafArea: 0,
    fruitCount: 0,
    rootO2Level: 90,
    nutrientEC: 2.0,
    diseaseRisk: 0,
    isBolting: false,
    boltingHoursAccumulated: 0,
  };

  // Also replant all tiles of this crop type (with fresh genetics per tile)
  const newTileCrops = { ...env.tileCrops };
  for (const [tileId, tile] of Object.entries(newTileCrops)) {
    if (tile.cropType === crop) {
      newTileCrops[tileId] = {
        ...tile,
        soilMoisture: tile.soilMoisture,
        soilTemperature: tile.soilTemperature,
        stage: 'seed' as const,
        stageProgress: 0,
        daysSincePlanting: 0,
        healthScore: 1,
        stressAccumulator: 0,
        biomassKg: 0,
        estimatedYieldKg: 0,
        plantGrowth: 0,
        leafArea: 0,
        fruitCount: 0,
        rootO2Level: 90,
        nutrientEC: 2.0,
        diseaseRisk: 0,
        isBolting: false,
        boltingHoursAccumulated: 0,
        // Genetic identity preserved — same plant stock
      };
    }
  }

  const newEnv = { ...env, crops: newCrops, tileCrops: newTileCrops };
  const simulation = createSimulation(newEnv, state.greenhouse);
  return { simulation, greenhouse: state.greenhouse };
}
