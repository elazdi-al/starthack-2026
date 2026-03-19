/**
 * Crew interaction endpoint — handles crew messages as dispatcher triggers
 *
 * Unlike /api/chat (streaming), this endpoint runs the full dispatcher pipeline
 * for crew requests and overrides, returning a structured decision.
 *
 * POST /api/crew-message
 * Body: { message: string, snapshot: EnvironmentSnapshot, missionSol: number }
 *
 * Intent classification (spec §6.3):
 * - question  → Wellbeing answers directly from snapshot (< 3s)
 * - request   → Both agents + Arbiter (mini routine cycle)
 * - override  → Survival veto check
 */

import { mastra } from '@/mastra';
import type { EnvironmentSnapshot } from '@/lib/greenhouse-store';

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
      return Response.json(
        { ok: false, error: 'Dispatcher failed to produce output', crewResponse: 'System is processing your request. Please try again.' },
        { status: 500 },
      );
    }

    return Response.json({
      ok: true,
      crewIntent: output.crewIntent,
      crewResponse: output.crewResponse,
      resolvedActions: output.resolvedActions,
      conflictType: output.conflictType,
      winningAgent: output.winningAgent,
      riskScore: output.riskScore,
      wellbeingScore: output.wellbeingScore,
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
