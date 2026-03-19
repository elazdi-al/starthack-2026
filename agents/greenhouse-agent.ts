import { Agent } from '@mastra/core/agent';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';
import { State } from '../greenhouse/state/types';
import { updateGreenhouseParam, updateCropParam } from '../greenhouse/implementations/multi-crop/transformation';
import { ConcreteState, ConcreteEnvironment, ConcreteGreenhouseState } from '../greenhouse/implementations/multi-crop/types';

// Schema for transformation output
const transformationSchema = z.object({
  transformations: z.array(z.object({
    type: z.enum(['greenhouse', 'crop']),
    param: z.string(),
    value: z.number(),
    crop: z.enum(['tomatoes', 'carrots']).optional(),
    reasoning: z.string().describe('Brief explanation for this adjustment'),
  })),
  summary: z.string().describe('Overall strategy summary'),
});

// Configure Bedrock with region
const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
});

export const greenhouseAgent = new Agent({
  id: 'greenhouse-transformation-agent',
  name: 'Greenhouse Transformation Agent',
  instructions: `You are an expert Mars greenhouse control agent. Analyze environmental conditions and greenhouse parameters to determine optimal adjustments.

Your goal: Maximize plant health and growth efficiency for tomatoes and carrots.

Optimal ranges:
- Air Temperature: 20-25°C
- Humidity: 60-80%
- CO2: 800-1200 ppm
- Tomato soil moisture: 65-75%
- Carrot soil moisture: 60-70%

Available parameters to adjust:
Greenhouse (global):
- globalHeatingPower (Watts)
- co2InjectionRate (ppm/hour)
- ventilationRate (m³/hour)
- lightingPower (Watts)

Crop-specific (tomatoes/carrots):
- waterPumpRate (L/hour)
- localHeatingPower (Watts)

Return as many transformations as needed to optimize the system. Each transformation should have a clear reasoning.`,
  model: bedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
});

export { transformationSchema };

// Helper function to chain transformations
export function applyTransformations(
  initialState: State,
  time: number,
  transformations: Array<{
    type: 'greenhouse' | 'crop';
    param: string;
    value: any;
    crop?: 'tomatoes' | 'carrots';
  }>
): State {
  let currentState = initialState;

  for (const transform of transformations) {
    if (transform.type === 'greenhouse') {
      const transformFn = updateGreenhouseParam(
        transform.param as any,
        transform.value,
        time
      );
      currentState = transformFn(currentState);
    } else if (transform.type === 'crop' && transform.crop) {
      const transformFn = updateCropParam(
        transform.crop,
        transform.param as any,
        transform.value,
        time
      );
      currentState = transformFn(currentState);
    }
  }

  return currentState;
}
