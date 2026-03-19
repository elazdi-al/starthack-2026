// Multi-crop greenhouse implementation (tomatoes and carrots)
export {
  ConcreteEnvironment,
  ConcreteGreenhouseState,
  ConcreteSimulationState,
  ConcreteState,
} from './types';

export type { CropEnvironment, CropControls } from './types';

export {
  createInitialEnvironment,
  createInitialGreenhouseState,
  createInitialSimulationState,
  createInitialState,
} from './initial';

export { 
  simpleTransformation,
  updateGreenhouseParam,
  updateCropParam,
} from './transformation';
