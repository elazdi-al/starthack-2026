"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveLinePoint } from "@/components/charts/live-line-chart";

const MAX_POINTS = 120;

/**
 * Streams a numeric value into a rolling LiveLinePoint buffer.
 * Pushes one point per `intervalSec` seconds (default 15),
 * giving the LiveLineChart a coarser but still precise feed.
 */
export function useLiveParam(value: number, enabled = true, intervalSec = 15): [LiveLinePoint[], number] {
  const [data, setData] = useState<LiveLinePoint[]>([]);
  const lastPush = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now() / 1000;
    // Throttle: one point per interval (default 15 s)
    if (now - lastPush.current < intervalSec) return;
    lastPush.current = now;

    setData((prev) => {
      const next = [...prev, { time: now, value }];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [value, enabled]);

  return [data, value];
}
