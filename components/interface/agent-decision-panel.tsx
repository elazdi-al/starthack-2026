"use client";

import * as React from "react";
import {
  X, Robot, ArrowsClockwise, Thermometer, Drop, Wind, Sun,
  Plant, Leaf, CheckCircle, Warning, CaretDown, CaretRight,
  TreeStructure, ShieldCheck, Heart, Scales,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import type { AgentDecision, AgentAction } from "@/lib/greenhouse-store";
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

  const minutesSinceTick = Math.floor(elapsedMinutes - lastTickSimMinutes);
  const nextTickIn = Math.max(0, 120 - minutesSinceTick);

  return (
    <div
      className="w-80 rounded-[14px] overflow-hidden flex flex-col max-h-[85vh]"
      style={{
        background: "var(--dial-glass-bg)",
        border: "1px solid var(--dial-border)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 var(--glass-panel-highlight), var(--dial-shadow)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-3.5 pb-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--dial-border)" }}
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
  );
}

// ─── Decision Card ────────────────────────────────────────────────────────────────

function DecisionCard({ decision, defaultOpen }: { decision: AgentDecision; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);

  const hasAgentData = !!(
    decision.survivalJustification ||
    decision.wellbeingJustification ||
    decision.winningAgent ||
    decision.conflictType ||
    decision.riskScore != null ||
    decision.wellbeingScore != null
  );

  // Auto-show graph for the latest decision (defaultOpen === true)
  const [showGraph, setShowGraph] = React.useState(defaultOpen && hasAgentData);

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
          {/* Reasoning graph button */}
          {hasAgentData && (
            <button
              type="button"
              onClick={() => setShowGraph((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors self-start"
              style={{
                background: showGraph ? "var(--highlight-tabs-active-bg, rgba(59,130,246,0.12))" : "var(--dial-surface)",
                border: `1px solid ${showGraph ? "rgba(59,130,246,0.35)" : "var(--dial-border)"}`,
                color: showGraph ? "rgb(59,130,246)" : "var(--dial-text-secondary)",
              }}
            >
              <TreeStructure size={11} weight="bold" />
              <span className="type-caption font-medium" style={{ fontSize: "10px" }}>Reasoning</span>
            </button>
          )}

          {/* Reasoning graph */}
          <AnimatePresence>
            {showGraph && hasAgentData && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <ReasoningGraph decision={decision} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reasoning text (show when graph is not open) */}
          {!showGraph && decision.reasoning && (
            <div
              className="rounded-lg px-3 py-2.5"
              style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
            >
              <p className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider mb-1.5">
                Reasoning
              </p>
              <p className="type-caption text-[var(--dial-text-secondary)] leading-relaxed whitespace-pre-line">
                {decision.reasoning}
              </p>
            </div>
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

// ─── Reasoning Graph ──────────────────────────────────────────────────────────────

const AGENT_CONFIG = {
  survival: { label: "Survival", icon: ShieldCheck, color: "#ef4444", bgColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)" },
  wellbeing: { label: "Wellbeing", icon: Heart, color: "#ec4899", bgColor: "rgba(236,72,153,0.12)", borderColor: "rgba(236,72,153,0.35)" },
  arbiter: { label: "Arbiter", icon: Scales, color: "#3b82f6", bgColor: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.35)" },
} as const;

function ReasoningGraph({ decision }: { decision: AgentDecision }) {
  const [selectedAgent, setSelectedAgent] = React.useState<"survival" | "wellbeing" | "arbiter" | null>(null);

  const conflictLabel =
    decision.conflictType === "hard_veto" ? "Hard Veto" :
    decision.conflictType === "soft_conflict" ? "Soft Conflict" :
    decision.conflictType === "agreement" ? "Agreement" :
    "Evaluated";

  const conflictColor =
    decision.conflictType === "hard_veto" ? "#ef4444" :
    decision.conflictType === "soft_conflict" ? "#f59e0b" :
    "#22c55e";

  const winnerLabel =
    decision.winningAgent === "survival" ? "Survival" :
    decision.winningAgent === "wellbeing" ? "Wellbeing" :
    decision.winningAgent === "arbiter" ? "Hybrid" :
    decision.winningAgent === "both" ? "Both" :
    decision.winningAgent === "hardcoded" ? "Playbook" :
    decision.winningAgent ?? "—";

  const selectedText =
    selectedAgent === "survival" ? (decision.survivalJustification || "No survival data available.") :
    selectedAgent === "wellbeing" ? (decision.wellbeingJustification || "No wellbeing data available.") :
    selectedAgent === "arbiter" ? (decision.reasoning || "No arbiter reasoning available.") :
    null;

  const selectedConfig = selectedAgent ? AGENT_CONFIG[selectedAgent] : null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
    >
      {/* SVG Graph */}
      <svg viewBox="0 0 260 170" className="w-full" style={{ display: "block" }}>
        {/* Connection lines */}
        {/* Survival -> Arbiter */}
        <line x1="68" y1="50" x2="130" y2="110" stroke="var(--dial-border)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Wellbeing -> Arbiter */}
        <line x1="192" y1="50" x2="130" y2="110" stroke="var(--dial-border)" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* Highlight winning path */}
        {(decision.winningAgent === "survival" || decision.winningAgent === "both" || decision.winningAgent === "arbiter") && (
          <line x1="68" y1="50" x2="130" y2="110" stroke={AGENT_CONFIG.survival.color} strokeWidth="1.5" opacity="0.5" />
        )}
        {(decision.winningAgent === "wellbeing" || decision.winningAgent === "both" || decision.winningAgent === "arbiter") && (
          <line x1="192" y1="50" x2="130" y2="110" stroke={AGENT_CONFIG.wellbeing.color} strokeWidth="1.5" opacity="0.5" />
        )}

        {/* Conflict type label */}
        <text x="130" y="82" textAnchor="middle" fill={conflictColor} fontSize="8" fontWeight="600" fontFamily="inherit">
          {conflictLabel}
        </text>

        {/* Survival Agent node */}
        <AgentNode
          cx={68} cy={35}
          agent="survival"
          score={decision.riskScore}
          scoreLabel="Risk"
          selected={selectedAgent === "survival"}
          onClick={() => setSelectedAgent(selectedAgent === "survival" ? null : "survival")}
        />

        {/* Wellbeing Agent node */}
        <AgentNode
          cx={192} cy={35}
          agent="wellbeing"
          score={decision.wellbeingScore}
          scoreLabel="Wellbeing"
          selected={selectedAgent === "wellbeing"}
          onClick={() => setSelectedAgent(selectedAgent === "wellbeing" ? null : "wellbeing")}
        />

        {/* Arbiter node */}
        <AgentNode
          cx={130} cy={120}
          agent="arbiter"
          selected={selectedAgent === "arbiter"}
          onClick={() => setSelectedAgent(selectedAgent === "arbiter" ? null : "arbiter")}
        />

        {/* Decision output label */}
        <text x="130" y="155" textAnchor="middle" fill="var(--dial-text-tertiary)" fontSize="7.5" fontFamily="inherit">
          Decision: {winnerLabel}
        </text>
      </svg>

      {/* Agent text panel */}
      <AnimatePresence>
        {selectedAgent && selectedText && selectedConfig && (
          <motion.div
            key={selectedAgent}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-3 py-2.5"
              style={{ borderTop: `1px solid ${selectedConfig.borderColor}` }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <selectedConfig.icon size={10} weight="fill" style={{ color: selectedConfig.color }} />
                <span className="type-caption font-semibold" style={{ color: selectedConfig.color, fontSize: "10px" }}>
                  {selectedConfig.label}
                </span>
              </div>
              <p className="type-caption text-[var(--dial-text-secondary)] leading-relaxed whitespace-pre-line" style={{ fontSize: "10px" }}>
                {selectedText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Agent Node (SVG) ─────────────────────────────────────────────────────────────

function AgentNode({
  cx, cy, agent, score, scoreLabel, selected, onClick,
}: {
  cx: number;
  cy: number;
  agent: "survival" | "wellbeing" | "arbiter";
  score?: number;
  scoreLabel?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const config = AGENT_CONFIG[agent];
  const r = 16;

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Hover / selected ring */}
      <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={config.color} strokeWidth={selected ? 1.5 : 0} opacity={selected ? 0.6 : 0} />
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r} fill={config.bgColor} stroke={config.borderColor} strokeWidth="1" />
      {/* Icon (rendered as text fallback since we can't use React icons in SVG foreignObject reliably) */}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={config.color} fontSize="12" fontWeight="bold" fontFamily="inherit">
        {agent === "survival" ? "S" : agent === "wellbeing" ? "W" : "A"}
      </text>
      {/* Label */}
      <text x={cx} y={cy + r + 10} textAnchor="middle" fill="var(--dial-text-secondary)" fontSize="8" fontWeight="500" fontFamily="inherit">
        {config.label}
      </text>
      {/* Score */}
      {score !== undefined && scoreLabel && (
        <text x={cx} y={cy - r - 5} textAnchor="middle" fill={config.color} fontSize="7.5" fontWeight="600" fontFamily="inherit">
          {scoreLabel}: {score.toFixed(2)}
        </text>
      )}
    </g>
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
  "plant-tile": "text-violet-500 bg-violet-500/10 border-violet-500/25",
};

type DisplayAction = AgentAction & { count?: number };

/** Group plant-tile actions by crop so we show "Plant tomato ×5" instead of 5 rows */
function groupActions(actions: AgentAction[]): DisplayAction[] {
  const result: DisplayAction[] = [];
  const plantCounts = new Map<string, number>();

  for (const a of actions) {
    if (a.type === "plant-tile" && a.crop) {
      plantCounts.set(a.crop, (plantCounts.get(a.crop) ?? 0) + 1);
    } else {
      result.push(a);
    }
  }

  for (const [crop, count] of plantCounts) {
    result.push({ type: "plant-tile", crop, count });
  }

  return result;
}

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
    } else if (a.type === "plant-tile" && a.crop) {
      plantCounts[a.crop] = (plantCounts[a.crop] ?? 0) + 1;
    } else if (a.type === "harvest-tile") {
      harvestTileCount++;
    } else if (a.type === "clear-tile") {
      clearTileCount++;
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
