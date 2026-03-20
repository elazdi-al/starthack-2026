"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useReducedAnimations } from "@/lib/use-animation-config";

import { CentralControlExample } from "@/components/examples/central-control-example";
import { SnapshotSync } from "@/components/interface/snapshot-sync";
import { GreenhouseGrid, MarsBackdrop } from "@/components/interface/greenhouse-grid";
import { CentralControlPanel } from "@/components/interface/central-control-panel";
import { useGreenhouseStore, type CropType, type SeasonName } from "@/lib/greenhouse-store";
import { useSettingsStore } from "@/lib/settings-store";
import { useChatStore } from "@/lib/chat-store";
import { DialStore } from "@/components/ui/central-control";
import { HighlightTabs } from "@/components/ui/highlight-tabs";

import { ClockWidget } from "@/components/interface/clock-widget";
import { SettingsButton } from "@/components/interface/settings-button";
import { TemperatureWidget } from "@/components/interface/temperature-widget";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { McpSetupButton } from "@/components/interface/mcp-setup-button";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { CallOverlay } from "@/components/call/call-overlay";
import { ElevenLabsCallProvider } from "@/lib/eleven-labs-call-provider";
import { AgentDecisionPanel } from "@/components/interface/agent-decision-panel";
import { SimulationOverrides } from "@/components/interface/simulation-overrides";
import { EnvWidgetShells } from "@/components/interface/env-widget-shells";
import { ReportsView } from "@/components/interface/reports-view";
import { DashboardView } from "@/components/interface/dashboard-view";
import { SquaresFour, Leaf, Robot, FileText } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";

/* ── Types ─────────────────────────────────────────────────────────────────── */

type IntroStage = "sealed" | "opening" | "open";
type MainView = "greenhouse" | "dashboard" | "reports";

const VALID_VIEWS: ReadonlySet<string> = new Set(["greenhouse", "dashboard", "reports"]);

/** Derive the active view from the current pathname. */
function pathToView(pathname: string): MainView {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (segment && VALID_VIEWS.has(segment)) return segment as MainView;
  return "greenhouse";
}

/* ── Animation constants ───────────────────────────────────────────────────── */

const VIEW_ORDER: Record<MainView, number> = {
  greenhouse: 0,
  dashboard: 1,
  reports: 2,
};

const VIEWPORT_TRANSITION = {
  duration: 0.55,
  ease: [0.32, 0.72, 0, 1] as const,
};

const GREENHOUSE_PANEL_TRANSITION = {
  duration: 0.5,
  ease: [0.32, 0.72, 0, 1] as const,
};

const PANEL_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
  }),
  center: { x: 0 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
  }),
};

const UI_ENTER_TOP    = { opacity: 0, y: -10, scale: 0.98 };
const UI_ENTER_BOTTOM = { opacity: 0, y: 10, scale: 0.98 };
const UI_ENTER_RIGHT  = { opacity: 0, x: 12, scale: 0.98 };
const UI_ANIMATE_Y    = { opacity: 1, y: 0, scale: 1 };
const UI_ANIMATE_X    = { opacity: 1, x: 0, scale: 1 };
const UI_EXIT_TOP     = { opacity: 0, y: -6 };
const UI_EXIT_BOTTOM  = { opacity: 0, y: 6 };
const UI_EXIT_RIGHT   = { opacity: 0, x: 8 };

const UI_SPRING_A = { duration: 0.36, delay: 0.06, ease: [0.22, 1, 0.36, 1] };
const UI_SPRING_B = { duration: 0.36, delay: 0.10, ease: [0.22, 1, 0.36, 1] };
const UI_SPRING_C = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };
const UI_SPRING_D = { duration: 0.36, delay: 0.16, ease: [0.22, 1, 0.36, 1] };
const UI_SPRING_E = { duration: 0.36, delay: 0.12, ease: [0.22, 1, 0.36, 1] };

const ZERO_TRANSITION = { duration: 0 };

const SEASON_LABEL: Record<SeasonName, string> = {
  northern_spring: "Northern Spring",
  northern_summer: "Northern Summer",
  northern_autumn: "Northern Autumn",
  northern_winter: "Northern Winter",
};

const BACKDROP_ON  = { opacity: 1 };
const BACKDROP_OFF = { opacity: 0 };

const CONTAINED: React.CSSProperties = { contain: "strict" };

/* ── Layout ────────────────────────────────────────────────────────────────── */

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  /* ── Derive active view from the URL ──────────────────────────────────── */
  const activeView = pathToView(pathname);

  /* ── Track navigation direction for slide animations ──────────────────── */
  const prevViewRef = React.useRef<MainView>(activeView);
  const directionRef = React.useRef(1);

  if (prevViewRef.current !== activeView) {
    directionRef.current =
      VIEW_ORDER[activeView] > VIEW_ORDER[prevViewRef.current] ? 1 : -1;
    prevViewRef.current = activeView;
  }
  const viewDirection = directionRef.current;

  /* ── Optimistic tab state for instant highlight animation ─────────────── */
  const [activeTab, setActiveTab] = React.useState(activeView);

  React.useEffect(() => {
    setActiveTab(activeView);
  }, [activeView]);

  /* ── Store selectors ──────────────────────────────────────────────────── */
  const tickInFlight      = useGreenhouseStore((s) => s.tickInFlight);
  const autonomousEnabled = useGreenhouseStore((s) => s.autonomousEnabled);
  const decisionCount     = useGreenhouseStore((s) => s.agentDecisions.length);
  const dustStormActive   = useGreenhouseStore((s) => s.dustStormActive);
  const seasonName        = useGreenhouseStore((s) => s.seasonName);
  const setFocusedCrop    = useGreenhouseStore((s) => s.setFocusedCrop);
  const shouldReduceMotion = useReducedAnimations();

  /* ── Local UI state ───────────────────────────────────────────────────── */
  const [sidebarOpen, setSidebarOpen]       = React.useState(false);
  const [controlOpen, setControlOpen]       = React.useState(false);
  const [agentOpen, setAgentOpen]           = React.useState(false);
  const [introStage, setIntroStage]         = React.useState<IntroStage>("sealed");
  const [greenhouseVisible, setGreenhouseVisible] = React.useState(false);

  /* ── Hydrate stores from localStorage once on mount ───────────────────── */
  React.useEffect(() => {
    useGreenhouseStore.getState().hydrateFromStorage();
    useSettingsStore.getState().hydrateFromStorage();
    useChatStore.getState().hydrateFromStorage();
  }, []);

  /* ── Intro animation sequence ─────────────────────────────────────────── */
  React.useEffect(() => {
    if (shouldReduceMotion) {
      setIntroStage("open");
      return;
    }

    const openingTimer  = window.setTimeout(() => setIntroStage("opening"), 800);
    const completeTimer = window.setTimeout(() => setIntroStage("open"), 2350);

    return () => {
      window.clearTimeout(openingTimer);
      window.clearTimeout(completeTimer);
    };
  }, [shouldReduceMotion]);

  /* ── Keep focusedCrop in sync with toolbar visibility ──────────────── */
  React.useEffect(() => {
    if (!controlOpen) setFocusedCrop(null);
  }, [controlOpen, setFocusedCrop]);

  /* ── Callbacks ────────────────────────────────────────────────────────── */
  const handleSidebarOpenChange = React.useCallback((next: boolean) => {
    setSidebarOpen(next);
    if (next) setControlOpen(false);
  }, []);

  const handleControlOpenChange = React.useCallback((next: boolean) => {
    setControlOpen(next);
    if (next) setSidebarOpen(false);
    triggerHaptic("selection");
    if (!next) {
      setFocusedCrop(null);
    } else {
      const cropValues = DialStore.getValues("sim-crops");
      const selectedCrop = cropValues?.cropType as CropType | undefined;
      if (selectedCrop) setFocusedCrop(selectedCrop);
    }
  }, [setFocusedCrop]);

  const handleAgentToggle = React.useCallback(() => {
    triggerHaptic("selection");
    setAgentOpen((v) => !v);
  }, []);

  const handleAgentClose = React.useCallback(() => {
    setAgentOpen(false);
  }, []);

  /** Navigate to the selected tab route. */
  const handleTabChange = React.useCallback(
    (tab: string) => {
      if (!VALID_VIEWS.has(tab)) return;
      if (tab === activeView) return;
      setActiveTab(tab as MainView);                 // optimistic highlight
      router.push(`/${tab}`, { scroll: false });     // client-side navigation
    },
    [activeView, router],
  );

  const interfaceVisible = introStage === "open";

  const navTabs = React.useMemo(
    () => [
      { value: "greenhouse", label: "Greenhouse", icon: <Leaf size={16} weight="fill" /> },
      { value: "dashboard",  label: "Dashboard",  icon: <SquaresFour size={16} weight="fill" /> },
      { value: "reports",    label: "Reports",     icon: <FileText size={16} weight="fill" /> },
    ],
    [],
  );

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <ElevenLabsCallProvider>
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Page outlet — kept in tree for Next.js routing; pages return null */}
      {children}

      <main
        aria-hidden={false}
        className="relative min-h-screen overflow-hidden transition-[margin-right] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ marginRight: sidebarOpen ? 360 : 0, contain: "content" }}
      >
        <CentralControlExample />
        <SnapshotSync />
        <SimulationOverrides />

        <div className="absolute inset-0 isolate overflow-hidden bg-background">
          <motion.div
            aria-hidden="true"
            animate={activeView === "greenhouse" ? BACKDROP_ON : BACKDROP_OFF}
            transition={shouldReduceMotion ? ZERO_TRANSITION : VIEWPORT_TRANSITION}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            <MarsBackdrop dustStormActive={dustStormActive} />
          </motion.div>

          <AnimatePresence initial={false} custom={viewDirection}>
            {activeView === "greenhouse" && (
              <motion.section
                key="greenhouse"
                custom={viewDirection}
                initial={shouldReduceMotion ? false : "enter"}
                animate="center"
                exit={shouldReduceMotion ? BACKDROP_OFF : "exit"}
                variants={PANEL_VARIANTS}
                transition={shouldReduceMotion ? ZERO_TRANSITION : GREENHOUSE_PANEL_TRANSITION}
                className="absolute inset-0 z-10 will-change-transform"
              >
                <GreenhouseView
                  introStage={introStage}
                  greenhouseVisible={greenhouseVisible}
                  onGreenhouseVisibleChange={setGreenhouseVisible}
                />
              </motion.section>
            )}

            {activeView === "dashboard" && (
              <motion.section
                key="dashboard"
                custom={viewDirection}
                initial={shouldReduceMotion ? false : "enter"}
                animate="center"
                exit={shouldReduceMotion ? BACKDROP_OFF : "exit"}
                variants={PANEL_VARIANTS}
                transition={shouldReduceMotion ? ZERO_TRANSITION : GREENHOUSE_PANEL_TRANSITION}
                className="absolute inset-0 z-10 will-change-transform"
                style={CONTAINED}
              >
                <DashboardView />
              </motion.section>
            )}

            {activeView === "reports" && (
              <motion.section
                key="reports"
                custom={viewDirection}
                initial={shouldReduceMotion ? false : "enter"}
                animate="center"
                exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
                variants={PANEL_VARIANTS}
                transition={shouldReduceMotion ? { duration: 0 } : GREENHOUSE_PANEL_TRANSITION}
                className="absolute inset-0 z-10 will-change-transform"
              >
                <ReportsView />
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {interfaceVisible && (
            <>
              <motion.div
                initial={shouldReduceMotion ? false : UI_ENTER_TOP}
                animate={UI_ANIMATE_Y}
                exit={shouldReduceMotion ? undefined : UI_EXIT_TOP}
                transition={shouldReduceMotion ? ZERO_TRANSITION : UI_SPRING_A}
                className="absolute left-6 top-6 flex items-center gap-2"
              >
                <div className="rounded-lg flex items-center h-10 px-3 bg-[var(--dial-surface)]">
                  <span className="type-ui text-[var(--dial-text-primary)] font-medium whitespace-nowrap">
                    {SEASON_LABEL[seasonName]}
                  </span>
                </div>
                <ClockWidget />
                <TemperatureWidget />
                <EnvWidgetShells />
              </motion.div>

              <motion.div
                initial={shouldReduceMotion ? false : UI_ENTER_TOP}
                animate={UI_ANIMATE_Y}
                exit={shouldReduceMotion ? undefined : UI_EXIT_TOP}
                transition={shouldReduceMotion ? ZERO_TRANSITION : UI_SPRING_B}
                className={`absolute right-6 top-6 flex items-center gap-3 ${controlOpen ? "z-50" : ""}`}
              >
                <McpSetupButton />
                <CentralControlPanel
                  open={controlOpen}
                  onOpenChange={handleControlOpenChange}
                />
                <div className="size-10 shrink-0" />
              </motion.div>

              <AnimatePresence>
                {agentOpen && (
                  <motion.div
                    key="agent-panel"
                    initial={shouldReduceMotion ? false : UI_ENTER_BOTTOM}
                    animate={UI_ANIMATE_Y}
                    exit={shouldReduceMotion ? undefined : UI_EXIT_BOTTOM}
                    transition={shouldReduceMotion ? ZERO_TRANSITION : UI_SPRING_C}
                    className="absolute top-20 left-6 z-20 pointer-events-none"
                  >
                    <AgentDecisionPanel onClose={handleAgentClose} />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={shouldReduceMotion ? false : UI_ENTER_BOTTOM}
                animate={UI_ANIMATE_Y}
                exit={shouldReduceMotion ? undefined : UI_EXIT_BOTTOM}
                transition={shouldReduceMotion ? ZERO_TRANSITION : UI_SPRING_D}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2"
              >
                <SettingsButton />
                {activeView === "greenhouse" && (
                  <GreenhouseToggleButton
                    active={greenhouseVisible}
                    onClick={() => setGreenhouseVisible((value) => !value)}
                  />
                )}
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
                  onClick={handleAgentToggle}
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
              initial={shouldReduceMotion ? false : UI_ENTER_RIGHT}
              animate={UI_ANIMATE_X}
              exit={shouldReduceMotion ? undefined : UI_EXIT_RIGHT}
              transition={shouldReduceMotion ? ZERO_TRANSITION : UI_SPRING_E}
              className={`fixed right-6 top-6 ${controlOpen ? "z-40" : "z-60"}`}
            >
              <SidebarToggle
                pressed={sidebarOpen}
                onPressedChange={handleSidebarOpenChange}
              />
            </motion.div>

            <ChatSidebar open={sidebarOpen} onOpenChange={handleSidebarOpenChange} />
          </>
        )}
      </AnimatePresence>

      <CallOverlay />
    </div>
    </ElevenLabsCallProvider>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

const GreenhouseView = React.memo(function GreenhouseView({
  introStage,
  greenhouseVisible,
  onGreenhouseVisibleChange,
}: {
  introStage: IntroStage;
  greenhouseVisible: boolean;
  onGreenhouseVisibleChange?: (next: boolean) => void;
}) {
  return (
    <div className="absolute inset-0">
      <GreenhouseGrid
        introStage={introStage}
        greenhouseVisible={greenhouseVisible}
        onGreenhouseVisibleChange={onGreenhouseVisibleChange}
        showBackdrop={false}
      />
    </div>
  );
});

function GreenhouseToggleButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Hide greenhouse" : "Restore greenhouse"}
      aria-label={active ? "Hide greenhouse" : "Restore greenhouse"}
      aria-pressed={active}
      className={[
        "relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-transparent transition-[background-color,color,box-shadow] duration-200",
        active
          ? "bg-[var(--highlight-tabs-active)] text-[var(--highlight-tabs-active-foreground)]"
          : "bg-[var(--highlight-tabs-bg)] text-[var(--highlight-tabs-text)] hover:text-[var(--dial-text-primary)]",
      ].join(" ")}
    >
      <GreenhouseIcon active={active} />
    </button>
  );
}

function GreenhouseIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.25 16.25V9.6L10 4.75L15.75 9.6V16.25" />
      <path d="M6.65 16.25V10.9H13.35V16.25" opacity={active ? 1 : 0.76} />
      <path d="M10 10.9V16.25" opacity={active ? 1 : 0.76} />
      <path d="M6.65 13.55H13.35" opacity={active ? 1 : 0.76} />
      {!active && <path d="M5.15 5.4L14.85 15.1" opacity="0.72" />}
    </svg>
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
