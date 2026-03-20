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
  agentTickMinutes: number
}

function loadPersistedSettings(): PersistedSettings {
  const saved = loadJSON<PersistedSettings>(STORAGE_KEYS.settings)
  return {
    tempUnit: saved?.tempUnit ?? "celsius",
    timeFormat: saved?.timeFormat ?? "24h",
    reducedAnimations: saved?.reducedAnimations ?? false,
    agentTickMinutes: saved?.agentTickMinutes ?? 120,
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
  agentTickMinutes: number

  setThemePreference: (preference: ThemePreference) => void
  setTempUnit: (unit: TempUnit) => void
  setTimeFormat: (format: TimeFormat) => void
  setReducedAnimations: (enabled: boolean) => void
  setAgentTickMinutes: (minutes: number) => void
  hydrateFromStorage: () => void
}

const saved: PersistedSettings = { tempUnit: "celsius", timeFormat: "24h", reducedAnimations: false, agentTickMinutes: 120 }

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themePreference: "system" as ThemePreference,
  tempUnit: saved.tempUnit,
  timeFormat: saved.timeFormat,
  reducedAnimations: saved.reducedAnimations,
  agentTickMinutes: saved.agentTickMinutes,

  setThemePreference: (themePreference) => {
    setThemePreference(themePreference)
    set({ themePreference })
  },

  setTempUnit: (tempUnit) => {
    set({ tempUnit })
    const s = get(); persistSettings({ tempUnit, timeFormat: s.timeFormat, reducedAnimations: s.reducedAnimations, agentTickMinutes: s.agentTickMinutes })
  },
  setTimeFormat: (timeFormat) => {
    set({ timeFormat })
    const s = get(); persistSettings({ tempUnit: s.tempUnit, timeFormat, reducedAnimations: s.reducedAnimations, agentTickMinutes: s.agentTickMinutes })
  },
  setReducedAnimations: (reducedAnimations) => {
    set({ reducedAnimations })
    const s = get(); persistSettings({ tempUnit: s.tempUnit, timeFormat: s.timeFormat, reducedAnimations, agentTickMinutes: s.agentTickMinutes })
  },
  setAgentTickMinutes: (agentTickMinutes) => {
    set({ agentTickMinutes })
    const s = get(); persistSettings({ tempUnit: s.tempUnit, timeFormat: s.timeFormat, reducedAnimations: s.reducedAnimations, agentTickMinutes })
  },

  hydrateFromStorage: () => {
    const loaded = loadPersistedSettings()
    set({
      themePreference: readThemePreferenceSnapshot(),
      tempUnit: loaded.tempUnit,
      timeFormat: loaded.timeFormat,
      reducedAnimations: loaded.reducedAnimations,
      agentTickMinutes: loaded.agentTickMinutes,
    })
  },
}))

export function formatTemperature(celsius: number, unit: TempUnit): string {
  if (unit === "fahrenheit") {
    return `${Math.round(celsius * 9 / 5 + 32)}°F`
  }
  return `${Math.round(celsius * 10) / 10}°C`
}
