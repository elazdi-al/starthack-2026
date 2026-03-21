"use client";

import { useMemo, memo, useCallback, useRef } from "react";
import Image from "next/image";
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

import { type HealthStatus, type NeedLevel, type CrewmateProfile } from "@/lib/crew-data";

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

function profilesToCrewMembers(profiles: CrewmateProfile[]): CrewMember[] {
  return profiles.map((p) => ({
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
}

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

function withAlpha(color: string, alpha: string) {
  return color.startsWith("#") && color.length === 7 ? `${color}${alpha}` : color;
}

const CREW_AVATAR_SRC = "/images/crew/noto-astronaut.svg";
const CREW_AVATAR_MASK_SRC = "/images/crew/noto-astronaut-mask.svg";

const CrewPortrait = memo(function CrewPortrait({ color }: { color: string }) {
  const shellGlow = withAlpha(color, "28");
  const helmetTint = `linear-gradient(180deg, ${withAlpha(color, "DC")} 0%, ${withAlpha(color, "8C")} 100%)`;
  const highlightTint = `radial-gradient(circle at 50% 18%, ${withAlpha(color, "80")} 0%, transparent 62%)`;

  return (
    <div
      aria-hidden="true"
      className="relative size-16 shrink-0 overflow-hidden rounded-[1.35rem] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_rgba(0,0,0,0.18)]"
      style={{
        background: `radial-gradient(circle at 30% 18%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 24%, rgba(10,14,24,0.98) 74%), radial-gradient(circle at 50% 34%, ${shellGlow} 0%, transparent 54%)`,
      }}
    >
      <Image
        src={CREW_AVATAR_SRC}
        alt=""
        fill
        sizes="64px"
        draggable={false}
        className="relative z-10 select-none object-contain p-[2px]"
      />
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background: helmetTint,
          mixBlendMode: "multiply",
          opacity: 0.92,
          WebkitMaskImage: `url(${CREW_AVATAR_MASK_SRC})`,
          maskImage: `url(${CREW_AVATAR_MASK_SRC})`,
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-30"
        style={{
          background: highlightTint,
          mixBlendMode: "screen",
          opacity: 0.44,
          WebkitMaskImage: `url(${CREW_AVATAR_MASK_SRC})`,
          maskImage: `url(${CREW_AVATAR_MASK_SRC})`,
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          filter: `drop-shadow(0 0 12px ${shellGlow})`,
        }}
      />
    </div>
  );
});

const CrewRadarCard = memo(function CrewRadarCard({ member }: { member: CrewMember }) {
  const radarData = useMemo(() => [crewToRadar(member)], [member]);
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-card/80 p-2.5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 px-0.5 shrink-0">
        <div className="min-w-0">
          <CrewPortrait color={member.color} />
          <div className="mt-2 min-w-0">
            <span className="block truncate text-[10px] font-semibold leading-tight text-foreground">
              {member.name}
            </span>
            <span className="block truncate text-[8px] uppercase tracking-[0.16em] text-muted-foreground/90">
              {member.role}
            </span>
          </div>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/40 px-1.5 py-1 shadow-sm">
          <span className={`size-1.5 rounded-full ${STATUS_DOT[member.health]}`} />
          <span className="text-[8px] text-muted-foreground capitalize">{member.health}</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center pb-1">
        <RadarChart data={radarData} metrics={HEALTH_METRICS} size={132} levels={3} margin={25}>
          <RadarGrid showLabels={false} />
          <RadarAxis />
          <RadarLabels fontSize={7} offset={12} />
          <RadarArea index={0} showGlow={false} />
        </RadarChart>
      </div>
    </div>
  );
});



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

  const crewProfiles = useGreenhouseStore((s) => s.crew);
  const crewMembers = useMemo(() => profilesToCrewMembers(crewProfiles), [crewProfiles]);

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
      <div className="px-10 pt-[80px] pb-[88px] h-full flex flex-col gap-2">
        {/* Row 1: Environment — 3 columns, large */}
        <div className="grid grid-cols-3 gap-3 flex-3 min-h-0">
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

     

        {/* Row 3: Crew radars — 4 across */}
        <div className="grid grid-cols-4 gap-3 flex-[3] min-h-0">
          {crewMembers.map((m) => (
            <CrewRadarCard key={m.name} member={m} />
          ))}
        </div> 
      </div>
    </section>
  );
});
