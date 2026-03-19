"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { SettingsGearIcon } from "@/components/icons"
import { SettingsDialog } from "@/components/interface/settings-dialog"

export function SettingsButton() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        aria-label="Open settings"
        size="icon-lg"
        variant="ghost"
        className="rounded-full border-transparent bg-transparent text-[var(--dial-text-secondary)] shadow-none hover:bg-accent hover:text-[var(--dial-text-primary)]"
        onContextMenu={(event) => {
          event.currentTarget.blur()
        }}
        onClick={() => setOpen(true)}
      >
        <SettingsGearIcon className="size-6" tone="muted" />
      </Button>

      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
