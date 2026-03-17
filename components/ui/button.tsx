"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const standardButtonVariants = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
] as const

const utilityPillVariants = [
  "pill",
  "pill-outline",
  "pill-subtle",
  "pill-ghost",
] as const

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-sm font-medium tracking-[-0.01em] transition-[background,color,opacity,transform,box-shadow] outline-none select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/85",
        outline:
          "border border-border bg-transparent text-foreground/70 hover:border-foreground/20 hover:bg-accent hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "bg-transparent text-foreground/70 hover:bg-accent hover:text-foreground",
        destructive:
          "bg-destructive/20 text-destructive hover:bg-destructive/30",
        link:
          "bg-transparent text-foreground/70 underline-offset-4 hover:text-foreground hover:underline",
        pill:
          "border-white/5 bg-white/[0.18] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_10px_26px_rgba(0,0,0,0.2)] hover:bg-white/[0.24]",
        "pill-outline":
          "border-white/14 bg-white/[0.03] text-foreground/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.08] hover:text-foreground",
        "pill-subtle":
          "border-white/8 bg-white/[0.1] text-foreground/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.14]",
        "pill-ghost":
          "bg-transparent text-foreground/65 hover:bg-white/[0.06] hover:text-foreground/88",
      },
      size: {
        default: "h-9 py-2",
        xs: "h-7 gap-1 text-xs",
        sm: "h-8 text-[13px]",
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

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
