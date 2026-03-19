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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a performance digest as a prompt preamble block. Returns empty string if no digest. */
function digestPreamble(agentName: 'survival' | 'wellbeing' | 'arbiter'): string {
  const digests = secretaryStore.getPerformanceDigests();
  if (!digests) return '';
  const text = digests[agentName];
  return `[PERFORMANCE DIGEST — calibration signal from Secretary, last 10 sols]\n${text}\n`;
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

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ActionSchema = z.object({
  type: z.enum(['greenhouse', 'crop', 'harvest', 'replant', 'harvest-tile', 'plant-tile', 'clear-tile']),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
  tileId: z.string().optional(),
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

    const dustOpacity = (snap.dustOpacity as number) ?? (snap.dustStormFactor as number) ? (1 - (snap.dustStormFactor as number)) * 5 : 0;
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
      const playbookActions: z.infer<typeof ActionSchema>[] = [];
      const reasons: string[] = [];

      if (dustOpacity > 3.0) {
        playbookActions.push({ type: 'greenhouse', param: 'ventilationRate', value: 20 });
        reasons.push('Extreme dust storm (tau > 3.0): sealed vents, filter intakes activated');
      }
      if (solarCritical) {
        playbookActions.push({ type: 'greenhouse', param: 'lightingPower', value: 2000 });
        playbookActions.push({ type: 'greenhouse', param: 'globalHeatingPower', value: 1500 });
        reasons.push('Solar power < 15% with battery critically low: shedding non-essential loads, switching to battery reserves');
      }
      if (co2Level > 5000) {
        playbookActions.push({ type: 'greenhouse', param: 'ventilationRate', value: 400 });
        playbookActions.push({ type: 'greenhouse', param: 'co2InjectionRate', value: 0 });
        reasons.push('CO₂ breach > 5000 ppm: maximising ventilation, CO₂ injection halted');
      }
      if (batteryPct < 0.1) {
        playbookActions.push({ type: 'greenhouse', param: 'lightingPower', value: 1000 });
        playbookActions.push({ type: 'greenhouse', param: 'globalHeatingPower', value: 1000 });
        reasons.push('Battery critically low (<10%): emergency power reduction');
      }

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

    return {
      triggerType: 'emergency' as const,
      emergencySeverity: 2 as const,
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

    const snapshotJson = JSON.stringify(snapshot, null, 2);
    const contextBlock = `
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
      const incident = secretaryStore.addIncident({
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
        summary: `⚠️ EMERGENCY (severity 1): ${reason}`,
        decisionId: decisionEntry.id,
      };
    }

    // ── CREW QUESTION: Wellbeing only, direct answer from snapshot ─────────
    if (triggerType === 'crew' && crewMessage) {
      // First classify intent using wellbeing agent
      const intentClassificationPrompt = `[ARBITER_MODE]
${contextBlock}

Current greenhouse sensor readings:
${snapshotJson}

Crew message: "${crewMessage}"

Classify this message as "question", "request", or "override" and respond accordingly.
For questions: answer directly from the sensor data.
For requests or overrides: classify intent and provide your proposal.`;

      let crewIntent = 'question';
      let crewResponse = '';
      let wellbeingScore = 0.7;
      let wellbeingProposal: z.infer<typeof ActionSchema>[] = [];
      let wellbeingJustification = '';

      if (wellbeingAgent) {
        try {
          const wResult = await wellbeingAgent.generate(
            [{ role: 'user', content: intentClassificationPrompt }],
            { maxSteps: 3 },
          );
          const wText = wResult.text ?? '';

          // Parse JSON response
          const jsonMatch = wText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              crewIntent = parsed.intent ?? 'question';
              wellbeingScore = parsed.wellbeingScore ?? 0.7;

              // Apply preference updates from any crew interaction
              applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
              secretaryStore.addCrewRequest(crewMessage, missionSol);

              if (crewIntent === 'question') {
                crewResponse = parsed.response ?? wText;
                const decisionEntry = secretaryStore.addDecision({
                  missionSol,
                  triggerType: 'crew_question',
                  riskScore: 0,
                  wellbeingScore,
                  conflictType: 'none',
                  winningAgent: 'wellbeing',
                  survivalProposalSummary: 'Not consulted (question)',
                  wellbeingProposalSummary: crewResponse.slice(0, 100),
                  actionsEnacted: [],
                  reasoning: crewResponse,
                });

                return {
                  triggerType: 'crew_question',
                  crewIntent: 'question',
                  resolvedActions: [],
                  conflictType: 'none',
                  winningAgent: 'wellbeing',
                  riskScore: 0,
                  wellbeingScore,
                  survivalJustification: '',
                  wellbeingJustification: 'Direct question answered from snapshot',
                  crewResponse,
                  reasoning: crewResponse,
                  summary: crewResponse.slice(0, 150),
                  decisionId: decisionEntry.id,
                };
              }

              // For request or override
              wellbeingProposal = parsed.proposal?.actions ?? [];
              wellbeingJustification = parsed.proposal?.justification ?? '';
              crewResponse = parsed.crewResponse ?? '';
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
${snapshotJson}

The crew is attempting an OVERRIDE: "${crewMessage}"
Proposed override actions: ${JSON.stringify(wellbeingProposal)}

Evaluate this override. If risk score > 0.85, issue a hard veto with explanation.
Otherwise, permit the override and log it.`;

          try {
            const sResult = await survivalAgent.generate(
              [{ role: 'user', content: vetoPrompt }],
              { maxSteps: 3 },
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
                  wellbeingScore,
                  conflictType: 'hard_veto',
                  winningAgent: 'survival',
                  survivalProposalSummary: parsed.vetoReason ?? 'Veto issued',
                  wellbeingProposalSummary: wellbeingJustification,
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
                  wellbeingScore,
                  survivalJustification: parsed.vetoReason ?? 'Override vetoed',
                  wellbeingJustification,
                  crewResponse: `Override denied: ${parsed.vetoReason ?? 'Safety threshold exceeded.'}`,
                  reasoning: parsed.vetoReason ?? 'Override vetoed for safety',
                  summary: `Override vetoed — risk score ${riskScore.toFixed(2)} > 0.85`,
                  decisionId: decisionEntry.id,
                };
              }

              // Override permitted
              secretaryStore.logOverrideAttempt(crewMessage, true, missionSol);
              const decisionEntry = secretaryStore.addDecision({
                missionSol,
                triggerType: 'crew_override',
                riskScore,
                wellbeingScore,
                conflictType: 'none',
                winningAgent: 'wellbeing',
                survivalProposalSummary: `Risk score ${riskScore.toFixed(2)} — permitted`,
                wellbeingProposalSummary: wellbeingJustification,
                actionsEnacted: wellbeingProposal,
                reasoning: `Crew override permitted — risk score ${riskScore.toFixed(2)} < 0.85`,
              });

              return {
                triggerType: 'crew_override',
                crewIntent: 'override',
                resolvedActions: wellbeingProposal,
                conflictType: 'none',
                winningAgent: 'wellbeing',
                riskScore,
                wellbeingScore,
                survivalJustification: `Permitted — risk ${riskScore.toFixed(2)}`,
                wellbeingJustification,
                crewResponse: crewResponse || 'Override approved.',
                reasoning: `Crew override permitted`,
                summary: `Override approved — risk score ${riskScore.toFixed(2)}`,
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
          wellbeingScore,
          conflictType: 'none',
          winningAgent: 'wellbeing',
          survivalProposalSummary: 'No survival check (agent unavailable)',
          wellbeingProposalSummary: wellbeingJustification,
          actionsEnacted: wellbeingProposal,
          reasoning: 'Override permitted — survival check unavailable',
        });

        return {
          triggerType: 'crew_override',
          crewIntent: 'override',
          resolvedActions: wellbeingProposal,
          conflictType: 'none',
          winningAgent: 'wellbeing',
          riskScore: 0.3,
          wellbeingScore,
          survivalJustification: '',
          wellbeingJustification,
          crewResponse: crewResponse || 'Override accepted.',
          reasoning: 'Override permitted',
          summary: 'Crew override accepted',
          decisionId: decisionEntry.id,
        };
      }

      // Crew request → fall through to full Both + Arbiter pipeline below
      // (handled by mini routine cycle)
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
${snapshotJson}

${crewMessage ? `Crew message (context for this decision): "${crewMessage}"` : ''}
Mission sol: ${missionSol}
Trigger: ${isEmergencySev2 ? 'EMERGENCY severity-2' : isCrewRequest ? 'crew request' : 'routine'}`;

    // Run both agents in parallel
    let survivalRiskScore = 0.3;
    let survivalActions: z.infer<typeof ActionSchema>[] = [];
    let survivalJustification = 'No proposal';
    let survivalVeto = false;
    let survivalVetoReason = '';

    let wellbeingScore = 0.7;
    let wellbeingActions: z.infer<typeof ActionSchema>[] = [];
    let wellbeingJustification = 'No proposal';
    let crewResponseText = '';

    const [survivalResult, wellbeingResult] = await Promise.allSettled([
      survivalAgent?.generate(
        [{ role: 'user', content: `${digestPreamble('survival')}${basePrompt}\n\nProvide your risk assessment and conservative action proposal.` }],
        { maxSteps: isEmergencySev2 ? 2 : 5 },
      ),
      wellbeingAgent?.generate(
        [{ role: 'user', content: `[ARBITER_MODE]\n${digestPreamble('wellbeing')}${basePrompt}\n\nProvide your wellbeing assessment and crew-centred action proposal.` }],
        { maxSteps: isEmergencySev2 ? 2 : 5 },
        // Memory only for crew-facing interactions
      ),
    ]);

    // Parse survival agent output
    if (survivalResult.status === 'fulfilled' && survivalResult.value) {
      const sText = survivalResult.value.text ?? '';
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
        survivalJustification = sText.slice(0, 200);
      }
    }

    // Parse wellbeing agent output
    if (wellbeingResult.status === 'fulfilled' && wellbeingResult.value) {
      const wText = wellbeingResult.value.text ?? '';
      const jsonMatch = wText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          wellbeingScore = parsed.wellbeingScore ?? 0.7;
          wellbeingActions = parsed.proposal?.actions ?? [];
          wellbeingJustification = parsed.proposal?.justification ?? wText.slice(0, 200);
          crewResponseText = parsed.crewResponse ?? '';
          applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
        } catch { wellbeingJustification = wText.slice(0, 200); }
      } else {
        wellbeingJustification = wText.slice(0, 200);
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

    if (survivalVeto || survivalRiskScore > 0.85) {
      conflictType = 'hard_veto';
      winningAgent = 'survival';
      resolvedActions = survivalActions;
      crewResponseText = survivalVetoReason
        ? `⚠️ Mission commander veto: ${survivalVetoReason}`
        : `⚠️ Safety threshold exceeded — survival plan enacted.`;
      arbiterReasoning = `Hard veto invoked (risk ${survivalRiskScore.toFixed(2)} > 0.85). Survival plan enacted without deliberation. ${survivalVetoReason}`;

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
            : Promise.resolve(runSimulation({ snapshot, proposedActions: wellbeingActions, horizonSols, scenarioCount })),
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
${snapshotJson}
${crewMessage ? `\nCREW MESSAGE: "${crewMessage}"` : ''}

SURVIVAL AGENT BRIEF:
Risk score: ${survivalRiskScore.toFixed(3)}
Justification: ${survivalJustification}
Proposed actions: ${JSON.stringify(survivalActions, null, 2)}

WELLBEING AGENT BRIEF:
Wellbeing score: ${wellbeingScore.toFixed(3)}
Justification: ${wellbeingJustification}
Proposed actions: ${JSON.stringify(wellbeingActions, null, 2)}
${crewResponseText ? `Crew-facing message from Wellbeing: "${crewResponseText}"` : ''}

SIMULATION RESULTS (P10 = worst-case 10th percentile):
${simSurvivalResult ? `Survival plan — P10: ${simSurvivalResult.p10YieldKg.toFixed(2)} kg, P90: ${simSurvivalResult.p90YieldKg.toFixed(2)} kg` : 'Survival plan: not simulated'}
${simWellbeingResult ? `Wellbeing plan — P10: ${simWellbeingResult.p10YieldKg.toFixed(2)} kg, P90: ${simWellbeingResult.p90YieldKg.toFixed(2)} kg` : isEmergencySev2 ? 'Wellbeing plan: not consulted (emergency)' : 'Wellbeing plan: not simulated (low risk)'}

Make your decision. You may propose a hybrid. Remember: risk > 0.85 = unconditional survival veto (already checked — not applicable here).`.trim();

      if (arbiterAgent) {
        try {
          const arbiterResult = await arbiterAgent.generate(
            [{ role: 'user', content: arbiterPrompt }],
            { maxSteps: 3 },
          );
          const aText = arbiterResult.text ?? '';
          const jsonMatch = aText.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            conflictType = (parsed.conflictType as ConflictType) ?? 'none';
            arbiterReasoning = parsed.reasoning ?? aText.slice(0, 400);
            if (parsed.crewMessage) crewResponseText = parsed.crewMessage;

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
              resolvedActions = wellbeingActions;
            } else {
              // Fallback merge for agreement
              const mergedMap = new Map<string, z.infer<typeof ActionSchema>>();
              for (const a of survivalActions) mergedMap.set(`${a.type}:${a.param ?? a.crop}`, a);
              for (const a of wellbeingActions) {
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
        resolvedActions = survivalRiskScore >= 0.5 ? survivalActions : [...survivalActions, ...wellbeingActions];
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
      wellbeingScore,
      conflictType,
      winningAgent,
      survivalProposalSummary: survivalJustification.slice(0, 150),
      wellbeingProposalSummary: wellbeingJustification.slice(0, 150),
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
      wellbeingScore,
      survivalJustification,
      wellbeingJustification,
      crewResponse: crewResponseText || undefined,
      simulationP10,
      simulationP90,
      reasoning: arbiterReasoning,
      summary: conflictType === 'hard_veto'
        ? `Safety veto (risk ${survivalRiskScore.toFixed(2)}) — survival plan enacted`
        : conflictType === 'soft_conflict'
        ? `Conflict resolved — ${winningAgent} plan selected`
        : isEmergencySev2
        ? `Severity-2 emergency — ${resolvedActions.length} action(s) enacted`
        : `${resolvedActions.length} action(s) enacted — agents agreed`,
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
