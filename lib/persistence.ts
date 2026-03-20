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
 * Wipe **all** application data — both client-side (localStorage) and
 * server-side (in-memory singletons like the secretary decision log and
 * snapshot cache) — then reload the page so every store re-initialises
 * from scratch.
 *
 * Must stay **synchronous** so that localStorage is cleared and the reload
 * is triggered in the same microtask — before any beforeunload handler or
 * Zustand subscriber can re-persist state.
 */
export function resetAllData(): void {
  _resetInProgress = true;

  // 1. Clear all localStorage keys
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  // 2. Fire server-side reset (decision log, incident log, snapshot cache, etc.)
  //    Using keepalive so the request survives the page reload.
  try {
    fetch("/api/reset", { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // fetch itself threw (e.g. SSR) — ignore
  }

  // 3. Reload to re-initialise all in-memory Zustand stores
  window.location.reload();
}
