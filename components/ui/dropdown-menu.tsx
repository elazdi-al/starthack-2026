"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Check } from "@phosphor-icons/react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Menu.Trigger>
>(function DropdownMenuTrigger({ className, ...props }, ref) {
  return (
    <Menu.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[var(--dial-border)] bg-[var(--dial-surface)] px-3 text-[var(--dial-text-primary)] shadow-none outline-none backdrop-blur-md transition-[background-color,border-color,color,transform] hover:border-[var(--dial-border-hover)] hover:bg-[var(--dial-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[popup-open]:bg-[var(--dial-surface-active)]",
        className
      )}
      {...props}
    />
  );
});

function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "start",
  container,
  ...props
}: React.ComponentPropsWithoutRef<typeof Menu.Popup> & {
  sideOffset?: number;
  align?: React.ComponentPropsWithoutRef<typeof Menu.Positioner>["align"];
  container?: HTMLElement | null;
}) {
  return (
    <Menu.Portal container={container}>
      <Menu.Positioner align={align} sideOffset={sideOffset}>
        <Menu.Popup
          className={cn(
            "min-w-44 overflow-hidden rounded-[var(--dial-panel-radius)] border border-[var(--dial-border)] bg-[var(--dial-glass-bg)] p-2.5 text-[var(--dial-text-primary)] shadow-[var(--dial-shadow)] outline-none backdrop-blur-[var(--dial-backdrop-blur)]",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

const DropdownMenuRadioGroup = Menu.RadioGroup;

const DropdownMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.RadioItem>
>(function DropdownMenuRadioItem({ className, children, onClick, ...props }, ref) {
  return (
    <Menu.RadioItem
      ref={ref}
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between rounded-[10px] px-4 font-[var(--font-ui)] text-[16px] leading-none font-medium text-[var(--dial-text-label)] outline-none transition-[background-color,color,transform] data-[highlighted]:bg-[var(--dial-surface-hover)] data-[highlighted]:text-[var(--dial-text-primary)] data-[checked]:bg-[var(--dial-surface-active)] data-[checked]:text-[var(--dial-text-primary)]",
        className
      )}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          triggerHaptic("selection");
        }
      }}
      {...props}
    >
      <span>{children}</span>
      <Menu.RadioItemIndicator
        keepMounted
        className="inline-flex size-4 items-center justify-center text-[var(--dial-text-primary)] opacity-0 transition-opacity data-[checked]:opacity-100"
      >
        <Check size={12} weight="bold" />
      </Menu.RadioItemIndicator>
    </Menu.RadioItem>
  );
});

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
};
