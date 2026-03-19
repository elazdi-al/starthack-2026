"use client";

import * as React from "react";
import { ArrowUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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
  placeholder = "Message…",
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div
      className={cn(
        "relative flex items-end rounded-[20px] pl-3.5 pr-[5px]",
        "bg-[var(--dial-surface)] border border-[var(--dial-border)]",
        "transition-[border-color,box-shadow] duration-200",
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
        style={{ margin: 0, padding: 0 }}
        className={cn(
          "my-[9px] flex-1 resize-none bg-transparent",
          "text-[15px] leading-[20px] font-normal",
          "text-[var(--dial-text-primary)] placeholder:text-[var(--dial-text-tertiary)]",
          "outline-none scrollbar-none",
        )}
      />
      <div className="flex shrink-0 items-center pb-[5px] pl-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex size-[28px] items-center justify-center rounded-full",
            "transition-[background-color,opacity,transform] duration-150",
            "active:scale-[0.85]",
            canSend
              ? "bg-[#007AFF] text-white"
              : "bg-transparent text-[var(--dial-text-tertiary)] opacity-0 pointer-events-none",
          )}
        >
          <ArrowUp size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
