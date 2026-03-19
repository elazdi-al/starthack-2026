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
import { runSimulation, runBaseline } from '../tools/simulation-engine';
import {
  secretaryStore,
  type TriggerType,
  type ConflictType,
  type WinningAgent,
} from '../../lib/secretary-store';
import { ingestSecretaryReports } from '../tools/secretary-vector-tool';
import { crewProfilesForAgent } from '../../lib/crew-data';

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
  if (actions.length === 0) return 'No actions';

  const parts: string[] = [];

  // Aggregate batch-tile and loose tile actions into counts per crop
  const plantCounts: Record<string, number> = {};
  const harvestCounts: Record<string, number> = {};
  let clearCount = 0;

  for (const a of actions) {
    if (a.type === 'batch-tile') {
      for (const p of a.plants ?? []) {
        plantCounts[p.crop] = (plantCounts[p.crop] ?? 0) + 1;
      }
      harvestCounts['tiles'] = (harvestCounts['tiles'] ?? 0) + (a.harvests?.length ?? 0);
      clearCount += a.clears?.length ?? 0;
    } else if (a.type === 'plant-tile' && a.crop) {
      plantCounts[a.crop] = (plantCounts[a.crop] ?? 0) + 1;
    } else if (a.type === 'harvest-tile') {
      harvestCounts['tiles'] = (harvestCounts['tiles'] ?? 0) + 1;
    } else if (a.type === 'clear-tile') {
      clearCount++;
    } else if (a.type === 'harvest' && a.crop) {
      parts.push(`harvested all ${a.crop}`);
    } else if (a.type === 'replant' && a.crop) {
      parts.push(`replanted all ${a.crop}`);
    } else if (a.type === 'greenhouse' && a.param != null && a.value != null) {
      const label = a.param === 'globalHeatingPower' ? 'heating'
        : a.param === 'lightingPower' ? 'lighting'
        : a.param === 'co2InjectionRate' ? 'CO2 injection'
        : a.param === 'ventilationRate' ? 'ventilation'
        : a.param;
      parts.push(`set ${label} to ${a.value}`);
    } else if (a.type === 'crop' && a.crop && a.param != null && a.value != null) {
      parts.push(`set ${a.crop} ${a.param} to ${a.value}`);
    }
  }

  // Summarize tile operations
  for (const [crop, count] of Object.entries(plantCounts)) {
    parts.push(`planted ${count} ${crop}`);
  }
  const totalHarvests = harvestCounts['tiles'] ?? 0;
  if (totalHarvests > 0) parts.push(`harvested ${totalHarvests} tile${totalHarvests > 1 ? 's' : ''}`);
  if (clearCount > 0) parts.push(`cleared ${clearCount} tile${clearCount > 1 ? 's' : ''}`);

  return parts.join(', ');
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
  /** Only tiles with health < 0.7, bolting, disease > 0.3, or freshly harvested. */
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

  // Extract flagged tiles only (health < 0.7, bolting, disease > 0.3, or harvested with recent yield)
  const flaggedTiles: Record<string, unknown> = {};
  let totalTiles = 0;
  let flaggedCount = 0;
  for (const [tileId, tile] of Object.entries(tileCrops)) {
    totalTiles++;
    const health = (tile.healthScore as number) ?? 1;
    const bolting = (tile.isBolting as boolean) ?? false;
    const disease = (tile.diseaseRisk as number) ?? 0;
    if (health < 0.7 || bolting || disease > 0.3) {
      flaggedTiles[tileId] = tile;
      flaggedCount++;
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
    flaggedTiles,
    tileSummary: `${totalTiles} tiles total, ${flaggedCount} flagged (health<0.7 / bolting / disease>0.3)`,
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

  // Build one-line per crop: name, stage, health, yield
  const cropLines = Object.entries(crops).map(([name, c]) => {
    const health = ((c.healthScore as number) ?? 1).toFixed(2);
    const yieldKg = ((c.estimatedYieldKg as number) ?? 0).toFixed(1);
    return `  ${name}: stage=${c.stage}, health=${health}, yield=${yieldKg}kg, bolting=${c.isBolting ?? false}`;
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
  type: z.enum(['greenhouse', 'crop', 'harvest', 'replant', 'harvest-tile', 'plant-tile', 'clear-tile', 'batch-tile']),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
  tileId: z.string().optional(),
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

// ─── Step 1: Classify ─────────────────────────────────────────────────────────
// Pure function — no LLM. Deterministic severity classification (spec §6.1).

const classifyStep = createStep({
  id: 'classify',
  inputSchema: DispatcherInputSchema,
  outputSchema: ClassifyOutputSchema,
  execute: async ({ inputData }) => {
    const { triggerType, snapshot, crewMessage, missionSol } = inputData;
    const snap = snapshot as Record<string, unknown>;

    if (triggerType !== 'emergency') {
      return {
        triggerType: triggerType as 'routine' | 'emergency' | 'crew',
        snapshot,
        crewMessage,
        missionSol,
      };
    }

    // ── Emergency severity classification (spec §6.1) ──────────────────────
    // Classification is deterministic — no LLM inference at this stage.

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

    // Emergency trigger fired but conditions don't meet severity-1 or severity-2
    // thresholds — downgrade to routine so agents handle it normally.
    return {
      triggerType: 'routine' as const,
      snapshot,
      missionSol,
    };
  },
});

// ─── Step 2: Dispatch ─────────────────────────────────────────────────────────
// Calls the appropriate agent(s), applies Arbiter, returns resolved decision.

const dispatchStep = createStep({
  id: 'dispatch',
  inputSchema: ClassifyOutputSchema,
  outputSchema: DispatcherOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { triggerType, emergencySeverity, snapshot, crewMessage, missionSol, playbookActions, playbookReason } = inputData;

    const survivalAgent = mastra?.getAgent('survivalAgent');
    const wellbeingAgent = mastra?.getAgent('wellbeingAgent');

    // Shared context: inject secretary's decision log for continuity (spec §3.1 inputs)
    const secretaryContext = secretaryStore.getAgentContext(5);
    const crewProfile = secretaryStore.getCrewPreferenceProfile();

    const compactSnap = compactSnapshot(snapshot as Record<string, unknown>);
    const compactSnapJson = JSON.stringify(compactSnap, null, 2);
    const crewStatusBlock = crewProfilesForAgent();
    const contextBlock = `
${crewStatusBlock}

Secretary context (recent decisions and crew state):
${secretaryContext || 'No prior decisions logged.'}

Crew preference profile: ${JSON.stringify(crewProfile.preferences)}
Mission sol: ${missionSol}
`.trim();

    // ── SEVERITY-1 EMERGENCY: Hardcoded playbook, no LLM ──────────────────
    if (triggerType === 'emergency' && emergencySeverity === 1) {
      const actions = playbookActions ?? [];
      const reason = playbookReason ?? 'Severity-1 emergency: hardcoded playbook executed.';

      // Log incident
      secretaryStore.addIncident({
        missionSol,
        emergencyType: reason.split(':')[0],
        severity: 1,
        trigger: reason,
        actionsExecuted: actions.map(a => `${a.type}:${a.param ?? a.crop}=${a.value ?? ''}`),
        systemsAffected: ['power', 'ventilation', 'co2'],
        resolved: false,
      });

      const decisionEntry = secretaryStore.addDecision({
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
        summary: `EMERGENCY: ${summarizeActions(actions)}`,
        decisionId: decisionEntry.id,
      };
    }

    // ── CREW TRIGGER: Classify intent, then route ─────────────────────────
    // Wellbeing state is hoisted so crew-request results can be carried
    // forward into the Both + Arbiter pipeline without a redundant LLM call.
    let crewIntent = 'question';
    let wbScore = 0.7;
    let wbActions: z.infer<typeof ActionSchema>[] = [];
    let wbJustification = '';
    let wbCrewResponse = '';

    if (triggerType === 'crew' && crewMessage) {
      // Classify intent using wellbeing agent
      const intentClassificationPrompt = `[ARBITER_MODE]
${contextBlock}

Current greenhouse sensor readings:
${compactSnapJson}

Crew message: "${crewMessage}"

Classify this message as "question", "request", or "override" and respond accordingly.
For questions: answer directly from the sensor data.
For requests or overrides: classify intent and provide your proposal.`;

      if (wellbeingAgent) {
        try {
          const wResult = await wellbeingAgent.generate(
            [{ role: 'user', content: intentClassificationPrompt }],
            { maxSteps: 1 },
          );
          const wText = wResult.text ?? '';

          // Parse JSON response
          const jsonMatch = wText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              crewIntent = parsed.intent ?? 'question';
              wbScore = parsed.wellbeingScore ?? 0.7;

              // Apply preference updates from any crew interaction
              applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
              secretaryStore.addCrewRequest(crewMessage, missionSol);

              if (crewIntent === 'question') {
                wbCrewResponse = parsed.response ?? wText;
                const decisionEntry = secretaryStore.addDecision({
                  missionSol,
                  triggerType: 'crew_question',
                  riskScore: 0,
                  wellbeingScore: wbScore,
                  conflictType: 'none',
                  winningAgent: 'wellbeing',
                  survivalProposalSummary: 'Not consulted (question)',
                  wellbeingProposalSummary: wbCrewResponse.slice(0, 100),
                  actionsEnacted: [],
                  reasoning: wbCrewResponse,
                });

                return {
                  triggerType: 'crew_question',
                  crewIntent: 'question',
                  resolvedActions: [],
                  conflictType: 'none',
                  winningAgent: 'wellbeing',
                  riskScore: 0,
                  wellbeingScore: wbScore,
                  survivalJustification: '',
                  wellbeingJustification: 'Direct question answered from snapshot',
                  crewResponse: wbCrewResponse,
                  reasoning: wbCrewResponse,
                  summary: wbCrewResponse.slice(0, 150),
                  decisionId: decisionEntry.id,
                };
              }

              // For request or override
              wbActions = parsed.proposal?.actions ?? [];
              wbJustification = parsed.proposal?.justification ?? '';
              wbCrewResponse = parsed.crewResponse ?? '';
              // preferenceUpdates already applied above
            } catch { /* continue with empty proposal */ }
          }
        } catch (err) {
          console.error('[dispatcher] wellbeing agent error:', err);
        }
      }

      // For crew overrides: Survival veto check only
      if (crewIntent === 'override') {
        secretaryStore.logOverrideAttempt(crewMessage, false, missionSol); // optimistic false, update below

        if (survivalAgent) {
          const vetoPrompt = `${digestPreamble('survival')}
${contextBlock}

Current greenhouse sensor readings:
${compactSnapJson}

The crew is attempting an OVERRIDE: "${crewMessage}"
Proposed override actions: ${JSON.stringify(wbActions)}

Evaluate this override. If risk score > 0.85, issue a hard veto with explanation.
Otherwise, permit the override and log it.`;

          try {
            const sResult = await survivalAgent.generate(
              [{ role: 'user', content: vetoPrompt }],
              { maxSteps: 1 },
            );
            const sText = sResult.text ?? '';
            const jsonMatch = sText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const riskScore = parsed.riskScore ?? 0.5;
              const veto = parsed.veto ?? (riskScore > 0.85);

              if (veto) {
                secretaryStore.logOverrideAttempt(crewMessage, false, missionSol);
                const decisionEntry = secretaryStore.addDecision({
                  missionSol,
                  triggerType: 'crew_override',
                  riskScore,
                  wellbeingScore: wbScore,
                  conflictType: 'hard_veto',
                  winningAgent: 'survival',
                  survivalProposalSummary: parsed.vetoReason ?? 'Veto issued',
                  wellbeingProposalSummary: wbJustification,
                  actionsEnacted: [],
                  reasoning: parsed.vetoReason ?? 'Override vetoed for safety',
                });

                return {
                  triggerType: 'crew_override',
                  crewIntent: 'override',
                  resolvedActions: [],
                  conflictType: 'hard_veto',
                  winningAgent: 'survival',
                  riskScore,
                  wellbeingScore: wbScore,
                  survivalJustification: parsed.vetoReason ?? 'Override vetoed',
                  wellbeingJustification: wbJustification,
                  crewResponse: `Override denied: ${parsed.vetoReason ?? 'Safety threshold exceeded.'}`,
                  reasoning: parsed.vetoReason ?? 'Override vetoed for safety',
                  summary: `Override vetoed (risk ${riskScore.toFixed(2)})`,
                  decisionId: decisionEntry.id,
                };
              }

              // Override permitted
              secretaryStore.logOverrideAttempt(crewMessage, true, missionSol);
              const decisionEntry = secretaryStore.addDecision({
                missionSol,
                triggerType: 'crew_override',
                riskScore,
                wellbeingScore: wbScore,
                conflictType: 'none',
                winningAgent: 'wellbeing',
                survivalProposalSummary: `Risk score ${riskScore.toFixed(2)} — permitted`,
                wellbeingProposalSummary: wbJustification,
                actionsEnacted: wbActions,
                reasoning: `Crew override permitted — risk score ${riskScore.toFixed(2)} < 0.85`,
              });

              return {
                triggerType: 'crew_override',
                crewIntent: 'override',
                resolvedActions: wbActions,
                conflictType: 'none',
                winningAgent: 'wellbeing',
                riskScore,
                wellbeingScore: wbScore,
                survivalJustification: `Permitted — risk ${riskScore.toFixed(2)}`,
                wellbeingJustification: wbJustification,
                crewResponse: wbCrewResponse || 'Override approved.',
                reasoning: `Crew override permitted`,
                summary: `Override approved: ${summarizeActions(wbActions)}`,
                decisionId: decisionEntry.id,
              };
            }
          } catch (err) {
            console.error('[dispatcher] survival veto check error:', err);
          }
        }

        // Fallback: permit without survival check
        const decisionEntry = secretaryStore.addDecision({
          missionSol,
          triggerType: 'crew_override',
          riskScore: 0.3,
          wellbeingScore: wbScore,
          conflictType: 'none',
          winningAgent: 'wellbeing',
          survivalProposalSummary: 'No survival check (agent unavailable)',
          wellbeingProposalSummary: wbJustification,
          actionsEnacted: wbActions,
          reasoning: 'Override permitted — survival check unavailable',
        });

        return {
          triggerType: 'crew_override',
          crewIntent: 'override',
          resolvedActions: wbActions,
          conflictType: 'none',
          winningAgent: 'wellbeing',
          riskScore: 0.3,
          wellbeingScore: wbScore,
          survivalJustification: '',
          wellbeingJustification: wbJustification,
          crewResponse: wbCrewResponse || 'Override accepted.',
          reasoning: 'Override permitted',
          summary: `Override accepted: ${summarizeActions(wbActions)}`,
          decisionId: decisionEntry.id,
        };
      }

      // Crew request → fall through to full Both + Arbiter pipeline below.
      // Carry forward the wellbeing result from intent classification to avoid
      // a redundant second wellbeing LLM call (saves 3-8s on the critical path).
    }

    // ── BOTH AGENTS + ARBITER (Routine, Crew Request, Severity-2 Emergency) ──

    // Determine simulation parameters based on trigger type
    const isEmergencySev2 = triggerType === 'emergency' && emergencySeverity === 2;
    const isCrewRequest = triggerType === 'crew';
    const horizonSols = isEmergencySev2 ? 3 : 7;
    const scenarioCount = isEmergencySev2 ? 10 : 100;

    const basePrompt = `
${contextBlock}

Current greenhouse sensor readings:
${compactSnapJson}

${crewMessage ? `Crew message (context for this decision): "${crewMessage}"` : ''}
Mission sol: ${missionSol}
Trigger: ${isEmergencySev2 ? 'EMERGENCY severity-2' : isCrewRequest ? 'crew request' : 'routine'}`;

    // Run both agents in parallel
    let survivalRiskScore = 0.3;
    let survivalActions: z.infer<typeof ActionSchema>[] = [];
    let survivalJustification = 'No proposal';
    let survivalVeto = false;
    let survivalVetoReason = '';

    // For crew requests, reuse the wellbeing result from intent classification above
    // instead of calling the wellbeing agent a second time.
    let arbWbScore = isCrewRequest ? wbScore : 0.7;
    let arbWbActions: z.infer<typeof ActionSchema>[] = isCrewRequest ? wbActions : [];
    let arbWbJustification = isCrewRequest ? wbJustification : 'No proposal';
    let arbWbCrewResponse = isCrewRequest ? wbCrewResponse : '';

    // For crew requests, only run survival (wellbeing already done).
    // For routine/sev-2, run both in parallel.
    // Use maxSteps: 1 — agents get full context in the prompt and don't need
    // tool calls in dispatcher mode. This eliminates the KB round-trip (~2-4s).
    const agentCalls: Promise<unknown>[] = [
      survivalAgent?.generate(
        [{ role: 'user', content: `${digestPreamble('survival')}${basePrompt}\n\nProvide your risk assessment and conservative action proposal.` }],
        { maxSteps: 1 },
      ) ?? Promise.resolve(null),
    ];
    if (!isCrewRequest) {
      agentCalls.push(
        wellbeingAgent?.generate(
          [{ role: 'user', content: `[ARBITER_MODE]\n${digestPreamble('wellbeing')}${basePrompt}\n\nProvide your wellbeing assessment and crew-centred action proposal.` }],
          { maxSteps: 1 },
        ) ?? Promise.resolve(null),
      );
    }

    const agentResults = await Promise.allSettled(agentCalls);
    const survivalResult = agentResults[0];
    const wellbeingResult = agentResults[1]; // undefined for crew requests

    // Parse survival agent output
    if (survivalResult.status === 'fulfilled' && survivalResult.value) {
      const sText = (survivalResult.value as { text?: string }).text ?? '';
      const jsonMatch = sText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          survivalRiskScore = parsed.riskScore ?? 0.3;
          survivalActions = parsed.proposal?.actions ?? [];
          survivalJustification = parsed.proposal?.justification ?? sText.slice(0, 200);
          survivalVeto = parsed.veto ?? (survivalRiskScore > 0.85);
          survivalVetoReason = parsed.vetoReason ?? '';
        } catch { survivalJustification = sText.slice(0, 200); }
      } else {
        survivalJustification = (survivalResult.value as { text?: string }).text?.slice(0, 200) ?? 'No proposal';
      }
    }

    // Parse wellbeing agent output (only for non-crew-request paths)
    if (!isCrewRequest && wellbeingResult?.status === 'fulfilled' && wellbeingResult.value) {
      const wText = (wellbeingResult.value as { text?: string }).text ?? '';
      const jsonMatch = wText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          arbWbScore = parsed.wellbeingScore ?? 0.7;
          arbWbActions = parsed.proposal?.actions ?? [];
          arbWbJustification = parsed.proposal?.justification ?? wText.slice(0, 200);
          arbWbCrewResponse = parsed.crewResponse ?? '';
          applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
        } catch { arbWbJustification = wText.slice(0, 200); }
      } else {
        arbWbJustification = wText.slice(0, 200);
      }
    }

    // ── SAFETY NET: Hard veto bypasses Arbiter entirely ──────────────────
    // Risk > 0.85 is unconditional — no deliberation, no hybrid possible.

    let conflictType: ConflictType = 'none';
    let winningAgent: WinningAgent = 'both';
    let resolvedActions: z.infer<typeof ActionSchema>[] = [];
    let simulationP10: number | undefined;
    let simulationP90: number | undefined;
    let arbiterReasoning = '';
    let arbiterSummary = '';

    if (survivalVeto || survivalRiskScore > 0.85) {
      conflictType = 'hard_veto';
      winningAgent = 'survival';
      resolvedActions = survivalActions;
      arbWbCrewResponse = survivalVetoReason
        ? `⚠️ Mission commander veto: ${survivalVetoReason}`
        : `⚠️ Safety threshold exceeded — survival plan enacted.`;
      arbiterReasoning = `Hard veto invoked (risk ${survivalRiskScore.toFixed(2)} > 0.85). Survival plan enacted without deliberation. ${survivalVetoReason}`;

    } else if (survivalRiskScore < 0.5 && !isEmergencySev2) {
      // ── FAST PATH: Agents agree, low risk — skip Arbiter entirely ───────
      // When risk is below 0.5 and it's not an emergency, there's no conflict
      // to resolve. Merge both proposals and proceed without a Sonnet call.
      const mergedMap = new Map<string, z.infer<typeof ActionSchema>>();
      for (const a of survivalActions) mergedMap.set(`${a.type}:${a.param ?? a.crop ?? 'tile'}`, a);
      for (const a of arbWbActions) {
        const key = `${a.type}:${a.param ?? a.crop ?? 'tile'}`;
        if (!mergedMap.has(key)) mergedMap.set(key, a);
      }
      resolvedActions = [...mergedMap.values()];
      conflictType = 'none';
      winningAgent = 'both';
      arbiterReasoning = `Low risk (${survivalRiskScore.toFixed(2)}) — agents agreed, arbiter skipped.`;

    } else {
      // ── Run simulations before calling Arbiter so it has the data ────────
      let simSurvivalResult: { p10YieldKg: number; p90YieldKg: number } | undefined;
      let simWellbeingResult: { p10YieldKg: number; p90YieldKg: number } | undefined;

      // Always run sim for sev-2 emergency; run for both proposals when risk is elevated
      const shouldSim = isEmergencySev2 || survivalRiskScore >= 0.5;
      if (shouldSim) {
        const [ss, sw] = await Promise.all([
          Promise.resolve(runSimulation({ snapshot, proposedActions: survivalActions, horizonSols, scenarioCount })),
          isEmergencySev2
            ? Promise.resolve(null) // sev-2: only sim survival plan
            : Promise.resolve(runSimulation({ snapshot, proposedActions: arbWbActions, horizonSols, scenarioCount })),
        ]);
        simSurvivalResult = ss;
        simWellbeingResult = sw ?? undefined;
        simulationP10 = ss.p10YieldKg;
        simulationP90 = ss.p90YieldKg;
      }

      // ── Call Arbiter agent ─────────────────────────────────────────────
      const arbiterAgent = mastra?.getAgent('arbiterAgent');
      const missionPhase =
        missionSol > 350 ? 'late (sols 350+) — crew morale weight increases to 50/50' :
        missionSol > 100 ? `mid (sol ${missionSol}) — 60/40 survival/wellbeing balance` :
        `early (sol ${missionSol}) — 70/30 bias toward survivability`;

      const arbiterPrompt = `${digestPreamble('arbiter')}
MISSION PHASE: ${missionPhase}
TRIGGER: ${isEmergencySev2 ? 'EMERGENCY severity-2' : isCrewRequest ? 'crew request' : 'routine'}

SECRETARY CONTEXT (recent mission history):
${secretaryContext || 'No prior decisions.'}

CURRENT GREENHOUSE STATE:
${envSummaryForArbiter(snapshot as Record<string, unknown>)}
${crewMessage ? `\nCREW MESSAGE: "${crewMessage}"` : ''}

SURVIVAL AGENT BRIEF:
Risk score: ${survivalRiskScore.toFixed(3)}
Justification: ${survivalJustification}
Proposed actions: ${JSON.stringify(survivalActions, null, 2)}

WELLBEING AGENT BRIEF:
Wellbeing score: ${arbWbScore.toFixed(3)}
Justification: ${arbWbJustification}
Proposed actions: ${JSON.stringify(arbWbActions, null, 2)}
${arbWbCrewResponse ? `Crew-facing message from Wellbeing: "${arbWbCrewResponse}"` : ''}

SIMULATION RESULTS (P10 = worst-case 10th percentile):
${simSurvivalResult ? `Survival plan — P10: ${simSurvivalResult.p10YieldKg.toFixed(2)} kg, P90: ${simSurvivalResult.p90YieldKg.toFixed(2)} kg` : 'Survival plan: not simulated'}
${simWellbeingResult ? `Wellbeing plan — P10: ${simWellbeingResult.p10YieldKg.toFixed(2)} kg, P90: ${simWellbeingResult.p90YieldKg.toFixed(2)} kg` : isEmergencySev2 ? 'Wellbeing plan: not consulted (emergency)' : 'Wellbeing plan: not simulated (low risk)'}

Make your decision. You may propose a hybrid. Remember: risk > 0.85 = unconditional survival veto (already checked — not applicable here).`.trim();

      if (arbiterAgent) {
        try {
          const arbiterResult = await arbiterAgent.generate(
            [{ role: 'user', content: arbiterPrompt }],
            { maxSteps: 1 },
          );
          const aText = arbiterResult.text ?? '';
          const jsonMatch = aText.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            conflictType = (parsed.conflictType as ConflictType) ?? 'none';
            arbiterReasoning = parsed.reasoning ?? aText.slice(0, 400);
            if (parsed.crewMessage) arbWbCrewResponse = parsed.crewMessage;

            // Resolve actions based on Arbiter decision
            const rawActions: z.infer<typeof ActionSchema>[] = parsed.actions ?? [];
            winningAgent =
              parsed.decision === 'hybrid' ? 'arbiter' :
              parsed.decision === 'survival' ? 'survival' :
              parsed.decision === 'wellbeing' ? 'wellbeing' : 'both';

            // Use Arbiter's actions if provided and non-empty, else fall back to chosen agent
            if (rawActions.length > 0) {
              resolvedActions = rawActions;
            } else if (winningAgent === 'survival') {
              resolvedActions = survivalActions;
            } else if (winningAgent === 'wellbeing') {
              resolvedActions = arbWbActions;
            } else {
              // Fallback merge for agreement
              const mergedMap = new Map<string, z.infer<typeof ActionSchema>>();
              for (const a of survivalActions) mergedMap.set(`${a.type}:${a.param ?? a.crop}`, a);
              for (const a of arbWbActions) {
                const key = `${a.type}:${a.param ?? a.crop}`;
                if (!mergedMap.has(key)) mergedMap.set(key, a);
              }
              resolvedActions = [...mergedMap.values()];
            }

            if (simSurvivalResult) simulationP10 = simSurvivalResult.p10YieldKg;
            if (simSurvivalResult) simulationP90 = simSurvivalResult.p90YieldKg;
          } else {
            // Arbiter returned plain text — use it as reasoning, fall back to survival plan
            arbiterReasoning = aText.slice(0, 400);
            winningAgent = 'survival';
            resolvedActions = survivalActions;
            conflictType = 'none';
          }
        } catch (err) {
          console.error('[dispatcher] arbiter agent error:', err);
          // Fallback: survival plan on error
          winningAgent = 'survival';
          resolvedActions = survivalActions;
          arbiterReasoning = `Arbiter error — defaulting to survival plan. ${err instanceof Error ? err.message : ''}`;
        }
      } else {
        // No arbiter available — deterministic fallback
        winningAgent = survivalRiskScore >= 0.5 ? 'survival' : 'both';
        resolvedActions = survivalRiskScore >= 0.5 ? survivalActions : [...survivalActions, ...arbWbActions];
        arbiterReasoning = 'Arbiter unavailable — deterministic fallback applied.';
      }
    }

    // Filter to valid actions only
    resolvedActions = resolvedActions.filter(a => {
      if (a.type === 'harvest' || a.type === 'replant') return !!a.crop;
      if (a.type === 'greenhouse') return !!a.param && a.value !== undefined;
      if (a.type === 'crop') return !!a.crop && !!a.param && a.value !== undefined;
      if (a.type === 'harvest-tile') return !!a.tileId;
      if (a.type === 'plant-tile') return !!a.tileId && !!a.crop;
      if (a.type === 'clear-tile') return !!a.tileId;
      if (a.type === 'batch-tile') return !!(a.harvests?.length || a.plants?.length || a.clears?.length);
      return false;
    });

    // ── SECRETARY LOGGING ──────────────────────────────────────────────────

    const logTriggerType: TriggerType = isEmergencySev2 ? 'emergency_sev2'
      : isCrewRequest ? 'crew_request'
      : 'routine';

    const decisionEntry = secretaryStore.addDecision({
      missionSol,
      triggerType: logTriggerType,
      riskScore: survivalRiskScore,
      wellbeingScore: arbWbScore,
      conflictType,
      winningAgent,
      survivalProposalSummary: survivalJustification.slice(0, 150),
      wellbeingProposalSummary: arbWbJustification.slice(0, 150),
      actionsEnacted: resolvedActions,
      simulationP10,
      simulationP90,
      reasoning: arbiterReasoning,
    });

    // Fire-and-forget: ingest latest decision into vector store for RAG
    ingestSecretaryReports(Date.now() - 5000).catch(err =>
      console.warn('[dispatcher] vector ingestion failed (non-blocking):', err),
    );

    return {
      triggerType: logTriggerType,
      emergencySeverity,
      crewIntent: isCrewRequest ? 'request' : undefined,
      resolvedActions,
      conflictType,
      winningAgent,
      riskScore: survivalRiskScore,
      wellbeingScore: arbWbScore,
      survivalJustification,
      wellbeingJustification: arbWbJustification,
      crewResponse: arbWbCrewResponse || undefined,
      simulationP10,
      simulationP90,
      reasoning: arbiterReasoning,
      summary: conflictType === 'hard_veto'
        ? `Safety veto (risk ${survivalRiskScore.toFixed(2)}): ${summarizeActions(resolvedActions)}`
        : conflictType === 'soft_conflict'
        ? `Conflict resolved (${winningAgent}): ${summarizeActions(resolvedActions)}`
        : isEmergencySev2
        ? `Severity-2 emergency: ${summarizeActions(resolvedActions)}`
        : summarizeActions(resolvedActions),
      decisionId: decisionEntry.id,
    };
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
