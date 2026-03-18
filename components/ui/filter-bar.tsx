"use client";

import * as React from "react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface FilterBarItem {
  value: string;
  label: string;
  disabled?: boolean;
}

interface FilterBarProps {
  items: FilterBarItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  listClassName?: string;
  buttonClassName?: string;
  "aria-label"?: string;
}

function FilterBar({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
  listClassName,
  buttonClassName,
  "aria-label": ariaLabel = "Filters",
}: FilterBarProps) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue ?? items[0]?.value
  );

  const currentValue = value ?? internalValue ?? items[0]?.value;

  if (!items.length || !currentValue) {
    return null;
  }

  return (
    <div className={className}>
      <ul aria-label={ariaLabel} className={cn("ui-filter-list", listClassName)}>
        {items.map((item) => {
          const isActive = currentValue === item.value;
          const isDisabled = item.disabled ?? false;

          return (
            <li key={item.value}>
              <button
                type="button"
                aria-pressed={isActive}
                disabled={isDisabled}
                data-active={isActive}
                className={cn("ui-filter-button type-label", buttonClassName)}
                onClick={() => {
                  if (isDisabled || isActive) {
                    return;
                  }

                  if (value === undefined) {
                    setInternalValue(item.value);
                  }

                  triggerHaptic("selection");
                  onValueChange?.(item.value);
                }}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { FilterBar };
export type { FilterBarItem, FilterBarProps };
