"use client"

import { WebHaptics, type HapticInput, type TriggerOptions } from "web-haptics"

let haptics: WebHaptics | null = null

function shouldEnableAudioFallback() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

function getHaptics() {
  if (typeof window === "undefined") {
    return null
  }

  if (!haptics) {
    haptics = new WebHaptics({
      debug: shouldEnableAudioFallback(),
      showSwitch: false,
    })
  }

  return haptics
}

export function triggerHaptic(
  input: HapticInput = "light",
  options?: TriggerOptions
) {
  const instance = getHaptics()

  if (!instance) {
    return
  }

  void instance.trigger(input, options)
}

export function cancelHaptics() {
  getHaptics()?.cancel()
}

export function supportsHaptics() {
  return typeof window !== "undefined" && WebHaptics.isSupported
}
