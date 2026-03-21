/**
 * Secretary RAG — extracts secretary store records as structured documents
 * for embedding into the local vector store.
 */

import { secretaryStore } from './secretary-store';
import type {
  CrewPreferenceProfile,
  DecisionLogEntry,
  IncidentLogEntry,
  MissionMemoryPackage,
  PerformanceDigests,
  WeeklyCrewReport,
} from './secretary-store';

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

function serialiseDecision(decision: DecisionLogEntry): SecretaryDocument {
  const actions = decision.actionsEnacted
    .map((action) => `${action.type}${action.param ? ` ${action.param}` : ''}${action.crop ? ` on ${action.crop}` : ''}${action.value !== undefined ? ` = ${action.value}` : ''}`)
    .join('; ');

  const text = [
    `Decision Log Entry — Sol ${decision.missionSol}`,
    `Trigger: ${decision.triggerType}`,
    `Risk Score: ${decision.riskScore.toFixed(2)}  |  Crew Impact Score: ${decision.crewImpactScore.toFixed(2)}`,
    `Decision Mode: ${decision.decisionMode}  |  Handler: ${decision.handledBy}`,
    `Operational Summary: ${decision.operationsSummary}`,
    `Crew Summary: ${decision.crewSummary}`,
    `Actions Enacted: ${actions || 'none'}`,
    `Reasoning: ${decision.reasoning}`,
    decision.actualOutcome ? `Actual Outcome: ${decision.actualOutcome}` : '',
  ].filter(Boolean).join('\n');

  return {
    text,
    metadata: {
      type: 'decision',
      id: decision.id,
      missionSol: decision.missionSol,
      timestamp: decision.timestamp,
      triggerType: decision.triggerType,
      decisionMode: decision.decisionMode,
      handledBy: decision.handledBy,
      riskScore: decision.riskScore,
      crewImpactScore: decision.crewImpactScore,
    },
  };
}

function serialiseIncident(incident: IncidentLogEntry): SecretaryDocument {
  const text = [
    `Incident Report — Sol ${incident.missionSol}`,
    `Emergency Type: ${incident.emergencyType}  |  Severity: ${incident.severity}`,
    `Trigger: ${incident.trigger}`,
    `Systems Affected: ${incident.systemsAffected.join(', ')}`,
    `Actions Executed: ${incident.actionsExecuted.join(', ')}`,
    incident.resolved
      ? `Resolved: yes  |  Resolution: ${incident.resolution}  |  Time to resolution: ${incident.timeToResolutionSols ?? '?'} sols`
      : 'Resolved: no — still active',
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'incident',
      id: incident.id,
      missionSol: incident.missionSol,
      timestamp: incident.timestamp,
      severity: incident.severity,
      resolved: incident.resolved,
    },
  };
}

function serialiseWeeklyReport(report: WeeklyCrewReport): SecretaryDocument {
  return {
    text: [
      `Weekly Crew Report — Week ${report.weekNumber} (Sols ${report.missionSolStart}–${report.missionSolEnd})`,
      '',
      report.report,
    ].join('\n'),
    metadata: {
      type: 'weekly_report',
      id: report.id,
      missionSol: report.missionSolEnd,
      timestamp: report.generatedAt,
      weekNumber: report.weekNumber,
    },
  };
}

function serialiseMissionMemory(memory: MissionMemoryPackage): SecretaryDocument {
  const text = [
    `Mission Memory Package — Sol ${memory.missionSol}`,
    '',
    'Decision History:',
    `  Safety blocks: ${memory.decisionHistory.safetyBlocks}`,
    `  Emergency playbooks: ${memory.decisionHistory.emergencyPlaybooks}`,
    `  Direct decisions: ${memory.decisionHistory.directDecisions}`,
    '',
    'Emergency Learnings:',
    ...memory.emergencyLearnings.map((learning) => `  - ${learning}`),
    '',
    'What Worked:',
    ...memory.whatWorked.map((item) => `  - ${item}`),
    '',
    'What Failed:',
    ...(memory.whatFailed.length > 0 ? memory.whatFailed.map((item) => `  - ${item}`) : ['  (none recorded)']),
    '',
    `Calibrated Crop Parameters: ${JSON.stringify(memory.calibratedCropParams)}`,
    `Resource Actuals vs Projections: ${JSON.stringify(memory.resourceActualsVsProjections)}`,
  ].join('\n');

  return {
    text,
    metadata: {
      type: 'mission_memory',
      id: `memory-sol${memory.missionSol}`,
      missionSol: memory.missionSol,
      timestamp: memory.generatedAt,
    },
  };
}

function serialisePerformanceDigests(digest: PerformanceDigests): SecretaryDocument {
  return {
    text: [
      `Performance Digests — Sol ${digest.generatedAtSol}`,
      '',
      'Decision System:',
      digest.decision,
      '',
      'Crew Signal:',
      digest.crew,
      '',
      'History Signal:',
      digest.history,
    ].join('\n'),
    metadata: {
      type: 'performance_digest',
      id: `digest-sol${digest.generatedAtSol}`,
      missionSol: digest.generatedAtSol,
      timestamp: Date.now(),
    },
  };
}

function serialiseCrewProfile(profile: CrewPreferenceProfile): SecretaryDocument {
  const prefs = Object.entries(profile.preferences)
    .map(([crop, score]) => `${crop}: ${score > 0 ? '+' : ''}${score.toFixed(2)}`)
    .join(', ');

  return {
    text: [
      `Crew Preference Profile — Last updated Sol ${profile.lastUpdatedSol}`,
      '',
      `Food Preferences: ${prefs || 'none recorded'}`,
      `Aversions: ${profile.aversions.length > 0 ? profile.aversions.join(', ') : 'none'}`,
      `Recent Requests (${profile.recentRequests.length}): ${profile.recentRequests.slice(0, 10).join('; ') || 'none'}`,
      `Override Attempts (${profile.overrideAttempts.length}):`,
      ...profile.overrideAttempts.slice(0, 10).map((attempt) =>
        `  - Sol ${attempt.sol}: "${attempt.request}" -> ${attempt.granted ? 'granted' : 'denied'}`,
      ),
    ].join('\n'),
    metadata: {
      type: 'crew_profile',
      id: `profile-sol${profile.lastUpdatedSol}`,
      missionSol: profile.lastUpdatedSol,
      timestamp: Date.now(),
    },
  };
}

export function getAllSecretaryDocuments(): SecretaryDocument[] {
  const docs: SecretaryDocument[] = [];

  for (const decision of secretaryStore.getDecisionLog(500)) {
    docs.push(serialiseDecision(decision));
  }

  for (const incident of secretaryStore.getIncidentLog(200)) {
    docs.push(serialiseIncident(incident));
  }

  for (const report of secretaryStore.getWeeklyReports(100)) {
    docs.push(serialiseWeeklyReport(report));
  }

  const memory = secretaryStore.getMissionMemory();
  if (memory) docs.push(serialiseMissionMemory(memory));

  const digests = secretaryStore.getPerformanceDigests();
  if (digests) docs.push(serialisePerformanceDigests(digests));

  const profile = secretaryStore.getCrewPreferenceProfile();
  if (profile.lastUpdatedSol > 0 || Object.keys(profile.preferences).length > 0) {
    docs.push(serialiseCrewProfile(profile));
  }

  return docs;
}

export function getSecretaryDocumentsSince(sinceTimestamp: number): SecretaryDocument[] {
  return getAllSecretaryDocuments().filter((doc) => doc.metadata.timestamp > sinceTimestamp);
}
