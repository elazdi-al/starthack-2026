"use client"

import { useMemo } from "react"
import { useReducedMotion } from "motion/react"
import { useSettingsStore } from "@/lib/settings-store"

/**
 * Returns whether animations should be reduced.
 * Combines the OS-level `prefers-reduced-motion` media query
 * with the user's in-app "Reduced animations" toggle.
 *
 * Using a narrow zustand selector (`s => s.reducedAnimations`)
 * ensures components only re-render when that specific slice changes.
 */
export function useReducedAnimations(): boolean {
  const osReduced = useReducedMotion()
  const userReduced = useSettingsStore((s) => s.reducedAnimations)
  return !!(osReduced || userReduced)
}

/** Instant transition used when animations are disabled. */
const INSTANT = { duration: 0 } as const

/** No-op motion props (no movement). */
const STATIC_INITIAL = { opacity: 1 } as const

/**
 * Memoised animation helper. Returns `{ enabled, instant }` so consumers
 * can conditionally apply motion props without allocating new objects
 * on every render.
 *
 * Usage:
 * ```tsx
 * const anim = useAnimationConfig()
 * <motion.div
 *   initial={anim.enabled ? { opacity: 0, y: 8 } : false}
 *   animate={{ opacity: 1, y: 0 }}
 *   transition={anim.enabled ? { duration: 0.28 } : anim.instant}
 * />
 * ```
 */
export function useAnimationConfig() {
  const reduced = useReducedAnimations()

  return useMemo(
    () => ({
      /** `true` when animations should play normally. */
      enabled: !reduced,
      /** A zero-duration transition for instant state snaps. */
      instant: INSTANT,
      /** Static initial state (no offset, full opacity). */
      staticInitial: STATIC_INITIAL,
    }),
    [reduced],
  )
}
