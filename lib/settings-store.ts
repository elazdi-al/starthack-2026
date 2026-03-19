"use client"

import { create } from "zustand"
import { readThemePreferenceSnapshot, setThemePreference, type ThemePreference } from "@/lib/theme"

export type TempUnit = "celsius" | "fahrenheit"
export type TimeFormat = "12h" | "24h"

export interface SettingsState {
  themePreference: ThemePreference
  tempUnit: TempUnit
  timeFormat: TimeFormat
  reducedAnimations: boolean

  setThemePreference: (preference: ThemePreference) => void
  setTempUnit: (unit: TempUnit) => void
  setTimeFormat: (format: TimeFormat) => void
  setReducedAnimations: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themePreference: readThemePreferenceSnapshot(),
  tempUnit: "celsius",
  timeFormat: "24h",

  setThemePreference: (themePreference) => {
    setThemePreference(themePreference)
    set({ themePreference })
  },
  reducedAnimations: false,

  setTempUnit: (tempUnit) => set({ tempUnit }),
  setTimeFormat: (timeFormat) => set({ timeFormat }),
  setReducedAnimations: (reducedAnimations) => set({ reducedAnimations }),
}))

export function formatTemperature(celsius: number, unit: TempUnit): string {
  if (unit === "fahrenheit") {
    return `${Math.round(celsius * 9 / 5 + 32)}°F`
  }
  return `${Math.round(celsius * 10) / 10}°C`
}
