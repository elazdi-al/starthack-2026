"use client";

import { Button } from "@/components/ui/button";
import { ControlPanelIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface CentralControlToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

export function CentralControlToggle({
  pressed,
  onPressedChange,
}: CentralControlToggleProps) {
  return (
    <Button
      aria-label={pressed ? "Hide controls" : "Show controls"}
      aria-pressed={pressed}
      size="icon-lg"
      variant="ghost"
      className={cn(
        "rounded-full border-transparent bg-transparent shadow-none hover:bg-accent",
        pressed
          ? "text-[var(--dial-text-primary)]"
          : "text-[var(--dial-text-secondary)] hover:text-[var(--dial-text-primary)]"
      )}
      onContextMenu={(event) => {
        event.currentTarget.blur();
      }}
      onClick={() => onPressedChange(!pressed)}
    >
      <ControlPanelIcon className="size-6" tone={pressed ? "strong" : "muted"} />
    </Button>
  );
}
