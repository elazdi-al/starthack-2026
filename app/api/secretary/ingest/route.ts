/**
 * Secretary Ingestion API — embed mission logs into the local vector store
 *
 * POST /api/secretary/ingest           — ingest all reports
 * POST /api/secretary/ingest?since=<ts> — incremental ingest since timestamp
 */

import { ingestSecretaryReports } from '@/mastra/tools/secretary-vector-tool';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  const sinceTimestamp = sinceParam ? parseInt(sinceParam, 10) : undefined;

  try {
    const chunksUpserted = await ingestSecretaryReports(sinceTimestamp);
    return Response.json({
      ok: true,
      chunksUpserted,
      incremental: sinceTimestamp !== undefined,
      sinceTimestamp: sinceTimestamp ?? null,
    });
  } catch (err) {
    console.error('[secretary/ingest] Error:', err);
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
