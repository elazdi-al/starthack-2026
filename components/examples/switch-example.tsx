"use client"

import * as React from "react"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export function SwitchExample({ className }: { className?: string }) {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true)
  const [locationEnabled, setLocationEnabled] = React.useState(false)

  return (
    <div className={cn("flex w-full max-w-[18rem] flex-col", className)}>
      <Switch
        checked={notificationsEnabled}
        label="Notifications"
        onToggle={setNotificationsEnabled}
      />
      <Switch
        checked={locationEnabled}
        label="Location access"
        onToggle={setLocationEnabled}
      />
      <Switch disabled label="Disabled option" />
    </div>
  )
}
