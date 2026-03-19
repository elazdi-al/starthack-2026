"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CentralControlExample } from "@/components/examples/central-control-example";
import { GreenhouseGrid } from "@/components/interface/greenhouse-grid";
import { CentralControlPanel } from "@/components/interface/central-control-panel";
import { useGreenhouseStore, type CropType } from "@/lib/greenhouse-store";
import { DialStore } from "@/components/ui/central-control";
import { HighlightTabs } from "@/components/ui/highlight-tabs";

import { ClockWidget } from "@/components/interface/clock-widget";
import { SettingsButton } from "@/components/interface/settings-button";
import { TemperatureWidget } from "@/components/interface/temperature-widget";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { AgentDecisionPanel } from "@/components/interface/agent-decision-panel";
import { SimulationOverrides } from "@/components/interface/simulation-overrides";
import { EnvWidgetShells } from "@/components/interface/env-widget-shells";
import { SquaresFour, Leaf, Gavel, Robot } from "@phosphor-icons/react";

type IntroStage = "sealed" | "opening" | "open";

export default function Home() {
  const tickInFlight      = useGreenhouseStore((s) => s.tickInFlight);
  const autonomousEnabled = useGreenhouseStore((s) => s.autonomousEnabled);
  const decisionCount     = useGreenhouseStore((s) => s.agentDecisions.length);
  const shouldReduceMotion = useReducedMotion();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [controlOpen, setControlOpen] = React.useState(false);
  const [agentOpen, setAgentOpen]     = React.useState(false);
  const [activeTab, setActiveTab]     = React.useState("greenhouse");
  const [introStage, setIntroStage] = React.useState<IntroStage>("sealed");
  const setFocusedCrop = useGreenhouseStore((s) => s.setFocusedCrop);

  React.useEffect(() => {
    if (shouldReduceMotion) {
      setIntroStage("open");
      return;
    }

    const openingTimer = window.setTimeout(() => {
      setIntroStage("opening");
    }, 800);
    const completeTimer = window.setTimeout(() => {
      setIntroStage("open");
    }, 2350);

    return () => {
      window.clearTimeout(openingTimer);
      window.clearTimeout(completeTimer);
    };
  }, [shouldReduceMotion]);

  const handleControlOpenChange = (next: boolean) => {
    setControlOpen(next);
    if (!next) {
      setFocusedCrop(null);
    } else {
      const cropValues = DialStore.getValues("sim-crops");
      const selectedCrop = cropValues?.cropType as CropType | undefined;
      if (selectedCrop) {
        setFocusedCrop(selectedCrop);
      }
    }
  };

  const interfaceVisible = introStage === "open";

  const navTabs = React.useMemo(
    () => [
      { value: "greenhouse", label: "Greenhouse", icon: <Leaf size={16} weight="fill" /> },
      { value: "dashboard",  label: "Dashboard",  icon: <SquaresFour size={16} weight="fill" /> },
      { value: "rules",      label: "Rules",      icon: <Gavel size={16} weight="fill" /> },
    ],
    []
  );

  const handleTabChange = React.useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <main
        aria-hidden={false}
        className="relative min-h-screen transition-[margin-right] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ marginRight: sidebarOpen ? 360 : 0 }}
      >
        <CentralControlExample />
        <SimulationOverrides />
        <GreenhouseGrid introStage={introStage} />

        <AnimatePresence>
          {interfaceVisible && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(8px)" }}
                transition={{ duration: 0.42, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-6 top-6 flex items-center gap-2"
              >
                <ClockWidget />
                <TemperatureWidget />
                <EnvWidgetShells />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(8px)" }}
                transition={{ duration: 0.42, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className={`absolute right-6 top-6 flex items-center gap-3 ${controlOpen ? "z-50" : ""}`}
              >
                <CentralControlPanel
                  open={controlOpen}
                  onOpenChange={handleControlOpenChange}
                />
                <div className="size-10 shrink-0" />
              </motion.div>

              {agentOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: 6, filter: "blur(8px)" }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-20 left-6"
                >
                  <AgentDecisionPanel onClose={() => setAgentOpen(false)} />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 6, filter: "blur(8px)" }}
                transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2"
              >
                <SettingsButton />
                <HighlightTabs
                  items={navTabs}
                  value={activeTab}
                  onValueChange={handleTabChange}
                  defaultValue="greenhouse"
                />
                <AgentToggleButton
                  active={agentOpen}
                  running={tickInFlight}
                  autonomousEnabled={autonomousEnabled}
                  decisionCount={decisionCount}
                  onClick={() => setAgentOpen((v) => !v)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {interfaceVisible && (
          <>
            <motion.div
              initial={{ opacity: 0, x: 12, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 8, filter: "blur(8px)" }}
              transition={{ duration: 0.42, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className={`fixed right-6 top-6 ${controlOpen ? "z-40" : "z-60"}`}
            >
              <SidebarToggle
                pressed={sidebarOpen}
                onPressedChange={setSidebarOpen}
              />
            </motion.div>

            <ChatSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentToggleButton({
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
        "relative h-[34px] w-[34px] shrink-0 rounded-full flex items-center justify-center transition-colors",
        active
          ? "bg-[var(--highlight-tabs-active)] text-[var(--highlight-tabs-active-foreground)]"
          : "bg-[var(--highlight-tabs-bg)] text-[var(--highlight-tabs-text)] hover:text-[var(--dial-text-primary)]",
      ].join(" ")}
    >
      <Robot size={16} weight={autonomousEnabled ? "fill" : "regular"} className={running ? "animate-pulse" : ""} />
      {decisionCount > 0 && !active && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold" style={{ fontSize: "9px" }}>
          {decisionCount > 99 ? "99+" : decisionCount}
        </span>
      )}
      {running && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-[var(--highlight-tabs-bg)] animate-pulse" />
      )}
    </button>
  );
}