"use client";

import * as React from "react";

import { ColorSelector, WIDGET_ACCENTS } from "@/components/ui/color-selector";
import { cn } from "@/lib/utils";

export function ColorSelectorExample({ className }: { className?: string }) {
  const [selectedColor, setSelectedColor] = React.useState<string>(WIDGET_ACCENTS[8]);
  const [appliedColor, setAppliedColor] = React.useState<string>(WIDGET_ACCENTS[8]);

  return (
    <div className={cn("flex w-full max-w-[400px] flex-col gap-3", className)}>
      <ColorSelector
        aria-label="Choose accent color"
        value={selectedColor}
        onColorSelect={setSelectedColor}
        onDone={setAppliedColor}
        doneLabel="Apply"
      />

      <div className="flex items-center gap-2 px-1">
        <span
          aria-hidden="true"
          className="size-3 rounded-full border border-black/5 shadow-sm"
          style={{ background: appliedColor }}
        />
        <p className="type-caption text-[var(--dial-text-label)]">
          Applied accent {appliedColor}
        </p>
      </div>
    </div>
  );
}
