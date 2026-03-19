/**
 * Persistence layer — localStorage for all client-side state.
 *
 * Stores:
 *   mars-greenhouse-state  — simulation environment, greenhouse config, grid, events, etc.
 *   mars-chat-state        — chat message history
 *   mars-settings-state    — user preferences (theme, units, animations)
 *   theme-preference       — (legacy key, kept for flash-free theme init in layout.tsx)
 */

// ─── Storage Keys ────────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  greenhouse: "mars-greenhouse-state",
  chat: "mars-chat-state",
  settings: "mars-settings-state",
  theme: "theme-preference", // existing key used by layout.tsx inline script
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────────

export function saveJSON(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Reset ───────────────────────────────────────────────────────────────────────

/**
 * Guard flag — when true, store subscriptions must skip auto-saving so the
 * `beforeunload` flush doesn't re-write state that was just cleared.
 */
let _resetInProgress = false;

export function isResetInProgress(): boolean {
  return _resetInProgress;
}

/**
 * Wipe all persisted application data and reload the page to reset in-memory state.
 */
export function resetAllData(): void {
  _resetInProgress = true;
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  window.location.reload();
}
