import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const VALID_GLOBAL_PARAMS = [
  'globalHeatingPower',
  'co2InjectionRate',
  'ventilationRate',
  'lightingPower',
] as const;

const VALID_CROP_PARAMS = ['waterPumpRate', 'localHeatingPower'] as const;

const CROP_NAMES = [
  'lettuce', 'tomato', 'potato', 'soybean',
  'spinach', 'wheat', 'radish', 'kale',
] as const;

export const greenhouseParameterTool = createTool({
  id: 'set-greenhouse-parameters',
  description:
    'Adjust greenhouse parameters, harvest crops, or replant crops. ' +
    'Changes propagate progressively through the thermal/atmospheric simulation. ' +
    'Global params (type "greenhouse"): globalHeatingPower (W, 0–10000), co2InjectionRate (ppm/h, 0–200), ' +
    'ventilationRate (m³/h, 0–500), lightingPower (W, 0–10000). ' +
    'Crop params (type "crop", requires crop): waterPumpRate (L/h, 0–30), localHeatingPower (W, 0–1000). ' +
    'Harvest (type "harvest", requires crop): harvest a crop at harvest_ready or fruiting stage. ' +
    'Replant (type "replant", requires crop): replant a harvested crop from seed. ' +
    'Available crops: lettuce, tomato, potato, soybean, spinach, wheat, radish, kale.',
  inputSchema: z.object({
    changes: z
      .array(
        z.object({
          type: z.enum(['greenhouse', 'crop', 'harvest', 'replant']),
          param: z.string().optional().describe('Parameter name (for greenhouse/crop types)'),
          value: z.number().optional().describe('New value (for greenhouse/crop types)'),
          crop: z
            .enum(CROP_NAMES)
            .optional()
            .describe('Required for crop/harvest/replant changes'),
        }),
      )
      .min(1)
      .describe('Actions to perform'),
    reasoning: z
      .string()
      .describe('Brief explanation of why these changes are being made'),
  }),
  execute: async ({ changes, reasoning }) => {
    const validated: typeof changes = [];

    for (const change of changes) {
      if (change.type === 'greenhouse') {
        if (!change.param || !(VALID_GLOBAL_PARAMS as readonly string[]).includes(change.param)) {
          return {
            success: false,
            error: `Invalid global parameter "${change.param}". Valid: ${VALID_GLOBAL_PARAMS.join(', ')}`,
          };
        }
        if (change.value === undefined) {
          return { success: false, error: 'Value is required for greenhouse parameter changes' };
        }
      } else if (change.type === 'crop') {
        if (!change.param || !(VALID_CROP_PARAMS as readonly string[]).includes(change.param)) {
          return {
            success: false,
            error: `Invalid crop parameter "${change.param}". Valid: ${VALID_CROP_PARAMS.join(', ')}`,
          };
        }
        if (!change.crop) {
          return { success: false, error: 'Crop name is required for crop-type parameter changes' };
        }
        if (change.value === undefined) {
          return { success: false, error: 'Value is required for crop parameter changes' };
        }
      } else if (change.type === 'harvest') {
        if (!change.crop) {
          return { success: false, error: 'Crop name is required for harvest' };
        }
      } else if (change.type === 'replant') {
        if (!change.crop) {
          return { success: false, error: 'Crop name is required for replant' };
        }
      }
      validated.push(change);
    }

    return {
      success: true,
      changes: validated,
      reasoning,
      message: `Queued ${validated.length} action(s). Parameter effects will manifest progressively following thermal dynamics.`,
    };
  },
});
