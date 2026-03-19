"use client"

import { create } from "zustand"

export type Theme = "light" | "dark"
export type TempUnit = "celsius" | "fahrenheit"
export type TimeFormat = "12h" | "24h"

export interface SettingsState {
  theme: Theme
  tempUnit: TempUnit
  timeFormat: TimeFormat

  setTheme: (theme: Theme) => void
  setTempUnit: (unit: TempUnit) => void
  setTimeFormat: (format: TimeFormat) => void
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "light",
  tempUnit: "celsius",
  timeFormat: "24h",

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },

  setTempUnit: (tempUnit) => set({ tempUnit }),
  setTimeFormat: (timeFormat) => set({ timeFormat }),
}))

export function formatTemperature(celsius: number, unit: TempUnit): string {
  if (unit === "fahrenheit") {
    return `${Math.round(celsius * 9 / 5 + 32)}°F`
  }
  return `${Math.round(celsius * 10) / 10}°C`
}
