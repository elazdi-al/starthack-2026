/**
 * Snapshot push endpoint.
 *
 * The frontend periodically POSTs the current EnvironmentSnapshot here
 * so the MCP server can serve it to external clients.
 */

import { setSnapshot } from "@/lib/snapshot-store";
import type { EnvironmentSnapshot } from "@/lib/greenhouse-store";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { snapshot: EnvironmentSnapshot };

    if (!body.snapshot) {
      return Response.json({ ok: false, error: "Missing snapshot" }, { status: 400 });
    }

    setSnapshot(body.snapshot);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
