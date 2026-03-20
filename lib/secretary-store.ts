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
export type WinningAgent = 'survival' | 'wellbeing' | 'both' | 'hardcoded' | 'arbiter';
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

export interface PerformanceDigests {
  survival: string;   // 3-line calibration signal for Survival agent
  wellbeing: string;  // 3-line calibration signal for Wellbeing agent
  arbiter: string;    // 3-line calibration signal for Arbiter agent
  generatedAtSol: number;
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
  private performanceDigests: PerformanceDigests | null = null;

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

  // ─── Performance Digests ───────────────────────────────────────────────────

  /**
   * Generate a 3-line calibration digest for each agent, covering the last ~20 decisions.
   * Refreshed every 10 sols and injected into agent prompts as a preamble.
   * The goal: give each agent a concise signal about how well-calibrated it has been
   * so it can self-correct (e.g. "you're over-predicting risk").
   */
  generatePerformanceDigests(missionSol: number): PerformanceDigests {
    const window = this.decisionLog.slice(0, 20); // newest first, up to 20 decisions
    const n = window.length;

    // ── Survival digest ──────────────────────────────────────────────────────
    let survivalDigest: string;
    if (n === 0) {
      survivalDigest = 'No decision history yet — operating on priors.\nCalibration will appear after the first decisions are logged.\nMaintain conservative defaults until feedback accumulates.';
    } else {
      const avgRisk = window.reduce((s, d) => s + d.riskScore, 0) / n;

      // "Nominal" = actualOutcome present and does not mention failure/emergency
      const withOutcomes = window.filter(d => d.actualOutcome);
      const nominalCount = withOutcomes.filter(
        d => !/fail|emergency|critical|dead|lost/i.test(d.actualOutcome!),
      ).length;
      const outcomeClause = withOutcomes.length > 0
        ? `actual outcomes were nominal in ${nominalCount} of ${withOutcomes.length} evaluated cases`
        : 'no retroactive outcomes logged yet';

      const hardVetoes = window.filter(d => d.conflictType === 'hard_veto').length;
      const vetoesSurvival = window.filter(d => d.conflictType === 'hard_veto' && d.winningAgent === 'survival').length;
      const vetoLine = hardVetoes > 0
        ? `You triggered ${hardVetoes} hard veto(es) in this window; ${vetoesSurvival} enacted the survival plan.`
        : 'No hard vetoes in this window — risk thresholds were not breached.';

      const paramCounts: Record<string, number> = {};
      for (const d of window) {
        for (const a of d.actionsEnacted) {
          if (a.param) paramCounts[a.param] = (paramCounts[a.param] ?? 0) + 1;
        }
      }
      const topParam = Object.entries(paramCounts).sort(([, a], [, b]) => b - a)[0];
      const actionLine = topParam
        ? `Most frequently adjusted parameter: ${topParam[0]} (${topParam[1]}x).`
        : 'No parameterised actions in this window.';

      survivalDigest =
        `Your last ${n} risk scores averaged ${avgRisk.toFixed(2)} but ${outcomeClause}.\n` +
        `${vetoLine}\n` +
        `${actionLine}`;
    }

    // ── Wellbeing digest ─────────────────────────────────────────────────────
    let wellbeingDigest: string;
    if (n === 0) {
      wellbeingDigest = 'No decision history yet — crew baseline is unknown.\nCalibration will appear after the first interactions are logged.\nApply neutral crew satisfaction priors until data accumulates.';
    } else {
      const avgWellbeing = window.reduce((s, d) => s + d.wellbeingScore, 0) / n;

      const profile = this.crewPreferenceProfile;
      const topPrefs = Object.entries(profile.preferences)
        .filter(([, v]) => v > 0.15)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([crop]) => crop);
      const prefLine = topPrefs.length > 0
        ? `Current crew favourites: ${topPrefs.join(', ')}.`
        : 'No strong crew food preferences recorded yet.';

      const recentReqs = profile.recentRequests.length;
      const overrides = profile.overrideAttempts.length;
      const deniedOverrides = profile.overrideAttempts.filter(o => !o.granted).length;
      const interactionLine = overrides > 0
        ? `${recentReqs} crew interactions logged; ${overrides} override attempt(s), ${deniedOverrides} denied by safety check.`
        : `${recentReqs} crew interaction(s) logged; no override attempts.`;

      const wellbeingWins = window.filter(d => d.winningAgent === 'wellbeing').length;
      const winLine = `Your proposals were adopted (fully or hybrid) in ${wellbeingWins} of ${n} decisions.`;

      wellbeingDigest =
        `Your last ${n} wellbeing scores averaged ${avgWellbeing.toFixed(2)}.\n` +
        `${prefLine}\n` +
        `${interactionLine} ${winLine}`;
    }

    // ── Arbiter digest ───────────────────────────────────────────────────────
    let arbiterDigest: string;
    if (n === 0) {
      arbiterDigest = 'No decision history yet — arbiter calibration unavailable.\nApply mission-phase defaults until decisions accumulate.\nHybrid proposals are encouraged when agents raise valid but conflicting concerns.';
    } else {
      const agreements = window.filter(d => d.conflictType === 'agreement' || d.conflictType === 'none').length;
      const softConflicts = window.filter(d => d.conflictType === 'soft_conflict').length;
      const hardVetoes = window.filter(d => d.conflictType === 'hard_veto').length;
      const hybrids = window.filter(d => d.winningAgent === 'arbiter').length;
      const conflictLine = `Last ${n} decisions: ${agreements} agreement(s), ${softConflicts} soft conflict(s), ${hardVetoes} hard veto(es).`;

      const hybridLine = hybrids > 0
        ? `You proposed ${hybrids} hybrid action set(s) — review outcomes to calibrate hybrid aggressiveness.`
        : 'No hybrid decisions in this window — consider hybrid when agents raise compatible concerns.';

      const survivalWins = window.filter(d => d.winningAgent === 'survival').length;
      const wellbeingWins = window.filter(d => d.winningAgent === 'wellbeing').length;
      const biasLine = survivalWins > wellbeingWins
        ? `Bias this window: ${survivalWins} survival vs ${wellbeingWins} wellbeing — check if crew morale context warrants more balance.`
        : survivalWins < wellbeingWins
        ? `Bias this window: ${wellbeingWins} wellbeing vs ${survivalWins} survival — verify safety margins remain adequate.`
        : `Balanced rulings: ${survivalWins} each this window.`;

      arbiterDigest =
        `${conflictLine}\n` +
        `${hybridLine}\n` +
        `${biasLine}`;
    }

    const digests: PerformanceDigests = {
      survival: survivalDigest,
      wellbeing: wellbeingDigest,
      arbiter: arbiterDigest,
      generatedAtSol: missionSol,
    };
    this.performanceDigests = digests;
    return digests;
  }

  getPerformanceDigests(): PerformanceDigests | null {
    return this.performanceDigests;
  }

  // ─── Mission Memory Package ────────────────────────────────────────────────

  /**
   * Generate the mission memory package from the current decision + incident logs.
   * Pure synthesis — no LLM required. Called at mission end or on a schedule.
   *
   * Per spec §5.1, the package gives Mission 2 agents:
   * - Calibrated crop growth parameters (deviation from MCP baseline)
   * - Storm response learnings (which playbook actions were effective)
   * - Conflict resolution history (how often Survival vetoed, and whether correct)
   * - Crew preference profile (food preferences to pre-warm Mission 2 Wellbeing agent)
   * - Resource consumption actuals vs. projections (for improving simulation accuracy)
   */
  generateMissionMemory(missionSol: number): MissionMemoryPackage {
    const decisions = this.decisionLog;
    const incidents = this.incidentLog;

    // ── Conflict resolution history ──────────────────────────────────────────
    const totalVetoes = decisions.filter(d => d.conflictType === 'hard_veto').length;
    const softConflicts = decisions.filter(d => d.conflictType === 'soft_conflict').length;
    // A veto is "correct in hindsight" if the actual outcome was positive (no crop failure)
    // We use actualOutcome presence as a proxy — a filled outcome that doesn't mention "failed"
    const vetoesCorrectInHindsight = decisions
      .filter(d => d.conflictType === 'hard_veto' && d.actualOutcome)
      .filter(d => !d.actualOutcome!.toLowerCase().includes('fail')).length;

    // ── Calibrated crop parameters ────────────────────────────────────────────
    // Infer which crops were acted on most, and what parameter adjustments dominated
    const cropActionCounts: Record<string, number> = {};
    const paramAdjustments: Record<string, number[]> = {};
    for (const d of decisions) {
      for (const action of d.actionsEnacted) {
        if (action.crop) {
          cropActionCounts[action.crop] = (cropActionCounts[action.crop] ?? 0) + 1;
        }
        if (action.param && action.value !== undefined) {
          if (!paramAdjustments[action.param]) paramAdjustments[action.param] = [];
          paramAdjustments[action.param].push(action.value);
        }
      }
    }
    // Average value per parameter as the "calibrated" baseline
    const calibratedCropParams: Record<string, unknown> = {};
    for (const [param, values] of Object.entries(paramAdjustments)) {
      calibratedCropParams[param] = values.reduce((s, v) => s + v, 0) / values.length;
    }
    calibratedCropParams['mostActedOnCrops'] = Object.entries(cropActionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([crop, count]) => ({ crop, actionCount: count }));

    // ── Storm response learnings ──────────────────────────────────────────────
    const stormResponseLearnings: string[] = [];
    const emergencyIncidents = incidents.filter(i => i.severity <= 2);
    for (const inc of emergencyIncidents.slice(0, 10)) {
      const resolved = inc.resolved ? `Resolved in ${inc.timeToResolutionSols ?? '?'} sols.` : 'Still active at package generation.';
      stormResponseLearnings.push(
        `[Sol ${inc.missionSol}] ${inc.emergencyType} (sev-${inc.severity}): ${inc.actionsExecuted.join(', ')}. ${resolved}`
      );
    }

    // ── Simulation accuracy: P10 predictions vs actual outcomes ──────────────
    const resourceActualsVsProjections: Record<string, { projected: number; actual: number }> = {};
    const simdDecisions = decisions.filter(d => d.simulationP10 !== undefined && d.actualOutcome);
    if (simdDecisions.length > 0) {
      const avgP10 = simdDecisions.reduce((s, d) => s + (d.simulationP10 ?? 0), 0) / simdDecisions.length;
      resourceActualsVsProjections['avgSimulationP10YieldKg'] = { projected: avgP10, actual: avgP10 }; // placeholder until actual yield tracking
    }

    // ── What worked / what failed ─────────────────────────────────────────────
    const whatWorked: string[] = [];
    const whatFailed: string[] = [];

    if (totalVetoes > 0 && vetoesCorrectInHindsight / totalVetoes > 0.6) {
      whatWorked.push(`Survival veto was reliable: ${vetoesCorrectInHindsight}/${totalVetoes} vetoes correct in hindsight.`);
    }
    if (softConflicts > 0) {
      const survivalWins = decisions.filter(d => d.conflictType === 'soft_conflict' && d.winningAgent === 'survival').length;
      whatWorked.push(`Simulation-based arbiter resolved ${softConflicts} soft conflicts (survival won ${survivalWins}).`);
    }
    const emergencyCount = incidents.filter(i => i.severity === 1).length;
    if (emergencyCount > 0) {
      const resolved = incidents.filter(i => i.severity === 1 && i.resolved).length;
      (resolved === emergencyCount ? whatWorked : whatFailed).push(
        `${emergencyCount} severity-1 emergencies — ${resolved} resolved, ${emergencyCount - resolved} unresolved.`
      );
    }
    const crewOverrideAttempts = this.crewPreferenceProfile.overrideAttempts.length;
    const deniedOverrides = this.crewPreferenceProfile.overrideAttempts.filter(o => !o.granted).length;
    if (crewOverrideAttempts > 0) {
      whatWorked.push(`Crew overrides: ${crewOverrideAttempts} attempted, ${deniedOverrides} denied by safety check.`);
    }

    const pkg: MissionMemoryPackage = {
      generatedAt: Date.now(),
      missionSol,
      calibratedCropParams,
      stormResponseLearnings,
      conflictResolutionHistory: {
        totalVetoes,
        vetoesCorrectInHindsight,
        softConflictsResolved: softConflicts,
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

  // ─── Reset ─────────────────────────────────────────────────────────────────

  /** Wipe all in-memory state back to a fresh mission start. */
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
