"use client";

import * as React from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useAnimationConfig } from "@/lib/use-animation-config";

function SearchBar({
  placeholder = "Ask about",
  suggestions = ["this project"],
  className,
  ...props
}: {
  placeholder?: string;
  suggestions?: string[];
  className?: string;
} & Omit<React.ComponentProps<"input">, "placeholder">) {
  const [value, setValue] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const anim = useAnimationConfig();

  React.useEffect(() => {
    if (suggestions.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % suggestions.length),
      3000
    );
    return () => clearInterval(id);
  }, [suggestions.length]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!value.trim()) {
      return;
    }

    triggerHaptic("nudge");
  }

  return (
    <div className={cn("mx-auto w-full max-w-[400px]", className)}>
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "relative h-[48px] overflow-hidden rounded-[20px] border border-input bg-[var(--card)]",
            "transition-[background-color,border-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "focus-within:border-[var(--input-hover)] focus-within:bg-[var(--dial-surface-active)]"
          )}
        >
          {/* Ghost placeholder */}
          {!value && (
            <div
              aria-hidden
              className="type-ui pointer-events-none absolute inset-y-0 left-4 right-12 flex items-center overflow-hidden whitespace-nowrap"
            >
              <span className="shrink-0 text-[var(--dial-text-label)]">
                {placeholder}
              </span>
              <span className="ml-1.5 inline-flex min-w-0 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={index}
                    initial={anim.enabled ? { opacity: 0, y: 6, filter: "blur(2px)" } : false}
                    animate={{ opacity: 0.56, y: 0, filter: "blur(0px)" }}
                    exit={anim.enabled ? { opacity: 0, y: -6, filter: "blur(2px)" } : undefined}
                    transition={anim.enabled ? { duration: 0.42, ease: [0.32, 0.72, 0, 1] } : anim.instant}
                    className="truncate text-[var(--dial-text-secondary)]"
                  >
                    {suggestions[index]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
          )}

          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="type-ui h-full w-full min-w-0 rounded-[20px] bg-transparent px-4 pr-12 text-foreground outline-none"
            {...props}
          />

          <button
            type="submit"
            disabled={!value}
            className={cn(
              "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2",
              "items-center justify-center rounded-full",
              "text-[var(--dial-text-label)] transition-[opacity,color] duration-300",
              "hover:text-foreground",
              "focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
            aria-label="Send"
          >
            <ArrowRight className="ui-icon ui-icon-ios ui-icon-strong h-4 w-4" weight="bold" />
          </button>
        </div>
      </form>
    </div>
  );
}

export { SearchBar };
