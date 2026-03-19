"use client";

import * as React from "react";
import { ArrowUp } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
    <div className="relative flex items-end gap-2 rounded-full border border-input bg-transparent px-3.5 py-2 transition-[border-color,box-shadow] focus-within:border-[var(--input-hover)]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className={cn(
          "flex-1 resize-none bg-transparent text-[13px] font-medium leading-relaxed text-[var(--dial-text-primary)] placeholder:text-[var(--dial-text-tertiary)] outline-none",
          "scrollbar-none"
        )}
      />
      <Button
        variant="default"
        size="icon-xs"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <ArrowUp size={14} weight="bold" />
      </Button>
    </div>
  );
}
