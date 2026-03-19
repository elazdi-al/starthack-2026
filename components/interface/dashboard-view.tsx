"use client";

import { useMemo } from "react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { useLiveParam } from "@/lib/use-live-param";
import { LiveLineChart } from "@/components/charts/live-line-chart";
import { LiveLine } from "@/components/charts/live-line";
import { LiveXAxis } from "@/components/charts/live-x-axis";
import { LiveYAxis } from "@/components/charts/live-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { RadarArea } from "@/components/charts/radar-area";
import type { RadarData, RadarMetric } from "@/components/charts/radar-context";

/* ── Colors ────────────────────────────────────────────────────── */

const C = {
  temperature: "#FF453A",
  humidity: "#0A84FF",
  pressure: "#FF9F0A",
  harvest: "#30D158",
  nutrition: "#BF5AF2",
} as const;

/* ── Live parameter chart (squared) ────────────────────────────── */

interface LiveParamCardProps {
  label: string;
  unit: string;
  color: string;
  value: number;
  fmtVal: (v: number) => string;
  fmtAxis: (v: number) => string;
  window?: number;
}

function LiveParamCard({
  label,
  unit,
  color,
  value,
  fmtVal,
  fmtAxis,
  window: windowSecs = 60,
}: LiveParamCardProps) {
  const [data] = useLiveParam(value);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 h-full min-h-0">
      <div className="flex items-baseline justify-between px-0.5 shrink-0">
        <span className="text-[9px] font-medium tracking-wide uppercase text-muted-foreground">
          {label}
        </span>
        <span className="tabular-nums text-xs font-semibold text-foreground">
          {fmtVal(value)}
          <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <LiveLineChart
          data={data}
          value={value}
          window={windowSecs}
          numXTicks={3}
          nowOffsetUnits={1}
          lerpSpeed={0.12}
          style={{ height: '100%' }}
          margin={{ top: 8, right: 40, bottom: 20, left: 40 }}
        >
          <Grid horizontal />
          <LiveLine
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dotSize={2.5}
            badge={false}
            formatValue={fmtVal}
          />
          <LiveXAxis />
          <LiveYAxis position="left" formatValue={fmtAxis} />
          <ChartTooltip
            showDatePill={false}
            rows={(point) => {
              const v = point.value as number;
              return [{ color, label, value: `${fmtVal(v)} ${unit}` }];
            }}
          />
        </LiveLineChart>
      </div>
    </div>
  );
}

/* ── Crew data ─────────────────────────────────────────────────── */

type HealthStatus = "nominal" | "caution" | "critical";

interface CrewMember {
  name: string;
  role: string;
  color: string;
  health: HealthStatus;
  morale: number;
  hydration: number;
  nutrition: number;
  sleep: number;
  o2Sat: number;
  stress: number;
}

const CREW: CrewMember[] = [
  { name: "Wei",   role: "Botanist",   color: "#30D158", health: "nominal", morale: 88, hydration: 92, nutrition: 88, sleep: 7.2, o2Sat: 98, stress: 90 },
  { name: "Amara", role: "Engineer",   color: "#0A84FF", health: "nominal", morale: 81, hydration: 85, nutrition: 79, sleep: 6.8, o2Sat: 97, stress: 60 },
  { name: "Lena",  role: "Medic",      color: "#BF5AF2", health: "caution", morale: 74, hydration: 76, nutrition: 82, sleep: 5.9, o2Sat: 97, stress: 60 },
  { name: "Kenji", role: "Specialist", color: "#FF9F0A", health: "nominal", morale: 91, hydration: 90, nutrition: 91, sleep: 7.5, o2Sat: 99, stress: 90 },
];

const HEALTH_METRICS: RadarMetric[] = [
  { key: "morale",    label: "Morale" },
  { key: "hydration", label: "Hydra." },
  { key: "nutrition", label: "Nutri." },
  { key: "sleep",     label: "Sleep" },
  { key: "o2Sat",     label: "O\u2082" },
  { key: "stress",    label: "Stress" },
];

function crewToRadar(m: CrewMember): RadarData {
  return {
    label: m.name,
    color: m.color,
    values: {
      morale: m.morale,
      hydration: m.hydration,
      nutrition: m.nutrition,
      sleep: Math.min(100, (m.sleep / 8) * 100),
      o2Sat: m.o2Sat,
      stress: m.stress,
    },
  };
}

const STATUS_DOT: Record<HealthStatus, string> = {
  nominal: "bg-emerald-500",
  caution: "bg-amber-500",
  critical: "bg-red-500",
};

function CrewRadarCard({ member }: { member: CrewMember }) {
  const radarData = useMemo(() => [crewToRadar(member)], [member]);
  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2 h-full min-h-0">
      <div className="flex items-center gap-1.5 px-0.5 shrink-0">
        <div
          className="size-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
          style={{ background: member.color }}
        >
          {member.name[0]}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-semibold text-foreground leading-tight truncate">
            {member.name}
          </span>
          <span className="text-[8px] text-muted-foreground leading-tight truncate">
            {member.role}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <span className={`size-1.5 rounded-full ${STATUS_DOT[member.health]}`} />
          <span className="text-[8px] text-muted-foreground capitalize">{member.health}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <RadarChart data={radarData} metrics={HEALTH_METRICS} size={140} levels={3} margin={28}>
          <RadarGrid showLabels={false} />
          <RadarAxis />
          <RadarLabels fontSize={7} offset={12} />
          <RadarArea index={0} showGlow={false} />
        </RadarChart>
      </div>
    </div>
  );
}

/* ── Crop card ─────────────────────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  seed: "Seed",
  germination: "Germ.",
  vegetative: "Veg.",
  flowering: "Flower",
  fruiting: "Fruit",
  harvest_ready: "Ready",
  harvested: "Done",
};

const CROP_COLORS: Record<string, string> = {
  lettuce: "#30D158", tomato: "#FF453A", potato: "#AC8E68", soybean: "#30D158",
  spinach: "#34C759", wheat: "#FFD60A", radish: "#FF375F", kale: "#32D74B",
};

interface CropCardProps {
  name: string;
  growth: number;
  health: number;
  stage: string;
  yieldKg: number;
  biomassKg: number;
}

function CropCard({ name, growth, health, stage, yieldKg }: CropCardProps) {
  const color = CROP_COLORS[name.toLowerCase()] ?? "#888";
  const healthPct = Math.round(health * 100);
  const [growthData] = useLiveParam(growth);

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[10px] font-semibold text-foreground">{name}</span>
        </div>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {STAGE_LABELS[stage] ?? stage}
        </span>
      </div>
      {/* Mini dual live chart: growth + health */}
      <LiveLineChart
        data={growthData}
        value={growth}
        window={90}
        numXTicks={2}
        nowOffsetUnits={1}
        lerpSpeed={0.1}
        style={{ height: 56 }}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      >
        <LiveLine dataKey="value" stroke={color} strokeWidth={1} dotSize={1.5} pulse={false} badge={false} fill={true} />
      </LiveLineChart>
      {/* Stats row */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground tabular-nums px-0.5">
        <span>
          Growth <span className="text-foreground font-medium">{growth.toFixed(0)}%</span>
        </span>
        <span>
          Health{" "}
          <span className={`font-medium ${healthPct > 70 ? "text-emerald-500" : healthPct > 40 ? "text-amber-500" : "text-red-500"}`}>
            {healthPct}%
          </span>
        </span>
        <span>
          Yield <span className="text-foreground font-medium">{yieldKg.toFixed(1)}<span className="text-muted-foreground"> kg</span></span>
        </span>
      </div>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────── */

export function DashboardView() {
  const temperature = useGreenhouseStore((s) => s.temperature);
  const humidity = useGreenhouseStore((s) => s.humidity);
  const pressure = useGreenhouseStore((s) => s.environment.atmosphericPressure);
  const totalHarvestKg = useGreenhouseStore((s) => s.totalHarvestKg);
  const nutritionalCoverage = useGreenhouseStore((s) => s.environment.nutritionalCoverage);
  const env = useGreenhouseStore((s) => s.environment);

  const cropEntries = useMemo(() => {
    return (Object.entries(env.crops) as [string, { plantGrowth: number; healthScore: number; stage: string; estimatedYieldKg: number; biomassKg: number }][])
      .map(([key, crop]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        key,
        growth: crop.plantGrowth,
        health: crop.healthScore,
        stage: crop.stage,
        yieldKg: crop.estimatedYieldKg,
        biomassKg: crop.biomassKg,
      }));
  }, [env.crops]);

  return (
    <section
      aria-label="Dashboard view"
      className="absolute inset-0 bg-background overflow-hidden"
    >
      <div className="px-10 pt-[80px] pb-[88px] h-full flex flex-col gap-3">
        {/* Row 1: Environment — 3 columns, large */}
        <div className="grid grid-cols-3 gap-3 flex-[3] min-h-0">
          <LiveParamCard
            label="Temperature"
            unit={"\u00b0C"}
            color={C.temperature}
            value={temperature}
            fmtVal={(v) => v.toFixed(1)}
            fmtAxis={(v) => `${v.toFixed(0)}\u00b0`}
          />
          <LiveParamCard
            label="Humidity"
            unit="%"
            color={C.humidity}
            value={humidity}
            fmtVal={(v) => v.toFixed(1)}
            fmtAxis={(v) => `${v.toFixed(0)}%`}
          />
          <LiveParamCard
            label="Pressure"
            unit="Pa"
            color={C.pressure}
            value={pressure}
            fmtVal={(v) => v.toFixed(0)}
            fmtAxis={(v) => `${v.toFixed(0)}`}
            window={90}
          />
        </div>

        {/* Row 2: Production — 2 columns, wide */}
        <div className="grid grid-cols-2 gap-3 flex-[2] min-h-0">
          <LiveParamCard
            label="Total Harvest"
            unit="kg"
            color={C.harvest}
            value={totalHarvestKg}
            fmtVal={(v) => v.toFixed(1)}
            fmtAxis={(v) => `${v.toFixed(0)}`}
            window={120}
          />
          <LiveParamCard
            label="Nutritional Coverage"
            unit="%"
            color={C.nutrition}
            value={Math.round(nutritionalCoverage * 1000) / 10}
            fmtVal={(v) => v.toFixed(1)}
            fmtAxis={(v) => `${v.toFixed(0)}%`}
            window={120}
          />
        </div>

        {/* Row 3: Crew radars — 4 across */}
        <div className="grid grid-cols-4 gap-3 flex-[3] min-h-0">
          {CREW.map((m) => (
            <CrewRadarCard key={m.name} member={m} />
          ))}
        </div> 
      </div>
    </section>
  );
}
