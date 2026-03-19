import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { greenhouseAgent } from '../agents/greenhouse-agent';

// ─── Schemas ────────────────────────────────────────────────────────────────────

const SnapshotSchema = z.record(z.string(), z.unknown());

const SituationReportSchema = z.object({
  snapshot: z.record(z.string(), z.unknown()),
  flags: z.object({
    energyDeficit: z.boolean(),
    co2SafetyAlert: z.boolean(),
    waterRecyclingLow: z.boolean(),
    dustStormActive: z.boolean(),
    nutritionLow: z.boolean(),
  }),
  cropsAtHarvestReady: z.array(z.string()),
  cropsWithHighDisease: z.array(z.string()),
  cropsWithLowO2: z.array(z.string()),
  cropsWithHighEC: z.array(z.string()),
  boltingCrops: z.array(z.string()),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

const ActionSchema = z.object({
  type: z.enum(['greenhouse', 'crop', 'harvest', 'replant']),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
});

const ReasonOutputSchema = z.object({
  reasoning: z.string().describe('Concise explanation of the situation and why these actions were chosen'),
  summary: z.string().describe('One-sentence status summary for the operator chat feed'),
  actions: z.array(ActionSchema).describe('List of parameter changes, harvests, and replants to apply'),
});

// ─── Steps ──────────────────────────────────────────────────────────────────────

/**
 * assessStep: Pure data shaping — no LLM call.
 * Reads the environment snapshot and flags anomalies to give the agent a structured briefing.
 */
const assessStep = createStep({
  id: 'assess',
  inputSchema: SnapshotSchema,
  outputSchema: SituationReportSchema,
  execute: async ({ inputData }) => {
    const snap = inputData;

    const energyDeficit = snap.energyDeficit as boolean | undefined ?? false;
    const co2SafetyAlert = snap.co2SafetyAlert as boolean | undefined ?? false;
    const waterRecyclingEfficiency = snap.waterRecyclingEfficiency as number | undefined ?? 1;
    const dustStormActive = snap.dustStormActive as boolean | undefined ?? false;
    const nutritionalCoverage = snap.nutritionalCoverage as number | undefined ?? 1;
    const crops = (snap.crops ?? {}) as Record<string, {
      stage?: string;
      diseaseRisk?: number;
      rootO2Level?: number;
      nutrientEC?: number;
      isBolting?: boolean;
    }>;

    const cropEntries = Object.entries(crops);

    const cropsAtHarvestReady = cropEntries
      .filter(([, c]) => c.stage === 'harvest_ready')
      .map(([name]) => name);

    const cropsWithHighDisease = cropEntries
      .filter(([, c]) => (c.diseaseRisk ?? 0) > 0.4)
      .map(([name]) => name);

    const cropsWithLowO2 = cropEntries
      .filter(([, c]) => (c.rootO2Level ?? 100) < 60)
      .map(([name]) => name);

    const cropsWithHighEC = cropEntries
      .filter(([, c]) => (c.nutrientEC ?? 2) > 3.5)
      .map(([name]) => name);

    const boltingCrops = cropEntries
      .filter(([, c]) => c.isBolting)
      .map(([name]) => name);

    const flags = {
      energyDeficit,
      co2SafetyAlert,
      waterRecyclingLow: waterRecyclingEfficiency < 0.80,
      dustStormActive,
      nutritionLow: nutritionalCoverage < 0.70,
    };

    const criticalCount = [
      flags.energyDeficit,
      flags.co2SafetyAlert,
      cropsAtHarvestReady.length > 0,
      cropsWithHighDisease.length > 0,
    ].filter(Boolean).length;

    const urgencyLevel: 'low' | 'medium' | 'high' | 'critical' =
      criticalCount >= 3 ? 'critical'
      : criticalCount >= 2 ? 'high'
      : criticalCount >= 1 ? 'medium'
      : 'low';

    return {
      snapshot: snap,
      flags,
      cropsAtHarvestReady,
      cropsWithHighDisease,
      cropsWithLowO2,
      cropsWithHighEC,
      boltingCrops,
      urgencyLevel,
    };
  },
});

/**
 * reasonStep: Calls the greenhouse agent with structured output.
 * This is the single-agent version — in future iterations this can be replaced with
 * parallel specialist agents (e.g., cropAgent, energyAgent, nutritionAgent) that each
 * return the same ActionSchema, with a merge step combining their outputs.
 */
const reasonStep = createStep({
  id: 'reason',
  inputSchema: SituationReportSchema,
  outputSchema: ReasonOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('greenhouseAgent');
    if (!agent) {
      return {
        reasoning: 'Agent unavailable',
        summary: 'Agent unavailable — no actions taken',
        actions: [],
      };
    }

    const { snapshot, flags, cropsAtHarvestReady, cropsWithHighDisease, cropsWithLowO2, cropsWithHighEC, boltingCrops, urgencyLevel } = inputData;

    const prompt = `AUTONOMOUS CONTROL TICK — urgency: ${urgencyLevel.toUpperCase()}

Situation flags:
- Energy deficit: ${flags.energyDeficit}
- CO₂ safety alert: ${flags.co2SafetyAlert}
- Water recycling low (<80%): ${flags.waterRecyclingLow}
- Dust storm active: ${flags.dustStormActive}
- Nutrition coverage low (<70%): ${flags.nutritionLow}

Crops at harvest_ready: ${cropsAtHarvestReady.length > 0 ? cropsAtHarvestReady.join(', ') : 'none'}
Crops with high disease risk (>40%): ${cropsWithHighDisease.length > 0 ? cropsWithHighDisease.join(', ') : 'none'}
Crops with low root O₂ (<60%): ${cropsWithLowO2.length > 0 ? cropsWithLowO2.join(', ') : 'none'}
Crops with high nutrient EC (>3.5): ${cropsWithHighEC.length > 0 ? cropsWithHighEC.join(', ') : 'none'}
Bolting crops: ${boltingCrops.length > 0 ? boltingCrops.join(', ') : 'none'}

Full sensor snapshot:
${JSON.stringify(snapshot, null, 2)}

Decide what actions to take this tick. Return your reasoning, a one-sentence summary for the operator, and the list of actions to apply (parameter changes, harvests, replants). Only include actions that are genuinely warranted by the current state. If nothing needs changing, return an empty actions array.`;

    const result = await agent.generate([{ role: 'user', content: prompt }], {
      structuredOutput: { schema: ReasonOutputSchema },
      maxSteps: 5,
    });

    const output = result.object;

    if (output && typeof output === 'object' && 'reasoning' in output) {
      return output as z.infer<typeof ReasonOutputSchema>;
    }

    return {
      reasoning: typeof result.text === 'string' ? result.text : 'Autonomous tick completed',
      summary: 'Autonomous tick completed — check logs for details',
      actions: [],
    };
  },
});

/**
 * actStep: Validates and passes through the actions.
 * In future multi-agent iterations, this step merges outputs from parallel specialist agents
 * and deduplicates/prioritizes conflicting recommendations before returning.
 */
const actStep = createStep({
  id: 'act',
  inputSchema: ReasonOutputSchema,
  outputSchema: ReasonOutputSchema,
  execute: async ({ inputData }) => {
    const validActions = inputData.actions.filter((a) => {
      if (a.type === 'harvest' || a.type === 'replant') return !!a.crop;
      if (a.type === 'greenhouse') return !!a.param && a.value !== undefined;
      if (a.type === 'crop') return !!a.crop && !!a.param && a.value !== undefined;
      return false;
    });

    return {
      ...inputData,
      actions: validActions,
    };
  },
});

// ─── Workflow ────────────────────────────────────────────────────────────────────

export const greenhouseControlWorkflow = createWorkflow({
  id: 'greenhouse-control',
  description: 'Autonomous greenhouse control loop: assess situation → reason with agent → validate and apply actions',
  inputSchema: SnapshotSchema,
  outputSchema: ReasonOutputSchema,
})
  .then(assessStep)
  .then(reasonStep)
  .then(actStep)
  .commit();
