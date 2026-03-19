"use client";

import * as React from "react";
import { ArrowCircleUpIcon } from "@phosphor-icons/react";
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="relative flex items-end gap-2 rounded-2xl border border-[var(--dial-border)] bg-[var(--dial-glass-bg)] px-3 py-2 shadow-sm transition-colors focus-within:border-[var(--dial-border-hover)]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className={cn(
          "flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--foreground)] placeholder:text-[var(--dial-text-tertiary)] outline-none",
          "scrollbar-none"
        )}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="mb-px flex-shrink-0 transition-opacity disabled:opacity-30"
      >
        <ArrowCircleUpIcon
          size={28}
          weight="fill"
          className="text-[#007AFF]"
        />
      </button>
    </div>
  );
}
