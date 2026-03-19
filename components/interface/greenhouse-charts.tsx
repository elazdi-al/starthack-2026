"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { LinearGradient } from "@visx/gradient";
import { useEnvHistory, type EnvHistoryPoint } from "@/lib/use-env-history";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

/* ─────────────────── Apple-inspired chart colors ───────────── */

const CHART_COLORS = {
  temperature: "#FF453A",
  humidity: "#0A84FF",
  co2: "#FFD60A",
  solar: "#FF9F0A",
  battery: "#30D158",
  nutrition: "#BF5AF2",
} as const;

/* ────────────── Format sim-minutes to readable time ────────── */

function formatSimTime(minutes: number, sol: number): string {
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.floor(minutes % 60);
  return `Sol ${sol}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ─────── Animated number display that transitions values ───── */

function AnimatedValue({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="text-[13px] tabular-nums font-medium text-[var(--dial-text-primary)] inline-flex items-baseline">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="text-[var(--dial-text-tertiary)] ml-0.5 text-[10px] font-normal">
        {unit}
      </span>
    </span>
  );
}

/* ───────── Shimmer empty state for chart areas ─────────────── */

function ChartEmptyState({ color, height }: { color: string; height: number }) {
  return (
    <div className="relative w-full overflow-hidden rounded-md" style={{ height }}>
      {/* Faint grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between py-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-full"
            style={{
              height: "1px",
              backgroundImage:
                "repeating-linear-gradient(to right, var(--dial-border) 0px, var(--dial-border) 3px, transparent 3px, transparent 7px)",
              opacity: 0.5,
            }}
          />
        ))}
      </div>
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color}08 40%, ${color}14 50%, ${color}08 60%, transparent 100%)`,
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
}

/* ───── Helper: convert env history to chart-compatible data ─── */

function toChartData(history: EnvHistoryPoint[]): Record<string, unknown>[] {
  return history.map((pt) => ({
    ...pt,
    date: new Date(pt.minutes * 60 * 1000),
  }));
}

/* ─────────────────── Spark Card (compact area chart) ─────────── */

function SparkCard({
  label,
  value,
  unit,
  color,
  data,
  dataKey,
  index,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  data: EnvHistoryPoint[];
  dataKey: string;
  index: number;
}) {
  const chartData = React.useMemo(() => toChartData(data), [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{
        duration: 0.35,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      className="rounded-xl px-3 pt-2.5 pb-2 flex flex-col gap-2 cursor-default transition-[border-color] duration-150"
      style={{
        background: "var(--dial-surface)",
        border: "1px solid var(--dial-border)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--dial-border)";
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-[var(--dial-text-tertiary)] tracking-wide uppercase">
          {label}
        </span>
        <AnimatedValue value={value} unit={unit} />
      </div>
      <div className="h-[80px]">
        {chartData.length > 1 ? (
          <AreaChart
            data={chartData}
            aspectRatio="unset"
            className="h-full"
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            animationDuration={600}
          >
            <Area
              dataKey={dataKey}
              fill={color}
              fillOpacity={0.18}
              stroke={color}
              strokeWidth={1.25}
              showHighlight={false}
            />
            <ChartTooltip
              showDatePill={false}
              showCrosshair={false}
              rows={(point) => {
                const raw = point[dataKey];
                const val = typeof raw === "number" ? raw.toFixed(1) : raw;
                const sol = point.sol as number;
                const mins = point.minutes as number;
                return [
                  {
                    color,
                    label: `${label} — ${formatSimTime(mins, sol)}`,
                    value: `${val} ${unit}`,
                  },
                ];
              }}
            />
          </AreaChart>
        ) : (
          <ChartEmptyState color={color} height={80} />
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────── Detail chart (tall, with grid) ───────────── */

function DetailChart({
  label,
  color,
  data,
  dataKey,
  unit,
  index,
  precision = 1,
}: {
  label: string;
  color: string;
  data: EnvHistoryPoint[];
  dataKey: string;
  unit: string;
  index: number;
  precision?: number;
}) {
  const chartData = React.useMemo(() => toChartData(data), [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{
        duration: 0.35,
        delay: 0.2 + index * 0.05,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      className="rounded-xl px-3 pt-2.5 pb-2 flex flex-col gap-2 cursor-default transition-[border-color] duration-150"
      style={{
        background: "var(--dial-surface)",
        border: "1px solid var(--dial-border)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--dial-border)";
      }}
    >
      <span className="text-[10px] text-[var(--dial-text-tertiary)] tracking-wide uppercase">
        {label}
      </span>
      <div className="h-[120px]">
        {chartData.length > 1 ? (
          <AreaChart
            data={chartData}
            aspectRatio="unset"
            className="h-full"
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            animationDuration={600}
          >
            <Grid horizontal />
            <Area
              dataKey={dataKey}
              fill={color}
              fillOpacity={0.12}
              stroke={color}
              strokeWidth={1.5}
            />
            <ChartTooltip
              showDatePill={false}
              rows={(point) => {
                const raw = point[dataKey];
                const val = typeof raw === "number" ? raw.toFixed(precision) : raw;
                const sol = point.sol as number;
                const mins = point.minutes as number;
                return [
                  {
                    color,
                    label: `${label} — ${formatSimTime(mins, sol)}`,
                    value: `${val} ${unit}`,
                  },
                ];
              }}
            />
          </AreaChart>
        ) : (
          <ChartEmptyState color={color} height={120} />
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────── Crop Colors & Constants ──────────────── */

const CROP_COLORS: Record<string, string> = {
  lettuce: "#30D158",
  tomato: "#FF453A",
  potato: "#AC8E68",
  soybean: "#30D158",
  spinach: "#34C759",
  wheat: "#FFD60A",
  radish: "#FF375F",
  kale: "#32D74B",
};

const CROP_BAR_HEIGHT = 160;

/* ──────────────── Main Charts Section ──────────────────────── */

function GreenhouseCharts() {
  const history = useEnvHistory(30);
  const env = useGreenhouseStore((s) => s.environment);
  const temperature = useGreenhouseStore((s) => s.temperature);
  const humidity = useGreenhouseStore((s) => s.humidity);
  const co2Level = useGreenhouseStore((s) => s.co2Level);

  const crops = env.crops;
  const cropEntries = Object.entries(crops) as [
    string,
    { plantGrowth: number; healthScore: number; stage: string },
  ][];

  const cropBarData = React.useMemo(
    () =>
      cropEntries.map(([name, crop]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        growth: Math.round(crop.plantGrowth),
      })),
    [cropEntries]
  );

  return (
    <section className="w-full flex flex-col gap-3">
      {/* Section label */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-[10px] text-[var(--dial-text-tertiary)] uppercase tracking-wider px-0.5"
      >
        Environment
      </motion.span>

      {/* Spark grid — 2 columns for square-ish cards */}
      <div className="grid grid-cols-2 gap-2">
        <SparkCard
          label="Temperature"
          value={`${Math.round(temperature * 10) / 10}`}
          unit={"\u00b0C"}
          color={CHART_COLORS.temperature}
          data={history}
          dataKey="temperature"
          index={0}
        />
        <SparkCard
          label="Humidity"
          value={`${Math.round(humidity)}`}
          unit="%"
          color={CHART_COLORS.humidity}
          data={history}
          dataKey="humidity"
          index={1}
        />
        <SparkCard
          label={"CO\u2082"}
          value={`${Math.round(co2Level)}`}
          unit="ppm"
          color={CHART_COLORS.co2}
          data={history}
          dataKey="co2"
          index={2}
        />
        <SparkCard
          label="Solar"
          value={`${Math.round(env.solarGenerationKW * 10) / 10}`}
          unit="kW"
          color={CHART_COLORS.solar}
          data={history}
          dataKey="solarKW"
          index={3}
        />
      </div>

      {/* Detail charts — each one full width for readability */}
      <div className="flex flex-col gap-2">
        <DetailChart
          label="Battery Storage"
          color={CHART_COLORS.battery}
          data={history}
          dataKey="batteryKWh"
          unit="kWh"
          index={0}
        />
        <DetailChart
          label="Nutritional Coverage"
          color={CHART_COLORS.nutrition}
          data={history}
          dataKey="nutritionalCoverage"
          unit="%"
          index={1}
          precision={2}
        />
      </div>

      {/* Crop growth — Bklit BarChart */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.35,
          delay: 0.25,
          ease: [0.22, 1, 0.36, 1] as const,
        }}
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.4,
            delay: 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="text-[10px] text-[var(--dial-text-tertiary)] uppercase tracking-wider px-0.5 block mb-1.5"
        >
          Crop Growth
        </motion.span>
        <div
          className="rounded-xl px-3 py-3 transition-[border-color] duration-150"
          style={{
            background: "var(--dial-surface)",
            border: "1px solid var(--dial-border)",
          }}
        >
          {cropBarData.length > 0 ? (
            <div style={{ height: CROP_BAR_HEIGHT }}>
              <BarChart
                data={cropBarData}
                xDataKey="name"
                aspectRatio="unset"
                className="h-full"
                margin={{ top: 8, right: 8, bottom: 28, left: 8 }}
                barGap={0.15}
                animationDuration={800}
              >
                <LinearGradient
                  id="crop-gradient"
                  from="#30D158"
                  to="#30D15820"
                />
                <Grid horizontal />
                <Bar
                  dataKey="growth"
                  fill="url(#crop-gradient)"
                  stroke="#30D158"
                  lineCap="round"
                />
                <BarXAxis showAllLabels />
                <ChartTooltip
                  showCrosshair={false}
                  rows={(point) => [
                    {
                      color: CROP_COLORS[(point.name as string).toLowerCase()] ?? "#30D158",
                      label: point.name as string,
                      value: `${point.growth}%`,
                    },
                  ]}
                />
              </BarChart>
            </div>
          ) : (
            <ChartEmptyState color="#30D158" height={CROP_BAR_HEIGHT} />
          )}
        </div>
      </motion.div>
    </section>
  );
}

export { GreenhouseCharts };
