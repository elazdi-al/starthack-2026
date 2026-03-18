"use client";

import * as React from "react";
import type { CSSProperties } from "react";

import { SettingsButton } from "@/components/interface/settings-button";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { SpeedSelector } from "@/components/interface/speed-selector";

const lightModeVars = {
  "--background": "#ffffff",
  "--foreground": "rgb(23 23 23)",
  "--accent": "rgb(0 0 0 / 0.06)",
  "--dial-text-primary": "rgb(23 23 23)",
  "--dial-text-secondary": "rgb(82 82 91)",
  "--icon-strong": "rgba(17, 24, 39, 0.92)",
  "--icon-muted": "rgba(17, 24, 39, 0.76)",
  "--icon-subtle": "rgba(17, 24, 39, 0.52)",
} as CSSProperties;

export default function Home() {
  const [speed, setSpeed] = React.useState("x1");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <main
      className="relative min-h-screen bg-background text-foreground"
      style={lightModeVars}
    >
      <div className="absolute right-6 top-6 flex items-center gap-3">
        <SpeedSelector value={speed} onValueChange={setSpeed} />
        <SidebarToggle
          pressed={sidebarOpen}
          onPressedChange={setSidebarOpen}
        />
      </div>

      <div className="absolute bottom-6 left-6">
        <SettingsButton />
      </div>
    </main>
  );
}
