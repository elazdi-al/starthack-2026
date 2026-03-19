/**
 * Secretary Store — in-memory persistence for mission logs
 *
 * The Secretary agent produces five distinct output types (spec §5):
 * 1. Per-decision log  — every trigger, proposal, conflict, action
 * 2. Weekly crew report — LLM-generated plain-language summary (every 7 sols)
 * 3. Incident log       — emergency events, severity, resolution
 * 4. Crew preference profile — rolling food preferences inferred from interactions
 * 5. Mission memory package — end-of-mission compressed policy + outcome log
 *
 * In production this maps to DynamoDB (logs) + S3 (memory package).
 * For the hackathon this is an in-memory singleton with localStorage persistence.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConflictType = 'agreement' | 'soft_conflict' | 'hard_veto' | 'none';
export type WinningAgent = 'survival' | 'wellbeing' | 'both' | 'hardcoded';
export type TriggerType = 'emergency_sev1' | 'emergency_sev2' | 'routine' | 'crew_question' | 'crew_request' | 'crew_override';

export interface DecisionLogEntry {
  id: string;
  timestamp: number;
  missionSol: number;
  triggerType: TriggerType;
  riskScore: number;
  wellbeingScore: number;
  conflictType: ConflictType;
  winningAgent: WinningAgent;
  survivalProposalSummary: string;
  wellbeingProposalSummary: string;
  actionsEnacted: Array<{ type: string; param?: string; value?: number; crop?: string }>;
  simulationP10?: number;
  simulationP90?: number;
  reasoning: string;
  // Retroactive outcome — filled n sols later
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
  preferences: Record<string, number>; // crop → preference score (-1 to +1)
  aversions: string[];
  recentRequests: string[];
  overrideAttempts: Array<{ request: string; granted: boolean; sol: number }>;
  lastUpdatedSol: number;
}

export interface MissionMemoryPackage {
  generatedAt: number;
  missionSol: number;
  calibratedCropParams: Record<string, unknown>;
  stormResponseLearnings: string[];
  conflictResolutionHistory: {
    totalVetoes: number;
    vetoesCorrectInHindsight: number;
    softConflictsResolved: number;
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
  report: string; // LLM-generated plain-language text
}

// ─── Store ────────────────────────────────────────────────────────────────────

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

  // ─── Decision Log ──────────────────────────────────────────────────────────

  addDecision(entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>): DecisionLogEntry {
    const full: DecisionLogEntry = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry,
    };
    this.decisionLog.unshift(full); // newest first
    // Keep last 500 entries
    if (this.decisionLog.length > 500) this.decisionLog = this.decisionLog.slice(0, 500);
    return full;
  }

  /** Retroactive logging: fill actual outcome n sols after the decision */
  updateDecisionOutcome(id: string, actualOutcome: string): void {
    const entry = this.decisionLog.find(d => d.id === id);
    if (entry) {
      entry.actualOutcome = actualOutcome;
      entry.outcomeFilledAt = Date.now();
    }
  }

  getDecisionLog(limit = 50): DecisionLogEntry[] {
    return this.decisionLog.slice(0, limit);
  }

  // ─── Incident Log ──────────────────────────────────────────────────────────

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
    const entry = this.incidentLog.find(i => i.id === id);
    if (entry) {
      entry.resolved = true;
      entry.resolution = resolution;
      entry.timeToResolutionSols = timeToResolutionSols;
    }
  }

  getIncidentLog(limit = 20): IncidentLogEntry[] {
    return this.incidentLog.slice(0, limit);
  }

  getActiveIncidents(): IncidentLogEntry[] {
    return this.incidentLog.filter(i => !i.resolved);
  }

  // ─── Crew Preference Profile ───────────────────────────────────────────────

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

  // ─── Weekly Reports ────────────────────────────────────────────────────────

  addWeeklyReport(report: Omit<WeeklyCrewReport, 'id' | 'generatedAt'>): WeeklyCrewReport {
    const full: WeeklyCrewReport = {
      id: `report-week${report.weekNumber}`,
      generatedAt: Date.now(),
      ...report,
    };
    this.weeklyReports.unshift(full);
    return full;
  }

  getWeeklyReports(limit = 10): WeeklyCrewReport[] {
    return this.weeklyReports.slice(0, limit);
  }

  getLatestWeeklyReport(): WeeklyCrewReport | null {
    return this.weeklyReports[0] ?? null;
  }

  // ─── Mission Memory Package ────────────────────────────────────────────────

  updateMissionMemory(pkg: MissionMemoryPackage): void {
    this.missionMemory = pkg;
  }

  getMissionMemory(): MissionMemoryPackage | null {
    return this.missionMemory;
  }

  // ─── Aggregated context for agents ────────────────────────────────────────

  getAgentContext(maxDecisions = 5): string {
    const recentDecisions = this.decisionLog.slice(0, maxDecisions);
    const activeIncidents = this.getActiveIncidents();

    const lines: string[] = [];

    if (activeIncidents.length > 0) {
      lines.push(`ACTIVE INCIDENTS (${activeIncidents.length}):`);
      for (const inc of activeIncidents) {
        lines.push(`  - [Sol ${inc.missionSol}] ${inc.emergencyType} (severity ${inc.severity}): ${inc.trigger}`);
      }
    }

    if (recentDecisions.length > 0) {
      lines.push(`RECENT DECISIONS:`);
      for (const dec of recentDecisions) {
        lines.push(`  - [Sol ${dec.missionSol}] ${dec.triggerType} | risk=${dec.riskScore.toFixed(2)} | ${dec.winningAgent} won | ${dec.actionsEnacted.length} actions`);
        if (dec.actualOutcome) lines.push(`    Outcome: ${dec.actualOutcome}`);
      }
    }

    const prefs = Object.entries(this.crewPreferenceProfile.preferences)
      .filter(([, v]) => Math.abs(v) > 0.2)
      .map(([crop, v]) => `${crop}:${v > 0 ? '+' : ''}${v.toFixed(1)}`);
    if (prefs.length > 0) {
      lines.push(`CREW PREFERENCES: ${prefs.join(', ')}`);
    }

    return lines.join('\n');
  }
}

// Singleton
export const secretaryStore = new SecretaryStore();
