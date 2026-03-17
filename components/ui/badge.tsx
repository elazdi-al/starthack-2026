import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-[var(--dial-border)] bg-[var(--dial-surface)] px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap tracking-[-0.01em] text-[var(--dial-text-label)] transition-[background,color,border-color] focus-visible:border-[var(--dial-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-[var(--destructive)] [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-[var(--dial-surface-active)] text-[var(--dial-text-primary)]",
        secondary:
          "border-transparent bg-white/[0.12] text-[var(--dial-text-primary)]",
        destructive:
          "border-transparent bg-[var(--destructive-surface)] text-white hover:bg-[var(--destructive-surface-hover)]",
        outline:
          "bg-transparent text-[var(--dial-text-label)] hover:bg-[var(--dial-surface)] hover:text-[var(--dial-text-primary)]",
        ghost:
          "border-transparent bg-transparent hover:bg-[var(--dial-surface)] hover:text-[var(--dial-text-primary)]",
        link: "border-transparent bg-transparent px-1 text-[var(--dial-text-label)] hover:text-[var(--dial-text-primary)] hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
