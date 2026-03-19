"use client";

import * as React from "react";
import type { CSSProperties } from "react";

import { CentralControlExample } from "@/components/examples/central-control-example";
import { GreenhouseGrid } from "@/components/interface/greenhouse-grid";
import { CentralControlPanel } from "@/components/interface/central-control-panel";
import { ColorSelectorExample } from "@/components/examples/color-selector-example";
import { HoldToDeleteExample } from "@/components/examples/hold-to-delete-example";
import { ExplodingInputExample } from "@/components/examples/exploding-input-example";
import { RunningWidgetExample } from "@/components/examples/running-widget-example";
import { SwitchExample } from "@/components/examples/switch-example";
import { TypographySpecimen } from "@/components/examples/typography-specimen";
import { WalletWidgetExample } from "@/components/examples/wallet-widget-example";
import {
  ArrowRightCircleIcon,
  ArrowUpCircleIcon,
  BalancesIcon,
  BillingIcon,
  ComponentsGlyphIcon,
  CourseArrowIcon,
  CustomersIcon,
  DeleteActionActiveIcon,
  DeleteActionIcon,
  NotificationBellIcon,
  NotificationBellMutedIcon,
  PaymentsIcon,
} from "@/components/icons";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/ui/code-block";
import { FilterBar } from "@/components/ui/filter-bar";
import { HighlightTabs } from "@/components/ui/highlight-tabs";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/ui/search-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlignBottomSimple,
  AlignCenterVerticalSimple,
  AlignTopSimple,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CaretRight,
  DotsThree,
  Layout,
  Minus,
  Sparkle,
  Swatches,
  TextAa,
} from "@phosphor-icons/react";
>>>>>>> aca35ad (feat: add central control)

import { ClockWidget } from "@/components/interface/clock-widget";
import { SettingsButton } from "@/components/interface/settings-button";
import { TemperatureWidget } from "@/components/interface/temperature-widget";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { SpeedSelector } from "@/components/interface/speed-selector";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

const lightModeVars = {
  "--background": "#ffffff",
  "--foreground": "rgb(23 23 23)",
  "--accent": "rgb(0 0 0 / 0.06)",
  "--border": "rgb(0 0 0 / 0.05)",
  "--ring": "rgb(0 0 0 / 0.12)",
  "--dial-surface": "#fafafa",
  "--dial-surface-hover": "#f5f5f5",
  "--dial-surface-active": "#ffffff",
  "--dial-text-root": "#171717",
  "--dial-text-section": "#525252",
  "--dial-text-label": "#737373",
  "--dial-text-primary": "rgb(23 23 23)",
  "--dial-text-secondary": "rgb(82 82 91)",
  "--dial-text-tertiary": "#a3a3a3",
  "--dial-border": "rgb(0 0 0 / 0.05)",
  "--dial-border-hover": "rgb(0 0 0 / 0.09)",
  "--dial-glass-bg": "#ffffff",
  "--dial-backdrop-blur": "14px",
  "--dial-radius": "8px",
  "--dial-panel-radius": "14px",
  "--dial-row-height": "36px",
  "--dial-shadow": "0 8px 24px rgb(0 0 0 / 0.04)",
  "--icon-strong": "rgba(17, 24, 39, 0.92)",
  "--icon-muted": "rgba(17, 24, 39, 0.76)",
  "--icon-subtle": "rgba(17, 24, 39, 0.52)",
} as CSSProperties;

export default function Home() {
  const [speed, setSpeed] = React.useState("x1");
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
    <main
      ref={mainRef}
      className="relative min-h-screen bg-background text-foreground"
      style={lightModeVars}
    >
      <CentralControlExample />
      <GreenhouseGrid />

      <div className="absolute left-6 top-6 flex items-center gap-2">
        <ClockWidget />
        <TemperatureWidget />
      </div>

      <div className="absolute right-6 top-6 flex items-center gap-3">
        <SpeedSelector
          value={speed}
          onValueChange={setSpeed}
          open={speedOpen}
          onOpenChange={handleSpeedOpenChange}
          portalContainer={portalContainer}
        />
        <CentralControlPanel
          open={controlOpen}
          onOpenChange={handleControlOpenChange}
        />
        <SidebarToggle
          pressed={sidebarOpen}
          onPressedChange={setSidebarOpen}
        />
      </div>

      <div className="absolute bottom-6 left-6">
        <SettingsButton />
      </div>

      <ChatSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </main>
  );
}
