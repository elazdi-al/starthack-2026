import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { applyTransformations } from '../../greenhouse/implementations/multi-crop/transformation';
import type { ConcreteState } from '../../greenhouse/implementations/multi-crop/types';

export const transformationTool = createTool({
  id: 'apply-greenhouse-transformations',
  description: 'Apply a sequence of parameter transformations to a greenhouse state. Each transformation updates a greenhouse parameter, crop-specific parameter, or performs a tile-level operation. They are applied in order.',
  inputSchema: z.object({
    state: z.any().describe('The current greenhouse state object'),
    time: z.number().describe('The time in minutes at which to apply transformations'),
    transformations: z.array(z.object({
      type: z.enum(['greenhouse', 'crop', 'harvest-tile', 'plant-tile', 'clear-tile']).describe('Type of transformation'),
      param: z.string().describe('Parameter name to update (e.g., globalHeatingPower, co2InjectionRate, waterPumpRate)'),
      value: z.number().describe('New numeric value for the parameter'),
      crop: z.enum([
        'lettuce', 'tomato', 'potato', 'soybean', 'spinach', 'wheat', 'radish', 'kale',
      ]).optional().describe('Crop name (required for crop type and plant-tile transformations)'),
      tileId: z.string().optional().describe('Tile ID (required for tile-level actions like plant-tile, harvest-tile, clear-tile)'),
    })).describe('Array of transformations to apply in sequence'),
  }),
  execute: async (inputData) => {
    const { state, time, transformations } = inputData;

    try {
      const finalState = applyTransformations(state as ConcreteState, time, transformations);
      return {
        success: true,
        finalState,
        message: `Applied ${transformations.length} transformations successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
