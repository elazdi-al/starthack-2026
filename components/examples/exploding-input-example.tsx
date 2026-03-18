"use client";

import * as React from "react";

import { ExplodingInput } from "@/components/ui/exploding-input";
import { LabelInput } from "@/components/ui/label-input";
import { cn } from "@/lib/utils";

const particleContent = ["🤩", "👾", "😺", "👻", "🎃", "🖤", "🗯️"].map(
  (emoji, index) => (
    <span
      key={`${emoji}-${index}`}
      className="pointer-events-none select-none text-[1.7rem] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
    >
      {emoji}
    </span>
  )
);

export function ExplodingInputExample({ className }: { className?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex w-full max-w-[320px] flex-col gap-3", className)}>
      <div className="relative">
        <LabelInput
          ref={inputRef}
          label="Username"
          autoComplete="username"
          name="username"
          spellCheck={false}
        />
        <ExplodingInput
          targetRef={inputRef}
          wrapperClassName="z-10"
          content={particleContent}
          direction={{ horizontal: "left", vertical: "top" }}
          gravity={0.5}
          duration={3}
          count={3}
        />
      </div>
      <span className="type-caption text-[var(--dial-text-label)]">
        You can change your username anytime.
      </span>
    </div>
  );
}
