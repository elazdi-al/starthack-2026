/**
 * Agent-tick endpoint — autonomous control loop entry point
 *
 * Routes every tick through the dispatcher workflow, which:
 * 1. Classifies the trigger type (emergency/routine/crew)
 * 2. Routes to the appropriate agent pipeline (Survival, Wellbeing, or both)
 * 3. Applies the Arbiter for conflict resolution
 * 4. Logs the decision via the Secretary
 *
 * Emergency classification is deterministic (no LLM).
 * Severity-1 emergencies use hardcoded playbook (no inference latency).
 */

import { mastra } from '@/mastra';
import { secretaryStore } from '@/lib/secretary-store';
import type { EnvironmentSnapshot } from '@/lib/greenhouse-store';

// Refresh memory package every 7 sols (spec §5.1 — configurable schedule)
const MEMORY_REFRESH_INTERVAL_SOLS = 7;
let lastMemoryRefreshSol = -1;

// Refresh performance digests every 10 sols
const DIGEST_REFRESH_INTERVAL_SOLS = 10;
let lastDigestRefreshSol = -1;

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      snapshot: EnvironmentSnapshot;
      triggerType?: 'emergency' | 'routine' | 'crew';
      crewMessage?: string;
    };

    const { snapshot, triggerType = 'routine', crewMessage } = body;

    // Classify emergency triggers deterministically before hitting LLMs
    // Severity-1 conditions (spec §6.1)
    const batteryPct = snapshot.batteryStorageKWh / Math.max(1, snapshot.batteryCapacityKWh);
    // Solar sev-1 requires BOTH critically low generation AND battery nearly depleted —
    // a transient dip (nighttime, mild dust) does not constitute an emergency on its own.
    const solarCritical = snapshot.solarGenerationKW < snapshot.batteryCapacityKWh * 0.003 && batteryPct < 0.15;

    const isSev1Emergency =
      (snapshot.dustStormFactor < 0.1 && snapshot.dustStormActive) || // tau > 3
      solarCritical ||
      snapshot.co2Level > 5000 ||
      batteryPct < 0.10;

    const isSev2Emergency =
      !isSev1Emergency && (
        batteryPct < 0.20 ||
        snapshot.waterRecyclingEfficiency < 0.25 ||
        snapshot.nutritionalCoverage < 0.5 ||
        (snapshot.dustStormActive && snapshot.dustStormFactor < 0.25)
      );

    const resolvedTriggerType = isSev1Emergency || isSev2Emergency ? 'emergency' : triggerType;

    const workflow = mastra.getWorkflow('dispatcher');
    const run = await workflow.createRun();

    const result = await run.start({
      inputData: {
        triggerType: resolvedTriggerType,
        snapshot: snapshot as unknown as Record<string, unknown>,
        crewMessage,
        missionSol: snapshot.missionSol,
      },
    });

    const steps = result.steps ?? {};

    // Extract dispatcher step output
    const dispatchOutput = steps['dispatch'] as { status: string; output: Record<string, unknown> } | undefined;
    const output = dispatchOutput?.status === 'success' ? dispatchOutput.output : null;

    if (!output) {
      // Fallback to legacy greenhouse control workflow if dispatcher fails
      const legacyWorkflow = mastra.getWorkflow('greenhouseControl');
      const legacyRun = await legacyWorkflow.createRun();
      const legacyResult = await legacyRun.start({
        inputData: snapshot as unknown as Record<string, unknown>,
      });
      const legacySteps = legacyResult.steps ?? {};
      const legacyAct = legacySteps['act'] as { status: string; output: Record<string, unknown> } | undefined;
      const legacyReason = legacySteps['reason'] as { status: string; output: Record<string, unknown> } | undefined;
      const legacyOutput = legacyAct?.output ?? legacyReason?.output;

      return Response.json({
        ok: true,
        reasoning: (legacyOutput as { reasoning?: string })?.reasoning ?? 'Fallback tick',
        summary: (legacyOutput as { summary?: string })?.summary ?? 'Autonomous tick completed',
        actions: (legacyOutput as { actions?: unknown[] })?.actions ?? [],
        triggerType: 'routine',
        conflictType: 'none',
        winningAgent: 'greenhouse',
        riskScore: 0.3,
        wellbeingScore: 0.7,
        decisionId: null,
      });
    }

    // Auto-refresh mission memory package every 7 sols (fire-and-forget, non-blocking)
    const sol = snapshot.missionSol;
    if (sol - lastMemoryRefreshSol >= MEMORY_REFRESH_INTERVAL_SOLS) {
      lastMemoryRefreshSol = sol;
      secretaryStore.generateMissionMemory(sol);
    }

    // Auto-refresh performance digests every 10 sols
    if (sol - lastDigestRefreshSol >= DIGEST_REFRESH_INTERVAL_SOLS) {
      lastDigestRefreshSol = sol;
      secretaryStore.generatePerformanceDigests(sol);
    }

    return Response.json({
      ok: true,
      reasoning: output.reasoning,
      summary: output.summary,
      actions: output.resolvedActions,
      triggerType: output.triggerType,
      emergencySeverity: output.emergencySeverity,
      conflictType: output.conflictType,
      winningAgent: output.winningAgent,
      riskScore: output.riskScore,
      wellbeingScore: output.wellbeingScore,
      survivalJustification: output.survivalJustification,
      wellbeingJustification: output.wellbeingJustification,
      crewResponse: output.crewResponse,
      simulationP10: output.simulationP10,
      simulationP90: output.simulationP90,
      decisionId: output.decisionId,
    });

  } catch (err) {
    console.error('[agent-tick] error:', err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error', actions: [] },
      { status: 500 },
    );
  }
}
