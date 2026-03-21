import { create } from "zustand";
import type {
  CrewPreferenceProfile,
  DecisionLogEntry,
  IncidentLogEntry,
  MissionMemoryPackage,
  PerformanceDigests,
  WeeklyCrewReport,
} from "@/lib/secretary-store";

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
  markdown: string;
}

export interface ReportsState {
  reports: ReportItem[];
  loading: boolean;
  openReportId: string | null;
  fetchReports: () => Promise<void>;
  openReport: (id: string) => void;
  closeReport: () => void;
}

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

export function getTypeLabel(type: ReportType) {
  return TYPE_LABELS[type];
}

export function getTypeIcon(type: ReportType) {
  return TYPE_ICONS[type];
}

function decisionToMarkdown(decision: DecisionLogEntry): string {
  const actions = (decision.actionsEnacted ?? [])
    .map((action) =>
      `- **${action.type}** ${action.param ?? ""}${action.crop ? ` on \`${action.crop}\`` : ""}${action.value !== undefined ? ` = ${action.value}` : ""}`
    )
    .join("\n");

  return `# Decision Log — Sol ${decision.missionSol}

| Field | Value |
|-------|-------|
| **Trigger** | ${decision.triggerType} |
| **Risk Score** | ${decision.riskScore?.toFixed(2)} |
| **Crew Impact Score** | ${decision.crewImpactScore?.toFixed(2)} |
| **Decision Mode** | ${decision.decisionMode} |
| **Handled By** | ${decision.handledBy} |

## Operational Summary

${decision.operationsSummary || "_None_"}

## Crew Summary

${decision.crewSummary || "_None_"}

## Actions Enacted

${actions || "_None_"}

## Reasoning

${decision.reasoning}

${decision.actualOutcome ? `## Actual Outcome\n\n${decision.actualOutcome}` : ""}`;
}

function incidentToMarkdown(incident: IncidentLogEntry): string {
  return `# Incident Report — Sol ${incident.missionSol}

| Field | Value |
|-------|-------|
| **Type** | ${incident.emergencyType} |
| **Severity** | ${incident.severity} |
| **Resolved** | ${incident.resolved ? "Yes" : "No"} |
| **Resolution Time** | ${incident.timeToResolutionSols ?? "—"} sols |

## Trigger

${incident.trigger}

## Systems Affected

${(incident.systemsAffected ?? []).map((item: string) => `- ${item}`).join("\n") || "_None_"}

## Actions Executed

${(incident.actionsExecuted ?? []).map((item: string) => `- ${item}`).join("\n") || "_None_"}

${incident.resolution ? `## Resolution\n\n${incident.resolution}` : ""}`;
}

function weeklyToMarkdown(report: WeeklyCrewReport): string {
  if (report.missionSolStart === report.missionSolEnd) {
    return `# Decision Report — Sol ${report.missionSolStart}\n\n${report.report}`;
  }

  return `# Weekly Report — Week ${report.weekNumber}

> Sols ${report.missionSolStart}–${report.missionSolEnd}

${report.report}`;
}

function digestToMarkdown(digest: PerformanceDigests): string {
  return `# Performance Digests — Sol ${digest.generatedAtSol}

## Decision System

${digest.decision}

## Crew Signal

${digest.crew}

## History Signal

${digest.history}`;
}

function profileToMarkdown(profile: CrewPreferenceProfile): string {
  const prefs = Object.entries(profile.preferences ?? {})
    .map(([crop, value]) => `| ${crop} | ${(value as number) > 0 ? "+" : ""}${(value as number).toFixed(2)} |`)
    .join("\n");

  const overrides = (profile.overrideAttempts ?? [])
    .slice(0, 10)
    .map((attempt) => `| Sol ${attempt.sol} | ${attempt.request} | ${attempt.granted ? "Granted" : "Denied"} |`)
    .join("\n");

  return `# Crew Preference Profile

*Last updated: Sol ${profile.lastUpdatedSol}*

## Food Preferences

| Crop | Score |
|------|-------|
${prefs || "| _No data_ | — |"}

## Aversions

${(profile.aversions ?? []).length > 0 ? (profile.aversions as string[]).map((item) => `- ${item}`).join("\n") : "_None recorded_"}

## Recent Requests

${(profile.recentRequests ?? []).slice(0, 10).map((request: string) => `- ${request}`).join("\n") || "_None_"}

## Override Attempts

| Sol | Request | Result |
|-----|---------|--------|
${overrides || "| _None_ | — | — |"}`;
}

function memoryToMarkdown(memory: MissionMemoryPackage): string {
  return `# Mission Memory Package — Sol ${memory.missionSol}

## Decision History

| Metric | Value |
|--------|-------|
| Safety blocks | ${memory.decisionHistory?.safetyBlocks ?? 0} |
| Emergency playbooks | ${memory.decisionHistory?.emergencyPlaybooks ?? 0} |
| Direct decisions | ${memory.decisionHistory?.directDecisions ?? 0} |

## Emergency Learnings

${(memory.emergencyLearnings ?? []).map((item: string) => `- ${item}`).join("\n") || "_None_"}

## What Worked

${(memory.whatWorked ?? []).map((item: string) => `- ${item}`).join("\n") || "_None_"}

## What Failed

${(memory.whatFailed ?? []).map((item: string) => `- ${item}`).join("\n") || "_None recorded_"}

## Calibrated Crop Parameters

\`\`\`json
${JSON.stringify(memory.calibratedCropParams ?? {}, null, 2)}
\`\`\``;
}

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

      const decData = await decisionsRes.json();
      if (decData.ok && Array.isArray(decData.data)) {
        for (const decision of decData.data) {
          items.push({
            id: decision.id,
            type: "decision",
            title: `Decision — Sol ${decision.missionSol}`,
            subtitle: `${decision.triggerType} | ${decision.handledBy} | risk ${decision.riskScore?.toFixed(2)}`,
            date: new Date(decision.timestamp),
            missionSol: decision.missionSol,
            markdown: decisionToMarkdown(decision),
          });
        }
      }

      const incData = await incidentsRes.json();
      if (incData.ok && Array.isArray(incData.data)) {
        for (const incident of incData.data) {
          items.push({
            id: incident.id,
            type: "incident",
            title: `Incident — Sol ${incident.missionSol}`,
            subtitle: `${incident.emergencyType} (sev ${incident.severity}) — ${incident.resolved ? "resolved" : "active"}`,
            date: new Date(incident.timestamp),
            missionSol: incident.missionSol,
            markdown: incidentToMarkdown(incident),
          });
        }
      }

      const repData = await reportsRes.json();
      if (repData.ok && Array.isArray(repData.data)) {
        for (const report of repData.data) {
          const isPerDecision = report.missionSolStart === report.missionSolEnd;
          items.push({
            id: report.id,
            type: "weekly_report",
            title: isPerDecision ? `Decision Report — Sol ${report.missionSolStart}` : `Week ${report.weekNumber} Report`,
            subtitle: isPerDecision ? "Autonomous tick" : `Sols ${report.missionSolStart}–${report.missionSolEnd}`,
            date: new Date(report.generatedAt),
            missionSol: report.missionSolEnd,
            markdown: weeklyToMarkdown(report),
          });
        }
      }

      const digestData = await digestsRes.json();
      if (digestData.ok && digestData.data) {
        const digest = digestData.data;
        items.push({
          id: `digest-sol${digest.generatedAtSol}`,
          type: "performance_digest",
          title: `Performance Digest — Sol ${digest.generatedAtSol}`,
          subtitle: "Decision-system calibration signals",
          date: new Date(),
          missionSol: digest.generatedAtSol,
          markdown: digestToMarkdown(digest),
        });
      }

      const profileData = await profileRes.json();
      if (profileData.ok && profileData.data) {
        const profile = profileData.data;
        if (profile.lastUpdatedSol > 0 || Object.keys(profile.preferences ?? {}).length > 0) {
          items.push({
            id: `profile-sol${profile.lastUpdatedSol}`,
            type: "crew_profile",
            title: "Crew Preference Profile",
            subtitle: `Last updated Sol ${profile.lastUpdatedSol}`,
            date: new Date(),
            missionSol: profile.lastUpdatedSol,
            markdown: profileToMarkdown(profile),
          });
        }
      }

      const memoryData = await memoryRes.json();
      if (memoryData.ok && memoryData.data) {
        const memory = memoryData.data;
        items.push({
          id: `memory-sol${memory.missionSol}`,
          type: "mission_memory",
          title: `Mission Memory — Sol ${memory.missionSol}`,
          subtitle: "Compressed mission policy package",
          date: new Date(memory.generatedAt),
          missionSol: memory.missionSol,
          markdown: memoryToMarkdown(memory),
        });
      }

      items.sort((left, right) => right.date.getTime() - left.date.getTime());
      set({ reports: items, loading: false });
    } catch (err) {
      console.error("[reports-store] fetch error:", err);
      set({ loading: false });
    }
  },

  openReport: (id: string) => {
    const report = get().reports.find((item) => item.id === id);
    if (!report) return;
    set({ openReportId: id });
  },

  closeReport: () => set({ openReportId: null }),
}));
