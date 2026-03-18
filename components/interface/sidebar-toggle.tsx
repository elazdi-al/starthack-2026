"use client";

import { Button } from "@/components/ui/button";
import { SidebarPanelIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface SidebarToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

export function SidebarToggle({
  pressed,
  onPressedChange,
}: SidebarToggleProps) {
  return (
    <Button
      aria-label={pressed ? "Hide sidebar" : "Show sidebar"}
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
      <SidebarPanelIcon className="size-6" tone={pressed ? "strong" : "muted"} />
    </Button>
  );
}
