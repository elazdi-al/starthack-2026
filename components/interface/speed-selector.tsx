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
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

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
          {speed}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-36"
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
              <DropdownMenuRadioItem key={s} value={s}>
                {s}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
