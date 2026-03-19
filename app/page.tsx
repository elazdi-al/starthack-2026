"use client";

import * as React from "react";

import { CentralControlExample } from "@/components/examples/central-control-example";
import { GreenhouseGrid } from "@/components/interface/greenhouse-grid";
import { CentralControlPanel } from "@/components/interface/central-control-panel";

import { ClockWidget } from "@/components/interface/clock-widget";
import { SettingsButton } from "@/components/interface/settings-button";
import { TemperatureWidget } from "@/components/interface/temperature-widget";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { SpeedSelector } from "@/components/interface/speed-selector";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [controlOpen, setControlOpen] = React.useState(false);
  const [speedOpen, setSpeedOpen] = React.useState(false);
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);
  const mainRef = React.useCallback((node: HTMLElement | null) => {
    setPortalContainer(node);
  }, []);

  const handleControlOpenChange = (next: boolean) => {
    if (next) setSpeedOpen(false);
    setControlOpen(next);
  };

  const handleSpeedOpenChange = (next: boolean) => {
    if (next) setControlOpen(false);
    setSpeedOpen(next);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <main
        ref={mainRef}
        className="relative min-h-screen transition-[margin-right] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ marginRight: sidebarOpen ? 360 : 0 }}
      >
        <CentralControlExample />
        <GreenhouseGrid />

        <div className="absolute left-6 top-6 flex items-center gap-2">
          <ClockWidget />
          <TemperatureWidget />
        </div>

        <div className={`absolute right-6 top-6 flex items-center gap-3 ${controlOpen ? "z-50" : ""}`}>
          <SpeedSelector
            open={speedOpen}
            onOpenChange={handleSpeedOpenChange}
            portalContainer={portalContainer}
          />
          <CentralControlPanel
            open={controlOpen}
            onOpenChange={handleControlOpenChange}
          />
          <div className="size-10 shrink-0" />
        </div>

        <div className="absolute bottom-6 left-6">
          <SettingsButton />
        </div>
      </main>

      <div className={`fixed right-6 top-6 ${controlOpen ? "z-40" : "z-60"}`}>
        <SidebarToggle
          pressed={sidebarOpen}
          onPressedChange={setSidebarOpen}
        />
      </div>

      <ChatSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </div>
  );
}
