/**
 * Reset API — wipe all server-side in-memory state.
 *
 * POST /api/reset
 *
 * Called by the client-side resetAllData() before it clears localStorage
 * and reloads, so that server-side singletons (secretary logs, snapshot
 * cache, etc.) are also returned to a fresh-mission state.
 */

import { secretaryStore } from "@/lib/secretary-store";
import { resetSnapshot } from "@/lib/snapshot-store";

export async function POST() {
  secretaryStore.reset();
  resetSnapshot();
  return Response.json({ ok: true });
}
