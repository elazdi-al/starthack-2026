"use client";

import { Check, Copy } from "@phosphor-icons/react";
import * as React from "react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface CopyButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  copiedLabel?: string;
  idleLabel?: string;
  resetDelay?: number;
}

function CopyButton({
  value,
  className,
  copiedLabel = "Copied",
  idleLabel = "Copy code",
  resetDelay = 2000,
  onClick,
  type = "button",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event);

    if (event.defaultPrevented || !navigator.clipboard?.writeText) {
      if (!event.defaultPrevented) {
        triggerHaptic("error");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      triggerHaptic("success");

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, resetDelay);
    } catch {
      triggerHaptic("error");
    }
  }

  return (
    <button
      type={type}
      aria-label={copied ? copiedLabel : idleLabel}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 transition-[background-color,color,transform] duration-200 ease-out hover:bg-neutral-200 hover:text-neutral-600 focus-visible:bg-neutral-200 focus-visible:text-neutral-600 focus-visible:outline-none focus-visible:ring-0 active:scale-95 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:focus-visible:bg-neutral-700 dark:focus-visible:text-neutral-300",
        className
      )}
      {...props}
    >
      <span className="sr-only">{copied ? copiedLabel : idleLabel}</span>
      <span className="relative block h-4 w-4">
        <Copy
          className={cn(
            "ui-icon ui-icon-ios ui-icon-muted absolute inset-0 h-4 w-4 transition-[opacity,transform] duration-200 ease-out",
            copied ? "scale-75 opacity-0" : "scale-100 opacity-100"
          )}
          weight="fill"
        />
        <Check
          className={cn(
            "ui-icon ui-icon-ios ui-icon-strong absolute inset-0 h-4 w-4 transition-[opacity,transform] duration-200 ease-out",
            copied ? "scale-100 opacity-100" : "scale-75 opacity-0"
          )}
          weight="bold"
        />
      </span>
    </button>
  );
}

export { CopyButton };
export type { CopyButtonProps };
