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
    'Adjust greenhouse machine parameters. Changes propagate progressively through ' +
    'the thermal/atmospheric simulation (not instantaneously). ' +
    'Global params: globalHeatingPower (W, 0–10000), co2InjectionRate (ppm/h, 0–200), ' +
    'ventilationRate (m³/h, 0–500), lightingPower (W, 0–10000). ' +
    'Crop params (requires crop name): waterPumpRate (L/h, 0–30), localHeatingPower (W, 0–1000). ' +
    'Available crops: lettuce, tomato, potato, soybean, spinach, wheat, radish, kale.',
  inputSchema: z.object({
    changes: z
      .array(
        z.object({
          type: z.enum(['greenhouse', 'crop']),
          param: z.string().describe('Parameter name'),
          value: z.number().describe('New value'),
          crop: z
            .enum(CROP_NAMES)
            .optional()
            .describe('Required for crop-type changes'),
        }),
      )
      .min(1)
      .describe('Parameter changes to apply'),
    reasoning: z
      .string()
      .describe('Brief explanation of why these changes are being made'),
  }),
  execute: async ({ changes, reasoning }) => {
    const validated: typeof changes = [];

    for (const change of changes) {
      if (change.type === 'greenhouse') {
        if (!(VALID_GLOBAL_PARAMS as readonly string[]).includes(change.param)) {
          return {
            success: false,
            error: `Invalid global parameter "${change.param}". Valid: ${VALID_GLOBAL_PARAMS.join(', ')}`,
          };
        }
      } else if (change.type === 'crop') {
        if (!(VALID_CROP_PARAMS as readonly string[]).includes(change.param)) {
          return {
            success: false,
            error: `Invalid crop parameter "${change.param}". Valid: ${VALID_CROP_PARAMS.join(', ')}`,
          };
        }
        if (!change.crop) {
          return {
            success: false,
            error: `Crop name is required for crop-type parameter changes`,
          };
        }
      }
      validated.push(change);
    }

    return {
      success: true,
      changes: validated,
      reasoning,
      message: `Queued ${validated.length} parameter change(s). Effects will manifest progressively following thermal dynamics.`,
    };
  },
});
