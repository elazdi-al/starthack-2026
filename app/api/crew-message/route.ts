/**
 * Crew interaction endpoint — handles crew messages through the simplified dispatcher
 *
 * Unlike /api/chat (streaming), this endpoint returns a structured decision payload.
 *
 * POST /api/crew-message
 * Body: { message: string, snapshot: EnvironmentSnapshot, missionSol: number }
 */

import { mastra } from '@/mastra';
import type { EnvironmentSnapshot } from '@/lib/greenhouse-store';

/** Flush buffered trace spans to storage so Studio can display them. */
async function flushTraces(): Promise<void> {
  try {
    await mastra.observability.getDefaultInstance()?.flush();
  } catch { /* non-blocking */ }
}

export async function POST(req: Request) {
  try {
    const { message, snapshot, missionSol } = await req.json() as {
      message: string;
      snapshot: EnvironmentSnapshot;
      missionSol: number;
    };

    const workflow = mastra.getWorkflow('dispatcher');
    const run = await workflow.createRun();

    const result = await run.start({
      inputData: {
        triggerType: 'crew' as const,
        snapshot: snapshot as unknown as Record<string, unknown>,
        crewMessage: message,
        missionSol,
      },
    });

    const steps = result.steps ?? {};
    const dispatchStep = steps['dispatch'] as { status: string; output: Record<string, unknown> } | undefined;
    const output = dispatchStep?.status === 'success' ? dispatchStep.output : null;

    if (!output) {
      await flushTraces();
      return Response.json(
        { ok: false, error: 'Dispatcher failed to produce output', crewResponse: 'System is processing your request. Please try again.' },
        { status: 500 },
      );
    }

    await flushTraces();

    return Response.json({
      ok: true,
      crewIntent: output.crewIntent,
      crewResponse: output.crewResponse,
      resolvedActions: output.resolvedActions,
      decisionMode: output.decisionMode,
      handledBy: output.handledBy,
      riskScore: output.riskScore,
      crewImpactScore: output.crewImpactScore,
      operationsSummary: output.operationsSummary,
      crewSummary: output.crewSummary,
      decisionId: output.decisionId,
      summary: output.summary,
    });

  } catch (err) {
    console.error('[crew-message] error:', err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
