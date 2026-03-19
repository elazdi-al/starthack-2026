"use client"

import { create } from "zustand"
import { readThemePreferenceSnapshot, setThemePreference, type ThemePreference } from "@/lib/theme"
import { saveJSON, loadJSON, STORAGE_KEYS } from "@/lib/persistence"

export type TempUnit = "celsius" | "fahrenheit"
export type TimeFormat = "12h" | "24h"

interface PersistedSettings {
  tempUnit: TempUnit
  timeFormat: TimeFormat
  reducedAnimations: boolean
}

function loadPersistedSettings(): PersistedSettings {
  const saved = loadJSON<PersistedSettings>(STORAGE_KEYS.settings)
  return {
    tempUnit: saved?.tempUnit ?? "celsius",
    timeFormat: saved?.timeFormat ?? "24h",
    reducedAnimations: saved?.reducedAnimations ?? false,
  }
}

function persistSettings(state: PersistedSettings): void {
  saveJSON(STORAGE_KEYS.settings, state)
}

export interface SettingsState {
  themePreference: ThemePreference
  tempUnit: TempUnit
  timeFormat: TimeFormat
  reducedAnimations: boolean

  setThemePreference: (preference: ThemePreference) => void
  setTempUnit: (unit: TempUnit) => void
  setTimeFormat: (format: TimeFormat) => void
  setReducedAnimations: (enabled: boolean) => void
  hydrateFromStorage: () => void
}

const saved: PersistedSettings = { tempUnit: "celsius", timeFormat: "24h", reducedAnimations: false }

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themePreference: "system" as ThemePreference,
  tempUnit: saved.tempUnit,
  timeFormat: saved.timeFormat,
  reducedAnimations: saved.reducedAnimations,

  setThemePreference: (themePreference) => {
    setThemePreference(themePreference)
    set({ themePreference })
  },

  setTempUnit: (tempUnit) => {
    set({ tempUnit })
    persistSettings({ tempUnit, timeFormat: get().timeFormat, reducedAnimations: get().reducedAnimations })
  },
  setTimeFormat: (timeFormat) => {
    set({ timeFormat })
    persistSettings({ tempUnit: get().tempUnit, timeFormat, reducedAnimations: get().reducedAnimations })
  },
  setReducedAnimations: (reducedAnimations) => {
    set({ reducedAnimations })
    persistSettings({ tempUnit: get().tempUnit, timeFormat: get().timeFormat, reducedAnimations })
  },

  hydrateFromStorage: () => {
    const loaded = loadPersistedSettings()
    set({
      themePreference: readThemePreferenceSnapshot(),
      tempUnit: loaded.tempUnit,
      timeFormat: loaded.timeFormat,
      reducedAnimations: loaded.reducedAnimations,
    })
  },
}))

export function formatTemperature(celsius: number, unit: TempUnit): string {
  if (unit === "fahrenheit") {
    return `${Math.round(celsius * 9 / 5 + 32)}°F`
  }
  return `${Math.round(celsius * 10) / 10}°C`
}
