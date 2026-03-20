"use client";

import * as React from "react";
import {
  X, Robot, ArrowsClockwise, Thermometer, Drop, Wind, Sun,
  Plant, Leaf, CheckCircle, Warning, CaretDown, CaretRight,
} from "@phosphor-icons/react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import type { AgentDecision, AgentAction } from "@/lib/greenhouse-store";
import { useSettingsStore } from "@/lib/settings-store";
import { triggerHaptic } from "@/lib/haptics";

interface Props {
  onClose: () => void;
}

export function AgentDecisionPanel({ onClose }: Props) {
  const decisions      = useGreenhouseStore((s) => s.agentDecisions);
  const tickInFlight   = useGreenhouseStore((s) => s.tickInFlight);
  const autonomousEnabled = useGreenhouseStore((s) => s.autonomousEnabled);
  const setAutonomousEnabled = useGreenhouseStore((s) => s.setAutonomousEnabled);
  const lastTickSimMinutes = useGreenhouseStore((s) => s.lastTickSimMinutes);
  const elapsedMinutes = useGreenhouseStore((s) => s.elapsedMinutes);
  const agentTickMinutes = useSettingsStore((s) => s.agentTickMinutes);
  const setAgentTickMinutes = useSettingsStore((s) => s.setAgentTickMinutes);

  const minutesSinceTick = Math.floor(elapsedMinutes - lastTickSimMinutes);
  const nextTickIn = Math.max(0, agentTickMinutes - minutesSinceTick);

  /* ── Drag via refs — no React state on mousemove ─────────────────────── */
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragOffsetRef = React.useRef({ x: 0, y: 0 });
  const dragRef = React.useRef<{
    startX: number; startY: number;
    offsetX: number; offsetY: number;
    baseLeft: number; baseTop: number;
    baseWidth: number; baseHeight: number;
  } | null>(null);

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { startX, startY, offsetX, offsetY, baseLeft, baseTop, baseWidth, baseHeight } = dragRef.current;
      let newX = offsetX + (e.clientX - startX);
      let newY = offsetY + (e.clientY - startY);

      newX = Math.max(-baseLeft, Math.min(window.innerWidth - baseLeft - baseWidth, newX));
      newY = Math.max(-baseTop, Math.min(window.innerHeight - baseTop - baseHeight, newY));

      dragOffsetRef.current = { x: newX, y: newY };
      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: dragOffsetRef.current.x,
      offsetY: dragOffsetRef.current.y,
      baseLeft: rect.left - dragOffsetRef.current.x,
      baseTop: rect.top - dragOffsetRef.current.y,
      baseWidth: rect.width,
      baseHeight: rect.height,
    };
    e.preventDefault();
  };

  return (
    <div ref={wrapperRef} className="pointer-events-auto">
    <div
      ref={panelRef}
      className="w-80 rounded-[14px] overflow-hidden flex flex-col max-h-[85vh]"
      style={{
        background: "var(--dial-glass-bg)",
        border: "1px solid var(--dial-border)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 var(--glass-panel-highlight), var(--dial-shadow)",
      }}
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-4 pt-3.5 pb-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--dial-border)", cursor: "grab" }}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <Robot
            size={14}
            weight="fill"
            className={tickInFlight ? "text-blue-500 animate-pulse" : "text-[var(--dial-text-secondary)]"}
          />
          <span className="type-label text-[var(--dial-text-root)]">Agent Decisions</span>
          {tickInFlight && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30">
              <ArrowsClockwise size={9} className="text-blue-500 animate-spin" />
              <span className="type-caption text-blue-500" style={{ fontSize: "9px" }}>thinking</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("soft");
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--dial-text-tertiary)] hover:text-[var(--dial-text-primary)] hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
          >
            <X size={11} weight="bold" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between shrink-0"
        style={{ borderBottom: "1px solid var(--dial-border)", background: "var(--dial-surface)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAutonomousEnabled(!autonomousEnabled);
              triggerHaptic("selection");
            }}
            className={[
              "relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none shrink-0",
              autonomousEnabled ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
                autonomousEnabled ? "translate-x-3.5" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
          <span className="type-caption text-[var(--dial-text-secondary)]">
            {autonomousEnabled ? "Autonomous ON" : "Autonomous OFF"}
          </span>
        </div>
        {autonomousEnabled && !tickInFlight && (
          <span className="type-caption text-[var(--dial-text-tertiary)] tabular-nums">
            next in {nextTickIn}m
          </span>
        )}
        {tickInFlight && (
          <span className="type-caption text-blue-500">running...</span>
        )}
      </div>

      {/* Agent tick interval slider */}
      {autonomousEnabled && (
        <div
          className="px-4 py-2 flex items-center gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--dial-border)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="type-caption text-[var(--dial-text-tertiary)] whitespace-nowrap">Period</span>
          <input
            type="range"
            min={30}
            max={480}
            step={30}
            value={agentTickMinutes}
            onChange={(e) => {
              setAgentTickMinutes(Number(e.target.value));
              triggerHaptic("soft");
            }}
            className="flex-1 h-1 accent-blue-500 cursor-pointer"
          />
          <span className="type-caption text-[var(--dial-text-secondary)] tabular-nums whitespace-nowrap w-10 text-right">
            {agentTickMinutes >= 60
              ? `${(agentTickMinutes / 60).toFixed(agentTickMinutes % 60 === 0 ? 0 : 1)}h`
              : `${agentTickMinutes}m`}
          </span>
        </div>
      )}

      <div className="overflow-y-auto flex flex-col">
        {decisions.length === 0 ? (
          <EmptyState autonomousEnabled={autonomousEnabled} />
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--dial-border)" }}>
            {decisions.map((d, i) => (
              <DecisionCard key={d.id} decision={d} defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── Decision Card ────────────────────────────────────────────────────────────────

function DecisionCard({ decision, defaultOpen }: { decision: AgentDecision; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="px-4 py-3">
      {/* Card header row */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          triggerHaptic("selection");
        }}
        className="w-full flex items-start gap-2 text-left"
      >
        <div className="mt-0.5 shrink-0 text-[var(--dial-text-tertiary)]">
          {open ? <CaretDown size={10} weight="bold" /> : <CaretRight size={10} weight="bold" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="type-caption text-[var(--dial-text-tertiary)] tabular-nums shrink-0">
              Sol {decision.sol} {decision.time}
            </span>
            <ActionBadge count={decision.actionCount} />
          </div>
          <p className="type-ui text-[var(--dial-text-primary)] leading-snug">{decision.summary}</p>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="mt-3 flex flex-col gap-2.5 ml-3.5">
          {/* Reasoning text */}
          {decision.reasoning && (
            <p className="type-caption text-[var(--dial-text-secondary)] leading-relaxed">
              {decision.reasoning}
            </p>
          )}

          {/* Actions */}
          {decision.actions.length > 0 ? (
            <div>
              <p className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider mb-1.5">
                Actions taken
              </p>
              <div className="flex flex-col gap-1">
                {summarizeActionList(decision.actions).map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${item.color}`}
                    style={{ fontSize: "10px" }}
                  >
                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                    <span className="font-medium truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CheckCircle size={11} className="text-emerald-500" weight="fill" />
              <span className="type-caption text-[var(--dial-text-tertiary)]">No changes needed — system nominal</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Action Row ───────────────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, React.ReactNode> = {
  globalHeatingPower: <Thermometer size={10} weight="fill" />,
  co2InjectionRate:   <Wind size={10} weight="fill" />,
  ventilationRate:    <Wind size={10} weight="fill" />,
  lightingPower:      <Sun size={10} weight="fill" />,
  waterPumpRate:      <Drop size={10} weight="fill" />,
  localHeatingPower:  <Thermometer size={10} weight="fill" />,
  harvest:            <Leaf size={10} weight="fill" />,
  replant:            <Plant size={10} weight="fill" />,
};

const ACTION_COLORS: Record<string, string> = {
  greenhouse: "text-blue-500 bg-blue-500/10 border-blue-500/25",
  crop:       "text-emerald-500 bg-emerald-500/10 border-emerald-500/25",
  harvest:    "text-amber-500 bg-amber-500/10 border-amber-500/25",
  replant:    "text-violet-500 bg-violet-500/10 border-violet-500/25",
  "batch-tile": "text-violet-500 bg-violet-500/10 border-violet-500/25",
};

/** Collapse raw actions into human-readable summary rows. */
function summarizeActionList(actions: AgentAction[]): Array<{ label: string; icon: React.ReactNode; color: string }> {
  const rows: Array<{ label: string; icon: React.ReactNode; color: string }> = [];

  // Collect tile operations by crop
  const plantCounts: Record<string, number> = {};
  let harvestTileCount = 0;
  let clearTileCount = 0;

  for (const a of actions) {
    if (a.type === "batch-tile") {
      for (const p of a.plants ?? []) {
        plantCounts[p.crop] = (plantCounts[p.crop] ?? 0) + 1;
      }
      harvestTileCount += a.harvests?.length ?? 0;
      clearTileCount += a.clears?.length ?? 0;
    } else if (a.type === "harvest" && a.crop) {
      rows.push({
        label: `Harvested all ${a.crop}`,
        icon: <Leaf size={10} weight="fill" />,
        color: ACTION_COLORS.harvest,
      });
    } else if (a.type === "replant" && a.crop) {
      rows.push({
        label: `Replanted all ${a.crop}`,
        icon: <Plant size={10} weight="fill" />,
        color: ACTION_COLORS.replant,
      });
    } else if (a.type === "greenhouse" && a.param) {
      const paramLabel = PARAM_LABELS[a.param] ?? a.param;
      rows.push({
        label: `${paramLabel} → ${formatValue(a.param, a.value)}`,
        icon: ACTION_ICON[a.param] ?? null,
        color: ACTION_COLORS.greenhouse,
      });
    } else if (a.type === "crop" && a.param && a.crop) {
      const paramLabel = PARAM_LABELS[a.param] ?? a.param;
      rows.push({
        label: `${a.crop} ${paramLabel} → ${formatValue(a.param, a.value)}`,
        icon: ACTION_ICON[a.param] ?? null,
        color: ACTION_COLORS.crop,
      });
    }
  }

  // Emit aggregated tile rows
  for (const [crop, count] of Object.entries(plantCounts)) {
    rows.push({
      label: `Planted ${count} ${crop}`,
      icon: <Plant size={10} weight="fill" />,
      color: ACTION_COLORS.replant,
    });
  }
  if (harvestTileCount > 0) {
    rows.push({
      label: `Harvested ${harvestTileCount} tile${harvestTileCount > 1 ? "s" : ""}`,
      icon: <Leaf size={10} weight="fill" />,
      color: ACTION_COLORS.harvest,
    });
  }
  if (clearTileCount > 0) {
    rows.push({
      label: `Cleared ${clearTileCount} tile${clearTileCount > 1 ? "s" : ""}`,
      icon: <Leaf size={10} weight="fill" />,
      color: ACTION_COLORS.harvest,
    });
  }

  return rows;
}

// ─── Sub-components ───────────────────────────────────────────────────────────────

function ActionBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
        <CheckCircle size={8} className="text-emerald-500" weight="fill" />
        <span className="type-caption text-emerald-500" style={{ fontSize: "9px" }}>nominal</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25">
      <Warning size={8} className="text-blue-500" weight="fill" />
      <span className="type-caption text-blue-500" style={{ fontSize: "9px" }}>{count} action{count !== 1 ? "s" : ""}</span>
    </span>
  );
}

function EmptyState({ autonomousEnabled }: { autonomousEnabled: boolean }) {
  return (
    <div className="px-4 py-10 flex flex-col items-center gap-3 text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
      >
        <Robot size={18} className="text-[var(--dial-text-tertiary)]" />
      </div>
      <div>
        <p className="type-ui text-[var(--dial-text-secondary)] font-medium mb-1">No decisions yet</p>
        <p className="type-caption text-[var(--dial-text-tertiary)] leading-relaxed">
          {autonomousEnabled
            ? "The agent will analyse the greenhouse every 2 simulation hours and log its decisions here."
            : "Enable autonomous mode to let the agent monitor and adjust the greenhouse automatically."}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────

const PARAM_LABELS: Record<string, string> = {
  globalHeatingPower: "Heating",
  co2InjectionRate:   "CO₂ inj.",
  ventilationRate:    "Ventilation",
  lightingPower:      "Lighting",
  waterPumpRate:      "Water pump",
  localHeatingPower:  "Local heat",
};

function formatValue(param: string, value?: number): string {
  if (value === undefined) return "—";
  const units: Record<string, string> = {
    globalHeatingPower: "W",
    lightingPower:      "W",
    localHeatingPower:  "W",
    co2InjectionRate:   "ppm/h",
    ventilationRate:    "m³/h",
    waterPumpRate:      "L/h",
  };
  return `${value}${units[param] ? " " + units[param] : ""}`;
}
