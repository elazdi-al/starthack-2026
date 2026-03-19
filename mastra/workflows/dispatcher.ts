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

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ActionSchema = z.object({
  type: z.enum(['greenhouse', 'crop', 'harvest', 'replant']),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
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
      const intentClassificationPrompt = `
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

              if (crewIntent === 'question') {
                crewResponse = parsed.response ?? wText;
                // Log to secretary intent log and return immediately
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

                // Update secretary crew profile
                secretaryStore.addCrewRequest(crewMessage, missionSol);

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
          const vetoPrompt = `
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
        [{ role: 'user', content: `${basePrompt}\n\nProvide your risk assessment and conservative action proposal.` }],
        { maxSteps: isEmergencySev2 ? 2 : 5 },
      ),
      wellbeingAgent?.generate(
        [{ role: 'user', content: `${basePrompt}\n\nProvide your wellbeing assessment and crew-centred action proposal.` }],
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

    // Parse wellbeing agent output (only if not sev2 emergency)
    if (!isEmergencySev2 && wellbeingResult.status === 'fulfilled' && wellbeingResult.value) {
      const wText = wellbeingResult.value.text ?? '';
      const jsonMatch = wText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          wellbeingScore = parsed.wellbeingScore ?? 0.7;
          wellbeingActions = parsed.proposal?.actions ?? [];
          wellbeingJustification = parsed.proposal?.justification ?? wText.slice(0, 200);
          crewResponseText = parsed.crewResponse ?? '';
        } catch { wellbeingJustification = wText.slice(0, 200); }
      } else {
        wellbeingJustification = wText.slice(0, 200);
      }
    }

    // ── ARBITER LAYER (spec §4) ────────────────────────────────────────────

    let conflictType: ConflictType = 'none';
    let winningAgent: WinningAgent = 'both';
    let resolvedActions: z.infer<typeof ActionSchema>[] = [];
    let simulationP10: number | undefined;
    let simulationP90: number | undefined;

    // Hard veto check (spec §4.1 row 3)
    if (survivalVeto || survivalRiskScore > 0.85) {
      conflictType = 'hard_veto';
      winningAgent = 'survival';
      resolvedActions = survivalActions;
      crewResponseText = survivalVetoReason
        ? `⚠️ Survival agent veto: ${survivalVetoReason}`
        : `⚠️ Safety threshold exceeded — survival plan enacted.`;

    } else if (isEmergencySev2) {
      // Severity-2: Survival leads, Wellbeing not consulted
      conflictType = 'none';
      winningAgent = 'survival';
      resolvedActions = survivalActions;

      // Run fast simulation to validate survival actions vs. baseline
      const simResult = runSimulation({
        snapshot,
        proposedActions: survivalActions,
        horizonSols,
        scenarioCount,
      });
      simulationP10 = simResult.p10YieldKg;
      simulationP90 = simResult.p90YieldKg;

    } else {
      // Check for agreement (both proposals compatible)
      // Simple heuristic: same top-level action types
      const survivalParamSet = new Set(survivalActions.map(a => `${a.type}:${a.param ?? a.crop}`));
      const wellbeingParamSet = new Set(wellbeingActions.map(a => `${a.type}:${a.param ?? a.crop}`));
      const intersection = [...survivalParamSet].filter(k => wellbeingParamSet.has(k));
      const proposalsCompatible = intersection.length > 0 || wellbeingActions.length === 0;

      if (proposalsCompatible || survivalRiskScore < 0.5) {
        // Agreement or low risk: merge both proposal sets (spec §4.1 row 1)
        conflictType = 'agreement';
        winningAgent = 'both';
        // Merge: start with survival actions, add wellbeing actions that don't conflict
        const mergedMap = new Map<string, z.infer<typeof ActionSchema>>();
        for (const a of survivalActions) mergedMap.set(`${a.type}:${a.param ?? a.crop}`, a);
        for (const a of wellbeingActions) {
          const key = `${a.type}:${a.param ?? a.crop}`;
          if (!mergedMap.has(key)) mergedMap.set(key, a); // wellbeing fills gaps
        }
        resolvedActions = [...mergedMap.values()];

      } else {
        // Soft conflict (risk 0.5–0.85): run simulation on both, pick safer P10 tail (spec §4.1 row 2)
        conflictType = 'soft_conflict';

        const simSurvival = runSimulation({
          snapshot,
          proposedActions: survivalActions,
          horizonSols,
          scenarioCount,
        });
        const simWellbeing = runSimulation({
          snapshot,
          proposedActions: wellbeingActions,
          horizonSols,
          scenarioCount,
        });

        // Mission phase weighting (spec §4.2)
        // Early (1–100): 70/30, Mid (100–350): 60/40, Late (350+): 50/50
        const wellbeingWeight =
          missionSol > 350 ? 0.50 :
          missionSol > 100 ? 0.40 : 0.30;
        const survivalWeight = 1 - wellbeingWeight;

        // Weighted P10 comparison
        const survivalScore = simSurvival.p10YieldKg * survivalWeight + simSurvival.p90YieldKg * wellbeingWeight;
        const wellbeingScore2 = simWellbeing.p10YieldKg * survivalWeight + simWellbeing.p90YieldKg * wellbeingWeight;

        if (survivalScore >= wellbeingScore2) {
          winningAgent = 'survival';
          resolvedActions = survivalActions;
          simulationP10 = simSurvival.p10YieldKg;
          simulationP90 = simSurvival.p90YieldKg;
        } else {
          winningAgent = 'wellbeing';
          resolvedActions = wellbeingActions;
          simulationP10 = simWellbeing.p10YieldKg;
          simulationP90 = simWellbeing.p90YieldKg;
        }
      }
    }

    // Filter to valid actions only
    resolvedActions = resolvedActions.filter(a => {
      if (a.type === 'harvest' || a.type === 'replant') return !!a.crop;
      if (a.type === 'greenhouse') return !!a.param && a.value !== undefined;
      if (a.type === 'crop') return !!a.crop && !!a.param && a.value !== undefined;
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
      reasoning: `${conflictType} — ${winningAgent} agent won. Risk: ${survivalRiskScore.toFixed(2)}, Wellbeing: ${wellbeingScore.toFixed(2)}`,
    });

    const summary = conflictType === 'hard_veto'
      ? `⚠️ Hard veto (risk ${survivalRiskScore.toFixed(2)}) — survival plan enacted`
      : conflictType === 'soft_conflict'
      ? `Soft conflict resolved via simulation — ${winningAgent} plan selected (P10: ${simulationP10?.toFixed(1)} kg)`
      : `${resolvedActions.length} action(s) enacted — ${conflictType}`;

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
      reasoning: `Survival: ${survivalJustification.slice(0, 100)} | Wellbeing: ${wellbeingJustification.slice(0, 100)}`,
      summary,
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
