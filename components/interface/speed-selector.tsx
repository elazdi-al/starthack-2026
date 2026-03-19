"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatedParameterValue } from "@/components/ui/animated-parameter-value";
import { cn } from "@/lib/utils";
import { useGreenhouseStore, type SpeedKey } from "@/lib/greenhouse-store";

const SPEED_OPTIONS: SpeedKey[] = ["x1", "x2", "x5", "x10", "x20", "x50", "x100", "x1000", "x5000", "x10000"];

interface SpeedSelectorProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  portalContainer?: HTMLElement | null;
  className?: string;
}

export function SpeedSelector({
  open: controlledOpen,
  onOpenChange,
  portalContainer,
  className,
}: SpeedSelectorProps) {
  const speed = useGreenhouseStore((s) => s.speed);
  const setSpeed = useGreenhouseStore((s) => s.setSpeed);

  const [internalOpen, setInternalOpen] = React.useState(false);
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined);
  const open = controlledOpen ?? internalOpen;
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const setOpen = (next: boolean) => {
    if (next && triggerRef.current) {
      setTriggerWidth(triggerRef.current.getBoundingClientRect().width);
    }
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn("relative flex min-w-0", className)}>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Choose speed"
          ref={triggerRef}
          className={cn(
            "cc-toolbar-speed w-full select-none",
            open && "bg-[var(--dial-surface-hover)] text-[var(--dial-text-primary)]"
          )}
          onMouseDown={(event) => {
            if (event.button === 2) {
              event.preventDefault();
              event.currentTarget.blur();
            }
            event.stopPropagation();
          }}
          onContextMenu={(event) => {
            event.currentTarget.blur();
          }}
        >
          <AnimatedParameterValue value={speed} debounceMs={64} />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="min-w-0 p-1"
          style={{ width: triggerWidth }}
          container={portalContainer}
        >
          <DropdownMenuRadioGroup
            value={speed}
            onValueChange={(nextValue) => {
              setSpeed(nextValue as SpeedKey);
              setOpen(false);
              triggerRef.current?.blur();
            }}
          >
            {SPEED_OPTIONS.map((s) => (
              <DropdownMenuRadioItem key={s} value={s} className="min-h-0 py-1.5 px-3 text-xs cursor-pointer">
                {s}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
