import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { State } from '../greenhouse/state/types';
import { updateGreenhouseParam, updateCropParam } from '../greenhouse/implementations/multi-crop/transformation';
import { ConcreteState } from '../greenhouse/implementations/multi-crop/types';

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

export const greenhouseAgent = new Agent({
  id: 'greenhouse-transformation-agent',
  name: 'Greenhouse Transformation Agent',
  instructions: `You are a greenhouse control agent that applies parameter transformations to greenhouse states.
  
Given a state and time, you chain multiple updateGreenhouseParam or updateCropParam transformations to produce the next state.

Your role is to:
1. Receive a greenhouse state and time
2. Apply a sequence of parameter updates using the transformation functions
3. Return the final transformed state

Each transformation is applied in order, with the output of one becoming the input to the next.`,
  model: 'openai/gpt-4o',
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
