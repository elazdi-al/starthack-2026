/**
 * Dispatcher — Main trigger routing and Arbiter layer
 *
 * This workflow implements the full pipeline from spec §6 (Trigger System) and §4 (Arbiter Layer).
 *
 * Trigger routing table (spec §6):
 * ┌────────────────┬──────────────────┬───────────────────────────────┬───────────────┐
 * │ Trigger        │ Agents called    │ Pipeline                      │ Sim used?     │
 * ├────────────────┼──────────────────┼───────────────────────────────┼───────────────┤
 * │ Emergency sev1 │ Survival only    │ Hardcoded playbook, instant   │ No            │
 * │ Emergency sev2 │ Survival leads   │ Fast sim, 10 scenarios/3 sol  │ Yes (fast)    │
 * │ Routine        │ Both + Arbiter   │ Full debate → sim if conflict │ Full (100/7)  │
 * │ Crew question  │ Wellbeing only   │ Direct answer from snapshot   │ No            │
 * │ Crew request   │ Both + Arbiter   │ Mini routine cycle            │ If conflict   │
 * │ Crew override  │ Survival veto    │ Survival evaluates, may veto  │ No            │
 * └────────────────┴──────────────────┴───────────────────────────────┴───────────────┘
 *
 * Arbiter conflict resolution (spec §4.1):
 * - Agreement (both compatible): Execute immediately, no simulation
 * - Soft conflict (risk 0.5–0.85): Run full simulation on both proposals, pick safer P10 tail
 * - Hard veto (risk > 0.85): Execute survival plan, notify crew with reason
 * - Mission phase shift (sol > 350): Wellbeing bias increases in soft-conflict resolution
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  secretaryStore,
  type TriggerType,
  type ConflictType,
  type WinningAgent,
} from '../../lib/secretary-store';
import { ingestSecretaryReports } from '../tools/secretary-vector-tool';
import { crewProfilesForAgent, INITIAL_CREW_PROFILES, type CrewmateProfile } from '../../lib/crew-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a performance digest as a prompt preamble block. Returns empty string if no digest. */
function digestPreamble(agentName: 'survival' | 'wellbeing' | 'arbiter'): string {
  const digests = secretaryStore.getPerformanceDigests();
  if (!digests) return '';
  const text = digests[agentName];
  return `[PERFORMANCE DIGEST — calibration signal from Secretary, last 10 sols]\n${text}\n`;
}

/** Build a concise human-readable summary of resolved actions. */
function summarizeActions(actions: z.infer<typeof ActionSchema>[]): string {
  if (actions.length === 0) return 'Routine monitoring — no changes needed';

  // Categorise all actions
  let hasClimate = false;
  let hasPlanting = false;
  let hasHarvesting = false;
  let hasClearing = false;
  let hasReplanting = false;
  let hasCropConfig = false;

  const climateParams = new Set<string>();
  const cropNames = new Set<string>();

  for (const a of actions) {
    if (a.type === 'batch-tile') {
      if (a.plants && a.plants.length > 0) {
        hasPlanting = true;
        for (const p of a.plants) cropNames.add(p.crop);
      }
      if (a.harvests && a.harvests.length > 0) hasHarvesting = true;
      if (a.clears && a.clears.length > 0) hasClearing = true;
    } else if (a.type === 'harvest') {
      hasHarvesting = true;
      if (a.crop) cropNames.add(a.crop);
    } else if (a.type === 'replant') {
      hasReplanting = true;
      if (a.crop) cropNames.add(a.crop);
    } else if (a.type === 'greenhouse') {
      hasClimate = true;
      if (a.param) {
        const label = a.param === 'globalHeatingPower' ? 'heating'
          : a.param === 'lightingPower' ? 'lighting'
          : a.param === 'co2InjectionRate' ? 'CO2'
          : a.param === 'ventilationRate' ? 'ventilation'
          : a.param === 'waterPump' ? 'irrigation'
          : a.param;
        climateParams.add(label);
      }
    } else if (a.type === 'crop') {
      hasCropConfig = true;
      if (a.crop) cropNames.add(a.crop);
    }
  }

  const hasCropWork = hasPlanting || hasHarvesting || hasClearing || hasReplanting || hasCropConfig;

  // Build a concise, title-style headline
  if (hasClimate && hasCropWork) {
    const params = [...climateParams].slice(0, 2).join(' & ');
    return params
      ? `Adjusted ${params} and managed crop operations`
      : 'Climate adjustment and crop management';
  }

  if (hasClimate) {
    const params = [...climateParams];
    if (params.length === 1) return `Adjusted ${params[0]} for greenhouse`;
    if (params.length === 2) return `Tuned ${params[0]} and ${params[1]}`;
    return `Updated greenhouse climate controls`;
  }

  if (hasCropWork) {
    const activities: string[] = [];
    if (hasHarvesting) activities.push('harvested');
    if (hasPlanting) activities.push('planted');
    if (hasReplanting) activities.push('replanted');
    if (hasClearing) activities.push('cleared');
    if (hasCropConfig) activities.push('reconfigured');
    const crops = [...cropNames].slice(0, 2);
    const cropSuffix = crops.length > 0 ? ` ${crops.join(' & ')}` : ' crops';
    const verb = activities.length <= 2 ? activities.join(' and ') : activities.slice(0, 2).join(' and ');
    // Capitalise first letter
    return (verb.charAt(0).toUpperCase() + verb.slice(1)) + cropSuffix;
  }

  return `Greenhouse maintenance update`;
}

/** Apply preferenceUpdates array from wellbeing agent JSON to the secretary store. */
function applyPreferenceUpdates(
  updates: Array<{ crop: string; delta: number }> | undefined,
  missionSol: number,
): void {
  if (!Array.isArray(updates)) return;
  for (const u of updates) {
    if (typeof u.crop === 'string' && typeof u.delta === 'number') {
      secretaryStore.updateCrewPreference(u.crop, u.delta, missionSol);
    }
  }
}

// ─── Snapshot Compression ────────────────────────────────────────────────────
// The full snapshot includes 108 tiles × 15 fields (~12K tokens). Agents only
// need per-crop aggregates + tiles with problems. This cuts prompt size by ~60%.

interface CompactSnapshot {
  environment: Record<string, unknown>;
  greenhouseControls: Record<string, unknown>;
  crops: Record<string, unknown>;
  resources: Record<string, unknown>;
  /** Per-crop-type tile allocation counts (total, planted, harvested). */
  tileCounts: Record<string, unknown>;
  /** Only tiles with health < 0.7, bolting, disease > 0.3, or harvest_ready. */
  flaggedTiles: Record<string, unknown>;
  tileSummary: string;
}

/**
 * Build a compact snapshot for agent prompts. Keeps full environment + controls +
 * per-crop aggregates but replaces 108 tiles with only flagged ones (~5-10 vs 108).
 */
function compactSnapshot(snapshot: Record<string, unknown>): CompactSnapshot {
  const snap = snapshot as Record<string, unknown>;
  const tileCrops = (snap.tileCrops ?? {}) as Record<string, Record<string, unknown>>;

  // Extract flagged tiles only (health < 0.7, bolting, disease > 0.3, or harvest_ready)
  const flaggedTiles: Record<string, unknown> = {};
  let totalTiles = 0;
  let flaggedCount = 0;
  let harvestReadyCount = 0;
  let emptyCount = 0;
  for (const [tileId, tile] of Object.entries(tileCrops)) {
    totalTiles++;
    const health = (tile.healthScore as number) ?? 1;
    const bolting = (tile.isBolting as boolean) ?? false;
    const disease = (tile.diseaseRisk as number) ?? 0;
    const stage = (tile.stage as string) ?? '';
    const isHarvestReady = stage === 'harvest_ready';
    const isEmpty = stage === 'harvested' || !stage;

    if (isEmpty) {
      emptyCount++;
      // Don't include every empty tile — tileCounts covers allocation
    } else if (health < 0.7 || bolting || disease > 0.3 || isHarvestReady) {
      flaggedTiles[tileId] = tile;
      flaggedCount++;
      if (isHarvestReady) harvestReadyCount++;
    }
  }

  return {
    environment: {
      missionSol: snap.missionSol,
      totalMissionSols: snap.totalMissionSols,
      currentLs: snap.currentLs,
      seasonName: snap.seasonName,
      atmosphericPressure: snap.atmosphericPressure,
      dustStormRisk: snap.dustStormRisk,
      airTemperature: snap.airTemperature,
      humidity: snap.humidity,
      co2Level: snap.co2Level,
      lightLevel: snap.lightLevel,
      o2Level: snap.o2Level,
      externalTemp: snap.externalTemp,
      solarRadiation: snap.solarRadiation,
      dustStormFactor: snap.dustStormFactor,
      dustStormActive: snap.dustStormActive,
      waterRecyclingEfficiency: snap.waterRecyclingEfficiency,
      solarGenerationKW: snap.solarGenerationKW,
      batteryStorageKWh: snap.batteryStorageKWh,
      batteryCapacityKWh: snap.batteryCapacityKWh,
      energyDeficit: snap.energyDeficit,
      co2SafetyAlert: snap.co2SafetyAlert,
      nutritionalCoverage: snap.nutritionalCoverage,
      foodReservesSols: snap.foodReservesSols,
    },
    greenhouseControls: (snap.greenhouseControls as Record<string, unknown>) ?? {},
    crops: (snap.crops as Record<string, unknown>) ?? {},
    resources: (snap.resources as Record<string, unknown>) ?? {},
    tileCounts: (snap.tileCounts as Record<string, unknown>) ?? {},
    flaggedTiles,
    tileSummary: `${totalTiles} tiles total: ${emptyCount} empty awaiting planting, ${harvestReadyCount} harvest-ready, ${flaggedCount - harvestReadyCount} with issues (health<0.7 / bolting / disease>0.3)`,
  };
}

/**
 * Build a compact environment summary for the Arbiter (~500 tokens instead of ~5000).
 * The Arbiter gets agent briefs with full justifications, so it only needs key metrics
 * to cross-reference — not the full crop/tile dump.
 */
function envSummaryForArbiter(snapshot: Record<string, unknown>): string {
  const s = snapshot as Record<string, unknown>;
  const controls = (s.greenhouseControls ?? {}) as Record<string, number>;
  const resources = (s.resources ?? {}) as Record<string, number>;
  const crops = (s.crops ?? {}) as Record<string, Record<string, unknown>>;
  const tileCounts = (s.tileCounts ?? {}) as Record<string, Record<string, number>>;

  // Build one-line per crop: name, stage, health, yield, tile allocation
  const cropLines = Object.entries(crops).map(([name, c]) => {
    const health = ((c.healthScore as number) ?? 1).toFixed(2);
    const yieldKg = ((c.estimatedYieldKg as number) ?? 0).toFixed(1);
    const tc = tileCounts[name];
    const tileInfo = tc ? ` tiles=${tc.planted ?? 0}/${tc.total ?? 0} (${tc.harvested ?? 0} harvested)` : '';
    return `  ${name}: stage=${c.stage}, health=${health}, yield=${yieldKg}kg, bolting=${c.isBolting ?? false}${tileInfo}`;
  }).join('\n');

  return `KEY METRICS:
  Sol ${s.missionSol}/${s.totalMissionSols}, Ls ${s.currentLs}°, Season: ${s.seasonName}
  Temp: ${s.airTemperature}°C, Humidity: ${s.humidity}%, CO₂: ${s.co2Level}ppm, O₂: ${s.o2Level}%
  Light: ${s.lightLevel}, Solar: ${s.solarGenerationKW}kW, Battery: ${s.batteryStorageKWh}/${s.batteryCapacityKWh}kWh
  Dust factor: ${s.dustStormFactor}, Storm active: ${s.dustStormActive}, Energy deficit: ${s.energyDeficit}
  Water recycling: ${s.waterRecyclingEfficiency}, Nutritional coverage: ${s.nutritionalCoverage}
  Food reserves: ${s.foodReservesSols} sols
  Controls: heat=${controls.globalHeatingPower}W, light=${controls.lightingPower}W, CO₂=${controls.co2InjectionRate}ppm/h, vent=${controls.ventilationRate}
  Resources: water=${resources.waterConsumedL}L, energy=${resources.energyUsedKWh}kWh, O₂=${resources.o2ProducedKg}kg, harvest=${resources.totalHarvestKg}kg
CROPS:
${cropLines}`;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ActionSchema = z.object({
  type: z.enum(['greenhouse', 'crop', 'harvest', 'replant', 'batch-tile']),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
  // batch-tile fields
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
  crewMessage: z.string().optional(),
  snapshot: z.record(z.string(), z.unknown()),
  missionSol: z.number(),
  // Emergency playbook actions for severity-1 (determined without LLM)
  playbookActions: z.array(ActionSchema).optional(),
  playbookReason: z.string().optional(),
});

const DispatcherOutputSchema = z.object({
  triggerType: z.string(),
  emergencySeverity: z.number().optional(),
  crewIntent: z.string().optional(),
  resolvedActions: z.array(ActionSchema),
  conflictType: z.string(),
  winningAgent: z.string(),
  riskScore: z.number(),
  wellbeingScore: z.number(),
  survivalJustification: z.string(),
  wellbeingJustification: z.string(),
  crewResponse: z.string().optional(),
  simulationP10: z.number().optional(),
  simulationP90: z.number().optional(),
  reasoning: z.string(),
  summary: z.string(),
  decisionId: z.string(),
});

// ─── Timeout helper ───────────────────────────────────────────────────────────

const AGENT_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms = AGENT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ─── Structured output schema for greenhouse agent ────────────────────────────

const RoutineOutputSchema = z.object({
  reasoning: z.string().describe('Brief explanation of the situation and why these actions were chosen'),
  summary: z.string().describe('One-sentence status summary for the operator'),
  actions: z.array(ActionSchema).describe('Actions to apply this tick — empty array if no changes needed'),
});

// ─── Step 1: Classify ─────────────────────────────────────────────────────────
// Pure function — no LLM. Deterministic severity classification (spec §6.1).

const classifyStep = createStep({
  id: 'classify',
  inputSchema: DispatcherInputSchema,
  outputSchema: ClassifyOutputSchema,
  execute: async ({ inputData }) => {
    const { triggerType, snapshot, crewMessage, missionSol } = inputData;
    const snap = snapshot as Record<string, unknown>;

    // Crew triggers skip emergency classification — always route to crew pipeline
    if (triggerType === 'crew') {
      return {
        triggerType: 'crew' as const,
        snapshot,
        crewMessage,
        missionSol,
      };
    }

    // ── Emergency severity classification (spec §6.1) ──────────────────────
    // Classification is deterministic — no LLM inference at this stage.
    // Runs for BOTH 'routine' and 'emergency' triggers so that routine ticks
    // with emergency-level readings are correctly upgraded (single source of truth).

    const dustOpacity = (() => {
      const rawOpacity = snap.dustOpacity as number | undefined;
      if (rawOpacity != null) return rawOpacity;
      const stormFactor = snap.dustStormFactor as number | undefined;
      if (stormFactor != null) return (1 - stormFactor) * 5;
      return 0;
    })();
    const solarPct = (() => {
      const gen = (snap.solarGenerationKW as number) ?? 0;
      const cap = 5; // nominal ~5 kW at full solar
      return gen / cap;
    })();
    const co2Level = (snap.co2Level as number) ?? 1000;
    const batteryPct = (() => {
      const charge = (snap.batteryStorageKWh as number) ?? 100;
      const capacity = (snap.batteryCapacityKWh as number) ?? 100;
      return charge / Math.max(1, capacity);
    })();
    const waterRecycling = (snap.waterRecyclingEfficiency as number) ?? 1;
    const nutritionalCoverage = (snap.nutritionalCoverage as number) ?? 1;

    // Severity-1 criteria (critical — hardcoded playbook, no LLM)
    // Solar alone does not constitute sev-1 — require battery also critically low
    // to avoid false positives from nighttime/mild dust transients.
    const solarCritical = solarPct < 0.15 && batteryPct < 0.15;
    const isSev1 =
      dustOpacity > 3.0 ||
      solarCritical ||
      co2Level > 5000 ||
      batteryPct < 0.1;

    if (isSev1) {
      // Build hardcoded playbook actions (spec §3.1 Emergency playbook)
      // Use a map keyed by param to deduplicate conflicting actions.
      // Order: dust → solar → battery → CO₂ (most life-threatening last wins).
      const actionMap = new Map<string, z.infer<typeof ActionSchema>>();
      const reasons: string[] = [];

      if (dustOpacity > 3.0) {
        actionMap.set('ventilationRate', { type: 'greenhouse', param: 'ventilationRate', value: 20 });
        reasons.push('Extreme dust storm (tau > 3.0): sealed vents, filter intakes activated');
      }
      if (solarCritical) {
        actionMap.set('lightingPower', { type: 'greenhouse', param: 'lightingPower', value: 2000 });
        actionMap.set('globalHeatingPower', { type: 'greenhouse', param: 'globalHeatingPower', value: 1500 });
        reasons.push('Solar power < 15% with battery critically low: shedding non-essential loads, switching to battery reserves');
      }
      if (batteryPct < 0.1) {
        actionMap.set('lightingPower', { type: 'greenhouse', param: 'lightingPower', value: 1000 });
        actionMap.set('globalHeatingPower', { type: 'greenhouse', param: 'globalHeatingPower', value: 1000 });
        reasons.push('Battery critically low (<10%): emergency power reduction');
      }
      if (co2Level > 5000) {
        // CO₂ > 5000 ppm is immediately life-threatening — ventilation takes priority
        // over dust sealing since crew asphyxiation is more urgent than dust exposure.
        actionMap.set('ventilationRate', { type: 'greenhouse', param: 'ventilationRate', value: 400 });
        actionMap.set('co2InjectionRate', { type: 'greenhouse', param: 'co2InjectionRate', value: 0 });
        reasons.push('CO₂ breach > 5000 ppm: maximising ventilation, CO₂ injection halted');
      }

      const playbookActions = [...actionMap.values()];

      return {
        triggerType: 'emergency' as const,
        emergencySeverity: 1 as const,
        snapshot,
        missionSol,
        playbookActions,
        playbookReason: reasons.join('; '),
      };
    }

    // Severity-2 criteria (elevated — Survival leads, fast sim)
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

    // No emergency conditions detected — proceed as routine.
    return {
      triggerType: 'routine' as const,
      snapshot,
      missionSol,
    };
  },
});

// ─── Step 2: Dispatch ─────────────────────────────────────────────────────────
// Routes to the right agent based on trigger type. Simple, linear flow:
//   sev-1 → hardcoded playbook (instant, no LLM)
//   crew question → wellbeing agent (conversational answer)
//   crew override → survival safety check, then greenhouse agent
//   everything else → greenhouse agent with structured output

const dispatchStep = createStep({
  id: 'dispatch',
  inputSchema: ClassifyOutputSchema,
  outputSchema: DispatcherOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { triggerType, emergencySeverity, snapshot, crewMessage, missionSol, playbookActions, playbookReason } = inputData;

    const compactSnap = compactSnapshot(snapshot as Record<string, unknown>);
    const compactSnapJson = JSON.stringify(compactSnap, null, 2);
    const crewStatusBlock = crewProfilesForAgent(
      (Array.isArray((snapshot as Record<string, unknown>)?.crew)
        ? (snapshot as Record<string, unknown>).crew
        : INITIAL_CREW_PROFILES) as CrewmateProfile[],
    );
    const secretaryContext = secretaryStore.getAgentContext(5);

    // ── SEV-1 EMERGENCY: Hardcoded playbook, no LLM ──────────────────────

    if (triggerType === 'emergency' && emergencySeverity === 1) {
      const actions = playbookActions ?? [];
      const reason = playbookReason ?? 'Severity-1 emergency: hardcoded playbook executed.';

      secretaryStore.addIncident({
        missionSol,
        emergencyType: reason.split(':')[0],
        severity: 1,
        trigger: reason,
        actionsExecuted: actions.map(a => `${a.type}:${a.param ?? a.crop}=${a.value ?? ''}`),
        systemsAffected: ['power', 'ventilation', 'co2'],
        resolved: false,
      });

      const entry = secretaryStore.addDecision({
        missionSol,
        triggerType: 'emergency_sev1',
        riskScore: 1.0,
        wellbeingScore: 0.5,
        conflictType: 'none',
        winningAgent: 'hardcoded',
        survivalProposalSummary: 'Hardcoded playbook',
        wellbeingProposalSummary: 'Not consulted (severity-1)',
        actionsEnacted: actions,
        reasoning: reason,
      });

      return {
        triggerType: 'emergency_sev1',
        emergencySeverity: 1,
        resolvedActions: actions,
        conflictType: 'none',
        winningAgent: 'hardcoded',
        riskScore: 1.0,
        wellbeingScore: 0.5,
        survivalJustification: reason,
        wellbeingJustification: 'Not consulted — severity-1 emergency',
        reasoning: reason,
        summary: `Emergency — ${reason}`,
        decisionId: entry.id,
      };
    }

    // ── CREW TRIGGER: Wellbeing classifies intent, then route ─────────────

    let crewIntent: string | undefined;
    let crewResponse: string | undefined;

    if (triggerType === 'crew' && crewMessage) {
      const wb = mastra?.getAgent('wellbeingAgent');
      if (wb) {
        try {
          const wResult = await withTimeout(wb.generate(
            [{ role: 'user', content: `[ARBITER_MODE]\nMission sol: ${missionSol}\n\nCurrent greenhouse sensor readings:\n${compactSnapJson}\n\nCrew message: "${crewMessage}"\n\nClassify this message as "question", "request", or "override" and respond accordingly.` }],
            { maxSteps: 1 },
          ));
          const wText = wResult.text ?? '';
          const jsonMatch = wText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            crewIntent = parsed.intent ?? 'question';
            applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
            secretaryStore.addCrewRequest(crewMessage, missionSol);

            // QUESTION → Return answer directly, no greenhouse agent needed
            if (crewIntent === 'question') {
              const answer = parsed.response ?? wText;
              crewResponse = answer;
              const entry = secretaryStore.addDecision({
                missionSol,
                triggerType: 'crew_question',
                riskScore: 0,
                wellbeingScore: parsed.wellbeingScore ?? 0.7,
                conflictType: 'none',
                winningAgent: 'wellbeing',
                survivalProposalSummary: 'Not consulted (question)',
                wellbeingProposalSummary: answer.slice(0, 100),
                actionsEnacted: [],
                reasoning: answer,
              });
              return {
                triggerType: 'crew_question',
                crewIntent: 'question',
                resolvedActions: [],
                conflictType: 'none',
                winningAgent: 'wellbeing',
                riskScore: 0,
                wellbeingScore: parsed.wellbeingScore ?? 0.7,
                survivalJustification: '',
                wellbeingJustification: 'Direct question answered',
                crewResponse: answer,
                reasoning: answer,
                summary: 'Crew question answered',
                decisionId: entry.id,
              };
            }

            // OVERRIDE → Quick survival safety check
            if (crewIntent === 'override') {
              const survival = mastra?.getAgent('survivalAgent');
              if (survival) {
                try {
                  const sResult = await withTimeout(survival.generate(
                    [{ role: 'user', content: `Mission sol: ${missionSol}\n\nGreenhouse:\n${compactSnapJson}\n\nCrew override: "${crewMessage}"\n\nOutput JSON: { "riskScore": number, "veto": boolean, "vetoReason": string }` }],
                    { maxSteps: 1 },
                  ), 30_000);
                  const sText = sResult.text ?? '';
                  const sJson = sText.match(/\{[\s\S]*\}/);
                  if (sJson) {
                    const sp = JSON.parse(sJson[0]);
                    if (sp.veto || (sp.riskScore ?? 0) > 0.85) {
                      secretaryStore.logOverrideAttempt(crewMessage, false, missionSol);
                      const entry = secretaryStore.addDecision({
                        missionSol, triggerType: 'crew_override', riskScore: sp.riskScore ?? 0.9,
                        wellbeingScore: 0.5, conflictType: 'hard_veto', winningAgent: 'survival',
                        survivalProposalSummary: sp.vetoReason ?? 'Veto issued',
                        wellbeingProposalSummary: '', actionsEnacted: [],
                        reasoning: sp.vetoReason ?? 'Override vetoed for safety',
                      });
                      return {
                        triggerType: 'crew_override', crewIntent: 'override',
                        resolvedActions: [], conflictType: 'hard_veto', winningAgent: 'survival',
                        riskScore: sp.riskScore ?? 0.9, wellbeingScore: 0.5,
                        survivalJustification: sp.vetoReason ?? 'Override vetoed',
                        wellbeingJustification: '',
                        crewResponse: `Override denied: ${sp.vetoReason ?? 'Safety concern'}`,
                        reasoning: sp.vetoReason ?? 'Override vetoed',
                        summary: 'Override vetoed', decisionId: entry.id,
                      };
                    }
                    secretaryStore.logOverrideAttempt(crewMessage, true, missionSol);
                  }
                } catch {
                  // Safety check failed/timed out → permit the override, let greenhouse agent handle it
                  secretaryStore.logOverrideAttempt(crewMessage, true, missionSol);
                }
              }
            }

            // REQUEST or permitted OVERRIDE → carry crew context to greenhouse agent below
            crewResponse = parsed.crewResponse;
          }
        } catch (err) {
          console.error('[dispatcher] crew intent classification failed:', err);
          // Fall through to greenhouse agent — treat as routine with crew context
        }
      }
    }

    // ── MAIN PATH: Greenhouse agent with structured output ────────────────
    // Handles: routine ticks, sev-2 emergencies, crew requests, permitted overrides.
    // One agent call, structured output, timeout. No regex JSON parsing.

    const agent = mastra?.getAgent('greenhouseAgent');
    if (!agent) {
      const entry = secretaryStore.addDecision({
        missionSol, triggerType: 'routine', riskScore: 0, wellbeingScore: 0,
        conflictType: 'none', winningAgent: 'none',
        survivalProposalSummary: '', wellbeingProposalSummary: '',
        actionsEnacted: [], reasoning: 'Greenhouse agent unavailable',
      });
      return {
        triggerType: 'routine', resolvedActions: [], conflictType: 'none',
        winningAgent: 'none', riskScore: 0, wellbeingScore: 0,
        survivalJustification: '', wellbeingJustification: '',
        reasoning: 'Greenhouse agent unavailable', summary: 'No agent available',
        decisionId: entry.id,
      };
    }

    const isEmergency = triggerType === 'emergency' && emergencySeverity === 2;
    const triggerLabel = isEmergency
      ? 'EMERGENCY severity-2 — prioritise crew safety, act conservatively'
      : crewMessage ? `Crew ${crewIntent ?? 'request'}: "${crewMessage}"` : 'routine';

    const prompt = `AUTONOMOUS CONTROL TICK — Sol ${missionSol}
Trigger: ${triggerLabel}

${crewStatusBlock}

Recent decisions: ${secretaryContext || 'None yet.'}

Current greenhouse state:
${compactSnapJson}

Decide what actions to take this tick. Use batch-tile for tile operations. If nothing needs changing, return an empty actions array.`;

    try {
      const result = await withTimeout(agent.generate(
        [{ role: 'user', content: prompt }],
        { structuredOutput: { schema: RoutineOutputSchema }, maxSteps: 3 },
      ));

      const output = result.object;
      let actions: z.infer<typeof ActionSchema>[] = [];
      let reasoning = 'Autonomous tick completed';
      let summary = 'Autonomous tick completed';

      if (output && typeof output === 'object' && 'actions' in output) {
        actions = (output.actions ?? []).filter(a => {
          if (a.type === 'harvest' || a.type === 'replant') return !!a.crop;
          if (a.type === 'greenhouse') return !!a.param && a.value !== undefined;
          if (a.type === 'crop') return !!a.crop && !!a.param && a.value !== undefined;
          if (a.type === 'batch-tile') return !!(a.harvests?.length || a.plants?.length || a.clears?.length);
          return false;
        });
        reasoning = output.reasoning ?? reasoning;
        summary = output.summary ?? summary;
      }

      const logType: TriggerType = isEmergency ? 'emergency_sev2'
        : crewIntent ? 'crew_request' : 'routine';

      const entry = secretaryStore.addDecision({
        missionSol, triggerType: logType, riskScore: 0, wellbeingScore: 0,
        conflictType: 'none', winningAgent: 'greenhouse',
        survivalProposalSummary: isEmergency ? 'Handled by greenhouse agent' : '',
        wellbeingProposalSummary: crewIntent ? 'Handled by greenhouse agent' : '',
        actionsEnacted: actions, reasoning,
      });

      // Fire-and-forget: ingest decision into vector store for RAG
      ingestSecretaryReports(Date.now() - 5000).catch(() => {});

      return {
        triggerType: logType,
        emergencySeverity: isEmergency ? 2 : undefined,
        crewIntent,
        resolvedActions: actions,
        conflictType: 'none',
        winningAgent: 'greenhouse',
        riskScore: 0,
        wellbeingScore: 0,
        survivalJustification: isEmergency ? 'Handled by greenhouse agent' : '',
        wellbeingJustification: crewIntent ? 'Handled by greenhouse agent' : '',
        crewResponse,
        reasoning,
        summary: summary || summarizeActions(actions),
        decisionId: entry.id,
      };
    } catch (err) {
      console.error('[dispatcher] greenhouse agent error:', err);
      const entry = secretaryStore.addDecision({
        missionSol, triggerType: 'routine', riskScore: 0, wellbeingScore: 0,
        conflictType: 'none', winningAgent: 'none',
        survivalProposalSummary: '', wellbeingProposalSummary: '',
        actionsEnacted: [], reasoning: `Agent error: ${err instanceof Error ? err.message : 'unknown'}`,
      });
      return {
        triggerType: 'routine', resolvedActions: [], conflictType: 'none',
        winningAgent: 'none', riskScore: 0, wellbeingScore: 0,
        survivalJustification: '', wellbeingJustification: '',
        reasoning: `Agent error: ${err instanceof Error ? err.message : 'unknown'}`,
        summary: 'Agent error — no actions taken',
        decisionId: entry.id,
      };
    }
  },
});

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const dispatcherWorkflow = createWorkflow({
  id: 'dispatcher',
  description: 'Main trigger dispatcher: classify → route to agents → apply arbiter → log via secretary',
  inputSchema: DispatcherInputSchema,
  outputSchema: DispatcherOutputSchema,
})
  .then(classifyStep)
  .then(dispatchStep)
  .commit();
