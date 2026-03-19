"use client";

import * as React from "react";
import { X, Leaf, Drop, Lightning, Wind, Thermometer, Plant, Warning, Bug, Syringe, FirstAid } from "@phosphor-icons/react";
import { useGreenhouseStore, CROP_DB, TOTAL_MISSION_SOLS } from "@/lib/greenhouse-store";
import type { GrowthStage } from "@/lib/greenhouse-store";
import { ALL_CROP_TYPES } from "@/greenhouse/implementations/multi-crop";
import { useSettingsStore, formatTemperature } from "@/lib/settings-store";
import { CREW_DAILY_TARGETS } from "@/greenhouse/implementations/multi-crop/types";

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
  const nutrition = env.nutritionalOutput;
  const coverage = env.nutritionalCoverage;

  const calCoverage  = Math.min(1, nutrition.caloriesPerDay    / CREW_DAILY_TARGETS.calories);
  const protCoverage = Math.min(1, nutrition.proteinGPerDay    / CREW_DAILY_TARGETS.proteinG);
  const vitCCoverage = Math.min(1, nutrition.vitaminC_mgPerDay / CREW_DAILY_TARGETS.vitaminC_mg);

  // Alert badges
  const co2Alert      = env.co2SafetyAlert;
  const energyAlert   = env.energyDeficit;
  const recyclingWarn = env.waterRecyclingEfficiency < 0.80;

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
          <Leaf size={14} weight="fill" className="text-[var(--dial-text-secondary)]" />
          <span className="type-label text-[var(--dial-text-root)]">Greenhouse Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          {co2Alert    && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="CO₂ Alert" />}
          {energyAlert && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="Energy Deficit" />}
          {recyclingWarn && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Water Recycling Low" />}
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--dial-text-tertiary)] hover:text-[var(--dial-text-primary)] hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
          >
            <X size={11} weight="bold" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex flex-col gap-0">

        {/* Active Alerts */}
        {(co2Alert || energyAlert || recyclingWarn) && (
          <>
            <div className="px-4 pt-3 pb-2 flex flex-col gap-1.5 shrink-0">
              {co2Alert && (
                <AlertBanner
                  icon={<Warning size={12} weight="fill" />}
                  message={`CO₂ at ${Math.round(env.co2Level)} ppm — crew health risk`}
                  color="text-red-500 dark:text-red-400"
                  bg="bg-red-500/10 border-red-500/30"
                />
              )}
              {energyAlert && (
                <AlertBanner
                  icon={<Lightning size={12} weight="fill" />}
                  message="Energy deficit — battery depleted, systems throttled"
                  color="text-orange-500 dark:text-orange-400"
                  bg="bg-orange-500/10 border-orange-500/30"
                />
              )}
              {recyclingWarn && (
                <AlertBanner
                  icon={<Drop size={12} weight="fill" />}
                  message={`Water recycling at ${Math.round(env.waterRecyclingEfficiency * 100)}% — irrigation reduced`}
                  color="text-yellow-500 dark:text-yellow-400"
                  bg="bg-yellow-500/10 border-yellow-500/30"
                />
              )}
            </div>
            <Divider />
          </>
        )}

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
              fillColor={env.humidity > 85 ? "bg-red-400" : "bg-blue-400"}
              warn={env.humidity > 85}
            />
            <AtmoStat
              icon={<Wind size={12} weight="fill" />}
              label="CO₂"
              value={`${Math.round(env.co2Level)} ppm`}
              fill={Math.min(1, env.co2Level / 2000)}
              fillColor={co2Alert ? "bg-red-500" : "bg-purple-400"}
              warn={co2Alert}
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

        {/* Nutritional Coverage */}
        <Section label="Crew Nutrition (Daily)">
          <div className="flex items-center justify-between mb-2">
            <span className="type-ui text-[var(--dial-text-primary)] font-medium">
              Overall coverage
            </span>
            <span className={`type-label font-medium tabular-nums ${
              coverage >= 0.7 ? "text-emerald-500 dark:text-emerald-400"
              : coverage >= 0.4 ? "text-yellow-500 dark:text-yellow-400"
              : "text-red-500 dark:text-red-400"
            }`}>
              {Math.round(coverage * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--dial-surface)" }}>
            <div
              className={`h-full rounded-full transition-all ${
                coverage >= 0.7 ? "bg-emerald-500" : coverage >= 0.4 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, coverage * 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <NutritionBar label="Calories" value={Math.round(nutrition.caloriesPerDay)} unit="kcal/d" coverage={calCoverage} />
            <NutritionBar label="Protein"  value={Math.round(nutrition.proteinGPerDay)}  unit="g/d"   coverage={protCoverage} />
            <NutritionBar label="Vit C"    value={Math.round(nutrition.vitaminC_mgPerDay)} unit="mg/d" coverage={vitCCoverage} />
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
              subLabel={`Recycling: ${Math.round(env.waterRecyclingEfficiency * 100)}%`}
              subColor={recyclingWarn ? "text-yellow-500 dark:text-yellow-400" : undefined}
            />
            <ResourceStat
              icon={<Lightning size={12} weight="fill" />}
              label="Energy used"
              value={formatLargeNumber(env.energyUsedKWh, "kWh")}
              color="text-yellow-500 dark:text-yellow-400"
              subLabel={`Battery: ${Math.round(env.batteryStorageKWh)} kWh`}
              subColor={energyAlert ? "text-red-500 dark:text-red-400" : undefined}
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
              const crop    = crops[ct];
              const profile = CROP_DB[ct];
              const stageCfg = STAGE_CONFIG[crop.stage];
              const health   = crop.healthScore;
              const healthColor =
                health > 0.7 ? "bg-emerald-500" :
                health > 0.35 ? "bg-yellow-500" :
                health > 0 ? "bg-orange-500" :
                "bg-neutral-400";

              const hasAlerts = crop.isBolting || crop.diseaseRisk > 0.3 || crop.rootO2Level < 50 || crop.nutrientEC > 3.5 || crop.nutrientEC < 1.0;

              return (
                <div
                  key={ct}
                  className="rounded-lg px-3 py-2"
                  style={{ background: "var(--dial-surface)", border: `1px solid ${hasAlerts ? "var(--color-orange-500, #f97316)44" : "var(--dial-border)"}` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="type-label text-[var(--dial-text-primary)] font-medium">{profile.name}</span>
                    <div className="flex items-center gap-1">
                      {crop.isBolting && <span className="type-caption px-1 py-0.5 rounded bg-red-500/15 text-red-500 dark:text-red-400 font-medium">Bolting!</span>}
                      {crop.diseaseRisk > 0.3 && <Bug size={10} className="text-orange-500 dark:text-orange-400" weight="fill" />}
                      {crop.rootO2Level < 50 && <Drop size={10} className="text-blue-500 dark:text-blue-400" weight="fill" />}
                      <span className={`type-caption px-1.5 py-0.5 rounded-full font-medium ${stageCfg.color}`}>
                        {stageCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Health bar */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--dial-border)" }}>
                      <div className={`h-full rounded-full transition-all ${healthColor}`} style={{ width: `${Math.max(0, health * 100)}%` }} />
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

                  {/* Extended indicators row */}
                  <div className="grid grid-cols-3 gap-1">
                    <MiniStat
                      icon={<Syringe size={9} />}
                      label="EC"
                      value={`${crop.nutrientEC.toFixed(1)} mS`}
                      warn={crop.nutrientEC > 3.5 || crop.nutrientEC < 1.0}
                    />
                    <MiniStat
                      icon={<FirstAid size={9} />}
                      label="Root O₂"
                      value={`${Math.round(crop.rootO2Level)}%`}
                      warn={crop.rootO2Level < 50}
                    />
                    <MiniStat
                      icon={<Bug size={9} />}
                      label="Disease"
                      value={`${Math.round(crop.diseaseRisk * 100)}%`}
                      warn={crop.diseaseRisk > 0.3}
                    />
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

function AlertBanner({ icon, message, color, bg }: { icon: React.ReactNode; message: string; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${bg}`}>
      <span className={color}>{icon}</span>
      <span className={`type-caption font-medium ${color}`}>{message}</span>
    </div>
  );
}

function AtmoStat({
  icon, label, value, fill, fillColor, warn = false,
}: { icon: React.ReactNode; label: string; value: string; fill: number; fillColor: string; warn?: boolean }) {
  return (
    <div
      className="rounded-lg px-2.5 py-2"
      style={{ background: "var(--dial-surface)", border: `1px solid ${warn ? "rgba(239,68,68,0.3)" : "var(--dial-border)"}` }}
    >
      <div className="flex items-center gap-1 text-[var(--dial-text-tertiary)] mb-1">
        {icon}
        <span className="type-caption">{label}</span>
        {warn && <Warning size={9} className="text-red-500 ml-auto" weight="fill" />}
      </div>
      <p className="type-label text-[var(--dial-text-primary)] font-medium tabular-nums mb-1.5">{value}</p>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--dial-border)" }}>
        <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${Math.min(1, fill) * 100}%` }} />
      </div>
    </div>
  );
}

function NutritionBar({ label, value, unit, coverage }: { label: string; value: number; unit: string; coverage: number }) {
  const color = coverage >= 0.8 ? "bg-emerald-500" : coverage >= 0.5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}>
      <p className="type-caption text-[var(--dial-text-tertiary)] mb-0.5">{label}</p>
      <p className="type-caption text-[var(--dial-text-primary)] font-medium tabular-nums mb-1">{value} <span className="text-[var(--dial-text-tertiary)]">{unit}</span></p>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--dial-border)" }}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, coverage * 100)}%` }} />
      </div>
    </div>
  );
}

function ResourceStat({
  icon, label, value, color, subLabel, subColor,
}: { icon: React.ReactNode; label: string; value: string; color: string; subLabel?: string; subColor?: string }) {
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
      {subLabel && (
        <span className={`type-caption ${subColor ?? "text-[var(--dial-text-tertiary)]"}`}>{subLabel}</span>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-1 rounded px-1.5 py-1 ${warn ? "bg-orange-500/10" : ""}`}
         style={{ border: `1px solid ${warn ? "rgba(249,115,22,0.25)" : "var(--dial-border)"}` }}>
      <span className={warn ? "text-orange-500 dark:text-orange-400" : "text-[var(--dial-text-tertiary)]"}>{icon}</span>
      <div className="min-w-0">
        <p className="type-caption text-[var(--dial-text-tertiary)]" style={{ fontSize: "9px" }}>{label}</p>
        <p className={`type-caption font-medium tabular-nums ${warn ? "text-orange-500 dark:text-orange-400" : "text-[var(--dial-text-primary)]"}`} style={{ fontSize: "10px" }}>{value}</p>
      </div>
    </div>
  );
}

function formatLargeNumber(n: number, unit: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${unit}`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k ${unit}`;
  return `${n.toFixed(1)} ${unit}`;
}
