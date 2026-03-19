"use client";

import * as React from "react";

import { CentralControlExample } from "@/components/examples/central-control-example";
import { GreenhouseGrid } from "@/components/interface/greenhouse-grid";
import { CentralControlPanel } from "@/components/interface/central-control-panel";

import { ClockWidget } from "@/components/interface/clock-widget";
import { SettingsButton } from "@/components/interface/settings-button";
import { TemperatureWidget } from "@/components/interface/temperature-widget";
import { SeasonWidget } from "@/components/interface/season-widget";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { SpeedSelector } from "@/components/interface/speed-selector";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MarsEnvironmentPanel } from "@/components/interface/mars-environment-panel";
import { GreenhouseProgressPanel } from "@/components/interface/greenhouse-progress-panel";
import { AgentDecisionPanel } from "@/components/interface/agent-decision-panel";
import { SimulationOverrides } from "@/components/interface/simulation-overrides";
import { Planet, Leaf, Robot } from "@phosphor-icons/react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

export default function Home() {
  const tickInFlight      = useGreenhouseStore((s) => s.tickInFlight);
  const autonomousEnabled = useGreenhouseStore((s) => s.autonomousEnabled);
  const decisionCount     = useGreenhouseStore((s) => s.agentDecisions.length);

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [controlOpen, setControlOpen] = React.useState(false);
  const [speedOpen, setSpeedOpen]     = React.useState(false);
  const [marsOpen, setMarsOpen]       = React.useState(false);
  const [greenhouseOpen, setGreenhouseOpen] = React.useState(false);
  const [agentOpen, setAgentOpen]     = React.useState(false);

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
        <SimulationOverrides />
        <GreenhouseGrid />

        <div className="absolute left-6 top-6 flex items-center gap-2">
          <ClockWidget />
          <TemperatureWidget />
          <SeasonWidget />
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

        {/* Mars environment panel */}
        {marsOpen && (
          <div className="absolute bottom-20 left-6">
            <MarsEnvironmentPanel onClose={() => setMarsOpen(false)} />
          </div>
        )}

        {/* Greenhouse progress panel */}
        {greenhouseOpen && (
          <div className="absolute bottom-20 right-6">
            <GreenhouseProgressPanel onClose={() => setGreenhouseOpen(false)} />
          </div>
        )}

        {/* Agent decision panel */}
        {agentOpen && (
          <div className="absolute top-20 left-6">
            <AgentDecisionPanel onClose={() => setAgentOpen(false)} />
          </div>
        )}

        <div className="absolute bottom-6 left-6 flex items-center gap-2">
          <SettingsButton />
          <DashboardToggle
            icon={<Planet size={16} weight="fill" />}
            label="Mars Environment"
            active={marsOpen}
            onClick={() => setMarsOpen((v) => !v)}
          />
          <DashboardToggle
            icon={<Leaf size={16} weight="fill" />}
            label="Greenhouse Progress"
            active={greenhouseOpen}
            onClick={() => setGreenhouseOpen((v) => !v)}
          />
          <AgentToggle
            active={agentOpen}
            running={tickInFlight}
            autonomousEnabled={autonomousEnabled}
            decisionCount={decisionCount}
            onClick={() => setAgentOpen((v) => !v)}
          />
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

function DashboardToggle({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={[
        "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
        active
          ? "bg-neutral-900 text-white dark:bg-white/15 dark:text-white"
          : "bg-neutral-900 text-white/60 dark:bg-white/8 dark:text-white/60 hover:text-white hover:bg-neutral-700 dark:hover:bg-white/15",
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

function AgentToggle({
  active, running, autonomousEnabled, decisionCount, onClick,
}: {
  active: boolean;
  running: boolean;
  autonomousEnabled: boolean;
  decisionCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Agent Decisions"
      className={[
        "relative h-10 w-10 rounded-full flex items-center justify-center transition-colors",
        active
          ? "bg-neutral-900 text-white dark:bg-white/15 dark:text-white"
          : "bg-neutral-900 text-white/60 dark:bg-white/8 dark:text-white/60 hover:text-white hover:bg-neutral-700 dark:hover:bg-white/15",
      ].join(" ")}
    >
      <Robot size={16} weight={autonomousEnabled ? "fill" : "regular"} className={running ? "animate-pulse" : ""} />
      {/* Decision count badge */}
      {decisionCount > 0 && !active && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold" style={{ fontSize: "9px" }}>
          {decisionCount > 99 ? "99+" : decisionCount}
        </span>
      )}
      {/* Running indicator */}
      {running && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-[#111] animate-pulse" />
      )}
    </button>
  );
}
