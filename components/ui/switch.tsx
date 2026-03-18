"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { triggerHaptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  onCheckedChange,
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  const handleCheckedChange: SwitchPrimitive.Root.Props["onCheckedChange"] = (
    checked,
    eventDetails
  ) => {
    onCheckedChange?.(checked, eventDetails)
    triggerHaptic("selection")
  }

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      onCheckedChange={handleCheckedChange}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-[background,border-color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-[var(--dial-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] aria-invalid:border-[var(--destructive)] data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7 data-checked:bg-foreground/14 data-unchecked:bg-[var(--dial-surface-active)] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full border border-[var(--dial-border)] bg-[var(--card)] shadow-none dark:shadow-sm ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
