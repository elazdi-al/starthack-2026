"use client";

import { useMemo, memo, useCallback, useRef } from "react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { useLiveParam } from "@/lib/use-live-param";
import { useIsVisible } from "@/lib/use-is-visible";
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

/* ── Hoisted stable refs (no closure → referentially stable) ──── */

const fmt1 = (v: number) => v.toFixed(1);
const fmt0 = (v: number) => v.toFixed(0);
const fmtDeg = (v: number) => `${v.toFixed(0)}\u00b0`;
const fmtPct = (v: number) => `${v.toFixed(0)}%`;

const PARAM_MARGIN = { top: 8, right: 40, bottom: 20, left: 40 } as const;
const PARAM_STYLE: React.CSSProperties = { height: "100%" };
const CROP_MARGIN = { top: 4, right: 4, bottom: 4, left: 4 } as const;
const CROP_STYLE: React.CSSProperties = { height: 56 };

/* ── Live parameter chart (squared) ────────────────────────────── */

interface LiveParamCardProps {
  label: string;
  unit: string;
  color: string;
  value: number;
  fmtVal: (v: number) => string;
  fmtAxis: (v: number) => string;
  window?: number;
  /** When false, data collection and chart animation are paused. */
  active?: boolean;
}

const LiveParamCard = memo(function LiveParamCard({
  label,
  unit,
  color,
  value,
  fmtVal,
  fmtAxis,
  window: windowSecs = 60,
  active: cardActive = true,
}: LiveParamCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsVisible(cardRef);
  const enabled = cardActive && isVisible;
  const [data] = useLiveParam(value, enabled);

  const tooltipRows = useCallback(
    (point: Record<string, unknown>) => {
      const v = point.value as number;
      return [{ color, label, value: `${fmtVal(v)} ${unit}` }];
    },
    [color, label, unit, fmtVal],
  );

  return (
    <div ref={cardRef} className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 h-full min-h-0">
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
          paused={!enabled}
          style={PARAM_STYLE}
          margin={PARAM_MARGIN}
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
          <ChartTooltip showDatePill={false} rows={tooltipRows} />
        </LiveLineChart>
      </div>
    </div>
  );
});

/* ── Crew data ─────────────────────────────────────────────────── */

import { CREW_PROFILES, type HealthStatus, type NeedLevel } from "@/lib/crew-data";

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

const STRESS_MAP: Record<NeedLevel, number> = { good: 90, moderate: 60, low: 30 };
const COLOR_MAP: Record<string, string> = {
  wei: "#30D158", amara: "#0A84FF", lena: "#BF5AF2", kenji: "#FF9F0A",
};

const CREW: CrewMember[] = CREW_PROFILES.map((p) => ({
  name: p.name,
  role: p.role,
  color: COLOR_MAP[p.id] ?? "#888",
  health: p.health,
  morale: p.morale,
  hydration: p.hydration,
  nutrition: p.nutrition,
  sleep: p.sleep,
  o2Sat: p.o2Sat,
  stress: STRESS_MAP[p.stress],
}));

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

const CrewRadarCard = memo(function CrewRadarCard({ member }: { member: CrewMember }) {
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

/* ── Season / storm display helpers ─────────────────────────────── */

const SEASON_LABELS: Record<string, string> = {
  northern_spring: "Spring",
  northern_summer: "Summer",
  northern_autumn: "Autumn",
  northern_winter: "Winter",
};

const STORM_RISK_COLOR: Record<string, string> = {
  low: "text-emerald-500",
  moderate: "text-amber-500",
  high: "text-orange-500",
  extreme: "text-red-500",
};

const STORM_RISK_BG: Record<string, string> = {
  low: "bg-emerald-500/15",
  moderate: "bg-amber-500/15",
  high: "bg-orange-500/15",
  extreme: "bg-red-500/15",
};

/* ── Greenhouse State card ──────────────────────────────────────── */

function GreenhouseStateCard({
  sol,
  totalSols,
  foodReservesSols,
  totalHarvestKg,
  nutritionalCoverage,
}: {
  sol: number;
  totalSols: number;
  foodReservesSols: number;
  totalHarvestKg: number;
  nutritionalCoverage: number;
}) {
  const pct = Math.min(100, (sol / totalSols) * 100);
  const foodPct = Math.min(100, (foodReservesSols / totalSols) * 100);
  const foodColor =
    foodReservesSols > 200 ? "bg-emerald-500" : foodReservesSols > 100 ? "bg-amber-500" : "bg-red-500";
  const foodText =
    foodReservesSols > 200 ? "text-emerald-500" : foodReservesSols > 100 ? "text-amber-500" : "text-red-500";
  const covPct = Math.round(nutritionalCoverage * 1000) / 10;
  const covColor = covPct >= 80 ? "text-emerald-500" : covPct >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 h-full min-h-0 justify-center">
      {/* Header: Mission sol */}
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[9px] font-medium tracking-wide uppercase text-muted-foreground">
          Greenhouse
        </span>
        <span className="tabular-nums text-xs font-semibold text-foreground">
          Sol {Math.floor(sol)}
          <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">/ {totalSols}</span>
        </span>
      </div>

      {/* Mission progress bar */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[8px] text-muted-foreground tabular-nums text-right">
          {pct.toFixed(1)}% complete
        </span>
      </div>

      {/* Food reserves bar */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-medium tracking-wide uppercase text-muted-foreground">
            Food Reserves
          </span>
          <span className={`tabular-nums text-xs font-semibold ${foodText}`}>
            {Math.round(foodReservesSols)}
            <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">sols</span>
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full ${foodColor} transition-all duration-500`}
            style={{ width: `${foodPct}%` }}
          />
        </div>
      </div>

      {/* Harvest + Coverage stats row */}
      <div className="grid grid-cols-2 gap-3 px-0.5 pt-0.5">
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground">Total Harvest</span>
          <span className="tabular-nums text-[11px] font-semibold text-foreground">
            {totalHarvestKg.toFixed(1)}
            <span className="text-[9px] font-normal text-muted-foreground"> kg</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground">Nutritional Coverage</span>
          <span className={`tabular-nums text-[11px] font-semibold ${covColor}`}>
            {covPct.toFixed(1)}
            <span className="text-[9px] font-normal text-muted-foreground"> %</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Mars Info card ────────────────────────────────────────────── */

function MarsInfoCard({
  season,
  dustStormRisk,
  dustStormActive,
  externalTemp,
  solarRadiation,
  dustStormFactor,
}: {
  season: string;
  dustStormRisk: string;
  dustStormActive: boolean;
  externalTemp: number;
  solarRadiation: number;
  dustStormFactor: number;
}) {
  const riskColor = STORM_RISK_COLOR[dustStormRisk] ?? "text-muted-foreground";
  const riskBg = STORM_RISK_BG[dustStormRisk] ?? "bg-muted/50";
  const opacity = Math.round(dustStormFactor * 100);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 h-full min-h-0 justify-center">
      {/* Header */}
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[9px] font-medium tracking-wide uppercase text-muted-foreground">
          Mars Environment
        </span>
        <span className="text-[10px] font-semibold text-foreground">
          {SEASON_LABELS[season] ?? season}
        </span>
      </div>

      {/* Dust storm row */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[9px] text-muted-foreground">Dust Storm Risk</span>
        <div className="flex items-center gap-1.5">
          {dustStormActive && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-500 font-medium">
              ACTIVE
            </span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize ${riskColor} ${riskBg}`}>
            {dustStormRisk}
          </span>
        </div>
      </div>

      {/* Solar transparency bar */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[8px] text-muted-foreground">Solar Transparency</span>
          <span className="tabular-nums text-[10px] font-semibold text-foreground">{opacity}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${opacity > 80 ? "bg-emerald-500" : opacity > 50 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${opacity}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 px-0.5 pt-0.5">
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground">Surface Temp</span>
          <span className="tabular-nums text-[11px] font-semibold text-foreground">
            {externalTemp.toFixed(0)}<span className="text-[9px] font-normal text-muted-foreground">{"\u00b0C"}</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground">Solar Irrad.</span>
          <span className="tabular-nums text-[11px] font-semibold text-foreground">
            {Math.round(solarRadiation)}<span className="text-[9px] font-normal text-muted-foreground"> W/m{"\u00b2"}</span>
          </span>
        </div>
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

const CropCard = memo(function CropCard({ name, growth, health, stage, yieldKg }: CropCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsVisible(cardRef);
  const color = CROP_COLORS[name.toLowerCase()] ?? "#888";
  const healthPct = Math.round(health * 100);
  const [growthData] = useLiveParam(growth, isVisible);

  return (
    <div ref={cardRef} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-2.5 flex flex-col gap-1.5">
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
        paused={!isVisible}
        style={CROP_STYLE}
        margin={CROP_MARGIN}
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
});

/* ── Dashboard ─────────────────────────────────────────────────── */

export const DashboardView = memo(function DashboardView({ active = true }: { active?: boolean }) {
  const temperature = useGreenhouseStore((s) => s.temperature);
  const humidity = useGreenhouseStore((s) => s.humidity);
  const pressure = useGreenhouseStore((s) => s.environment.atmosphericPressure);
  const totalHarvestKg = useGreenhouseStore((s) => s.totalHarvestKg);
  const nutritionalCoverage = useGreenhouseStore((s) => s.environment.nutritionalCoverage);
  const env = useGreenhouseStore((s) => s.environment);

  const missionSol = env.missionSol;
  const totalMissionSols = 450;
  const foodReservesSols = env.foodReservesSols;
  const seasonName = env.seasonName;
  const dustStormRisk = env.dustStormRisk;
  const dustStormActive = env.dustStormFactor < 0.9;
  const dustStormFactor = env.dustStormFactor;
  const externalTemp = env.externalTemp;
  const solarRadiation = env.solarRadiation;

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
      className="absolute inset-0 overflow-hidden"
    >
      <div className="px-10 pt-[80px] pb-[88px] h-full flex flex-col gap-3">
        {/* Row 1: Environment — 3 columns, large */}
        <div className="grid grid-cols-3 gap-3 flex-[3] min-h-0">
          <LiveParamCard
            label="Temperature"
            unit={"\u00b0C"}
            color={C.temperature}
            value={temperature}
            fmtVal={fmt1}
            fmtAxis={fmtDeg}
            active={active}
          />
          <LiveParamCard
            label="Humidity"
            unit="%"
            color={C.humidity}
            value={humidity}
            fmtVal={fmt1}
            fmtAxis={fmtPct}
            active={active}
          />
          <LiveParamCard
            label="Pressure"
            unit="Pa"
            color={C.pressure}
            value={pressure}
            fmtVal={fmt0}
            fmtAxis={fmt0}
            window={90}
            active={active}
          />
        </div>

        {/* Row 2: Greenhouse state + Mars — 2 columns */}
        <div className="grid grid-cols-2 gap-3 flex-[2] min-h-0">
          <GreenhouseStateCard
            sol={missionSol}
            totalSols={totalMissionSols}
            foodReservesSols={foodReservesSols}
            totalHarvestKg={totalHarvestKg}
            nutritionalCoverage={nutritionalCoverage}
          />
          <MarsInfoCard
            season={seasonName}
            dustStormRisk={dustStormRisk}
            dustStormActive={dustStormActive}
            externalTemp={externalTemp}
            solarRadiation={solarRadiation}
            dustStormFactor={dustStormFactor}
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
});
