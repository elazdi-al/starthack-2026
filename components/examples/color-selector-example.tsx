"use client"

import * as React from "react"

import {
  ColorSelector,
  type ColorSelectorOption,
} from "@/components/ui/color-selector"
import { cn } from "@/lib/utils"

const colorOptions = [
  { value: "default", label: "Ink", swatch: "var(--foreground)" },
  { value: "sky", label: "Sky", swatch: "var(--color-sky-500)" },
  { value: "emerald", label: "Emerald", swatch: "var(--color-emerald-500)" },
  { value: "amber", label: "Amber", swatch: "var(--color-amber-500)" },
  { value: "rose", label: "Rose", swatch: "var(--color-rose-500)" },
  { value: "violet", label: "Violet", swatch: "var(--color-violet-500)" },
] satisfies readonly ColorSelectorOption[]

export function ColorSelectorExample({ className }: { className?: string }) {
  const [selectedColor, setSelectedColor] = React.useState("sky")

  return (
    <div className={cn("flex w-full max-w-[18rem] flex-col gap-3", className)}>
      <ColorSelector
        aria-label="Choose accent color"
        colors={colorOptions}
        value={selectedColor}
        onColorSelect={setSelectedColor}
      />
    </div>
  )
}
