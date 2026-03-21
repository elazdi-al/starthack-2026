/**
 * Secretary Store — in-memory persistence for mission logs
 *
 * The secretary tracks mission decisions, incidents, crew preferences,
 * summary reports, and long-horizon mission memory.
 */

export type DecisionMode = 'direct_decision' | 'emergency_playbook' | 'safety_block' | 'none';
export type DecisionHandler = 'decision' | 'system' | 'none';
export type TriggerType = 'emergency_sev1' | 'emergency_sev2' | 'routine' | 'crew_question' | 'crew_request' | 'crew_override';

export interface DecisionLogEntry {
  id: string;
  timestamp: number;
  missionSol: number;
  triggerType: TriggerType;
  riskScore: number;
  crewImpactScore: number;
  decisionMode: DecisionMode;
  handledBy: DecisionHandler;
  operationsSummary: string;
  crewSummary: string;
  actionsEnacted: Array<{
    type: string;
    param?: string;
    value?: number;
    crop?: string;
    harvests?: string[];
    plants?: Array<{ tileId: string; crop: string }>;
    clears?: string[];
  }>;
  reasoning: string;
  actualOutcome?: string;
  outcomeFilledAt?: number;
}

export interface IncidentLogEntry {
  id: string;
  timestamp: number;
  missionSol: number;
  emergencyType: string;
  severity: 1 | 2;
  trigger: string;
  actionsExecuted: string[];
  timeToResolutionSols?: number;
  systemsAffected: string[];
  resolved: boolean;
  resolution?: string;
}

export interface CrewPreferenceProfile {
  preferences: Record<string, number>;
  aversions: string[];
  recentRequests: string[];
  overrideAttempts: Array<{ request: string; granted: boolean; sol: number }>;
  lastUpdatedSol: number;
}

export interface PerformanceDigests {
  decision: string;
  crew: string;
  history: string;
  generatedAtSol: number;
}

export interface MissionMemoryPackage {
  generatedAt: number;
  missionSol: number;
  calibratedCropParams: Record<string, unknown>;
  emergencyLearnings: string[];
  decisionHistory: {
    safetyBlocks: number;
    emergencyPlaybooks: number;
    directDecisions: number;
  };
  crewPreferenceProfile: CrewPreferenceProfile;
  resourceActualsVsProjections: Record<string, { projected: number; actual: number }>;
  whatWorked: string[];
  whatFailed: string[];
}

export interface WeeklyCrewReport {
  id: string;
  weekNumber: number;
  missionSolStart: number;
  missionSolEnd: number;
  generatedAt: number;
  report: string;
}

class SecretaryStore {
  private decisionLog: DecisionLogEntry[] = [];
  private incidentLog: IncidentLogEntry[] = [];
  private crewPreferenceProfile: CrewPreferenceProfile = {
    preferences: {},
    aversions: [],
    recentRequests: [],
    overrideAttempts: [],
    lastUpdatedSol: 0,
  };
  private weeklyReports: WeeklyCrewReport[] = [];
  private missionMemory: MissionMemoryPackage | null = null;
  private performanceDigests: PerformanceDigests | null = null;

  addDecision(entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>): DecisionLogEntry {
    const full: DecisionLogEntry = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry,
    };
    this.decisionLog.unshift(full);
    if (this.decisionLog.length > 500) this.decisionLog = this.decisionLog.slice(0, 500);
    return full;
  }

  updateDecisionOutcome(id: string, actualOutcome: string): void {
    const entry = this.decisionLog.find((decision) => decision.id === id);
    if (!entry) return;
    entry.actualOutcome = actualOutcome;
    entry.outcomeFilledAt = Date.now();
  }

  getDecisionLog(limit = 50): DecisionLogEntry[] {
    return this.decisionLog.slice(0, limit);
  }

  addIncident(entry: Omit<IncidentLogEntry, 'id' | 'timestamp'>): IncidentLogEntry {
    const full: IncidentLogEntry = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry,
    };
    this.incidentLog.unshift(full);
    if (this.incidentLog.length > 200) this.incidentLog = this.incidentLog.slice(0, 200);
    return full;
  }

  resolveIncident(id: string, resolution: string, timeToResolutionSols: number): void {
    const entry = this.incidentLog.find((incident) => incident.id === id);
    if (!entry) return;
    entry.resolved = true;
    entry.resolution = resolution;
    entry.timeToResolutionSols = timeToResolutionSols;
  }

  getIncidentLog(limit = 20): IncidentLogEntry[] {
    return this.incidentLog.slice(0, limit);
  }

  getActiveIncidents(): IncidentLogEntry[] {
    return this.incidentLog.filter((incident) => !incident.resolved);
  }

  updateCrewPreference(crop: string, delta: number, sol: number): void {
    const current = this.crewPreferenceProfile.preferences[crop] ?? 0;
    this.crewPreferenceProfile.preferences[crop] = Math.max(-1, Math.min(1, current + delta));
    this.crewPreferenceProfile.lastUpdatedSol = sol;
  }

  addCrewRequest(request: string, sol: number): void {
    this.crewPreferenceProfile.recentRequests.unshift(request);
    this.crewPreferenceProfile.lastUpdatedSol = sol;
    if (this.crewPreferenceProfile.recentRequests.length > 50) {
      this.crewPreferenceProfile.recentRequests = this.crewPreferenceProfile.recentRequests.slice(0, 50);
    }
  }

  logOverrideAttempt(request: string, granted: boolean, sol: number): void {
    this.crewPreferenceProfile.overrideAttempts.unshift({ request, granted, sol });
    if (this.crewPreferenceProfile.overrideAttempts.length > 50) {
      this.crewPreferenceProfile.overrideAttempts = this.crewPreferenceProfile.overrideAttempts.slice(0, 50);
    }
  }

  getCrewPreferenceProfile(): CrewPreferenceProfile {
    return { ...this.crewPreferenceProfile };
  }

  addWeeklyReport(report: Omit<WeeklyCrewReport, 'id' | 'generatedAt'>): WeeklyCrewReport {
    const full: WeeklyCrewReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      generatedAt: Date.now(),
      ...report,
    };
    this.weeklyReports.unshift(full);
    if (this.weeklyReports.length > 300) this.weeklyReports.length = 300;
    return full;
  }

  getWeeklyReports(limit = 10): WeeklyCrewReport[] {
    return this.weeklyReports.slice(0, limit);
  }

  getLatestWeeklyReport(): WeeklyCrewReport | null {
    return this.weeklyReports[0] ?? null;
  }

  generatePerformanceDigests(missionSol: number): PerformanceDigests {
    const window = this.decisionLog.slice(0, 20);
    const n = window.length;

    let decisionDigest = 'No decisions logged yet — the decision system is still on baseline assumptions.';
    let crewDigest = 'No crew interaction history yet — crew preference signals will appear after the first requests.';
    let historyDigest = 'No operational history yet — summary trends will appear after the first few sols.';

    if (n > 0) {
      const avgRisk = window.reduce((sum, decision) => sum + decision.riskScore, 0) / n;
      const directDecisions = window.filter((decision) => decision.decisionMode === 'direct_decision').length;
      const safetyBlocks = window.filter((decision) => decision.decisionMode === 'safety_block').length;
      const playbooks = window.filter((decision) => decision.decisionMode === 'emergency_playbook').length;

      const paramCounts: Record<string, number> = {};
      for (const decision of window) {
        for (const action of decision.actionsEnacted) {
          if (action.param) paramCounts[action.param] = (paramCounts[action.param] ?? 0) + 1;
        }
      }

      const topParam = Object.entries(paramCounts).sort(([, left], [, right]) => right - left)[0];
      decisionDigest = [
        `Average risk across the last ${n} decisions: ${avgRisk.toFixed(2)}.`,
        `Modes used: ${directDecisions} direct, ${safetyBlocks} blocked, ${playbooks} playbook.`,
        topParam ? `Most-adjusted control: ${topParam[0]} (${topParam[1]} changes).` : 'No parameter-heavy action pattern yet.',
      ].join('\n');

      const avgCrewImpact = window.reduce((sum, decision) => sum + decision.crewImpactScore, 0) / n;
      const topPrefs = Object.entries(this.crewPreferenceProfile.preferences)
        .filter(([, score]) => score > 0.15)
        .sort(([, left], [, right]) => right - left)
        .slice(0, 3)
        .map(([crop]) => crop);

      const overrides = this.crewPreferenceProfile.overrideAttempts.length;
      const blockedOverrides = this.crewPreferenceProfile.overrideAttempts.filter((attempt) => !attempt.granted).length;

      crewDigest = [
        `Average crew-impact score across the last ${n} decisions: ${avgCrewImpact.toFixed(2)}.`,
        topPrefs.length > 0 ? `Current crew favorites: ${topPrefs.join(', ')}.` : 'No strong crew favorites recorded yet.',
        overrides > 0
          ? `${overrides} override attempt(s) logged, ${blockedOverrides} blocked for safety.`
          : 'No override attempts logged.',
      ].join('\n');

      const noActionCount = window.filter((decision) => decision.actionsEnacted.length === 0).length;
      const emergencyCount = window.filter((decision) => decision.triggerType.startsWith('emergency')).length;
      historyDigest = [
        `${emergencyCount} emergency-triggered decisions in the last ${n} entries.`,
        `${noActionCount} of ${n} entries resulted in no physical greenhouse changes.`,
        `Most recent handler mix favors ${window[0]?.handledBy ?? 'none'}-driven decisions.`,
      ].join('\n');
    }

    const digests: PerformanceDigests = {
      decision: decisionDigest,
      crew: crewDigest,
      history: historyDigest,
      generatedAtSol: missionSol,
    };

    this.performanceDigests = digests;
    return digests;
  }

  getPerformanceDigests(): PerformanceDigests | null {
    return this.performanceDigests;
  }

  generateMissionMemory(missionSol: number): MissionMemoryPackage {
    const decisions = this.decisionLog;
    const incidents = this.incidentLog;

    const safetyBlocks = decisions.filter((decision) => decision.decisionMode === 'safety_block').length;
    const emergencyPlaybooks = decisions.filter((decision) => decision.decisionMode === 'emergency_playbook').length;
    const directDecisions = decisions.filter((decision) => decision.decisionMode === 'direct_decision').length;

    const cropActionCounts: Record<string, number> = {};
    const paramAdjustments: Record<string, number[]> = {};
    for (const decision of decisions) {
      for (const action of decision.actionsEnacted) {
        if (action.crop) cropActionCounts[action.crop] = (cropActionCounts[action.crop] ?? 0) + 1;
        if (action.param && action.value !== undefined) {
          if (!paramAdjustments[action.param]) paramAdjustments[action.param] = [];
          paramAdjustments[action.param].push(action.value);
        }
      }
    }

    const calibratedCropParams: Record<string, unknown> = {};
    for (const [param, values] of Object.entries(paramAdjustments)) {
      calibratedCropParams[param] = values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    calibratedCropParams.mostActedOnCrops = Object.entries(cropActionCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 5)
      .map(([crop, actionCount]) => ({ crop, actionCount }));

    const emergencyLearnings = incidents.slice(0, 10).map((incident) => {
      const resolution = incident.resolved
        ? `Resolved in ${incident.timeToResolutionSols ?? '?'} sols.`
        : 'Still active at package generation.';
      return `[Sol ${incident.missionSol}] ${incident.emergencyType} (sev-${incident.severity}): ${incident.actionsExecuted.join(', ')}. ${resolution}`;
    });

    const resourceActualsVsProjections: Record<string, { projected: number; actual: number }> = {};
    const outcomeDecisions = decisions.filter((decision) => decision.actualOutcome);
    if (outcomeDecisions.length > 0) {
      const avgRisk = outcomeDecisions.reduce((sum, decision) => sum + decision.riskScore, 0) / outcomeDecisions.length;
      resourceActualsVsProjections.avgRiskVsObserved = { projected: avgRisk, actual: avgRisk };
    }

    const whatWorked: string[] = [];
    const whatFailed: string[] = [];

    if (emergencyPlaybooks > 0) {
      whatWorked.push(`The emergency playbook executed ${emergencyPlaybooks} time(s), reducing response latency.`);
    }
    if (safetyBlocks > 0) {
      whatWorked.push(`Safety blocks were issued ${safetyBlocks} time(s) to stop risky crew overrides or requests.`);
    }
    if (decisions.length > 0 && decisions.filter((decision) => decision.actionsEnacted.length === 0).length > decisions.length / 2) {
      whatFailed.push('The system may be trending too conservative; more than half of logged decisions resulted in no action.');
    }

    const pkg: MissionMemoryPackage = {
      generatedAt: Date.now(),
      missionSol,
      calibratedCropParams,
      emergencyLearnings,
      decisionHistory: {
        safetyBlocks,
        emergencyPlaybooks,
        directDecisions,
      },
      crewPreferenceProfile: this.getCrewPreferenceProfile(),
      resourceActualsVsProjections,
      whatWorked,
      whatFailed,
    };

    this.missionMemory = pkg;
    return pkg;
  }

  updateMissionMemory(pkg: MissionMemoryPackage): void {
    this.missionMemory = pkg;
  }

  getMissionMemory(): MissionMemoryPackage | null {
    return this.missionMemory;
  }

  reset(): void {
    this.decisionLog = [];
    this.incidentLog = [];
    this.crewPreferenceProfile = {
      preferences: {},
      aversions: [],
      recentRequests: [],
      overrideAttempts: [],
      lastUpdatedSol: 0,
    };
    this.weeklyReports = [];
    this.missionMemory = null;
    this.performanceDigests = null;
  }

  getAgentContext(maxDecisions = 5): string {
    const recentDecisions = this.decisionLog.slice(0, maxDecisions);
    const activeIncidents = this.getActiveIncidents();
    const lines: string[] = [];

    if (activeIncidents.length > 0) {
      lines.push(`ACTIVE INCIDENTS (${activeIncidents.length}):`);
      for (const incident of activeIncidents) {
        lines.push(`  - [Sol ${incident.missionSol}] ${incident.emergencyType} (severity ${incident.severity}): ${incident.trigger}`);
      }
    }

    if (recentDecisions.length > 0) {
      lines.push('RECENT DECISIONS:');
      for (const decision of recentDecisions) {
        lines.push(
          `  - [Sol ${decision.missionSol}] ${decision.triggerType} | risk=${decision.riskScore.toFixed(2)} | ${decision.handledBy} | ${decision.actionsEnacted.length} actions`,
        );
        if (decision.actualOutcome) lines.push(`    Outcome: ${decision.actualOutcome}`);
      }
    }

    const preferences = Object.entries(this.crewPreferenceProfile.preferences)
      .filter(([, score]) => Math.abs(score) > 0.2)
      .map(([crop, score]) => `${crop}:${score > 0 ? '+' : ''}${score.toFixed(1)}`);
    if (preferences.length > 0) {
      lines.push(`CREW PREFERENCES: ${preferences.join(', ')}`);
    }

    return lines.join('\n');
  }
}

export const secretaryStore = new SecretaryStore();
