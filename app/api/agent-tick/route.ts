import { mastra } from '@/mastra';
import type { EnvironmentSnapshot } from '@/lib/greenhouse-store';

export async function POST(req: Request) {
  try {
    const { snapshot }: { snapshot: EnvironmentSnapshot } = await req.json();

    const workflow = mastra.getWorkflow('greenhouseControl');
    const run = await workflow.createRun();

    const result = await run.start({
      inputData: snapshot as unknown as Record<string, unknown>,
    });

    // Extract the final step output — act step is last
    const steps = result.steps ?? {};
    const getOutput = (stepId: string) => {
      const step = steps[stepId];
      if (step && step.status === 'success') return step.output;
      return undefined;
    };

    const output = getOutput('act') ?? getOutput('reason');
    const reasoning: string = (output as { reasoning?: string })?.reasoning ?? 'No reasoning provided';
    const summary: string = (output as { summary?: string })?.summary ?? 'Autonomous tick completed';
    const actions: unknown[] = (output as { actions?: unknown[] })?.actions ?? [];

    return Response.json({ ok: true, reasoning, summary, actions });
  } catch (err) {
    console.error('[agent-tick] error:', err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error', actions: [] },
      { status: 500 },
    );
  }
}
