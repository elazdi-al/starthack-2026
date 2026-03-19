"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Heart,
  Brain,
  Lightning,
  Drop,
  Moon,
  Thermometer,
  Barbell,
  Heartbeat,
  Leaf,
  X,
} from "@phosphor-icons/react";
import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import type { RingData } from "@/components/charts/ring-context";

/* ─────────────────────────── Types ─────────────────────────── */

type HealthStatus = "nominal" | "caution" | "critical";
type NeedLevel = "good" | "moderate" | "low";

interface Crewmate {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  health: HealthStatus;
  condition: string;
  heartRate: number;
  bloodPressure: string;
  bodyTemp: number;
  o2Sat: number;
  sleep: number;
  stress: NeedLevel;
  morale: number;
  hydration: number;
  nutrition: number;
  calories: number;
  evaHours: number;
  taskLoad: NeedLevel;
  currentTask: string;
  specialty: string;
}

/* ─────────────────────────── Data ──────────────────────────── */

const CREW: Crewmate[] = [
  {
    id: "wei",
    name: "Wei",
    role: "Botanist",
    initials: "W",
    color: "#30d158",
    health: "nominal",
    condition: "Rested",
    heartRate: 68,
    bloodPressure: "118/76",
    bodyTemp: 36.6,
    o2Sat: 98,
    sleep: 7.2,
    stress: "good",
    morale: 88,
    hydration: 92,
    nutrition: 88,
    calories: 2180,
    evaHours: 142,
    taskLoad: "moderate",
    currentTask: "Monitoring tomato flowering cycle",
    specialty: "Closed-loop agriculture",
  },
  {
    id: "amara",
    name: "Amara",
    role: "Engineer",
    initials: "A",
    color: "#0a84ff",
    health: "nominal",
    condition: "Alert",
    heartRate: 72,
    bloodPressure: "122/78",
    bodyTemp: 36.7,
    o2Sat: 97,
    sleep: 6.8,
    stress: "moderate",
    morale: 81,
    hydration: 85,
    nutrition: 79,
    calories: 2340,
    evaHours: 218,
    taskLoad: "moderate",
    currentTask: "Solar panel diagnostics post-storm",
    specialty: "Life support & power systems",
  },
  {
    id: "lena",
    name: "Lena",
    role: "Medic",
    initials: "L",
    color: "#bf5af2",
    health: "caution",
    condition: "Fatigued",
    heartRate: 74,
    bloodPressure: "115/72",
    bodyTemp: 36.9,
    o2Sat: 97,
    sleep: 5.9,
    stress: "moderate",
    morale: 74,
    hydration: 76,
    nutrition: 82,
    calories: 1980,
    evaHours: 96,
    taskLoad: "moderate",
    currentTask: "Crew sleep pattern analysis",
    specialty: "Crew health & nutrition",
  },
  {
    id: "kenji",
    name: "Kenji",
    role: "Specialist",
    initials: "K",
    color: "#ff9f0a",
    health: "nominal",
    condition: "Sharp",
    heartRate: 65,
    bloodPressure: "116/74",
    bodyTemp: 36.5,
    o2Sat: 99,
    sleep: 7.5,
    stress: "good",
    morale: 91,
    hydration: 90,
    nutrition: 91,
    calories: 2420,
    evaHours: 186,
    taskLoad: "good",
    currentTask: "EVA prep for water extraction site",
    specialty: "Geology & EVA ops",
  },
];

/* ────────────────────── Apple-like ring colors ─────────────── */

const RING_COLORS = {
  move: "#FA114F",      // Apple Activity red/pink  → Hydration
  exercise: "#A8FF04",  // Apple Activity green/lime → Nutrition
  stand: "#00D4FF",     // Apple Activity cyan → Morale
} as const;

/* ────────────────────── Helpers ─────────────────────────────── */

const STATUS_COLOR: Record<HealthStatus, string> = {
  nominal: "#30d158",
  caution: "#ff9f0a",
  critical: "#ff453a",
};

const NEED_COLOR: Record<NeedLevel, string> = {
  good: "#30d158",
  moderate: "#ff9f0a",
  low: "#ff453a",
};

function levelOf(pct: number): NeedLevel {
  if (pct >= 85) return "good";
  if (pct >= 70) return "moderate";
  return "low";
}

/* ──────── Activity Rings using Bklit RingChart ──────────────── */

function ActivityRings({
  move,
  exercise,
  stand,
  size = 56,
}: {
  move: number;     // 0-100 (hydration)
  exercise: number; // 0-100 (nutrition)
  stand: number;    // 0-100 (morale)
  size?: number;
}) {
  const ringData: RingData[] = React.useMemo(
    () => [
      { label: "Hydration", value: move, maxValue: 100, color: RING_COLORS.move },
      { label: "Nutrition", value: exercise, maxValue: 100, color: RING_COLORS.exercise },
      { label: "Morale", value: stand, maxValue: 100, color: RING_COLORS.stand },
    ],
    [move, exercise, stand]
  );

  return (
    <RingChart
      data={ringData}
      size={size}
      strokeWidth={10}
      ringGap={3}
      baseInnerRadius={14}
    >
      {ringData.map((item, index) => (
        <Ring key={item.label} index={index} showGlow={false} />
      ))}
    </RingChart>
  );
}

/* ────────── Single Apple-style vital ring ──────────────────── */

function VitalRing({
  value,
  max,
  color,
  size = 44,
  strokeWidth = 4,
  children,
  animated = true,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  animated?: boolean;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block" aria-hidden="true" role="img">
        <title>{`${Math.round(value)}/${max}`}</title>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeOpacity={0.12}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
        {/* Progress */}
        {animated ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", filter: `drop-shadow(0 0 2px ${color}30)` }}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.4s ease" }}
          />
        )}
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Crew Card (redesigned) ────────────────────── */

function CrewCard({
  member,
  onClick,
  index,
}: {
  member: Crewmate;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] as const }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "rounded-2xl p-4 flex items-center gap-4 text-left w-full",
        "transition-shadow duration-200",
        "hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "cursor-pointer select-none"
      )}
      style={{
        background: "var(--dial-surface)",
        border: "1px solid var(--dial-border)",
      }}
    >
      {/* Activity Rings */}
      <ActivityRings
        move={member.hydration}
        exercise={member.nutrition}
        stand={member.morale}
        size={52}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="flex size-6 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `color-mix(in srgb, ${member.color} 14%, transparent)`,
              color: member.color,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {member.initials}
          </div>
          <span className="type-label text-[var(--dial-text-primary)]">{member.name}</span>
          <span
            className="inline-block size-[5px] shrink-0 rounded-full"
            style={{ background: STATUS_COLOR[member.health] }}
          />
        </div>
        <span className="type-caption text-[var(--dial-text-tertiary)] mt-0.5 block">{member.role}</span>

        {/* Quick stats row */}
        <div className="flex items-center gap-3 mt-2">
          <QuickStat
            label="Hydration"
            value={member.hydration}
            color={RING_COLORS.move}
          />
          <QuickStat
            label="Nutrition"
            value={member.nutrition}
            color={RING_COLORS.exercise}
          />
          <QuickStat
            label="Morale"
            value={member.morale}
            color={RING_COLORS.stand}
          />
        </div>
      </div>
    </motion.button>
  );
}

function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block size-[5px] rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="type-caption tabular-nums" style={{ color, fontSize: 10, fontWeight: 600 }}>
        {Math.round(value)}%
      </span>
    </div>
  );
}

/* ──────── Crew Overview: wellness summary (Bklit RingChart) ── */

function CrewOverviewChart() {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const ringData: RingData[] = React.useMemo(
    () =>
      CREW.map((c) => ({
        label: c.name,
        value: c.morale,
        maxValue: 100,
        color: c.color,
      })),
    []
  );

  const hoveredCrew = hoveredIndex !== null ? CREW[hoveredIndex] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: "var(--dial-surface)",
        border: "1px solid var(--dial-border)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider">
          Crew Wellness
        </span>
        <div className="flex items-center gap-3">
          {CREW.map((c) => (
            <div key={c.id} className="flex items-center gap-1">
              <span className="inline-block size-[5px] rounded-full" style={{ background: c.color }} />
              <span className="type-caption text-[var(--dial-text-tertiary)]" style={{ fontSize: 10 }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center py-1">
        <RingChart
          data={ringData}
          size={120}
          strokeWidth={7}
          ringGap={3}
          baseInnerRadius={24}
          hoveredIndex={hoveredIndex}
          onHoverChange={setHoveredIndex}
        >
          {ringData.map((item, index) => (
            <Ring key={item.label} index={index} />
          ))}
        </RingChart>
      </div>
      {/* Hover detail or summary */}
      <div className="flex items-center justify-center h-4">
        {hoveredCrew ? (
          <span className="type-caption tabular-nums" style={{ color: hoveredCrew.color, fontSize: 11, fontWeight: 600 }}>
            {hoveredCrew.name} — {hoveredCrew.morale}% morale
          </span>
        ) : (
          <span className="type-caption text-[var(--dial-text-tertiary)]" style={{ fontSize: 10 }}>
            Hover to inspect
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────────── Detail Modal ─────────────────────────── */

function CrewDetail({
  member,
  onClose,
}: {
  member: Crewmate;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="crew-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[6px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="crew-sheet"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as const }}
        className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none"
      >
        <dialog
          open
          aria-label={`${member.name} profile`}
          className="pointer-events-auto w-full max-w-[380px] max-h-[85vh] overflow-y-auto rounded-2xl p-0 m-0 border-none flex flex-col"
          style={{
            background: "var(--dial-glass-bg)",
            border: "1px solid var(--dial-border)",
          }}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full type-label"
              style={{
                background: `color-mix(in srgb, ${member.color} 14%, transparent)`,
                color: member.color,
              }}
            >
              {member.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="type-ui text-[var(--dial-text-root)]">{member.name}</span>
                <span
                  className="inline-block size-[6px] rounded-full"
                  style={{ background: STATUS_COLOR[member.health] }}
                />
              </div>
              <span className="type-caption text-[var(--dial-text-secondary)]">
                {member.role} &middot; {member.condition}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-full bg-[var(--dial-surface)] text-[var(--dial-text-tertiary)] hover:text-[var(--dial-text-primary)] transition-colors"
              aria-label="Close"
            >
              <X size={12} weight="bold" />
            </button>
          </div>

          {/* Apple-style Activity Rings */}
          <div className="flex items-center justify-center py-4">
            <ActivityRings
              move={member.hydration}
              exercise={member.nutrition}
              stand={member.morale}
              size={100}
            />
          </div>

          {/* Ring legend */}
          <div className="flex items-center justify-center gap-4 pb-3">
            <RingLegend label="Hydration" value={member.hydration} color={RING_COLORS.move} />
            <RingLegend label="Nutrition" value={member.nutrition} color={RING_COLORS.exercise} />
            <RingLegend label="Morale" value={member.morale} color={RING_COLORS.stand} />
          </div>

          {/* Grouped sections */}
          <GroupLabel>Vitals</GroupLabel>
          <GroupedList>
            <Row label="Heart Rate" value={`${member.heartRate} bpm`} icon={<Heartbeat size={14} weight="fill" />} />
            <Row label="Blood Pressure" value={member.bloodPressure} icon={<Heart size={14} weight="fill" />} />
            <Row label="Body Temp" value={`${member.bodyTemp}\u00b0C`} icon={<Thermometer size={14} weight="fill" />} />
            <Row label="O\u2082 Sat" value={`${member.o2Sat}%`} icon={<Drop size={14} weight="fill" />} color={NEED_COLOR[levelOf(member.o2Sat)]} last />
          </GroupedList>

          <GroupLabel>Wellness</GroupLabel>
          <GroupedList>
            <Row label="Sleep" value={`${member.sleep}h avg`} icon={<Moon size={14} weight="fill" />} color={NEED_COLOR[member.sleep >= 7 ? "good" : member.sleep >= 6 ? "moderate" : "low"]} />
            <Row label="Stress" value={member.stress === "good" ? "Low" : member.stress === "moderate" ? "Moderate" : "High"} icon={<Brain size={14} weight="fill" />} color={NEED_COLOR[member.stress]} />
            <Row label="Morale" value={`${member.morale}%`} icon={<Lightning size={14} weight="fill" />} color={NEED_COLOR[levelOf(member.morale)]} last />
          </GroupedList>

          <GroupLabel>Nutrition</GroupLabel>
          <GroupedList>
            <Row label="Hydration" value={`${member.hydration}%`} icon={<Drop size={14} weight="fill" />} color={NEED_COLOR[levelOf(member.hydration)]} />
            <Row label="Nutrition" value={`${member.nutrition}%`} icon={<Leaf size={14} weight="fill" />} color={NEED_COLOR[levelOf(member.nutrition)]} />
            <Row label="Calories" value={`${member.calories.toLocaleString()} kcal`} icon={<Barbell size={14} weight="fill" />} last />
          </GroupedList>

          <GroupLabel>Activity</GroupLabel>
          <GroupedList>
            <Row label="EVA Hours" value={`${member.evaHours}h total`} />
            <Row label="Task Load" value={member.taskLoad === "good" ? "Light" : member.taskLoad === "moderate" ? "Moderate" : "Heavy"} color={NEED_COLOR[member.taskLoad]} />
            <Row label="Current" value={member.currentTask} last />
          </GroupedList>

          <GroupLabel>Info</GroupLabel>
          <GroupedList>
            <Row label="Specialty" value={member.specialty} last />
          </GroupedList>

          <div className="h-4 shrink-0" />
        </dialog>
      </motion.div>
    </>
  );
}

/* ──────────── Ring legend item ──────────────────────────────── */

function RingLegend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="type-caption tabular-nums" style={{ color, fontWeight: 600, fontSize: 13 }}>
        {Math.round(value)}%
      </span>
      <span className="type-caption text-[var(--dial-text-tertiary)]" style={{ fontSize: 10 }}>
        {label}
      </span>
    </div>
  );
}

/* ──────────────── iOS grouped-list primitives ──────────────── */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider px-5 pt-4 pb-1.5">
      {children}
    </span>
  );
}

function GroupedList({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-4 rounded-[10px] overflow-hidden"
      style={{
        background: "var(--dial-surface)",
        border: "1px solid var(--dial-border)",
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  icon,
  color,
  last,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3.5 py-2",
        !last && "border-b border-[var(--dial-border)]"
      )}
    >
      {icon && (
        <span className="text-[var(--dial-text-tertiary)] shrink-0">{icon}</span>
      )}
      <span className="type-caption text-[var(--dial-text-secondary)] flex-1">{label}</span>
      <span
        className="type-caption tabular-nums text-right"
        style={{ color: color ?? "var(--dial-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────── Section Wrapper ───────────────────────── */

function CrewmatesSection() {
  const [selected, setSelected] = React.useState<Crewmate | null>(null);
  const handleClose = React.useCallback(() => setSelected(null), []);

  return (
    <>
      <section className="w-full flex flex-col gap-3">
        <span className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider px-1">
          Crew Members
        </span>

        {/* Crew cards: vertical stack for left panel */}
        <div className="flex flex-col gap-2">
          {CREW.map((c, i) => (
            <CrewCard
              key={c.id}
              member={c}
              onClick={() => setSelected(c)}
              index={i}
            />
          ))}
        </div>

        {/* Overview chart */}
        <CrewOverviewChart />
      </section>

      <AnimatePresence>
        {selected && (
          <CrewDetail member={selected} onClose={handleClose} />
        )}
      </AnimatePresence>
    </>
  );
}

export { CrewmatesSection, type Crewmate };
