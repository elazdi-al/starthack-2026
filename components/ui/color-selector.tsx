"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"

import { triggerHaptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

const colorSelectorColorMap = {
  default: "var(--foreground)",
  red: "var(--color-red-500)",
  green: "var(--color-green-500)",
  blue: "var(--color-blue-500)",
  yellow: "var(--color-yellow-500)",
  purple: "var(--color-purple-500)",
  pink: "var(--color-pink-500)",
  indigo: "var(--color-indigo-500)",
  orange: "var(--color-orange-500)",
  teal: "var(--color-teal-500)",
  cyan: "var(--color-cyan-500)",
  lime: "var(--color-lime-500)",
  emerald: "var(--color-emerald-500)",
  violet: "var(--color-violet-500)",
  fuchsia: "var(--color-fuchsia-500)",
  rose: "var(--color-rose-500)",
  sky: "var(--color-sky-500)",
  amber: "var(--color-amber-500)",
} as const

type ColorSelectorOption =
  | string
  | {
      value: string
      label?: string
      swatch?: string
      disabled?: boolean
    }

interface NormalizedColorSelectorOption {
  value: string
  label: string
  swatch: string
  disabled: boolean
}

interface ColorSelectorProps
  extends Omit<
    RadioGroup.Props<string>,
    "defaultValue" | "value" | "onValueChange"
  > {
  colors: readonly ColorSelectorOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (
    value: string,
    eventDetails: RadioGroup.ChangeEventDetails
  ) => void
  onColorSelect?: (color: string) => void
  itemClassName?: string
}

function formatColorLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function resolveColorSelectorSwatch(color: string) {
  return colorSelectorColorMap[color as keyof typeof colorSelectorColorMap] ?? color
}

function normalizeColorOption(
  option: ColorSelectorOption
): NormalizedColorSelectorOption {
  if (typeof option === "string") {
    return {
      value: option,
      label: formatColorLabel(option),
      swatch: resolveColorSelectorSwatch(option),
      disabled: false,
    }
  }

  return {
    value: option.value,
    label: option.label ?? formatColorLabel(option.value),
    swatch: resolveColorSelectorSwatch(option.swatch ?? option.value),
    disabled: option.disabled ?? false,
  }
}

function ColorSelector({
  colors,
  value,
  defaultValue,
  onValueChange,
  onColorSelect,
  className,
  itemClassName,
  ...props
}: ColorSelectorProps) {
  const normalizedColors = React.useMemo(
    () => colors.map(normalizeColorOption),
    [colors]
  )

  const fallbackValue = normalizedColors[0]?.value

  if (!fallbackValue) {
    return null
  }

  const handleValueChange: RadioGroup.Props<string>["onValueChange"] = (
    nextValue,
    eventDetails
  ) => {
    onValueChange?.(nextValue, eventDetails)

    if (eventDetails.isCanceled) {
      return
    }

    triggerHaptic("selection")
    onColorSelect?.(nextValue)
  }

  return (
    <RadioGroup
      data-slot="color-selector"
      defaultValue={defaultValue ?? fallbackValue}
      value={value}
      onValueChange={handleValueChange}
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {normalizedColors.map((color) => (
        <Radio.Root
          key={color.value}
          value={color.value}
          disabled={color.disabled}
          title={color.label}
          aria-label={`Select ${color.label} color`}
          className={cn(
            "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-[transform,box-shadow,filter,opacity] duration-200 ease-out active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-40 shadow-[0_0_0_0_var(--color-selector-ring)] data-checked:shadow-[0_0_0_2px_var(--color-selector-ring)]",
            "size-5",
            itemClassName
          )}
          style={{ "--color-selector-ring": color.swatch } as React.CSSProperties}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none block size-full rounded-full ring-1 ring-inset ring-black/5 shadow-[inset_0_1px_0_rgb(255_255_255/0.78)] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]"
            style={{ backgroundColor: color.swatch }}
          />
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}

export { ColorSelector, colorSelectorColorMap, resolveColorSelectorSwatch }
export type { ColorSelectorOption, ColorSelectorProps }
