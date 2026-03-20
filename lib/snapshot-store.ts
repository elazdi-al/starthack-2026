/**
 * Server-side in-memory cache for the latest greenhouse EnvironmentSnapshot.
 *
 * The simulation runs client-side in Zustand. The frontend periodically POSTs
 * the current snapshot to /api/snapshot, which updates this cache. The MCP
 * server then reads from this cache when external tools request the state.
 */

import type { EnvironmentSnapshot } from "@/lib/greenhouse-store";

let _snapshot: EnvironmentSnapshot | null = null;
let _updatedAt = 0;

export function setSnapshot(snapshot: EnvironmentSnapshot): void {
  _snapshot = snapshot;
  _updatedAt = Date.now();
}

export function getSnapshot(): EnvironmentSnapshot | null {
  return _snapshot;
}

export function getSnapshotAge(): number {
  if (_updatedAt === 0) return Number.POSITIVE_INFINITY;
  return Date.now() - _updatedAt;
}

export function resetSnapshot(): void {
  _snapshot = null;
  _updatedAt = 0;
}
