"use client";

import * as React from "react";
import { ArrowUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Message...",
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        triggerHaptic("light");
        onSubmit();
      }
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize when value changes
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div
      className={cn(
        "relative flex items-end gap-1.5 rounded-[22px] py-[5px] pl-4 pr-[5px]",
        "bg-[var(--dial-surface)] border border-[var(--dial-border)]",
        "transition-[border-color] duration-150",
        "focus-within:border-[var(--dial-border-hover)]",
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className={cn(
          "my-[5px] flex-1 resize-none bg-transparent",
          "text-[15px] leading-[20px] font-normal",
          "text-[var(--dial-text-primary)] placeholder:text-[var(--dial-text-tertiary)]",
          "outline-none scrollbar-none",
        )}
      />

      <button
        type="button"
        onClick={() => {
          if (canSend) {
            triggerHaptic("light");
            onSubmit();
          }
        }}
        disabled={!canSend}
        aria-label="Send message"
        className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-full",
          "transition-all duration-150",
          "active:scale-90",
          canSend
            ? "bg-[#007AFF] text-white"
            : "bg-transparent text-[var(--dial-text-tertiary)] opacity-0 pointer-events-none",
        )}
      >
        <ArrowUp size={16} weight="bold" />
      </button>
    </div>
  );
}
