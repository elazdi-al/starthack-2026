export type ThemeMode = "light" | "dark";
export type ThemePreference = "system" | ThemeMode;

const themeListeners = new Set<() => void>();
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_PREFERENCE_STORAGE_KEY = "theme-preference";

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

function resolveSystemTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedPreference = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
}

export function readSystemThemeSnapshot(): ThemeMode {
  return resolveSystemTheme();
}

export function readThemePreferenceSnapshot(): ThemePreference {
  return readStoredThemePreference();
}

function resolveTheme(preference: ThemePreference): ThemeMode {
  return preference === "system" ? resolveSystemTheme() : preference;
}

export function applyThemePreference(preference: ThemePreference) {
  applyThemeToDocument(resolveTheme(preference));
}

export function setThemePreference(preference: ThemePreference) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    } catch {}
  }

  applyThemePreference(preference);
  notifyThemeListeners();
}

export function readThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }

  applyThemePreference(readStoredThemePreference());
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      themeListeners.delete(listener);
    };
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY);
  const handleChange = () => {
    if (readStoredThemePreference() !== "system") {
      return;
    }

    applyThemePreference("system");
    notifyThemeListeners();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_PREFERENCE_STORAGE_KEY || !isThemePreference(event.newValue)) {
      return;
    }

    applyThemePreference(event.newValue);
    notifyThemeListeners();
  };

  applyThemePreference(readStoredThemePreference());
  mediaQuery.addEventListener("change", handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    themeListeners.delete(listener);
    mediaQuery.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
