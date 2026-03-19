"use client";

import * as React from "react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

const SYNC_INTERVAL_MS = 5000;

/**
 * Headless component that periodically pushes the current greenhouse
 * EnvironmentSnapshot to the server so the MCP endpoint can serve it
 * to external clients. Renders nothing.
 */
export function SnapshotSync() {
  React.useEffect(() => {
    function pushSnapshot() {
      const snapshot = useGreenhouseStore.getState().getEnvironmentSnapshot();
      fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      }).catch(() => {
        // Silently ignore push failures
      });
    }

    // Push immediately on mount
    pushSnapshot();

    // Then push every SYNC_INTERVAL_MS
    const id = window.setInterval(pushSnapshot, SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
