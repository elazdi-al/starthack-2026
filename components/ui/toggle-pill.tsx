"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface TogglePillOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface TogglePillProps {
  options: TogglePillOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  layoutId: string;
}

function TogglePill({
  options,
  value,
  defaultValue,
  onValueChange,
  className,
  layoutId,
}: TogglePillProps) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue ?? options[0]?.value
  );
  const currentValue = value ?? internalValue;

  return (
    <div
      className={cn(
        "relative flex rounded-full bg-neutral-200/80 p-1 dark:bg-neutral-700/80",
        className
      )}
    >
      {options.map((option) => {
        const isActive = currentValue === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            onClick={() => {
              setInternalValue(option.value);
              onValueChange?.(option.value);
            }}
            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full"
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-neutral-600"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span
              className={cn(
                "relative z-10 transition-colors duration-200",
                isActive
                  ? "text-neutral-600 dark:text-neutral-300"
                  : "text-neutral-400"
              )}
            >
              {option.icon ?? (
                <span className="flex h-4 items-center text-xs font-medium">
                  {option.label}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { TogglePill };
export type { TogglePillOption, TogglePillProps };
