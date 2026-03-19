"use client";

import { useEffect, useState } from "react";

const OBSERVER_OPTS: IntersectionObserverInit = { threshold: 0 };

/**
 * Returns `true` while the element attached to `ref` intersects the viewport.
 * Falls back to `true` when IntersectionObserver is unavailable (SSR).
 */
export function useIsVisible(
  ref: React.RefObject<HTMLElement | null>,
): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? true);
    }, OBSERVER_OPTS);

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return visible;
}
