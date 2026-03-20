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

/** Flush buffered trace spans to storage so Studio can display them. */
async function flushTraces(): Promise<void> {
  try {
    await mastra.observability.getDefaultInstance()?.flush();
  } catch { /* non-blocking */ }
}

/** Build a clean markdown report from the dispatcher output for the reports tab. */
function buildDecisionReport(output: Record<string, unknown>, sol: number): string {
  const actions = (output.resolvedActions as Array<Record<string, unknown>> ?? [])
    .map((a) => {
      if (a.type === 'greenhouse') return `Set **${a.param}** to ${a.value}`;
      if (a.type === 'crop') return `Set ${a.crop} **${a.param}** to ${a.value}`;
      if (a.type === 'harvest') return `Harvest all **${a.crop}**`;
      if (a.type === 'replant') return `Replant all **${a.crop}**`;
      if (a.type === 'batch-tile') {
        const parts: string[] = [];
        if ((a.harvests as string[])?.length) parts.push(`harvest ${(a.harvests as string[]).length} tiles`);
        if ((a.plants as unknown[])?.length) parts.push(`plant ${(a.plants as unknown[]).length} tiles`);
        if ((a.clears as string[])?.length) parts.push(`clear ${(a.clears as string[]).length} tiles`);
        return `Batch: ${parts.join(', ')}`;
      }
      return `${a.type}`;
    })
    .map(s => `- ${s}`)
    .join('\n');

  const riskScore = output.riskScore as number | undefined;
  const wellbeingScore = output.wellbeingScore as number | undefined;
  const simP10 = output.simulationP10 as number | undefined;
  const simP90 = output.simulationP90 as number | undefined;

  const simBlock = simP10 != null
    ? `\n## Simulation\n\n| P10 yield | P90 yield |\n|---|---|\n| ${simP10.toFixed(1)} kg | ${simP90?.toFixed(1) ?? '—'} kg |`
    : '';

  return `**${output.summary || 'Autonomous tick completed'}**

| | |
|---|---|
| Trigger | ${output.triggerType}${output.emergencySeverity ? ` (severity ${output.emergencySeverity})` : ''} |
| Risk | ${riskScore?.toFixed(2) ?? '—'} |
| Wellbeing | ${wellbeingScore?.toFixed(2) ?? '—'} |
| Conflict | ${output.conflictType} |
| Decision by | ${output.winningAgent} |

## Survival Assessment

${output.survivalJustification || '_Not consulted_'}

## Wellbeing Assessment

${output.wellbeingJustification || '_Not consulted_'}

## Arbiter Reasoning

${output.reasoning || '_No reasoning provided_'}

## Actions Enacted

${actions || '_No actions taken this tick_'}
${simBlock}`;
}

// Refresh mission memory package every 3 sols
const MEMORY_REFRESH_INTERVAL_SOLS = 3;
let lastMemoryRefreshSol = -1;

// Refresh performance digests every 3 sols
const DIGEST_REFRESH_INTERVAL_SOLS = 3;
let lastDigestRefreshSol = -1;

export async function POST(req: Request) {
  try {
    let body: {
      snapshot: EnvironmentSnapshot;
      triggerType?: 'emergency' | 'routine' | 'crew';
      crewMessage?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { ok: false, error: 'Invalid or empty request body', actions: [] },
        { status: 400 },
      );
    }

    const { snapshot, triggerType = 'routine', crewMessage } = body;

    if (!snapshot || typeof snapshot !== 'object') {
      return Response.json(
        { ok: false, error: 'Missing snapshot in request body', actions: [] },
        { status: 400 },
      );
    }

    // Emergency classification is handled entirely by the dispatcher workflow's
    // classifyStep — single source of truth, no duplicate thresholds here.

    const workflow = mastra.getWorkflow('dispatcher');
    const run = await workflow.createRun();

    const result = await run.start({
      inputData: {
        triggerType,
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
      // Dispatcher failed — return immediately with empty actions.
      // No legacy fallback (calling another LLM just adds more latency on failure).
      await flushTraces();
      return Response.json({
        ok: true,
        reasoning: 'Dispatcher returned no output',
        summary: 'No actions — dispatcher error',
        actions: [],
        triggerType: 'routine',
        conflictType: 'none',
        winningAgent: 'none',
        riskScore: 0,
        wellbeingScore: 0,
        survivalJustification: '',
        wellbeingJustification: '',
        decisionId: null,
      });
    }

    // Auto-refresh mission memory package every 3 sols (fire-and-forget, non-blocking)
    const sol = snapshot.missionSol;
    if (sol - lastMemoryRefreshSol >= MEMORY_REFRESH_INTERVAL_SOLS) {
      lastMemoryRefreshSol = sol;
      secretaryStore.generateMissionMemory(sol);
    }

    // Auto-refresh performance digests every 3 sols
    if (sol - lastDigestRefreshSol >= DIGEST_REFRESH_INTERVAL_SOLS) {
      lastDigestRefreshSol = sol;
      secretaryStore.generatePerformanceDigests(sol);
    }

    // Generate a per-decision report for the reports tab
    secretaryStore.addWeeklyReport({
      weekNumber: sol,
      missionSolStart: sol,
      missionSolEnd: sol,
      report: buildDecisionReport(output, sol),
    });

    await flushTraces();

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
