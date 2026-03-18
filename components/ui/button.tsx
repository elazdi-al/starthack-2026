"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { triggerHaptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

const standardButtonVariants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "course",
] as const

const utilityPillVariants = [
  "pill",
  "pill-outline",
  "pill-subtle",
  "pill-ghost",
] as const

const buttonVariants = cva(
  "group/button type-ui inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full transition-[background,color,opacity,transform,box-shadow] outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/85",
        outline:
          "border border-border bg-transparent text-[var(--dial-text-secondary)] hover:border-foreground/20 hover:bg-accent hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "bg-transparent text-[var(--dial-text-secondary)] hover:bg-accent hover:text-foreground",
        destructive:
          "bg-destructive/20 text-destructive hover:bg-destructive/30",
        course:
          "bg-stone-700 text-white hover:bg-stone-600 dark:bg-stone-300 dark:text-stone-900 dark:hover:bg-stone-200",
        link:
          "bg-transparent text-[var(--dial-text-secondary)] underline-offset-4 hover:text-foreground hover:underline",
        pill:
          "border-[var(--dial-border)] bg-[var(--dial-surface-active)] text-foreground shadow-[inset_0_1px_0_var(--glass-row-highlight)] hover:bg-[var(--dial-surface-hover)]",
        "pill-outline":
          "border-[var(--dial-border)] bg-transparent text-[var(--dial-text-secondary)] shadow-[inset_0_1px_0_var(--glass-row-highlight)] hover:bg-[var(--dial-surface)] hover:text-foreground",
        "pill-subtle":
          "border-[var(--dial-border)] bg-[var(--dial-surface)] text-[var(--dial-text-primary)] shadow-[inset_0_1px_0_var(--glass-row-highlight)] hover:bg-[var(--dial-surface-hover)]",
        "pill-ghost":
          "bg-transparent text-[var(--dial-text-label)] hover:bg-[var(--dial-surface)] hover:text-foreground",
      },
      size: {
        default: "h-9 py-2",
        xs: "type-caption h-7 gap-1",
        sm: "type-label h-8",
        lg: "h-10",
        icon: "size-9 px-0",
        "icon-xs": "size-7 px-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 px-0",
        "icon-lg": "size-10 px-0",
      },
    },
    compoundVariants: [
      {
        variant: [...standardButtonVariants],
        size: "default",
        class: "px-4",
      },
      {
        variant: [...standardButtonVariants],
        size: "xs",
        class: "px-2.5",
      },
      {
        variant: [...standardButtonVariants],
        size: "sm",
        class: "px-3",
      },
      {
        variant: [...standardButtonVariants],
        size: "lg",
        class: "px-5",
      },
      {
        variant: "link",
        size: ["default", "xs", "sm", "lg"],
        class: "px-1",
      },
      {
        variant: [...utilityPillVariants],
        class: "gap-2",
      },
      {
        variant: ["pill", "pill-outline", "pill-subtle"],
        class: "border backdrop-blur-md",
      },
      {
        variant: [...utilityPillVariants],
        size: "default",
        class: "pl-3.5 pr-4",
      },
      {
        variant: [...utilityPillVariants],
        size: "xs",
        class: "pl-2.5 pr-3",
      },
      {
        variant: [...utilityPillVariants],
        size: "sm",
        class: "pl-3 pr-3.5",
      },
      {
        variant: [...utilityPillVariants],
        size: "lg",
        class: "pl-4 pr-5",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function getButtonHaptic(
  variant: VariantProps<typeof buttonVariants>["variant"]
) {
  switch (variant) {
    case "destructive":
      return "heavy"
    case "ghost":
    case "link":
    case "pill-ghost":
      return "selection"
    case "outline":
    case "pill-outline":
    case "pill-subtle":
      return "soft"
    default:
      return "light"
  }
}

function Button({
  className,
  variant = "default",
  size = "default",
  onClick,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const handleClick: ButtonPrimitive.Props["onClick"] = (event) => {
    onClick?.(event)

    if (event.defaultPrevented) {
      return
    }

    triggerHaptic(getButtonHaptic(variant))
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={handleClick}
      {...props}
    />
  )
}

export { Button, buttonVariants }
