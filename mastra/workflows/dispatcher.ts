import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { secretaryStore, type TriggerType } from '../../lib/secretary-store';
import { ingestSecretaryReports } from '../tools/secretary-vector-tool';
import { crewProfilesForAgent, INITIAL_CREW_PROFILES, type CrewmateProfile } from '../../lib/crew-data';

export const ActionSchema = z.object({
  type: z.enum(['greenhouse', 'crop', 'harvest', 'replant', 'batch-tile']),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
  harvests: z.array(z.string()).optional(),
  plants: z.array(z.object({ tileId: z.string(), crop: z.string() })).optional(),
  clears: z.array(z.string()).optional(),
});

const DispatcherInputSchema = z.object({
  triggerType: z.enum(['emergency', 'routine', 'crew']),
  snapshot: z.record(z.string(), z.unknown()),
  crewMessage: z.string().optional(),
  missionSol: z.number(),
});

const ClassifyOutputSchema = z.object({
  triggerType: z.enum(['emergency', 'routine', 'crew']),
  emergencySeverity: z.union([z.literal(1), z.literal(2)]).optional(),
  snapshot: z.record(z.string(), z.unknown()),
  crewMessage: z.string().optional(),
  missionSol: z.number(),
  playbookActions: z.array(ActionSchema).optional(),
  playbookReason: z.string().optional(),
});

const PreferenceSignalSchema = z.object({
  crop: z.string(),
  delta: z.number(),
});

const DecisionAgentOutputSchema = z.object({
  crewIntent: z.enum(['question', 'request', 'override']).optional(),
  riskScore: z.number(),
  crewImpactScore: z.number(),
  summary: z.string(),
  reasoning: z.string(),
  operationsSummary: z.string(),
  crewSummary: z.string(),
  crewResponse: z.string().optional(),
  blockForSafety: z.boolean(),
  actions: z.array(ActionSchema),
  preferenceSignals: z.array(PreferenceSignalSchema),
});

const DispatcherOutputSchema = z.object({
  triggerType: z.string(),
  emergencySeverity: z.number().optional(),
  crewIntent: z.string().optional(),
  resolvedActions: z.array(ActionSchema),
  decisionMode: z.string(),
  handledBy: z.string(),
  riskScore: z.number(),
  crewImpactScore: z.number(),
  operationsSummary: z.string(),
  crewSummary: z.string(),
  crewResponse: z.string().optional(),
  reasoning: z.string(),
  summary: z.string(),
  decisionId: z.string(),
});

const AGENT_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms = AGENT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function summarizeActions(actions: z.infer<typeof ActionSchema>[]): string {
  if (actions.length === 0) return 'No operational changes were needed';

  let climateCount = 0;
  let cropCount = 0;
  let tilePlantCount = 0;
  let tileHarvestCount = 0;

  for (const action of actions) {
    if (action.type === 'greenhouse') climateCount += 1;
    if (action.type === 'crop' || action.type === 'harvest' || action.type === 'replant') cropCount += 1;
    if (action.type === 'batch-tile') {
      tilePlantCount += action.plants?.length ?? 0;
      tileHarvestCount += action.harvests?.length ?? 0;
    }
  }

  const parts: string[] = [];
  if (climateCount > 0) parts.push(`${climateCount} climate adjustment${climateCount > 1 ? 's' : ''}`);
  if (cropCount > 0) parts.push(`${cropCount} crop action${cropCount > 1 ? 's' : ''}`);
  if (tilePlantCount > 0) parts.push(`${tilePlantCount} tile planting${tilePlantCount > 1 ? 's' : ''}`);
  if (tileHarvestCount > 0) parts.push(`${tileHarvestCount} tile harvest${tileHarvestCount > 1 ? 's' : ''}`);

  return parts.join(', ');
}

function applyPreferenceSignals(
  signals: Array<z.infer<typeof PreferenceSignalSchema>> | undefined,
  missionSol: number,
): void {
  if (!signals) return;
  for (const signal of signals) {
    if (typeof signal.crop === 'string' && typeof signal.delta === 'number') {
      secretaryStore.updateCrewPreference(signal.crop, signal.delta, missionSol);
    }
  }
}

function compactSnapshot(snapshot: Record<string, unknown>) {
  const tileCrops = (snapshot.tileCrops ?? {}) as Record<string, Record<string, unknown>>;
  const flaggedTiles: Record<string, Record<string, unknown>> = {};

  for (const [tileId, tile] of Object.entries(tileCrops)) {
    const health = (tile.healthScore as number) ?? 1;
    const disease = (tile.diseaseRisk as number) ?? 0;
    const stage = (tile.stage as string) ?? '';
    const isHarvestReady = stage === 'harvest_ready';
    const isEmpty = stage === 'harvested' || !stage;

    if (!isEmpty && (health < 0.7 || disease > 0.3 || isHarvestReady)) {
      flaggedTiles[tileId] = tile;
    }
  }

  return {
    environment: {
      missionSol: snapshot.missionSol,
      totalMissionSols: snapshot.totalMissionSols,
      currentLs: snapshot.currentLs,
      seasonName: snapshot.seasonName,
      atmosphericPressure: snapshot.atmosphericPressure,
      dustStormRisk: snapshot.dustStormRisk,
      airTemperature: snapshot.airTemperature,
      humidity: snapshot.humidity,
      co2Level: snapshot.co2Level,
      lightLevel: snapshot.lightLevel,
      o2Level: snapshot.o2Level,
      externalTemp: snapshot.externalTemp,
      solarRadiation: snapshot.solarRadiation,
      dustStormFactor: snapshot.dustStormFactor,
      dustStormActive: snapshot.dustStormActive,
      waterRecyclingEfficiency: snapshot.waterRecyclingEfficiency,
      solarGenerationKW: snapshot.solarGenerationKW,
      batteryStorageKWh: snapshot.batteryStorageKWh,
      batteryCapacityKWh: snapshot.batteryCapacityKWh,
      energyDeficit: snapshot.energyDeficit,
      co2SafetyAlert: snapshot.co2SafetyAlert,
      nutritionalCoverage: snapshot.nutritionalCoverage,
      foodReservesSols: snapshot.foodReservesSols,
    },
    greenhouseControls: (snapshot.greenhouseControls as Record<string, unknown>) ?? {},
    crops: (snapshot.crops as Record<string, unknown>) ?? {},
    resources: (snapshot.resources as Record<string, unknown>) ?? {},
    tileCounts: (snapshot.tileCounts as Record<string, unknown>) ?? {},
    flaggedTiles,
  };
}

const classifyStep = createStep({
  id: 'classify',
  inputSchema: DispatcherInputSchema,
  outputSchema: ClassifyOutputSchema,
  execute: async ({ inputData }) => {
    const { triggerType, snapshot, crewMessage, missionSol } = inputData;

    if (triggerType === 'crew') {
      return { triggerType, snapshot, crewMessage, missionSol };
    }

    const dustOpacity = (() => {
      const rawOpacity = snapshot.dustOpacity as number | undefined;
      if (rawOpacity != null) return rawOpacity;
      const stormFactor = snapshot.dustStormFactor as number | undefined;
      if (stormFactor != null) return (1 - stormFactor) * 5;
      return 0;
    })();
    const solarPct = (() => {
      const generation = (snapshot.solarGenerationKW as number) ?? 0;
      return generation / 5;
    })();
    const co2Level = (snapshot.co2Level as number) ?? 1000;
    const batteryPct = (() => {
      const charge = (snapshot.batteryStorageKWh as number) ?? 100;
      const capacity = (snapshot.batteryCapacityKWh as number) ?? 100;
      return charge / Math.max(1, capacity);
    })();
    const waterRecycling = (snapshot.waterRecyclingEfficiency as number) ?? 1;
    const nutritionalCoverage = (snapshot.nutritionalCoverage as number) ?? 1;

    const solarCritical = solarPct < 0.15 && batteryPct < 0.15;
    const isSev1 =
      dustOpacity > 3.0 ||
      solarCritical ||
      co2Level > 5000 ||
      batteryPct < 0.1;

    if (isSev1) {
      const actionMap = new Map<string, z.infer<typeof ActionSchema>>();
      const reasons: string[] = [];

      if (dustOpacity > 3.0) {
        actionMap.set('ventilationRate', { type: 'greenhouse', param: 'ventilationRate', value: 20 });
        reasons.push('Extreme dust storm: reduce ventilation and protect intake pathways');
      }
      if (solarCritical) {
        actionMap.set('lightingPower', { type: 'greenhouse', param: 'lightingPower', value: 2000 });
        actionMap.set('globalHeatingPower', { type: 'greenhouse', param: 'globalHeatingPower', value: 1500 });
        reasons.push('Solar generation collapsed while battery is critically low');
      }
      if (batteryPct < 0.1) {
        actionMap.set('lightingPower', { type: 'greenhouse', param: 'lightingPower', value: 1000 });
        actionMap.set('globalHeatingPower', { type: 'greenhouse', param: 'globalHeatingPower', value: 1000 });
        reasons.push('Battery reserve is below 10 percent');
      }
      if (co2Level > 5000) {
        actionMap.set('ventilationRate', { type: 'greenhouse', param: 'ventilationRate', value: 400 });
        actionMap.set('co2InjectionRate', { type: 'greenhouse', param: 'co2InjectionRate', value: 0 });
        reasons.push('CO2 has crossed the crew-safe threshold');
      }

      return {
        triggerType: 'emergency' as const,
        emergencySeverity: 1 as const,
        snapshot,
        missionSol,
        playbookActions: [...actionMap.values()],
        playbookReason: reasons.join('; '),
      };
    }

    const isSev2 =
      (dustOpacity >= 1.5 && dustOpacity <= 3.0) ||
      batteryPct < 0.25 ||
      waterRecycling < 0.25 ||
      nutritionalCoverage < 0.5;

    if (isSev2) {
      return {
        triggerType: 'emergency' as const,
        emergencySeverity: 2 as const,
        snapshot,
        missionSol,
      };
    }

    return {
      triggerType: 'routine' as const,
      snapshot,
      missionSol,
    };
  },
});

const dispatchStep = createStep({
  id: 'dispatch',
  inputSchema: ClassifyOutputSchema,
  outputSchema: DispatcherOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { triggerType, emergencySeverity, snapshot, crewMessage, missionSol, playbookActions, playbookReason } = inputData;

    if (triggerType === 'emergency' && emergencySeverity === 1) {
      const actions = playbookActions ?? [];
      const reason = playbookReason ?? 'Severity-1 emergency playbook executed';

      secretaryStore.addIncident({
        missionSol,
        emergencyType: 'severity-1 emergency',
        severity: 1,
        trigger: reason,
        actionsExecuted: actions.map((action) => `${action.type}:${action.param ?? action.crop ?? 'batch'}`),
        systemsAffected: ['greenhouse'],
        resolved: false,
      });

      const entry = secretaryStore.addDecision({
        missionSol,
        triggerType: 'emergency_sev1',
        riskScore: 1,
        crewImpactScore: 0.2,
        decisionMode: 'emergency_playbook',
        handledBy: 'system',
        operationsSummary: summarizeActions(actions),
        crewSummary: 'Crew comfort was deprioritized while stabilizing the emergency',
        actionsEnacted: actions,
        reasoning: reason,
      });

      return {
        triggerType: 'emergency_sev1',
        emergencySeverity: 1,
        resolvedActions: actions,
        decisionMode: 'emergency_playbook',
        handledBy: 'system',
        riskScore: 1,
        crewImpactScore: 0.2,
        operationsSummary: summarizeActions(actions),
        crewSummary: 'Crew comfort was deprioritized while stabilizing the emergency',
        reasoning: reason,
        summary: `Emergency response: ${reason}`,
        decisionId: entry.id,
      };
    }

    const agent = mastra?.getAgent('decisionAgent');
    if (!agent) {
      const entry = secretaryStore.addDecision({
        missionSol,
        triggerType: 'routine',
        riskScore: 0,
        crewImpactScore: 0,
        decisionMode: 'none',
        handledBy: 'none',
        operationsSummary: '',
        crewSummary: '',
        actionsEnacted: [],
        reasoning: 'Decision agent unavailable',
      });

      return {
        triggerType: 'routine',
        resolvedActions: [],
        decisionMode: 'none',
        handledBy: 'none',
        riskScore: 0,
        crewImpactScore: 0,
        operationsSummary: '',
        crewSummary: '',
        reasoning: 'Decision agent unavailable',
        summary: 'No decision agent available',
        decisionId: entry.id,
      };
    }

    const compactSnap = compactSnapshot(snapshot);
    const crewStatus = crewProfilesForAgent(
      (Array.isArray(snapshot.crew) ? snapshot.crew : INITIAL_CREW_PROFILES) as CrewmateProfile[],
    );
    const recentContext = secretaryStore.getAgentContext(5);
    const crewProfile = secretaryStore.getCrewPreferenceProfile();
    const modeLabel =
      triggerType === 'crew'
        ? 'crew interaction'
        : triggerType === 'emergency'
          ? `severity-${emergencySeverity} emergency`
          : 'routine autonomous tick';

    const prompt = [
      `You are handling a ${modeLabel} on mission sol ${missionSol}.`,
      crewMessage ? `Crew message:\n${crewMessage}` : null,
      crewStatus,
      `Recent mission context:\n${recentContext || 'None recorded yet.'}`,
      Object.keys(crewProfile.preferences).length > 0
        ? `Known crew food preferences:\n${JSON.stringify(crewProfile.preferences, null, 2)}`
        : null,
      `Compact greenhouse snapshot:\n${JSON.stringify(compactSnap, null, 2)}`,
      triggerType === 'crew'
        ? `For crew interactions:
- classify the message as question, request, or override
- return actions only if operations should change
- set blockForSafety true if the request should be denied
- write crewResponse as the message to show the crew`
        : `For autonomous control:
- propose only necessary actions
- prefer the smallest effective action set
- if no changes are warranted, return an empty actions array`,
    ].filter(Boolean).join('\n\n');

    try {
      const result = await withTimeout(agent.generate(
        [{ role: 'user', content: prompt }],
        { structuredOutput: { schema: DecisionAgentOutputSchema }, maxSteps: 4 },
      ));

      const output = result.object;
      if (!output) {
        throw new Error('Decision agent returned no structured output');
      }

      const actions = output.actions.filter((action) => {
        if (action.type === 'harvest' || action.type === 'replant') return !!action.crop;
        if (action.type === 'greenhouse') return !!action.param && action.value !== undefined;
        if (action.type === 'crop') return !!action.crop && !!action.param && action.value !== undefined;
        if (action.type === 'batch-tile') return !!(action.harvests?.length || action.plants?.length || action.clears?.length);
        return false;
      });

      if (crewMessage) {
        secretaryStore.addCrewRequest(crewMessage, missionSol);
        applyPreferenceSignals(output.preferenceSignals, missionSol);
      }

      const isCrewQuestion = triggerType === 'crew' && output.crewIntent === 'question';
      const isCrewOverride = triggerType === 'crew' && output.crewIntent === 'override';
      const blockedForSafety = !!output.blockForSafety;

      if (isCrewOverride) {
        secretaryStore.logOverrideAttempt(crewMessage ?? '', !blockedForSafety, missionSol);
      }

      const logType: TriggerType =
        triggerType === 'emergency' ? 'emergency_sev2'
          : isCrewQuestion ? 'crew_question'
            : isCrewOverride ? 'crew_override'
              : triggerType === 'crew' ? 'crew_request'
                : 'routine';

      const decisionMode = blockedForSafety
        ? 'safety_block'
        : triggerType === 'emergency'
          ? 'direct_decision'
          : isCrewQuestion
            ? 'direct_decision'
            : 'direct_decision';

      const entry = secretaryStore.addDecision({
        missionSol,
        triggerType: logType,
        riskScore: output.riskScore,
        crewImpactScore: output.crewImpactScore,
        decisionMode,
        handledBy: 'decision',
        operationsSummary: output.operationsSummary || summarizeActions(actions),
        crewSummary: output.crewSummary,
        actionsEnacted: blockedForSafety ? [] : actions,
        reasoning: output.reasoning,
      });

      ingestSecretaryReports(Date.now() - 5000).catch(() => {});

      return {
        triggerType: logType,
        emergencySeverity: triggerType === 'emergency' ? emergencySeverity : undefined,
        crewIntent: output.crewIntent,
        resolvedActions: blockedForSafety ? [] : actions,
        decisionMode,
        handledBy: 'decision',
        riskScore: output.riskScore,
        crewImpactScore: output.crewImpactScore,
        operationsSummary: output.operationsSummary || summarizeActions(actions),
        crewSummary: output.crewSummary,
        crewResponse: output.crewResponse,
        reasoning: output.reasoning,
        summary: output.summary || summarizeActions(actions),
        decisionId: entry.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown decision-agent error';
      const entry = secretaryStore.addDecision({
        missionSol,
        triggerType: 'routine',
        riskScore: 0,
        crewImpactScore: 0,
        decisionMode: 'none',
        handledBy: 'none',
        operationsSummary: '',
        crewSummary: '',
        actionsEnacted: [],
        reasoning: message,
      });

      return {
        triggerType: 'routine',
        resolvedActions: [],
        decisionMode: 'none',
        handledBy: 'none',
        riskScore: 0,
        crewImpactScore: 0,
        operationsSummary: '',
        crewSummary: '',
        reasoning: message,
        summary: 'Decision processing failed',
        decisionId: entry.id,
      };
    }
  },
});

export const dispatcherWorkflow = createWorkflow({
  id: 'dispatcher',
  description: 'Simplified dispatch: classify emergencies, ask the decision agent, log via secretary',
  inputSchema: DispatcherInputSchema,
  outputSchema: DispatcherOutputSchema,
})
  .then(classifyStep)
  .then(dispatchStep)
  .commit();
