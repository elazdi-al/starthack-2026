import { Agent } from '@mastra/core/agent';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';
import { State } from '../greenhouse/state/types';
import { updateGreenhouseParam, updateCropParam } from '../greenhouse/implementations/multi-crop/transformation';
import { ConcreteState } from '../greenhouse/implementations/multi-crop/types';
import { transformationTool } from './tools/transformation-tool';

// Schema for the agent input
const transformationInputSchema = z.object({
  state: z.any().describe('The current greenhouse state'),
  time: z.number().describe('The time in minutes'),
  transformations: z.array(z.object({
    type: z.enum(['greenhouse', 'crop']),
    param: z.string(),
    value: z.any(),
    crop: z.enum(['tomatoes', 'carrots']).optional(),
  })).describe('Array of transformations to apply in sequence'),
});

// Configure Bedrock with region
const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
});

export const greenhouseAgent = new Agent({
  id: 'greenhouse-transformation-agent',
  name: 'Greenhouse Transformation Agent',
  instructions: `You are a greenhouse control agent that applies parameter transformations to greenhouse states.
  
Given a state and time, you chain multiple updateGreenhouseParam or updateCropParam transformations to produce the next state.

Your role is to:
1. Receive a greenhouse state and time
2. Analyze the current conditions
3. Determine optimal parameter adjustments
4. Use the apply-greenhouse-transformations tool to apply the transformations
5. Return the final transformed state

Each transformation is applied in order, with the output of one becoming the input to the next.

Available parameters:
- Greenhouse: globalHeatingPower, co2InjectionRate, ventilationRate, lightingPower
- Crop (tomatoes/carrots): waterPumpRate, localHeatingPower`,
  model: bedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
  tools: {
    transformationTool,
  },
});

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
