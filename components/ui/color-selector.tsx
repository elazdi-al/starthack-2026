"use client";

import * as React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { motion, type Variants } from "motion/react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export const WIDGET_ACCENTS = [
  "#ee4562",
  "#ec4899",
  "#d946ef",
  "#9553f9",
  "#5647f0",
  "#0680fa",
  "#4dafff",
  "#0ea5e9",
  "#14bbc7",
  "#10b981",
  "#34c759",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#cdb35e",
  "#c48c54",
  "#023364",
  "#1a1a1a",
] as const;

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
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const COLOR_SELECTOR_ANIMATED_STYLE = {
  willChange: "transform, opacity",
  contain: "layout paint style" as const,
  backfaceVisibility: "hidden" as const,
  WebkitBackfaceVisibility: "hidden" as const,
} as const;

const COLOR_SELECTOR_CONTENT_TRANSITION = {
  duration: 0.18,
  ease: EASE_OUT,
} as const;

const COLOR_SELECTOR_POPUP_TRANSITION = {
  duration: 0.2,
  ease: EASE_OUT,
} as const;

const colorSelectorPanelVariants = {
  hidden: {
    opacity: 0,
    translateY: 14,
    scale: 0.992,
  },
  visible: {
    opacity: 1,
    translateY: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    translateY: 14,
    scale: 0.992,
    transition: { duration: 0.16, ease: EASE_OUT },
  },
} as const satisfies Variants;

const colorSelectorPanelClassName =
  "pointer-events-auto flex w-full max-w-[400px] flex-col gap-4 rounded-[20px] border border-border/60 bg-card/72 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-card/46";

type ColorSelectorOption =
  | string
  | {
      value: string;
      label?: string;
      swatch?: string;
      disabled?: boolean;
    };

interface NormalizedColorSelectorOption {
  value: string;
  label: string;
  swatch: string;
  disabled: boolean;
}

interface ColorSelectorProps
  extends Omit<
    RadioGroup.Props<string>,
    "defaultValue" | "value" | "onValueChange"
  > {
  colors?: readonly ColorSelectorOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (
    value: string,
    eventDetails: RadioGroup.ChangeEventDetails
  ) => void;
  onColorSelect?: (color: string) => void;
  onDone?: (color: string) => void;
  doneLabel?: string;
  itemClassName?: string;
  panelClassName?: string;
}

function formatColorLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveColorSelectorSwatch(color: string) {
  return colorSelectorColorMap[color as keyof typeof colorSelectorColorMap] ?? color;
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
    };
  }

  return {
    value: option.value,
    label: option.label ?? formatColorLabel(option.value),
    swatch: resolveColorSelectorSwatch(option.swatch ?? option.value),
    disabled: option.disabled ?? false,
  };
}

function ColorSelector({
  colors = WIDGET_ACCENTS,
  value,
  defaultValue,
  onValueChange,
  onColorSelect,
  onDone,
  doneLabel = "Save",
  className,
  itemClassName,
  panelClassName,
  ...props
}: ColorSelectorProps) {
  const normalizedColors = React.useMemo(
    () => colors.map(normalizeColorOption),
    [colors]
  );

  const fallbackValue = normalizedColors[0]?.value;
  const [internalValue, setInternalValue] = React.useState(
    value ?? defaultValue ?? fallbackValue
  );

  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  React.useEffect(() => {
    if (!fallbackValue) {
      return;
    }

    if (!internalValue || !normalizedColors.some((color) => color.value === internalValue)) {
      setInternalValue(value ?? defaultValue ?? fallbackValue);
    }
  }, [defaultValue, fallbackValue, internalValue, normalizedColors, value]);

  if (!fallbackValue) {
    return null;
  }

  const selectedValue = value ?? internalValue ?? fallbackValue;
  const selectedColor =
    normalizedColors.find((color) => color.value === selectedValue) ?? normalizedColors[0];

  const handleValueChange: RadioGroup.Props<string>["onValueChange"] = (
    nextValue,
    eventDetails
  ) => {
    onValueChange?.(nextValue, eventDetails);

    if (eventDetails.isCanceled || nextValue === selectedValue) {
      return;
    }

    if (value === undefined) {
      setInternalValue(nextValue);
    }

    triggerHaptic("selection");
    onColorSelect?.(nextValue);
  };

  function handleDoneClick() {
    triggerHaptic("success");
    onDone?.(selectedColor.value);
  }

  return (
    <motion.div
      key="color-selector"
      data-slot="color-selector"
      variants={colorSelectorPanelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(colorSelectorPanelClassName, panelClassName)}
      style={COLOR_SELECTOR_ANIMATED_STYLE}
      transition={COLOR_SELECTOR_POPUP_TRANSITION}
    >
      <RadioGroup
        value={selectedValue}
        onValueChange={handleValueChange}
        className={cn("m-0 grid min-w-0 grid-cols-5 gap-2 border-0 p-0", className)}
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
              "group/color-selector relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-[transform,box-shadow,opacity] duration-200 ease-out active:scale-90 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-40",
              itemClassName
            )}
            style={{ background: color.swatch }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[4px] rounded-full ring-[3px] ring-white/95 opacity-0 transition-opacity duration-200 ease-out group-data-[checked]/color-selector:opacity-100"
            />
          </Radio.Root>
        ))}
      </RadioGroup>

      {onDone ? (
        <motion.button
          type="button"
          onClick={handleDoneClick}
          className="type-ui h-10 rounded-2xl text-white"
          style={{ background: selectedColor.swatch }}
          transition={COLOR_SELECTOR_CONTENT_TRANSITION}
        >
          {doneLabel}
        </motion.button>
      ) : null}
    </motion.div>
  );
}

export { ColorSelector, colorSelectorColorMap, resolveColorSelectorSwatch };
export type { ColorSelectorOption, ColorSelectorProps };
