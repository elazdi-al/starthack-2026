"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Scales,
  Warning,
  Newspaper,
  ChartLine,
  Users,
  Brain,
  MagnifyingGlass,
  CalendarBlank,
  CircleNotch,
  FunnelSimple,
  FileText,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  useReportsStore,
  type ReportItem,
  type ReportType,
  getTypeLabel,
} from "@/lib/reports-store";
import { useAnimationConfig } from "@/lib/use-animation-config";
import { triggerHaptic } from "@/lib/haptics";
import { ReportDialog } from "./report-dialog";

// ─── Icon map ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<ReportType, PhosphorIcon> = {
  decision: Scales,
  incident: Warning,
  weekly_report: Newspaper,
  performance_digest: ChartLine,
  crew_profile: Users,
  mission_memory: Brain,
};

const TYPE_COLOR: Record<ReportType, string> = {
  decision: "text-blue-400",
  incident: "text-amber-400",
  weekly_report: "text-emerald-400",
  performance_digest: "text-violet-400",
  crew_profile: "text-pink-400",
  mission_memory: "text-cyan-400",
};

const TYPE_BG: Record<ReportType, string> = {
  decision: "bg-blue-500/10",
  incident: "bg-amber-500/10",
  weekly_report: "bg-emerald-500/10",
  performance_digest: "bg-violet-500/10",
  crew_profile: "bg-pink-500/10",
  mission_memory: "bg-cyan-500/10",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByDate(items: ReportItem[]): Map<string, ReportItem[]> {
  const groups = new Map<string, ReportItem[]>();
  for (const item of items) {
    const key = item.date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return groups;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const ALL_TYPES: ReportType[] = [
  "decision",
  "incident",
  "weekly_report",
  "performance_digest",
  "crew_profile",
  "mission_memory",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportsView() {
  const reports = useReportsStore((s) => s.reports);
  const loading = useReportsStore((s) => s.loading);
  const fetchReports = useReportsStore((s) => s.fetchReports);
  const openReport = useReportsStore((s) => s.openReport);
  const openReportId = useReportsStore((s) => s.openReportId);
  const closeReport = useReportsStore((s) => s.closeReport);
  const anim = useAnimationConfig();

  const [search, setSearch] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<ReportType | "all">("all");

  // Fetch on mount
  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Filter + search
  const filtered = React.useMemo(() => {
    let items = reports;
    if (activeFilter !== "all") {
      items = items.filter((r) => r.type === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q)
      );
    }
    return items;
  }, [reports, activeFilter, search]);

  const grouped = React.useMemo(() => groupByDate(filtered), [filtered]);

  const selectedReport = React.useMemo(
    () => (openReportId ? reports.find((r) => r.id === openReportId) ?? null : null),
    [openReportId, reports]
  );

  return (
    <>
      <section className="absolute inset-0 flex flex-col bg-background overflow-hidden">
        {/* Header bar */}
        <div className="shrink-0 px-6 pt-20 pb-4 flex flex-col gap-4">
          {/* Title row */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--highlight-tabs-active)]/10">
              <FileText size={18} weight="fill" className="text-[var(--highlight-tabs-active)]" />
            </div>
            <div>
              <h1 className="type-title text-foreground">Mission Reports</h1>
              <p className="type-caption text-[var(--dial-text-tertiary)]">
                {reports.length} report{reports.length !== 1 ? "s" : ""} logged
              </p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[340px]">
              <MagnifyingGlass
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dial-text-tertiary)]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports..."
                className={cn(
                  "w-full h-[34px] rounded-full pl-8 pr-3 text-[13px]",
                  "bg-[var(--dial-surface)] border border-[var(--dial-border)]",
                  "text-[var(--dial-text-primary)] placeholder:text-[var(--dial-text-tertiary)]",
                  "outline-none focus:border-[var(--dial-border-hover)]",
                  "transition-colors"
                )}
              />
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-1">
              <FunnelSimple size={13} className="text-[var(--dial-text-tertiary)] mr-1" />
              <FilterPill
                label="All"
                active={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
              />
              {ALL_TYPES.map((t) => {
                const Icon = TYPE_ICON[t];
                const count = reports.filter((r) => r.type === t).length;
                if (count === 0) return null;
                return (
                  <FilterPill
                    key={t}
                    label={getTypeLabel(t)}
                    icon={<Icon size={12} weight="fill" className={TYPE_COLOR[t]} />}
                    active={activeFilter === t}
                    onClick={() => setActiveFilter(t)}
                    count={count}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-none">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <CircleNotch size={24} className="animate-spin text-[var(--dial-text-tertiary)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <FileText size={32} className="text-[var(--dial-text-tertiary)] opacity-40" />
              <p className="type-label text-[var(--dial-text-tertiary)]">
                {search ? "No reports match your search" : "No reports yet"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {[...grouped.entries()].map(([dateLabel, items]) => (
                <div key={dateLabel}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarBlank size={13} className="text-[var(--dial-text-tertiary)]" />
                    <span className="type-caption font-medium text-[var(--dial-text-secondary)]">
                      {dateLabel}
                    </span>
                    <span className="type-caption text-[var(--dial-text-tertiary)]">
                      ({items.length})
                    </span>
                  </div>

                  {/* File grid */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
                    <AnimatePresence>
                      {items.map((item, i) => (
                        <ReportCard
                          key={item.id}
                          item={item}
                          index={i}
                          onClick={() => {
                            triggerHaptic("selection");
                            openReport(item.id);
                          }}
                          animEnabled={anim.enabled}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Report popup */}
      <ReportDialog
        report={selectedReport}
        open={!!openReportId}
        onClose={closeReport}
      />
    </>
  );
}

// ─── Filter pill ─────────────────────────────────────────────────────────────

function FilterPill({
  label,
  icon,
  active,
  onClick,
  count,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        triggerHaptic("selection");
      }}
      className={cn(
        "flex items-center gap-1.5 h-[28px] px-2.5 rounded-full type-caption transition-all",
        active
          ? "bg-[var(--highlight-tabs-active)] text-white"
          : "bg-[var(--dial-surface)] text-[var(--dial-text-secondary)] border border-[var(--dial-border)] hover:border-[var(--dial-border-hover)]"
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && !active && (
        <span className="text-[10px] opacity-50">{count}</span>
      )}
    </button>
  );
}

// ─── Report card (Google Drive-style file tile) ──────────────────────────────

const ReportCard = React.memo(function ReportCard({
  item,
  index,
  onClick,
  animEnabled,
}: {
  item: ReportItem;
  index: number;
  onClick: () => void;
  animEnabled: boolean;
}) {
  const Icon = TYPE_ICON[item.type];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={animEnabled ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={animEnabled ? { opacity: 0, scale: 0.97 } : undefined}
      transition={
        animEnabled
          ? { duration: 0.22, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0 }
      }
      whileHover={animEnabled ? { scale: 1.015, y: -1 } : undefined}
      whileTap={animEnabled ? { scale: 0.98 } : undefined}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl p-3 text-left",
        "bg-[var(--dial-surface)] border border-[var(--dial-border)]",
        "hover:border-[var(--dial-border-hover)] hover:bg-[var(--dial-surface-hover)]",
        "transition-colors cursor-pointer"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          TYPE_BG[item.type]
        )}
      >
        <Icon size={18} weight="fill" className={TYPE_COLOR[item.type]} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="type-label text-foreground truncate">{item.title}</p>
        <p className="type-caption text-[var(--dial-text-tertiary)] truncate mt-0.5">
          {item.subtitle}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="type-small text-[var(--dial-text-tertiary)] tabular-nums">
            Sol {item.missionSol}
          </span>
          <span className="text-[var(--dial-text-tertiary)] opacity-30">|</span>
          <span className="type-small text-[var(--dial-text-tertiary)] tabular-nums">
            {formatTime(item.date)}
          </span>
        </div>
      </div>
    </motion.button>
  );
});
