/**
 * Shared Bedrock client — single instance reused across all agents and tools.
 * Avoids creating 6+ independent client instances and guarantees connection reuse.
 */

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

export const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
});
