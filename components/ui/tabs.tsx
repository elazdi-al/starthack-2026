"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { triggerHaptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  onValueChange,
  ...props
}: TabsPrimitive.Root.Props) {
  const handleValueChange: TabsPrimitive.Root.Props["onValueChange"] = (
    value,
    eventDetails
  ) => {
    onValueChange?.(value, eventDetails)
    triggerHaptic("selection")
  }

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      onValueChange={handleValueChange}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-[var(--dial-radius)] p-0.5 text-[var(--dial-text-label)] group-data-horizontal/tabs:min-h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "ui-glass-row gap-0.5",
        line: "gap-2 border-b border-[var(--dial-border)] bg-transparent p-0",
        clipPath: "min-h-0 rounded-none bg-transparent p-0 text-inherit shadow-none",
        highlight: "min-h-0 rounded-none bg-transparent p-0 text-inherit shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "type-label relative inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-transparent px-3 py-0.5 whitespace-nowrap text-[var(--dial-text-label)] transition-[background,color,border-color] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-[var(--dial-text-primary)] focus-visible:border-[var(--dial-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:bg-[var(--dial-surface-active)] group-data-[variant=default]/tabs-list:data-active:text-[var(--dial-text-primary)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:text-[var(--dial-text-primary)]",
        "group-data-[variant=clipPath]/tabs-list:flex-none group-data-[variant=clipPath]/tabs-list:border-transparent group-data-[variant=clipPath]/tabs-list:bg-transparent group-data-[variant=clipPath]/tabs-list:text-inherit group-data-[variant=clipPath]/tabs-list:data-active:bg-transparent group-data-[variant=clipPath]/tabs-list:data-active:text-inherit",
        "group-data-[variant=highlight]/tabs-list:flex-none group-data-[variant=highlight]/tabs-list:border-transparent group-data-[variant=highlight]/tabs-list:bg-transparent group-data-[variant=highlight]/tabs-list:text-inherit group-data-[variant=highlight]/tabs-list:data-active:bg-transparent group-data-[variant=highlight]/tabs-list:data-active:text-inherit",
        "after:absolute after:bg-current after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-1 group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-px group-data-vertical/tabs:after:inset-y-1 group-data-vertical/tabs:after:-right-0.5 group-data-vertical/tabs:after:w-px group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        "group-data-[variant=clipPath]/tabs-list:after:hidden",
        "group-data-[variant=highlight]/tabs-list:after:hidden",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("type-small flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
