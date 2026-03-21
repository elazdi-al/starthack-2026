/**
 * Agent-tick endpoint — autonomous control loop entry point
 *
 * Routes every tick through the dispatcher workflow, which:
 * 1. Classifies the trigger type (emergency/routine/crew)
 * 2. Uses the single decision agent when needed
 * 3. Logs the decision via the Secretary
 *
 * Emergency classification is deterministic (no LLM).
 * Severity-1 emergencies use a hardcoded playbook.
 */

import { mastra } from '@/mastra';
import { secretaryStore } from '@/lib/secretary-store';
import type { EnvironmentSnapshot } from '@/lib/greenhouse-store';

async function flushTraces(): Promise<void> {
  try {
    await mastra.observability.getDefaultInstance()?.flush();
  } catch { /* non-blocking */ }
}

function buildDecisionReport(output: Record<string, unknown>, sol: number): string {
  const actions = (output.resolvedActions as Array<Record<string, unknown>> ?? [])
    .map((action) => {
      if (action.type === 'greenhouse') return `Set **${action.param}** to ${action.value}`;
      if (action.type === 'crop') return `Set ${action.crop} **${action.param}** to ${action.value}`;
      if (action.type === 'harvest') return `Harvest all **${action.crop}**`;
      if (action.type === 'replant') return `Replant all **${action.crop}**`;
      if (action.type === 'batch-tile') {
        const parts: string[] = [];
        if ((action.harvests as string[])?.length) parts.push(`harvest ${(action.harvests as string[]).length} tiles`);
        if ((action.plants as unknown[])?.length) parts.push(`plant ${(action.plants as unknown[]).length} tiles`);
        if ((action.clears as string[])?.length) parts.push(`clear ${(action.clears as string[]).length} tiles`);
        return `Batch: ${parts.join(', ')}`;
      }
      return String(action.type);
    })
    .map((line) => `- ${line}`)
    .join('\n');

  const riskScore = output.riskScore as number | undefined;
  const crewImpactScore = output.crewImpactScore as number | undefined;

  return `**${output.summary || 'Autonomous tick completed'}**

| | |
|---|---|
| Trigger | ${output.triggerType}${output.emergencySeverity ? ` (severity ${output.emergencySeverity})` : ''} |
| Risk | ${riskScore?.toFixed(2) ?? '—'} |
| Crew impact | ${crewImpactScore?.toFixed(2) ?? '—'} |
| Decision mode | ${output.decisionMode} |
| Handled by | ${output.handledBy} |

## Operational Summary

${output.operationsSummary || '_No operational notes_'}

## Crew Summary

${output.crewSummary || '_No crew-specific notes_'}

## Reasoning

${output.reasoning || '_No reasoning provided_'}

## Actions Enacted

${actions || '_No actions taken this tick_'}

_Logged on Sol ${sol}_`;
}

const MEMORY_REFRESH_INTERVAL_SOLS = 3;
let lastMemoryRefreshSol = -1;

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
    const dispatchOutput = steps['dispatch'] as { status: string; output: Record<string, unknown> } | undefined;
    const output = dispatchOutput?.status === 'success' ? dispatchOutput.output : null;

    if (!output) {
      await flushTraces();
      return Response.json({
        ok: true,
        reasoning: 'Dispatcher returned no output',
        summary: 'No actions — dispatcher error',
        actions: [],
        triggerType: 'routine',
        decisionMode: 'none',
        handledBy: 'none',
        riskScore: 0,
        crewImpactScore: 0,
        operationsSummary: '',
        crewSummary: '',
        decisionId: null,
      });
    }

    const sol = snapshot.missionSol;
    if (sol - lastMemoryRefreshSol >= MEMORY_REFRESH_INTERVAL_SOLS) {
      lastMemoryRefreshSol = sol;
      secretaryStore.generateMissionMemory(sol);
    }

    if (sol - lastDigestRefreshSol >= DIGEST_REFRESH_INTERVAL_SOLS) {
      lastDigestRefreshSol = sol;
      secretaryStore.generatePerformanceDigests(sol);
    }

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
      decisionMode: output.decisionMode,
      handledBy: output.handledBy,
      riskScore: output.riskScore,
      crewImpactScore: output.crewImpactScore,
      operationsSummary: output.operationsSummary,
      crewSummary: output.crewSummary,
      crewResponse: output.crewResponse,
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
