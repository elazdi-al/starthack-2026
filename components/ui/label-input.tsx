"use client"

import * as React from "react"
import { Field } from "@base-ui/react/field"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { EyeClosedIcon, EyeOpenIcon } from "@/components/icons"
import { inputBaseClassName } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type LabelInputRingColor =
  | "muted"
  | "primary"
  | "secondary"
  | "destructive"
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "pink"
  | "orange"
  | "cyan"
  | "indigo"
  | "violet"
  | "rose"
  | "amber"
  | "lime"
  | "emerald"
  | "sky"
  | "slate"
  | "fuchsia"

type LabelInputStyle = React.CSSProperties & {
  "--label-input-ring"?: string
  "--label-input-ring-soft"?: string
}

interface LabelInputProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "size"> {
  label?: string
  ringColor?: LabelInputRingColor
  containerClassName?: string
}

const labelInputRingColorMap: Record<LabelInputRingColor, string> = {
  muted: "var(--ring)",
  primary: "var(--foreground)",
  secondary: "var(--secondary-foreground)",
  destructive: "var(--destructive)",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#ca8a04",
  purple: "#9333ea",
  pink: "#db2777",
  orange: "#ea580c",
  cyan: "#0891b2",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  rose: "#e11d48",
  amber: "#d97706",
  lime: "#65a30d",
  emerald: "#059669",
  sky: "#0284c7",
  slate: "#475569",
  fuchsia: "#c026d3",
}

const LabelInput = React.forwardRef<
  React.ElementRef<"input">,
  LabelInputProps
>(
  (
    {
      label = "Your Email",
      ringColor = "muted",
      containerClassName,
      className,
      type = "text",
      placeholder = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(false)
    const isPasswordType = type === "password"
    const inputType = isPasswordType ? (isVisible ? "text" : "password") : type
    const ringValue = labelInputRingColorMap[ringColor]

    return (
      <Field.Root
        className={cn("group/label-input relative w-full", containerClassName)}
        disabled={disabled}
        style={
          {
            "--label-input-ring": ringValue,
            "--label-input-ring-soft": `color-mix(in oklab, ${ringValue} 22%, transparent)`,
          } as LabelInputStyle
        }
      >
        <InputPrimitive
          ref={ref}
          type={inputType}
          disabled={disabled}
          placeholder={placeholder}
          data-slot="label-input"
          className={cn(
            inputBaseClassName,
            "type-ui h-14 rounded-[calc(var(--dial-radius)+4px)] px-3.5 pb-2 pt-6 placeholder:text-transparent focus:placeholder:text-[var(--dial-text-tertiary)] focus-visible:border-[var(--label-input-ring)] focus-visible:ring-[var(--label-input-ring-soft)]",
            isPasswordType && "pr-11",
            className
          )}
          {...props}
        />
        {label ? (
          <Field.Label
            className={cn(
              "type-ui pointer-events-none absolute left-3 top-1/2 z-10 origin-top-left rounded-md px-1 text-[var(--dial-text-label)] transition-[transform,color] duration-200 ease-out",
              "-translate-y-1/2 scale-100 bg-transparent",
              "group-focus-within/label-input:-translate-y-[1.15rem] group-focus-within/label-input:scale-[0.82]",
              "data-[filled]:-translate-y-[1.15rem] data-[filled]:scale-[0.82]",
              "group-focus-within/label-input:text-[var(--dial-text-secondary)]",
              "data-[filled]:text-[var(--dial-text-label)]",
              "data-[invalid]:text-[var(--destructive)] data-[disabled]:opacity-70"
            )}
          >
            {label}
          </Field.Label>
        ) : null}
        {isPasswordType ? (
          <button
            type="button"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={isVisible ? "Hide password" : "Show password"}
            aria-pressed={isVisible}
            disabled={disabled}
            className={cn(
              "absolute inset-y-1 right-1 inline-flex w-10 items-center justify-center rounded-[calc(var(--dial-radius)+2px)]",
              "text-[var(--dial-text-label)] transition-[background,color,box-shadow] outline-none",
              "hover:bg-[var(--dial-surface-hover)] hover:text-[var(--dial-text-primary)]",
              "focus-visible:bg-[var(--dial-surface-active)] focus-visible:text-[var(--dial-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--label-input-ring-soft)]",
              "disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            {isVisible ? (
              <EyeClosedIcon aria-hidden="true" />
            ) : (
              <EyeOpenIcon aria-hidden="true" />
            )}
          </button>
        ) : null}
      </Field.Root>
    )
  }
)

LabelInput.displayName = "LabelInput"

export { LabelInput }
export type { LabelInputProps, LabelInputRingColor }
