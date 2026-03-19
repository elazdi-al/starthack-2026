"use client"

import * as React from "react"
import { Plugs } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { McpSetupDialog } from "@/components/interface/mcp-setup-dialog"
import { triggerHaptic } from "@/lib/haptics"

export function McpSetupButton() {
  const [open, setOpen] = React.useState(false)

  const handleClick = React.useCallback(() => {
    triggerHaptic("selection")
    setOpen(true)
  }, [])

  return (
    <>
      <Button
        aria-label="Setup MCP"
        size="icon-lg"
        variant="ghost"
        className="rounded-full border-transparent bg-transparent shadow-none text-(--dial-text-secondary) hover:text-(--dial-text-primary) hover:bg-accent"
        onClick={handleClick}
      >
        <Plugs className="size-5" weight="bold" />
      </Button>

      <McpSetupDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
