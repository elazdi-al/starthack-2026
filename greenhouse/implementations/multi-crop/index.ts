// Multi-crop greenhouse implementation (tomatoes and carrots)
export type { CropEnvironment, CropControls, ConcreteEnvironment, ConcreteGreenhouseState, ConcreteState } from './types';

export { simulate, createSimulation } from './simulation';

export {
  createInitialEnvironment,
  createInitialGreenhouseState,
  createInitialState,
} from './initial';

export {
  simpleTransformation,
  updateGreenhouseParam,
  updateCropParam,
  applyTransformations,
} from './transformation';
