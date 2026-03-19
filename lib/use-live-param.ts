"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveLinePoint } from "@/components/charts/live-line-chart";

const MAX_POINTS = 600;

/**
 * Streams a numeric value into a rolling LiveLinePoint buffer.
 * Pushes a new point on every value change (or at least once per second),
 * giving the LiveLineChart a smooth real-time feed.
 */
export function useLiveParam(value: number, enabled = true): [LiveLinePoint[], number] {
  const [data, setData] = useState<LiveLinePoint[]>([]);
  const lastPush = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now() / 1000;
    // Throttle: at most 1 point per 200ms to avoid flooding the buffer
    if (now - lastPush.current < 0.2) return;
    lastPush.current = now;

    setData((prev) => {
      const next = [...prev, { time: now, value }];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [value, enabled]);

  return [data, value];
}
