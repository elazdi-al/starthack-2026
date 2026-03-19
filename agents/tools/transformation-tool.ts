import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { applyTransformations } from '../greenhouse-agent';
import { State } from '../../greenhouse/state/types';

export const transformationTool = createTool({
  id: 'apply-greenhouse-transformations',
  description: 'Apply a sequence of parameter transformations to a greenhouse state. Each transformation updates a greenhouse parameter or crop-specific parameter, and they are applied in order.',
  inputSchema: z.object({
    state: z.any().describe('The current greenhouse state object'),
    time: z.number().describe('The time in minutes at which to apply transformations'),
    transformations: z.array(z.object({
      type: z.enum(['greenhouse', 'crop']).describe('Type of transformation: greenhouse for global parameters, crop for crop-specific parameters'),
      param: z.string().describe('Parameter name to update (e.g., globalHeatingPower, co2InjectionRate, waterPumpRate)'),
      value: z.union([z.number(), z.string(), z.boolean()]).describe('New value for the parameter'),
      crop: z.enum(['tomatoes', 'carrots']).optional().describe('Crop name (required only for crop type transformations)'),
    })).describe('Array of transformations to apply in sequence'),
  }),
  execute: async (inputData, context) => {
    const { state, time, transformations } = inputData;
    
    try {
      const finalState = applyTransformations(state as State, time, transformations);
      
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
