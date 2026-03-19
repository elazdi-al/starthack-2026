import { Agent } from '@mastra/core/agent';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';
import { transformationTool } from './tools/transformation-tool';

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
});

const cropEnum = z.enum([
  'lettuce', 'tomato', 'potato', 'soybean', 'spinach', 'wheat', 'radish', 'kale',
]);

export const transformationSchema = z.object({
  transformations: z.array(z.object({
    type: z.enum(['greenhouse', 'crop', 'harvest', 'replant', 'plant-tile', 'harvest-tile', 'clear-tile']),
    param: z.string(),
    value: z.number(),
    crop: cropEnum.optional(),
    tileId: z.string().optional().describe('Required for tile-level actions (plant-tile, harvest-tile, clear-tile)'),
    reasoning: z.string().describe('Brief explanation for this adjustment'),
  })),
  summary: z.string().describe('Overall strategy summary'),
});

export const greenhouseAgent = new Agent({
  id: 'greenhouse-transformation-agent',
  name: 'Greenhouse Transformation Agent',
  instructions: `You are an expert Mars greenhouse control agent. Analyze environmental conditions and greenhouse parameters to determine optimal adjustments.

Your goal: Maximize plant health and growth efficiency for all crops.

Crops and their optimal soil conditions:
- lettuce:  temp 21°C, moisture 70%
- tomato:   temp 24°C, moisture 70%
- potato:   temp 18°C, moisture 65%
- soybean:  temp 25°C, moisture 65%
- spinach:  temp 18°C, moisture 65%
- wheat:    temp 21°C, moisture 60%
- radish:   temp 19°C, moisture 60%
- kale:     temp 19°C, moisture 65%

Global optimal ranges:
- Air Temperature: 20-25°C
- Humidity: 60-80%
- CO2: 800-1200 ppm

Available parameters to adjust:
Greenhouse (global):
- globalHeatingPower (Watts)
- co2InjectionRate (ppm/hour)
- ventilationRate (m³/hour)
- lightingPower (Watts)

Crop-specific (per crop):
- waterPumpRate (L/hour)
- localHeatingPower (Watts)

Return as many transformations as needed to optimize the system. Each transformation should have a clear reasoning.`,
  model: bedrock('us.anthropic.claude-haiku-4-5-20250922-v1:0'),
  tools: { transformationTool },
});
