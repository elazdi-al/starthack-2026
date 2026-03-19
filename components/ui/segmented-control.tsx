"use client";

import * as React from "react";
import { motion } from "motion/react";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnimationConfig } from "@/lib/use-animation-config";

interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  indicatorId: string;
}

function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  className,
  indicatorId,
}: SegmentedControlProps) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue ?? options[0]?.value
  );
  const currentValue = value ?? internalValue;
  const anim = useAnimationConfig();

  function renderOptionIcon(icon: React.ReactNode) {
    return (
      <span className="flex size-4 items-center justify-center [&>svg]:size-4 [&>svg]:shrink-0">
        {icon}
      </span>
    );
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "relative flex rounded-full border border-[var(--dial-border)] bg-[var(--dial-surface)] p-1",
          className
        )}
      >
        {options.map((option) => {
          const isActive = currentValue === option.value;
          const isDisabled = option.disabled ?? false;
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                disabled={isDisabled}
                render={
                  <button
                    type="button"
                    aria-label={option.label}
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) {
                        return;
                      }

                      setInternalValue(option.value);
                      onValueChange?.(option.value);

                      if (!isActive) {
                        triggerHaptic("selection");
                      }
                    }}
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
                      isDisabled && "cursor-not-allowed"
                    )}
                  >
                    {isActive && (
                      anim.enabled ? (
                        <motion.span
                          layoutId={indicatorId}
                          className="absolute inset-0 rounded-full border border-[var(--dial-border)] bg-[var(--card)] shadow-none dark:shadow-sm"
                          transition={{
                            type: "spring",
                            duration: 0.35,
                            bounce: 0.15,
                          }}
                        />
                      ) : (
                        <span className="absolute inset-0 rounded-full border border-[var(--dial-border)] bg-[var(--card)] shadow-none dark:shadow-sm" />
                      )
                    )}
                    <span
                      className={cn(
                        "relative z-10 flex items-center justify-center transition-colors duration-200",
                        isDisabled
                          ? "text-[var(--dial-text-tertiary)]"
                          : isActive
                            ? "text-[var(--dial-text-primary)]"
                            : "text-[var(--dial-text-label)]"
                      )}
                    >
                      {option.icon ? renderOptionIcon(option.icon) : (
                        <span className="type-caption flex h-4 items-center">
                          {option.label}
                        </span>
                      )}
                    </span>
                  </button>
                }
              />
              <TooltipContent>{option.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export { SegmentedControl };
export type { SegmentedControlOption, SegmentedControlProps };
