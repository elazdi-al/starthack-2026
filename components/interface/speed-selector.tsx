"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS = ["x1", "x2", "x5", "x10"] as const;

interface SpeedSelectorProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  portalContainer?: HTMLElement | null;
  className?: string;
}

export function SpeedSelector({
  value,
  defaultValue = "x1",
  onValueChange,
  open: controlledOpen,
  onOpenChange,
  portalContainer,
  className,
}: SpeedSelectorProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const currentValue = value ?? internalValue;

  return (
    <div className={cn("relative inline-flex", className)}>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Choose speed"
          ref={triggerRef}
          className={cn(
            "inline-flex h-10 min-w-12 select-none items-center justify-center rounded-full border-transparent bg-transparent px-4 font-[var(--font-ui)] text-[18px] leading-none font-medium text-[var(--dial-text-secondary)] shadow-none transition-[background-color,color] hover:bg-accent hover:text-[var(--dial-text-primary)]",
            open && "bg-accent text-[var(--dial-text-primary)]"
          )}
          onMouseDown={(event) => {
            if (event.button === 2) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onContextMenu={(event) => {
            event.currentTarget.blur();
          }}
        >
          {currentValue}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-36"
          container={portalContainer}
        >
          <DropdownMenuRadioGroup
            value={currentValue}
            onValueChange={(nextValue) => {
              if (value === undefined) {
                setInternalValue(nextValue);
              }

              onValueChange?.(nextValue);
              setOpen(false);
              triggerRef.current?.blur();
            }}
          >
            {SPEED_OPTIONS.map((speed) => (
              <DropdownMenuRadioItem key={speed} value={speed}>
                {speed}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
