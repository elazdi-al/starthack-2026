/**
 * Secretary API — read mission logs and generate weekly crew reports
 *
 * GET /api/secretary?type=decisions&limit=20  — per-decision log
 * GET /api/secretary?type=incidents            — incident log
 * GET /api/secretary?type=profile              — crew preference profile
 * GET /api/secretary?type=report               — latest weekly crew report
 * GET /api/secretary?type=memory               — mission memory package
 * POST /api/secretary?type=report              — generate a new weekly crew report (LLM)
 */

import { mastra } from '@/mastra';
import { secretaryStore } from '@/lib/secretary-store';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'decisions';
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

  switch (type) {
    case 'decisions':
      return Response.json({ ok: true, data: secretaryStore.getDecisionLog(limit) });

    case 'incidents':
      return Response.json({ ok: true, data: secretaryStore.getIncidentLog(limit) });

    case 'profile':
      return Response.json({ ok: true, data: secretaryStore.getCrewPreferenceProfile() });

    case 'report':
      return Response.json({ ok: true, data: secretaryStore.getLatestWeeklyReport() });

    case 'reports':
      return Response.json({ ok: true, data: secretaryStore.getWeeklyReports(limit) });

    case 'memory':
      return Response.json({ ok: true, data: secretaryStore.getMissionMemory() });

    case 'context':
      return Response.json({ ok: true, data: secretaryStore.getAgentContext(10) });

    case 'digests':
      return Response.json({ ok: true, data: secretaryStore.getPerformanceDigests() });

    default:
      return Response.json({ ok: false, error: `Unknown type: ${type}` }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'report';

  if (type === 'report') {
    // Generate weekly crew report using Claude (Secretary's LLM use case from spec §3.3)
    const { missionSolStart, missionSolEnd, weekNumber } = await req.json() as {
      missionSolStart: number;
      missionSolEnd: number;
      weekNumber: number;
    };

    const recentDecisions = secretaryStore.getDecisionLog(50);
    const incidents = secretaryStore.getIncidentLog(20);
    const profile = secretaryStore.getCrewPreferenceProfile();

    const summaryPrompt = `You are the Secretary for a Mars greenhouse mission. Generate a plain-language weekly crew report for week ${weekNumber} (sols ${missionSolStart}–${missionSolEnd}).

Recent decisions (${recentDecisions.length} total):
${recentDecisions.slice(0, 10).map(d =>
  `- Sol ${d.missionSol}: ${d.triggerType} | risk=${d.riskScore.toFixed(2)} | ${d.winningAgent} | ${d.actionsEnacted.length} actions${d.actualOutcome ? ` | outcome: ${d.actualOutcome}` : ''}`
).join('\n')}

Incidents this period:
${incidents.slice(0, 5).map(i =>
  `- Sol ${i.missionSol}: ${i.emergencyType} (severity ${i.severity}) — ${i.resolved ? 'resolved' : 'ACTIVE'}`
).join('\n') || 'None'}

Crew preferences inferred: ${JSON.stringify(profile.preferences)}
Override attempts: ${profile.overrideAttempts.length}

Write a clear, warm, informative report for the crew covering:
1. What crops grew and were harvested this week
2. What was rationed and why each conflict was resolved as it was
3. Any emergency events and their resolution
4. Nutritional coverage trends
5. What to expect next week

Keep it under 300 words. Use plain language — no technical jargon. The crew needs to understand and trust these decisions.`;

    try {
      const agent = mastra.getAgent('secretaryAgent');
      const result = await agent.generate(
        [{ role: 'user', content: summaryPrompt }],
        { maxSteps: 1 },
      );

      const report = secretaryStore.addWeeklyReport({
        weekNumber,
        missionSolStart,
        missionSolEnd,
        report: result.text ?? 'Report generation failed.',
      });

      return Response.json({ ok: true, data: report });
    } catch (err) {
      return Response.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  if (type === 'memory') {
    // Generate (or refresh) the mission memory package from current logs — no LLM needed
    const { missionSol } = await req.json() as { missionSol: number };
    const pkg = secretaryStore.generateMissionMemory(missionSol);
    return Response.json({ ok: true, data: pkg });
  }

  if (type === 'outcome') {
    // Retroactive logging — fill actual outcome n sols after a decision
    const { decisionId, actualOutcome } = await req.json() as {
      decisionId: string;
      actualOutcome: string;
    };
    secretaryStore.updateDecisionOutcome(decisionId, actualOutcome);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: `Unknown type: ${type}` }, { status: 400 });
}
