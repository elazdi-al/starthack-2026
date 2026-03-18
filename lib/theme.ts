export const THEME_STORAGE_KEY = "design-system-theme";

export type ThemeMode = "light" | "dark";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: ThemeMode) {
  applyThemeToDocument(theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}

  notifyThemeListeners();
}

export function readThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") {
    return "dark";
  }

  let storedTheme: string | null = null;

  try {
    storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}

  if (isThemeMode(storedTheme)) {
    return storedTheme;
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      themeListeners.delete(listener);
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY || !isThemeMode(event.newValue)) {
      return;
    }

    applyThemeToDocument(event.newValue);
    notifyThemeListeners();
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}
