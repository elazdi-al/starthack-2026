import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "ui-glass-row h-9 w-full min-w-0 rounded-[var(--dial-radius)] border border-transparent px-3 py-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--dial-text-primary)] transition-[background,color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-[var(--dial-text-label)] placeholder:text-[var(--dial-text-tertiary)] focus-visible:border-[var(--dial-border-hover)] focus-visible:bg-[var(--dial-surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/[0.03] disabled:text-white/40 aria-invalid:border-[var(--destructive)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
