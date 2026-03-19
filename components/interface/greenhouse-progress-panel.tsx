"use client";

import * as React from "react";
import { X, Leaf, Drop, Lightning, Wind, Thermometer, Plant } from "@phosphor-icons/react";
import { useGreenhouseStore, CROP_DB, TOTAL_MISSION_SOLS } from "@/lib/greenhouse-store";
import type { GrowthStage } from "@/lib/greenhouse-store";
import { ALL_CROP_TYPES } from "@/greenhouse/implementations/multi-crop";
import { useSettingsStore, formatTemperature } from "@/lib/settings-store";

const STAGE_CONFIG: Record<GrowthStage, { label: string; color: string }> = {
  seed:          { label: "Seed",         color: "bg-neutral-400 dark:bg-neutral-500 text-white" },
  germination:   { label: "Germinating",  color: "bg-blue-500 text-white" },
  vegetative:    { label: "Vegetative",   color: "bg-green-500 text-white" },
  flowering:     { label: "Flowering",    color: "bg-yellow-500 text-white" },
  fruiting:      { label: "Fruiting",     color: "bg-orange-500 text-white" },
  harvest_ready: { label: "Harvest!",     color: "bg-emerald-500 text-white" },
  harvested:     { label: "Harvested",    color: "bg-neutral-300 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300" },
};

interface Props {
  onClose: () => void;
}

export function GreenhouseProgressPanel({ onClose }: Props) {
  const env            = useGreenhouseStore((s) => s.environment);
  const missionSol     = useGreenhouseStore((s) => s.missionSol);
  const totalHarvestKg = useGreenhouseStore((s) => s.totalHarvestKg);
  const tempUnit       = useSettingsStore((s) => s.tempUnit);

  const crops = env.crops;

  return (
    <div
      className="w-80 rounded-[14px] overflow-hidden flex flex-col max-h-[80vh]"
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
          <Leaf size={14} weight="fill" className="text-[var(--dial-text-secondary)]" />
          <span className="type-label text-[var(--dial-text-root)]">Greenhouse Progress</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--dial-text-tertiary)] hover:text-[var(--dial-text-primary)] hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
        >
          <X size={11} weight="bold" />
        </button>
      </div>

      <div className="overflow-y-auto flex flex-col gap-0">

        {/* Internal atmosphere */}
        <Section label="Internal Atmosphere">
          <div className="grid grid-cols-2 gap-2">
            <AtmoStat
              icon={<Thermometer size={12} weight="fill" />}
              label="Air Temp"
              value={formatTemperature(env.airTemperature, tempUnit)}
              fill={Math.max(0, Math.min(1, (env.airTemperature - 10) / 25))}
              fillColor="bg-orange-400"
            />
            <AtmoStat
              icon={<Drop size={12} weight="fill" />}
              label="Humidity"
              value={`${Math.round(env.humidity)}%`}
              fill={env.humidity / 100}
              fillColor="bg-blue-400"
            />
            <AtmoStat
              icon={<Wind size={12} weight="fill" />}
              label="CO₂"
              value={`${Math.round(env.co2Level)} ppm`}
              fill={Math.min(1, env.co2Level / 2000)}
              fillColor="bg-purple-400"
            />
            <AtmoStat
              icon={<Plant size={12} weight="fill" />}
              label="O₂"
              value={`${env.o2Level.toFixed(1)}%`}
              fill={Math.max(0, Math.min(1, (env.o2Level - 18) / 7))}
              fillColor="bg-cyan-400"
            />
          </div>
        </Section>

        <Divider />

        {/* Resources */}
        <Section label="Mission Resources">
          <div className="grid grid-cols-2 gap-2">
            <ResourceStat
              icon={<Drop size={12} weight="fill" />}
              label="Water used"
              value={formatLargeNumber(env.waterConsumedL, "L")}
              color="text-blue-500 dark:text-blue-400"
            />
            <ResourceStat
              icon={<Lightning size={12} weight="fill" />}
              label="Energy used"
              value={formatLargeNumber(env.energyUsedKWh, "kWh")}
              color="text-yellow-500 dark:text-yellow-400"
            />
            <ResourceStat
              icon={<Wind size={12} weight="fill" />}
              label="O₂ produced"
              value={formatLargeNumber(env.o2ProducedKg, "kg")}
              color="text-cyan-500 dark:text-cyan-400"
            />
            <ResourceStat
              icon={<Leaf size={12} weight="fill" />}
              label="Total harvest"
              value={formatLargeNumber(totalHarvestKg, "kg")}
              color="text-emerald-500 dark:text-emerald-400"
            />
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="type-caption text-[var(--dial-text-tertiary)]">Mission progress</span>
              <span className="type-caption text-[var(--dial-text-secondary)]">Sol {missionSol} / {TOTAL_MISSION_SOLS}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--dial-surface)" }}>
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(missionSol / TOTAL_MISSION_SOLS) * 100}%` }}
              />
            </div>
          </div>
        </Section>

        <Divider />

        {/* Crops */}
        <Section label="Crops">
          <div className="flex flex-col gap-1.5">
            {ALL_CROP_TYPES.map((ct) => {
              const crop = crops[ct];
              const profile = CROP_DB[ct];
              const stageCfg = STAGE_CONFIG[crop.stage];
              const health = crop.healthScore;
              const healthColor =
                health > 0.7 ? "bg-emerald-500" :
                health > 0.35 ? "bg-yellow-500" :
                health > 0 ? "bg-orange-500" :
                "bg-neutral-400";

              return (
                <div
                  key={ct}
                  className="rounded-lg px-3 py-2"
                  style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="type-label text-[var(--dial-text-primary)] font-medium">{profile.name}</span>
                    <span className={`type-caption px-1.5 py-0.5 rounded-full font-medium ${stageCfg.color}`}>
                      {stageCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Health bar */}
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--dial-border)" }}>
                      <div
                        className={`h-full rounded-full transition-all ${healthColor}`}
                        style={{ width: `${Math.max(0, health * 100)}%` }}
                      />
                    </div>
                    <span className="type-caption text-[var(--dial-text-tertiary)] tabular-nums w-8 text-right">
                      {Math.round(health * 100)}%
                    </span>
                    {crop.estimatedYieldKg > 0 && (
                      <span className="type-caption text-[var(--dial-text-tertiary)] tabular-nums w-12 text-right">
                        {crop.estimatedYieldKg.toFixed(1)} kg
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 shrink-0">
      <p className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="mx-4 shrink-0" style={{ borderTop: "1px solid var(--dial-border)" }} />;
}

function AtmoStat({
  icon, label, value, fill, fillColor,
}: { icon: React.ReactNode; label: string; value: string; fill: number; fillColor: string }) {
  return (
    <div
      className="rounded-lg px-2.5 py-2"
      style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
    >
      <div className="flex items-center gap-1 text-[var(--dial-text-tertiary)] mb-1">
        {icon}
        <span className="type-caption">{label}</span>
      </div>
      <p className="type-label text-[var(--dial-text-primary)] font-medium tabular-nums mb-1.5">{value}</p>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--dial-border)" }}>
        <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${Math.min(1, fill) * 100}%` }} />
      </div>
    </div>
  );
}

function ResourceStat({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-lg px-2.5 py-2 flex flex-col gap-0.5"
      style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
    >
      <div className={`flex items-center gap-1 ${color}`}>
        {icon}
        <span className="type-caption">{label}</span>
      </div>
      <span className="type-label text-[var(--dial-text-primary)] font-medium tabular-nums">{value}</span>
    </div>
  );
}

function formatLargeNumber(n: number, unit: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${unit}`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k ${unit}`;
  return `${n.toFixed(1)} ${unit}`;
}
