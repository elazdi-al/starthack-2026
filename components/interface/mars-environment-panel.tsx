"use client";

import * as React from "react";
import { X, Sun, Thermometer, Wind, Planet, Warning } from "@phosphor-icons/react";
import { useGreenhouseStore, TOTAL_MISSION_SOLS } from "@/lib/greenhouse-store";
import type { DustStormRisk, SeasonName } from "@/lib/greenhouse-store";
import { useSettingsStore, formatTemperature } from "@/lib/settings-store";

const SEASON_LABEL: Record<SeasonName, string> = {
  northern_spring: "Northern Spring",
  northern_summer: "Northern Summer",
  northern_autumn: "Northern Autumn",
  northern_winter: "Northern Winter",
};

const RISK_CONFIG: Record<DustStormRisk, { label: string; color: string; dot: string }> = {
  low:      { label: "Low",      color: "text-emerald-500 dark:text-emerald-400", dot: "bg-emerald-500" },
  moderate: { label: "Moderate", color: "text-yellow-500 dark:text-yellow-400",  dot: "bg-yellow-500"  },
  high:     { label: "High",     color: "text-orange-500 dark:text-orange-400",  dot: "bg-orange-500"  },
  extreme:  { label: "Extreme",  color: "text-red-500 dark:text-red-400",        dot: "bg-red-500"     },
};

interface Props {
  onClose: () => void;
}

export function MarsEnvironmentPanel({ onClose }: Props) {
  const env          = useGreenhouseStore((s) => s.environment);
  const missionSol   = useGreenhouseStore((s) => s.missionSol);
  const currentLs    = useGreenhouseStore((s) => s.currentLs);
  const seasonName   = useGreenhouseStore((s) => s.seasonName);
  const dustStormRisk = useGreenhouseStore((s) => s.dustStormRisk);
  const dustStormActive = useGreenhouseStore((s) => s.dustStormActive);
  const tempUnit     = useSettingsStore((s) => s.tempUnit);

  const missionProgress = Math.min(1, missionSol / TOTAL_MISSION_SOLS);
  const solFraction = env.solFraction;

  // Determine time of day label
  const timeOfDay =
    solFraction < 0.25 ? "Night"
    : solFraction < 0.35 ? "Dawn"
    : solFraction < 0.65 ? "Day"
    : solFraction < 0.75 ? "Dusk"
    : "Night";

  const riskCfg = RISK_CONFIG[dustStormRisk];

  return (
    <div
      className="w-72 rounded-[14px] overflow-hidden flex flex-col"
      style={{
        background: "var(--dial-glass-bg)",
        border: "1px solid var(--dial-border)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 var(--glass-panel-highlight), var(--dial-shadow)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5" style={{ borderBottom: "1px solid var(--dial-border)" }}>
        <div className="flex items-center gap-2">
          <Planet size={14} weight="fill" className="text-[var(--dial-text-secondary)]" />
          <span className="type-label text-[var(--dial-text-root)]">Mars Environment</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--dial-text-tertiary)] hover:text-[var(--dial-text-primary)] hover:bg-black/6 dark:hover:bg-white/10 transition-colors"
        >
          <X size={11} weight="bold" />
        </button>
      </div>

      <div className="flex flex-col gap-0">

        {/* Mission progress */}
        <Section label="Mission">
          <div className="flex items-baseline justify-between mb-2">
            <span className="type-display" style={{ fontSize: "1.5rem", lineHeight: 1 }}>
              Sol {missionSol}
            </span>
            <span className="type-caption text-[var(--dial-text-tertiary)]">/ {TOTAL_MISSION_SOLS}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--dial-surface)" }}>
            <div
              className="h-full rounded-full bg-[var(--color-blue-500,#6B97FF)] transition-all"
              style={{ width: `${missionProgress * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="type-caption text-[var(--dial-text-tertiary)]">{Math.round(missionProgress * 100)}% complete</span>
            <span className="type-caption text-[var(--dial-text-tertiary)]">{TOTAL_MISSION_SOLS - missionSol} sols left</span>
          </div>
        </Section>

        <Divider />

        {/* Season */}
        <Section label="Season">
          <div className="flex items-start justify-between">
            <div>
              <p className="type-ui text-[var(--dial-text-primary)] font-medium">{SEASON_LABEL[seasonName]}</p>
              <p className="type-caption text-[var(--dial-text-secondary)] mt-0.5">Ls {currentLs.toFixed(1)}°</p>
            </div>
            <div className="text-right">
              <p className="type-caption text-[var(--dial-text-tertiary)]">Seasonal flux</p>
              <p className="type-label text-[var(--dial-text-primary)]">{Math.round(env.seasonalSolarFlux)} W/m²</p>
            </div>
          </div>
        </Section>

        <Divider />

        {/* External conditions */}
        <Section label="External Conditions">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={<Thermometer size={12} weight="fill" />}
              label="Ext. Temp"
              value={formatTemperature(env.externalTemp, tempUnit)}
            />
            <Stat
              icon={<Sun size={12} weight="fill" />}
              label="Solar"
              value={`${Math.round(env.solarRadiation)} W/m²`}
            />
            <Stat
              icon={<Wind size={12} weight="fill" />}
              label="Pressure"
              value={`${Math.round(env.atmosphericPressure)} Pa`}
            />
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="type-caption text-[var(--dial-text-tertiary)]">Sol cycle</span>
              <span className="type-caption text-[var(--dial-text-secondary)]">{timeOfDay}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--dial-surface)" }}>
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${solFraction * 100}%` }}
              />
            </div>
          </div>
        </Section>

        <Divider />

        {/* Dust storm */}
        <Section label="Dust Storm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${riskCfg.dot} ${dustStormActive ? "animate-pulse" : ""}`} />
              <span className={`type-label font-medium ${riskCfg.color}`}>{riskCfg.label} risk</span>
            </div>
            {dustStormActive && (
              <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
                <Warning size={12} weight="fill" />
                <span className="type-caption font-medium">Storm active</span>
              </div>
            )}
          </div>
          {dustStormActive && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="type-caption text-[var(--dial-text-tertiary)]">Solar attenuation</span>
                <span className="type-caption text-red-500 dark:text-red-400 font-medium">
                  {Math.round((1 - env.dustStormFactor) * 100)}% blocked
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--dial-surface)" }}>
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${(1 - env.dustStormFactor) * 100}%` }}
                />
              </div>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="type-caption text-[var(--dial-text-tertiary)] uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="mx-4" style={{ borderTop: "1px solid var(--dial-border)" }} />;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-lg px-2.5 py-2 flex flex-col gap-1"
      style={{ background: "var(--dial-surface)", border: "1px solid var(--dial-border)" }}
    >
      <div className="flex items-center gap-1 text-[var(--dial-text-tertiary)]">
        {icon}
        <span className="type-caption truncate">{label}</span>
      </div>
      <span className="type-label text-[var(--dial-text-primary)] font-medium tabular-nums">{value}</span>
    </div>
  );
}
