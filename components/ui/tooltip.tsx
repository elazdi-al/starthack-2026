"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const tooltipContentVariants = cva(
  [
    "z-50 origin-[var(--transform-origin)]",
    "data-[starting-style]:animate-in data-[ending-style]:animate-out",
    "data-[starting-style]:fade-in-0 data-[ending-style]:fade-out-0",
    "data-[starting-style]:zoom-in-95 data-[ending-style]:zoom-out-95",
    "data-[side=bottom]:slide-in-from-top-1 data-[side=bottom]:slide-out-to-top-1",
    "data-[side=left]:slide-in-from-right-1 data-[side=left]:slide-out-to-right-1",
    "data-[side=right]:slide-in-from-left-1 data-[side=right]:slide-out-to-left-1",
    "data-[side=top]:slide-in-from-bottom-1 data-[side=top]:slide-out-to-bottom-1",
  ],
  {
    variants: {
      variant: {
        default:
          "type-label pointer-events-none select-none rounded-full border border-black/8 bg-[#333333] px-3 py-1.5 text-center text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)] dark:border-white/10 dark:shadow-[0_4px_18px_rgba(0,0,0,0.32)]",
        card:
          "type-small max-w-64 rounded-xl border border-border bg-popover px-3.5 py-3 text-left text-popover-foreground shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TooltipProvider({
  delay = 100,
  closeDelay = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(
  props: React.ComponentProps<typeof TooltipPrimitive.Trigger>
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 8,
  align = "center",
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> & {
  side?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
  sideOffset?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["sideOffset"];
  align?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["align"];
} & VariantProps<typeof tooltipContentVariants>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        data-slot="tooltip-positioner"
        className="z-50"
        side={side}
        sideOffset={sideOffset}
        align={align}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          data-variant={variant}
          className={cn(tooltipContentVariants({ variant }), className)}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
