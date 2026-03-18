import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const inputBaseClassName =
  "ui-glass-row type-label h-9 w-full min-w-0 rounded-[var(--dial-radius)] border border-input px-3 py-2 text-[var(--dial-text-primary)] transition-[background,color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-[var(--dial-text-label)] placeholder:text-[var(--dial-text-tertiary)] focus-visible:border-[var(--input-hover)] focus-visible:bg-[var(--dial-surface-active)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-[var(--destructive)]"

const Input = React.forwardRef<
  React.ElementRef<"input">,
  React.ComponentPropsWithoutRef<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <InputPrimitive
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(inputBaseClassName, className)}
      {...props}
    />
  )
})

Input.displayName = "Input"

export { Input, inputBaseClassName }
