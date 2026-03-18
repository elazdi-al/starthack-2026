"use client";

import { Button } from "@/components/ui/button";
import { SettingsGearIcon } from "@/components/icons";

interface SettingsButtonProps {
  onClick?: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <Button
      aria-label="Open settings"
      size="icon-lg"
      variant="ghost"
      className="rounded-full border-transparent bg-transparent text-[var(--dial-text-secondary)] shadow-none hover:bg-accent hover:text-[var(--dial-text-primary)]"
      onContextMenu={(event) => {
        event.currentTarget.blur();
      }}
      onClick={onClick}
    >
      <SettingsGearIcon className="size-6" tone="muted" />
    </Button>
  );
}
