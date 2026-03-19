import { create } from "zustand";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportType =
  | "decision"
  | "incident"
  | "weekly_report"
  | "performance_digest"
  | "crew_profile"
  | "mission_memory";

export interface ReportItem {
  id: string;
  type: ReportType;
  title: string;
  subtitle: string;
  date: Date;
  missionSol: number;
  /** Pre-rendered markdown string for the popup viewer */
  markdown: string;
}

export interface ReportsState {
  reports: ReportItem[];
  loading: boolean;
  /** Currently-opened report id */
  openReportId: string | null;

  fetchReports: () => Promise<void>;
  openReport: (id: string) => void;
  closeReport: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ReportType, string> = {
  decision: "Decision Log",
  incident: "Incident Report",
  weekly_report: "Weekly Report",
  performance_digest: "Performance Digest",
  crew_profile: "Crew Profile",
  mission_memory: "Mission Memory",
};

const TYPE_ICONS: Record<ReportType, string> = {
  decision: "Scales",
  incident: "Warning",
  weekly_report: "Newspaper",
  performance_digest: "ChartLine",
  crew_profile: "Users",
  mission_memory: "Brain",
};

export function getTypeLabel(t: ReportType) {
  return TYPE_LABELS[t];
}
export function getTypeIcon(t: ReportType) {
  return TYPE_ICONS[t];
}

// ─── Markdown serialisers ────────────────────────────────────────────────────

function decisionToMarkdown(d: any): string {
  const actions = (d.actionsEnacted ?? [])
    .map(
      (a: any) =>
        `- **${a.type}** ${a.param ?? ""}${a.crop ? ` on \`${a.crop}\`` : ""}${a.value !== undefined ? ` = ${a.value}` : ""}`
    )
    .join("\n");

  return `# Decision Log — Sol ${d.missionSol}

| Field | Value |
|-------|-------|
| **Trigger** | ${d.triggerType} |
| **Risk Score** | ${d.riskScore?.toFixed(2)} |
| **Wellbeing Score** | ${d.wellbeingScore?.toFixed(2)} |
| **Conflict** | ${d.conflictType} |
| **Winner** | ${d.winningAgent} |
| **Sim P10 / P90** | ${d.simulationP10?.toFixed(1) ?? "—"} / ${d.simulationP90?.toFixed(1) ?? "—"} kg |

## Proposals

**Survival:** ${d.survivalProposalSummary}

**Wellbeing:** ${d.wellbeingProposalSummary}

## Actions Enacted

${actions || "_None_"}

## Reasoning

${d.reasoning}

${d.actualOutcome ? `## Actual Outcome\n\n${d.actualOutcome}` : ""}`;
}

function incidentToMarkdown(i: any): string {
  return `# Incident Report — Sol ${i.missionSol}

| Field | Value |
|-------|-------|
| **Type** | ${i.emergencyType} |
| **Severity** | ${i.severity} |
| **Resolved** | ${i.resolved ? "Yes" : "No"} |
| **Resolution Time** | ${i.timeToResolutionSols ?? "—"} sols |

## Trigger

${i.trigger}

## Systems Affected

${(i.systemsAffected ?? []).map((s: string) => `- ${s}`).join("\n") || "_None_"}

## Actions Executed

${(i.actionsExecuted ?? []).map((a: string) => `- ${a}`).join("\n") || "_None_"}

${i.resolution ? `## Resolution\n\n${i.resolution}` : ""}`;
}

function weeklyToMarkdown(r: any): string {
  return `# Weekly Report — Week ${r.weekNumber}

> Sols ${r.missionSolStart}–${r.missionSolEnd}

${r.report}`;
}

function digestToMarkdown(d: any): string {
  return `# Performance Digests — Sol ${d.generatedAtSol}

## Survival Agent

${d.survival}

## Wellbeing Agent

${d.wellbeing}

## Arbiter

${d.arbiter}`;
}

function profileToMarkdown(p: any): string {
  const prefs = Object.entries(p.preferences ?? {})
    .map(([crop, val]) => `| ${crop} | ${(val as number) > 0 ? "+" : ""}${(val as number).toFixed(2)} |`)
    .join("\n");

  const overrides = (p.overrideAttempts ?? [])
    .slice(0, 10)
    .map(
      (o: any) =>
        `| Sol ${o.sol} | ${o.request} | ${o.granted ? "Granted" : "Denied"} |`
    )
    .join("\n");

  return `# Crew Preference Profile

*Last updated: Sol ${p.lastUpdatedSol}*

## Food Preferences

| Crop | Score |
|------|-------|
${prefs || "| _No data_ | — |"}

## Aversions

${(p.aversions ?? []).length > 0 ? (p.aversions as string[]).map((a) => `- ${a}`).join("\n") : "_None recorded_"}

## Recent Requests

${(p.recentRequests ?? []).slice(0, 10).map((r: string) => `- ${r}`).join("\n") || "_None_"}

## Override Attempts

| Sol | Request | Result |
|-----|---------|--------|
${overrides || "| _None_ | — | — |"}`;
}

function memoryToMarkdown(m: any): string {
  return `# Mission Memory Package — Sol ${m.missionSol}

## Conflict Resolution History

| Metric | Value |
|--------|-------|
| Total vetoes | ${m.conflictResolutionHistory?.totalVetoes ?? 0} |
| Vetoes correct | ${m.conflictResolutionHistory?.vetoesCorrectInHindsight ?? 0} |
| Soft conflicts resolved | ${m.conflictResolutionHistory?.softConflictsResolved ?? 0} |

## Storm Response Learnings

${(m.stormResponseLearnings ?? []).map((l: string) => `- ${l}`).join("\n") || "_None_"}

## What Worked

${(m.whatWorked ?? []).map((w: string) => `- ${w}`).join("\n") || "_None_"}

## What Failed

${(m.whatFailed ?? []).map((f: string) => `- ${f}`).join("\n") || "_None recorded_"}

## Calibrated Crop Parameters

\`\`\`json
${JSON.stringify(m.calibratedCropParams ?? {}, null, 2)}
\`\`\``;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useReportsStore = create<ReportsState>((set, get) => ({
  reports: [],
  loading: false,
  openReportId: null,

  fetchReports: async () => {
    set({ loading: true });
    try {
      const [decisionsRes, incidentsRes, reportsRes, digestsRes, profileRes, memoryRes] =
        await Promise.all([
          fetch("/api/secretary?type=decisions&limit=200"),
          fetch("/api/secretary?type=incidents&limit=100"),
          fetch("/api/secretary?type=reports&limit=100"),
          fetch("/api/secretary?type=digests"),
          fetch("/api/secretary?type=profile"),
          fetch("/api/secretary?type=memory"),
        ]);

      const items: ReportItem[] = [];

      // Decisions
      const decData = await decisionsRes.json();
      if (decData.ok && Array.isArray(decData.data)) {
        for (const d of decData.data) {
          items.push({
            id: d.id,
            type: "decision",
            title: `Decision — Sol ${d.missionSol}`,
            subtitle: `${d.triggerType} | ${d.winningAgent} | risk ${d.riskScore?.toFixed(2)}`,
            date: new Date(d.timestamp),
            missionSol: d.missionSol,
            markdown: decisionToMarkdown(d),
          });
        }
      }

      // Incidents
      const incData = await incidentsRes.json();
      if (incData.ok && Array.isArray(incData.data)) {
        for (const i of incData.data) {
          items.push({
            id: i.id,
            type: "incident",
            title: `Incident — Sol ${i.missionSol}`,
            subtitle: `${i.emergencyType} (sev ${i.severity}) — ${i.resolved ? "resolved" : "active"}`,
            date: new Date(i.timestamp),
            missionSol: i.missionSol,
            markdown: incidentToMarkdown(i),
          });
        }
      }

      // Weekly reports
      const repData = await reportsRes.json();
      if (repData.ok && Array.isArray(repData.data)) {
        for (const r of repData.data) {
          items.push({
            id: r.id,
            type: "weekly_report",
            title: `Week ${r.weekNumber} Report`,
            subtitle: `Sols ${r.missionSolStart}–${r.missionSolEnd}`,
            date: new Date(r.generatedAt),
            missionSol: r.missionSolEnd,
            markdown: weeklyToMarkdown(r),
          });
        }
      }

      // Performance digests
      const digData = await digestsRes.json();
      if (digData.ok && digData.data) {
        const d = digData.data;
        items.push({
          id: `digest-sol${d.generatedAtSol}`,
          type: "performance_digest",
          title: `Performance Digest — Sol ${d.generatedAtSol}`,
          subtitle: "Agent calibration signals",
          date: new Date(),
          missionSol: d.generatedAtSol,
          markdown: digestToMarkdown(d),
        });
      }

      // Crew profile
      const profData = await profileRes.json();
      if (profData.ok && profData.data) {
        const p = profData.data;
        if (p.lastUpdatedSol > 0 || Object.keys(p.preferences ?? {}).length > 0) {
          items.push({
            id: `profile-sol${p.lastUpdatedSol}`,
            type: "crew_profile",
            title: "Crew Preference Profile",
            subtitle: `Last updated Sol ${p.lastUpdatedSol}`,
            date: new Date(),
            missionSol: p.lastUpdatedSol,
            markdown: profileToMarkdown(p),
          });
        }
      }

      // Mission memory
      const memData = await memoryRes.json();
      if (memData.ok && memData.data) {
        const m = memData.data;
        items.push({
          id: `memory-sol${m.missionSol}`,
          type: "mission_memory",
          title: `Mission Memory — Sol ${m.missionSol}`,
          subtitle: "Compressed mission policy package",
          date: new Date(m.generatedAt),
          missionSol: m.missionSol,
          markdown: memoryToMarkdown(m),
        });
      }

      // Sort newest first
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      set({ reports: items, loading: false });
    } catch (err) {
      console.error("[reports-store] fetch error:", err);
      set({ loading: false });
    }
  },

  openReport: (id: string) => {
    const report = get().reports.find((r) => r.id === id);
    if (!report) return;
    set({ openReportId: id });
  },

  closeReport: () => set({ openReportId: null }),
}));
