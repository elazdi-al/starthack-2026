import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { applyTransformations } from '../../greenhouse/implementations/multi-crop/transformation';
import type { ConcreteState } from '../../greenhouse/implementations/multi-crop/types';

export const greenhouseTransformationTool = createTool({
  id: 'apply-greenhouse-transformations',
  description:
    'Apply a sequence of parameter transformations to a greenhouse state. ' +
    'Each transformation updates a greenhouse parameter or crop-specific parameter, applied in order.',
  inputSchema: z.object({
    state: z.any().describe('The current greenhouse state object'),
    time: z.number().describe('The time in minutes at which to apply transformations'),
    transformations: z
      .array(
        z.object({
          type: z
            .enum(['greenhouse', 'crop'])
            .describe('greenhouse for global parameters, crop for crop-specific'),
          param: z
            .string()
            .describe('Parameter name (e.g. globalHeatingPower, waterPumpRate)'),
          value: z.number().describe('New numeric value for the parameter'),
          crop: z
            .enum(['tomatoes', 'carrots'])
            .optional()
            .describe('Required only for crop-type transformations'),
        }),
      )
      .describe('Array of transformations to apply in sequence'),
  }),
  execute: async (inputData) => {
    const { state, time, transformations } = inputData;

    try {
      const finalState = applyTransformations(
        state as ConcreteState,
        time,
        transformations,
      );
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
