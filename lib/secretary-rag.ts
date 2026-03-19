/**
 * Secretary RAG — extracts secretary store reports as structured documents
 * for embedding into a local vector store.
 *
 * Each document type gets its own metadata tags so the vector query tool
 * can filter by report type (decision, incident, weekly_report, memory, digest).
 */

import { secretaryStore } from './secretary-store';
import type {
  DecisionLogEntry,
  IncidentLogEntry,
  WeeklyCrewReport,
  MissionMemoryPackage,
  PerformanceDigests,
  CrewPreferenceProfile,
} from './secretary-store';

// ─── Plain-text serialisers ──────────────────────────────────────────────────
// Each function turns a store record into a single text block suitable for
// chunking and embedding.  Metadata is returned separately for vector storage.

export interface SecretaryDocument {
  text: string;
  metadata: {
    type: 'decision' | 'incident' | 'weekly_report' | 'mission_memory' | 'performance_digest' | 'crew_profile';
    id: string;
    missionSol: number;
    timestamp: number;
    [key: string]: unknown;
  };
}

function serialiseDecision(d: DecisionLogEntry): SecretaryDocument {
  const actions = d.actionsEnacted
    .map(a => `${a.type}${a.param ? ` ${a.param}` : ''}${a.crop ? ` on ${a.crop}` : ''}${a.value !== undefined ? ` = ${a.value}` : ''}`)
    .join('; ');

  const text = [
    `Decision Log Entry — Sol ${d.missionSol}`,
    `Trigger: ${d.triggerType}`,
    `Risk Score: ${d.riskScore.toFixed(2)}  |  Wellbeing Score: ${d.wellbeingScore.toFixed(2)}`,
    `Conflict: ${d.conflictType}  |  Winner: ${d.winningAgent}`,
    `Survival Proposal: ${d.survivalProposalSummary}`,
    `Wellbeing Proposal: ${d.wellbeingProposalSummary}`,
    `Actions Enacted: ${actions || 'none'}`,
    d.simulationP10 !== undefined ? `Simulation P10–P90: ${d.simulationP10.toFixed(1)}–${d.simulationP90?.toFixed(1) ?? '?'} kg` : '',
    `Reasoning: ${d.reasoning}`,
    d.actualOutcome ? `Actual Outcome: ${d.actualOutcome}` : '',
  ].filter(Boolean).join('\n');

  return {
    text,
    metadata: {
      type: 'decision',
      id: d.id,
      missionSol: d.missionSol,
      timestamp: d.timestamp,
      triggerType: d.triggerType,
      conflictType: d.conflictType,
      winningAgent: d.winningAgent,
      riskScore: d.riskScore,
      wellbeingScore: d.wellbeingScore,
    },
  };
}

function serialiseIncident(i: IncidentLogEntry): SecretaryDocument {
  const text = [
    `Incident Report — Sol ${i.missionSol}`,
    `Emergency Type: ${i.emergencyType}  |  Severity: ${i.severity}`,
    `Trigger: ${i.trigger}`,
    `Systems Affected: ${i.systemsAffected.join(', ')}`,
    `Actions Executed: ${i.actionsExecuted.join(', ')}`,
    i.resolved
      ? `Resolved: yes  |  Resolution: ${i.resolution}  |  Time to resolution: ${i.timeToResolutionSols ?? '?'} sols`
      : 'Resolved: no — still active',
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'incident',
      id: i.id,
      missionSol: i.missionSol,
      timestamp: i.timestamp,
      severity: i.severity,
      resolved: i.resolved,
    },
  };
}

function serialiseWeeklyReport(r: WeeklyCrewReport): SecretaryDocument {
  const text = [
    `Weekly Crew Report — Week ${r.weekNumber} (Sols ${r.missionSolStart}–${r.missionSolEnd})`,
    '',
    r.report,
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'weekly_report',
      id: r.id,
      missionSol: r.missionSolEnd,
      timestamp: r.generatedAt,
      weekNumber: r.weekNumber,
    },
  };
}

function serialiseMissionMemory(m: MissionMemoryPackage): SecretaryDocument {
  const text = [
    `Mission Memory Package — Sol ${m.missionSol}`,
    '',
    `Conflict Resolution History:`,
    `  Total vetoes: ${m.conflictResolutionHistory.totalVetoes}`,
    `  Vetoes correct in hindsight: ${m.conflictResolutionHistory.vetoesCorrectInHindsight}`,
    `  Soft conflicts resolved: ${m.conflictResolutionHistory.softConflictsResolved}`,
    '',
    `Storm Response Learnings:`,
    ...m.stormResponseLearnings.map(l => `  - ${l}`),
    '',
    `What Worked:`,
    ...m.whatWorked.map(w => `  - ${w}`),
    '',
    `What Failed:`,
    ...(m.whatFailed.length > 0 ? m.whatFailed.map(f => `  - ${f}`) : ['  (none recorded)']),
    '',
    `Calibrated Crop Parameters: ${JSON.stringify(m.calibratedCropParams)}`,
    `Resource Actuals vs Projections: ${JSON.stringify(m.resourceActualsVsProjections)}`,
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'mission_memory',
      id: `memory-sol${m.missionSol}`,
      missionSol: m.missionSol,
      timestamp: m.generatedAt,
    },
  };
}

function serialisePerformanceDigests(d: PerformanceDigests): SecretaryDocument {
  const text = [
    `Performance Digests — Sol ${d.generatedAtSol}`,
    '',
    `Survival Agent Calibration:`,
    d.survival,
    '',
    `Wellbeing Agent Calibration:`,
    d.wellbeing,
    '',
    `Arbiter Calibration:`,
    d.arbiter,
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'performance_digest',
      id: `digest-sol${d.generatedAtSol}`,
      missionSol: d.generatedAtSol,
      timestamp: Date.now(),
    },
  };
}

function serialiseCrewProfile(p: CrewPreferenceProfile): SecretaryDocument {
  const prefs = Object.entries(p.preferences)
    .map(([crop, score]) => `${crop}: ${score > 0 ? '+' : ''}${score.toFixed(2)}`)
    .join(', ');

  const text = [
    `Crew Preference Profile — Last updated Sol ${p.lastUpdatedSol}`,
    '',
    `Food Preferences: ${prefs || 'none recorded'}`,
    `Aversions: ${p.aversions.length > 0 ? p.aversions.join(', ') : 'none'}`,
    `Recent Requests (${p.recentRequests.length}): ${p.recentRequests.slice(0, 10).join('; ') || 'none'}`,
    `Override Attempts (${p.overrideAttempts.length}):`,
    ...p.overrideAttempts.slice(0, 10).map(o =>
      `  - Sol ${o.sol}: "${o.request}" → ${o.granted ? 'granted' : 'denied'}`
    ),
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'crew_profile',
      id: `profile-sol${p.lastUpdatedSol}`,
      missionSol: p.lastUpdatedSol,
      timestamp: Date.now(),
    },
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve all secretary reports as flat documents ready for embedding.
 * Returns every non-null report type currently stored in the secretary singleton.
 */
export function getAllSecretaryDocuments(): SecretaryDocument[] {
  const docs: SecretaryDocument[] = [];

  // Decision log
  for (const d of secretaryStore.getDecisionLog(500)) {
    docs.push(serialiseDecision(d));
  }

  // Incident log
  for (const i of secretaryStore.getIncidentLog(200)) {
    docs.push(serialiseIncident(i));
  }

  // Weekly reports
  for (const r of secretaryStore.getWeeklyReports(100)) {
    docs.push(serialiseWeeklyReport(r));
  }

  // Mission memory
  const mem = secretaryStore.getMissionMemory();
  if (mem) docs.push(serialiseMissionMemory(mem));

  // Performance digests
  const digests = secretaryStore.getPerformanceDigests();
  if (digests) docs.push(serialisePerformanceDigests(digests));

  // Crew preference profile
  const profile = secretaryStore.getCrewPreferenceProfile();
  if (profile.lastUpdatedSol > 0 || Object.keys(profile.preferences).length > 0) {
    docs.push(serialiseCrewProfile(profile));
  }

  return docs;
}

/**
 * Retrieve only new documents since a given timestamp.
 * Useful for incremental ingestion without re-embedding everything.
 */
export function getSecretaryDocumentsSince(sinceTimestamp: number): SecretaryDocument[] {
  return getAllSecretaryDocuments().filter(d => d.metadata.timestamp > sinceTimestamp);
}
