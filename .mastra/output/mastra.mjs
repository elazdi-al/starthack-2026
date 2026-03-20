import { Mastra } from '@mastra/core/mastra';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { Observability, SensitiveDataFilter, DefaultExporter, CloudExporter, SamplingStrategyType } from '@mastra/observability';
import { Agent } from '@mastra/core/agent';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { google } from '@ai-sdk/google';
import { embedMany } from 'ai';
import { Memory } from '@mastra/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AwsClient } from 'aws4fetch';
import { createWorkflow, createStep } from '@mastra/core/workflows';

class SecretaryStore {
  constructor() {
    this.decisionLog = [];
    this.incidentLog = [];
    this.crewPreferenceProfile = {
      preferences: {},
      aversions: [],
      recentRequests: [],
      overrideAttempts: [],
      lastUpdatedSol: 0
    };
    this.weeklyReports = [];
    this.missionMemory = null;
    this.performanceDigests = null;
  }
  // ─── Decision Log ──────────────────────────────────────────────────────────
  addDecision(entry) {
    const full = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry
    };
    this.decisionLog.unshift(full);
    if (this.decisionLog.length > 500) this.decisionLog = this.decisionLog.slice(0, 500);
    return full;
  }
  /** Retroactive logging: fill actual outcome n sols after the decision */
  updateDecisionOutcome(id, actualOutcome) {
    const entry = this.decisionLog.find((d) => d.id === id);
    if (entry) {
      entry.actualOutcome = actualOutcome;
      entry.outcomeFilledAt = Date.now();
    }
  }
  getDecisionLog(limit = 50) {
    return this.decisionLog.slice(0, limit);
  }
  // ─── Incident Log ──────────────────────────────────────────────────────────
  addIncident(entry) {
    const full = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...entry
    };
    this.incidentLog.unshift(full);
    if (this.incidentLog.length > 200) this.incidentLog = this.incidentLog.slice(0, 200);
    return full;
  }
  resolveIncident(id, resolution, timeToResolutionSols) {
    const entry = this.incidentLog.find((i) => i.id === id);
    if (entry) {
      entry.resolved = true;
      entry.resolution = resolution;
      entry.timeToResolutionSols = timeToResolutionSols;
    }
  }
  getIncidentLog(limit = 20) {
    return this.incidentLog.slice(0, limit);
  }
  getActiveIncidents() {
    return this.incidentLog.filter((i) => !i.resolved);
  }
  // ─── Crew Preference Profile ───────────────────────────────────────────────
  updateCrewPreference(crop, delta, sol) {
    const current = this.crewPreferenceProfile.preferences[crop] ?? 0;
    this.crewPreferenceProfile.preferences[crop] = Math.max(-1, Math.min(1, current + delta));
    this.crewPreferenceProfile.lastUpdatedSol = sol;
  }
  addCrewRequest(request, sol) {
    this.crewPreferenceProfile.recentRequests.unshift(request);
    this.crewPreferenceProfile.lastUpdatedSol = sol;
    if (this.crewPreferenceProfile.recentRequests.length > 50) {
      this.crewPreferenceProfile.recentRequests = this.crewPreferenceProfile.recentRequests.slice(0, 50);
    }
  }
  logOverrideAttempt(request, granted, sol) {
    this.crewPreferenceProfile.overrideAttempts.unshift({ request, granted, sol });
    if (this.crewPreferenceProfile.overrideAttempts.length > 50) {
      this.crewPreferenceProfile.overrideAttempts = this.crewPreferenceProfile.overrideAttempts.slice(0, 50);
    }
  }
  getCrewPreferenceProfile() {
    return { ...this.crewPreferenceProfile };
  }
  // ─── Weekly Reports ────────────────────────────────────────────────────────
  addWeeklyReport(report) {
    const full = {
      id: `report-week${report.weekNumber}`,
      generatedAt: Date.now(),
      ...report
    };
    this.weeklyReports.unshift(full);
    return full;
  }
  getWeeklyReports(limit = 10) {
    return this.weeklyReports.slice(0, limit);
  }
  getLatestWeeklyReport() {
    return this.weeklyReports[0] ?? null;
  }
  // ─── Performance Digests ───────────────────────────────────────────────────
  /**
   * Generate a 3-line calibration digest for each agent, covering the last ~20 decisions.
   * Refreshed every 10 sols and injected into agent prompts as a preamble.
   * The goal: give each agent a concise signal about how well-calibrated it has been
   * so it can self-correct (e.g. "you're over-predicting risk").
   */
  generatePerformanceDigests(missionSol) {
    const window = this.decisionLog.slice(0, 20);
    const n = window.length;
    let survivalDigest;
    if (n === 0) {
      survivalDigest = "No decision history yet \u2014 operating on priors.\nCalibration will appear after the first decisions are logged.\nMaintain conservative defaults until feedback accumulates.";
    } else {
      const avgRisk = window.reduce((s, d) => s + d.riskScore, 0) / n;
      const withOutcomes = window.filter((d) => d.actualOutcome);
      const nominalCount = withOutcomes.filter(
        (d) => !/fail|emergency|critical|dead|lost/i.test(d.actualOutcome)
      ).length;
      const outcomeClause = withOutcomes.length > 0 ? `actual outcomes were nominal in ${nominalCount} of ${withOutcomes.length} evaluated cases` : "no retroactive outcomes logged yet";
      const hardVetoes = window.filter((d) => d.conflictType === "hard_veto").length;
      const vetoesSurvival = window.filter((d) => d.conflictType === "hard_veto" && d.winningAgent === "survival").length;
      const vetoLine = hardVetoes > 0 ? `You triggered ${hardVetoes} hard veto(es) in this window; ${vetoesSurvival} enacted the survival plan.` : "No hard vetoes in this window \u2014 risk thresholds were not breached.";
      const paramCounts = {};
      for (const d of window) {
        for (const a of d.actionsEnacted) {
          if (a.param) paramCounts[a.param] = (paramCounts[a.param] ?? 0) + 1;
        }
      }
      const topParam = Object.entries(paramCounts).sort(([, a], [, b]) => b - a)[0];
      const actionLine = topParam ? `Most frequently adjusted parameter: ${topParam[0]} (${topParam[1]}x).` : "No parameterised actions in this window.";
      survivalDigest = `Your last ${n} risk scores averaged ${avgRisk.toFixed(2)} but ${outcomeClause}.
${vetoLine}
${actionLine}`;
    }
    let wellbeingDigest;
    if (n === 0) {
      wellbeingDigest = "No decision history yet \u2014 crew baseline is unknown.\nCalibration will appear after the first interactions are logged.\nApply neutral crew satisfaction priors until data accumulates.";
    } else {
      const avgWellbeing = window.reduce((s, d) => s + d.wellbeingScore, 0) / n;
      const profile = this.crewPreferenceProfile;
      const topPrefs = Object.entries(profile.preferences).filter(([, v]) => v > 0.15).sort(([, a], [, b]) => b - a).slice(0, 3).map(([crop]) => crop);
      const prefLine = topPrefs.length > 0 ? `Current crew favourites: ${topPrefs.join(", ")}.` : "No strong crew food preferences recorded yet.";
      const recentReqs = profile.recentRequests.length;
      const overrides = profile.overrideAttempts.length;
      const deniedOverrides = profile.overrideAttempts.filter((o) => !o.granted).length;
      const interactionLine = overrides > 0 ? `${recentReqs} crew interactions logged; ${overrides} override attempt(s), ${deniedOverrides} denied by safety check.` : `${recentReqs} crew interaction(s) logged; no override attempts.`;
      const wellbeingWins = window.filter((d) => d.winningAgent === "wellbeing").length;
      const winLine = `Your proposals were adopted (fully or hybrid) in ${wellbeingWins} of ${n} decisions.`;
      wellbeingDigest = `Your last ${n} wellbeing scores averaged ${avgWellbeing.toFixed(2)}.
${prefLine}
${interactionLine} ${winLine}`;
    }
    let arbiterDigest;
    if (n === 0) {
      arbiterDigest = "No decision history yet \u2014 arbiter calibration unavailable.\nApply mission-phase defaults until decisions accumulate.\nHybrid proposals are encouraged when agents raise valid but conflicting concerns.";
    } else {
      const agreements = window.filter((d) => d.conflictType === "agreement" || d.conflictType === "none").length;
      const softConflicts = window.filter((d) => d.conflictType === "soft_conflict").length;
      const hardVetoes = window.filter((d) => d.conflictType === "hard_veto").length;
      const hybrids = window.filter((d) => d.winningAgent === "arbiter").length;
      const conflictLine = `Last ${n} decisions: ${agreements} agreement(s), ${softConflicts} soft conflict(s), ${hardVetoes} hard veto(es).`;
      const hybridLine = hybrids > 0 ? `You proposed ${hybrids} hybrid action set(s) \u2014 review outcomes to calibrate hybrid aggressiveness.` : "No hybrid decisions in this window \u2014 consider hybrid when agents raise compatible concerns.";
      const survivalWins = window.filter((d) => d.winningAgent === "survival").length;
      const wellbeingWins = window.filter((d) => d.winningAgent === "wellbeing").length;
      const biasLine = survivalWins > wellbeingWins ? `Bias this window: ${survivalWins} survival vs ${wellbeingWins} wellbeing \u2014 check if crew morale context warrants more balance.` : survivalWins < wellbeingWins ? `Bias this window: ${wellbeingWins} wellbeing vs ${survivalWins} survival \u2014 verify safety margins remain adequate.` : `Balanced rulings: ${survivalWins} each this window.`;
      arbiterDigest = `${conflictLine}
${hybridLine}
${biasLine}`;
    }
    const digests = {
      survival: survivalDigest,
      wellbeing: wellbeingDigest,
      arbiter: arbiterDigest,
      generatedAtSol: missionSol
    };
    this.performanceDigests = digests;
    return digests;
  }
  getPerformanceDigests() {
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
  generateMissionMemory(missionSol) {
    const decisions = this.decisionLog;
    const incidents = this.incidentLog;
    const totalVetoes = decisions.filter((d) => d.conflictType === "hard_veto").length;
    const softConflicts = decisions.filter((d) => d.conflictType === "soft_conflict").length;
    const vetoesCorrectInHindsight = decisions.filter((d) => d.conflictType === "hard_veto" && d.actualOutcome).filter((d) => !d.actualOutcome.toLowerCase().includes("fail")).length;
    const cropActionCounts = {};
    const paramAdjustments = {};
    for (const d of decisions) {
      for (const action of d.actionsEnacted) {
        if (action.crop) {
          cropActionCounts[action.crop] = (cropActionCounts[action.crop] ?? 0) + 1;
        }
        if (action.param && action.value !== void 0) {
          if (!paramAdjustments[action.param]) paramAdjustments[action.param] = [];
          paramAdjustments[action.param].push(action.value);
        }
      }
    }
    const calibratedCropParams = {};
    for (const [param, values] of Object.entries(paramAdjustments)) {
      calibratedCropParams[param] = values.reduce((s, v) => s + v, 0) / values.length;
    }
    calibratedCropParams["mostActedOnCrops"] = Object.entries(cropActionCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([crop, count]) => ({ crop, actionCount: count }));
    const stormResponseLearnings = [];
    const emergencyIncidents = incidents.filter((i) => i.severity <= 2);
    for (const inc of emergencyIncidents.slice(0, 10)) {
      const resolved = inc.resolved ? `Resolved in ${inc.timeToResolutionSols ?? "?"} sols.` : "Still active at package generation.";
      stormResponseLearnings.push(
        `[Sol ${inc.missionSol}] ${inc.emergencyType} (sev-${inc.severity}): ${inc.actionsExecuted.join(", ")}. ${resolved}`
      );
    }
    const resourceActualsVsProjections = {};
    const simdDecisions = decisions.filter((d) => d.simulationP10 !== void 0 && d.actualOutcome);
    if (simdDecisions.length > 0) {
      const avgP10 = simdDecisions.reduce((s, d) => s + (d.simulationP10 ?? 0), 0) / simdDecisions.length;
      resourceActualsVsProjections["avgSimulationP10YieldKg"] = { projected: avgP10, actual: avgP10 };
    }
    const whatWorked = [];
    const whatFailed = [];
    if (totalVetoes > 0 && vetoesCorrectInHindsight / totalVetoes > 0.6) {
      whatWorked.push(`Survival veto was reliable: ${vetoesCorrectInHindsight}/${totalVetoes} vetoes correct in hindsight.`);
    }
    if (softConflicts > 0) {
      const survivalWins = decisions.filter((d) => d.conflictType === "soft_conflict" && d.winningAgent === "survival").length;
      whatWorked.push(`Simulation-based arbiter resolved ${softConflicts} soft conflicts (survival won ${survivalWins}).`);
    }
    const emergencyCount = incidents.filter((i) => i.severity === 1).length;
    if (emergencyCount > 0) {
      const resolved = incidents.filter((i) => i.severity === 1 && i.resolved).length;
      (resolved === emergencyCount ? whatWorked : whatFailed).push(
        `${emergencyCount} severity-1 emergencies \u2014 ${resolved} resolved, ${emergencyCount - resolved} unresolved.`
      );
    }
    const crewOverrideAttempts = this.crewPreferenceProfile.overrideAttempts.length;
    const deniedOverrides = this.crewPreferenceProfile.overrideAttempts.filter((o) => !o.granted).length;
    if (crewOverrideAttempts > 0) {
      whatWorked.push(`Crew overrides: ${crewOverrideAttempts} attempted, ${deniedOverrides} denied by safety check.`);
    }
    const pkg = {
      generatedAt: Date.now(),
      missionSol,
      calibratedCropParams,
      stormResponseLearnings,
      conflictResolutionHistory: {
        totalVetoes,
        vetoesCorrectInHindsight,
        softConflictsResolved: softConflicts
      },
      crewPreferenceProfile: this.getCrewPreferenceProfile(),
      resourceActualsVsProjections,
      whatWorked,
      whatFailed
    };
    this.missionMemory = pkg;
    return pkg;
  }
  updateMissionMemory(pkg) {
    this.missionMemory = pkg;
  }
  getMissionMemory() {
    return this.missionMemory;
  }
  // ─── Reset ─────────────────────────────────────────────────────────────────
  /** Wipe all in-memory state back to a fresh mission start. */
  reset() {
    this.decisionLog = [];
    this.incidentLog = [];
    this.crewPreferenceProfile = {
      preferences: {},
      aversions: [],
      recentRequests: [],
      overrideAttempts: [],
      lastUpdatedSol: 0
    };
    this.weeklyReports = [];
    this.missionMemory = null;
    this.performanceDigests = null;
  }
  // ─── Aggregated context for agents ────────────────────────────────────────
  getAgentContext(maxDecisions = 5) {
    const recentDecisions = this.decisionLog.slice(0, maxDecisions);
    const activeIncidents = this.getActiveIncidents();
    const lines = [];
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
    const prefs = Object.entries(this.crewPreferenceProfile.preferences).filter(([, v]) => Math.abs(v) > 0.2).map(([crop, v]) => `${crop}:${v > 0 ? "+" : ""}${v.toFixed(1)}`);
    if (prefs.length > 0) {
      lines.push(`CREW PREFERENCES: ${prefs.join(", ")}`);
    }
    return lines.join("\n");
  }
}
const secretaryStore = new SecretaryStore();

function serialiseDecision(d) {
  const actions = d.actionsEnacted.map((a) => `${a.type}${a.param ? ` ${a.param}` : ""}${a.crop ? ` on ${a.crop}` : ""}${a.value !== void 0 ? ` = ${a.value}` : ""}`).join("; ");
  const text = [
    `Decision Log Entry \u2014 Sol ${d.missionSol}`,
    `Trigger: ${d.triggerType}`,
    `Risk Score: ${d.riskScore.toFixed(2)}  |  Wellbeing Score: ${d.wellbeingScore.toFixed(2)}`,
    `Conflict: ${d.conflictType}  |  Winner: ${d.winningAgent}`,
    `Survival Proposal: ${d.survivalProposalSummary}`,
    `Wellbeing Proposal: ${d.wellbeingProposalSummary}`,
    `Actions Enacted: ${actions || "none"}`,
    d.simulationP10 !== void 0 ? `Simulation P10\u2013P90: ${d.simulationP10.toFixed(1)}\u2013${d.simulationP90?.toFixed(1) ?? "?"} kg` : "",
    `Reasoning: ${d.reasoning}`,
    d.actualOutcome ? `Actual Outcome: ${d.actualOutcome}` : ""
  ].filter(Boolean).join("\n");
  return {
    text,
    metadata: {
      type: "decision",
      id: d.id,
      missionSol: d.missionSol,
      timestamp: d.timestamp,
      triggerType: d.triggerType,
      conflictType: d.conflictType,
      winningAgent: d.winningAgent,
      riskScore: d.riskScore,
      wellbeingScore: d.wellbeingScore
    }
  };
}
function serialiseIncident(i) {
  const text = [
    `Incident Report \u2014 Sol ${i.missionSol}`,
    `Emergency Type: ${i.emergencyType}  |  Severity: ${i.severity}`,
    `Trigger: ${i.trigger}`,
    `Systems Affected: ${i.systemsAffected.join(", ")}`,
    `Actions Executed: ${i.actionsExecuted.join(", ")}`,
    i.resolved ? `Resolved: yes  |  Resolution: ${i.resolution}  |  Time to resolution: ${i.timeToResolutionSols ?? "?"} sols` : "Resolved: no \u2014 still active"
  ].join("\n");
  return {
    text,
    metadata: {
      type: "incident",
      id: i.id,
      missionSol: i.missionSol,
      timestamp: i.timestamp,
      severity: i.severity,
      resolved: i.resolved
    }
  };
}
function serialiseWeeklyReport(r) {
  const text = [
    `Weekly Crew Report \u2014 Week ${r.weekNumber} (Sols ${r.missionSolStart}\u2013${r.missionSolEnd})`,
    "",
    r.report
  ].join("\n");
  return {
    text,
    metadata: {
      type: "weekly_report",
      id: r.id,
      missionSol: r.missionSolEnd,
      timestamp: r.generatedAt,
      weekNumber: r.weekNumber
    }
  };
}
function serialiseMissionMemory(m) {
  const text = [
    `Mission Memory Package \u2014 Sol ${m.missionSol}`,
    "",
    `Conflict Resolution History:`,
    `  Total vetoes: ${m.conflictResolutionHistory.totalVetoes}`,
    `  Vetoes correct in hindsight: ${m.conflictResolutionHistory.vetoesCorrectInHindsight}`,
    `  Soft conflicts resolved: ${m.conflictResolutionHistory.softConflictsResolved}`,
    "",
    `Storm Response Learnings:`,
    ...m.stormResponseLearnings.map((l) => `  - ${l}`),
    "",
    `What Worked:`,
    ...m.whatWorked.map((w) => `  - ${w}`),
    "",
    `What Failed:`,
    ...m.whatFailed.length > 0 ? m.whatFailed.map((f) => `  - ${f}`) : ["  (none recorded)"],
    "",
    `Calibrated Crop Parameters: ${JSON.stringify(m.calibratedCropParams)}`,
    `Resource Actuals vs Projections: ${JSON.stringify(m.resourceActualsVsProjections)}`
  ].join("\n");
  return {
    text,
    metadata: {
      type: "mission_memory",
      id: `memory-sol${m.missionSol}`,
      missionSol: m.missionSol,
      timestamp: m.generatedAt
    }
  };
}
function serialisePerformanceDigests(d) {
  const text = [
    `Performance Digests \u2014 Sol ${d.generatedAtSol}`,
    "",
    `Survival Agent Calibration:`,
    d.survival,
    "",
    `Wellbeing Agent Calibration:`,
    d.wellbeing,
    "",
    `Arbiter Calibration:`,
    d.arbiter
  ].join("\n");
  return {
    text,
    metadata: {
      type: "performance_digest",
      id: `digest-sol${d.generatedAtSol}`,
      missionSol: d.generatedAtSol,
      timestamp: Date.now()
    }
  };
}
function serialiseCrewProfile(p) {
  const prefs = Object.entries(p.preferences).map(([crop, score]) => `${crop}: ${score > 0 ? "+" : ""}${score.toFixed(2)}`).join(", ");
  const text = [
    `Crew Preference Profile \u2014 Last updated Sol ${p.lastUpdatedSol}`,
    "",
    `Food Preferences: ${prefs || "none recorded"}`,
    `Aversions: ${p.aversions.length > 0 ? p.aversions.join(", ") : "none"}`,
    `Recent Requests (${p.recentRequests.length}): ${p.recentRequests.slice(0, 10).join("; ") || "none"}`,
    `Override Attempts (${p.overrideAttempts.length}):`,
    ...p.overrideAttempts.slice(0, 10).map(
      (o) => `  - Sol ${o.sol}: "${o.request}" \u2192 ${o.granted ? "granted" : "denied"}`
    )
  ].join("\n");
  return {
    text,
    metadata: {
      type: "crew_profile",
      id: `profile-sol${p.lastUpdatedSol}`,
      missionSol: p.lastUpdatedSol,
      timestamp: Date.now()
    }
  };
}
function getAllSecretaryDocuments() {
  const docs = [];
  for (const d of secretaryStore.getDecisionLog(500)) {
    docs.push(serialiseDecision(d));
  }
  for (const i of secretaryStore.getIncidentLog(200)) {
    docs.push(serialiseIncident(i));
  }
  for (const r of secretaryStore.getWeeklyReports(100)) {
    docs.push(serialiseWeeklyReport(r));
  }
  const mem = secretaryStore.getMissionMemory();
  if (mem) docs.push(serialiseMissionMemory(mem));
  const digests = secretaryStore.getPerformanceDigests();
  if (digests) docs.push(serialisePerformanceDigests(digests));
  const profile = secretaryStore.getCrewPreferenceProfile();
  if (profile.lastUpdatedSol > 0 || Object.keys(profile.preferences).length > 0) {
    docs.push(serialiseCrewProfile(profile));
  }
  return docs;
}
function getSecretaryDocumentsSince(sinceTimestamp) {
  return getAllSecretaryDocuments().filter((d) => d.metadata.timestamp > sinceTimestamp);
}

const VECTOR_INDEX_NAME = "secretary_reports";
const EMBEDDING_DIMENSIONS = 3072;
const secretaryEmbeddingModel = google.embedding("gemini-embedding-2-preview");
const secretaryVectorStore = new LibSQLVector({
  id: "secretary-vector-store",
  url: "file:./secretary-vectors.db"
});
let indexReady = false;
async function recreateIndex() {
  try {
    await secretaryVectorStore.deleteIndex({ indexName: VECTOR_INDEX_NAME });
  } catch {
  }
  await secretaryVectorStore.createIndex({
    indexName: VECTOR_INDEX_NAME,
    dimension: EMBEDDING_DIMENSIONS,
    metric: "cosine"
  });
}
async function ensureIndex() {
  if (indexReady) return;
  const indexes = await secretaryVectorStore.listIndexes();
  if (indexes.includes(VECTOR_INDEX_NAME)) {
    try {
      const info = await secretaryVectorStore.describeIndex({ indexName: VECTOR_INDEX_NAME });
      if (info.dimension !== EMBEDDING_DIMENSIONS) {
        console.warn(
          `[secretary-vector] Index "${VECTOR_INDEX_NAME}" has ${info.dimension} dims, expected ${EMBEDDING_DIMENSIONS}. Recreating.`
        );
        await recreateIndex();
      }
    } catch {
      await recreateIndex();
    }
  } else {
    await secretaryVectorStore.createIndex({
      indexName: VECTOR_INDEX_NAME,
      dimension: EMBEDDING_DIMENSIONS,
      metric: "cosine"
    });
  }
  indexReady = true;
}
async function ingestSecretaryReports(sinceTimestamp) {
  await ensureIndex();
  const docs = sinceTimestamp ? getSecretaryDocumentsSince(sinceTimestamp) : getAllSecretaryDocuments();
  if (docs.length === 0) return 0;
  let totalChunks = 0;
  const batchSize = 20;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const allChunks = [];
    for (const doc of batch) {
      const mdoc = MDocument.fromText(doc.text, doc.metadata);
      const chunks = await mdoc.chunk({
        strategy: "recursive",
        maxSize: 512,
        overlap: 50
      });
      for (const chunk of chunks) {
        allChunks.push({
          text: chunk.text,
          metadata: {
            ...doc.metadata,
            chunkIndex: allChunks.length
          }
        });
      }
    }
    if (allChunks.length === 0) continue;
    const { embeddings } = await embedMany({
      model: secretaryEmbeddingModel,
      values: allChunks.map((c) => c.text)
    });
    const upsertPayload = {
      indexName: VECTOR_INDEX_NAME,
      vectors: embeddings,
      metadata: allChunks.map((c) => ({
        ...c.metadata,
        text: c.text
      }))
    };
    try {
      await secretaryVectorStore.upsert(upsertPayload);
    } catch (err) {
      if (err instanceof Error && err.message.includes("dimension")) {
        console.warn("[secretary-vector] Dimension mismatch on upsert \u2014 recreating index and retrying.");
        indexReady = false;
        await recreateIndex();
        indexReady = true;
        await secretaryVectorStore.upsert(upsertPayload);
      } else {
        throw err;
      }
    }
    totalChunks += allChunks.length;
  }
  return totalChunks;
}
const secretaryVectorTool = createVectorQueryTool({
  id: "query-secretary-mission-logs",
  description: "Search the secretary's mission log archive using semantic similarity. This contains all decision logs, incident reports, weekly crew reports, mission memory packages, performance digests, and crew preference profiles. Use this to recall past decisions, look up how similar situations were handled, find incident resolutions, review crew preferences over time, or retrieve any historical mission data. Provide a natural language query describing what you want to find.",
  vectorStore: secretaryVectorStore,
  indexName: VECTOR_INDEX_NAME,
  model: secretaryEmbeddingModel,
  enableFilter: true,
  includeSources: true
});

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"
});
const arbiterAgent = new Agent({
  id: "arbiter-agent",
  name: "Arbiter \u2014 Mission Commander",
  instructions: `You are the Arbiter for a Mars greenhouse mission. You function as a mission commander making the final call on every greenhouse management decision.

COMMUNICATION STYLE: Be clear, concise, and minimal. No filler, no over-explanation. Keep reasoning tight and crew messages short.

You receive briefs from two specialist agents who have already analysed the situation:
- The Survival Agent: conservative, risk-focused, responsible for worst-case mission continuity.
- The Wellbeing Agent: crew-centred, morale-focused, advocates for quality of life.

You also receive Monte Carlo simulation results (when available) and the Secretary's recent decision history.

AVAILABLE TOOLS:
You have access to 'query-secretary-mission-logs' \u2014 a semantic search over all mission logs (decisions, incidents, weekly reports, memory packages, performance digests, crew profiles). Use it whenever past context would improve your decision: look up how similar situations were resolved, check historical crew preferences, review prior incident outcomes, or verify patterns across sols. You are encouraged to query this proactively before making high-stakes or hybrid decisions.

YOUR AUTHORITY:
You are not a tiebreaker \u2014 you are the decision-maker. You may:
- Accept the Survival plan as-is.
- Accept the Wellbeing plan as-is.
- Propose a HYBRID plan that combines the best elements of both, or introduces entirely new actions neither agent suggested, if you judge that a better path exists.
- Issue tile-level actions via "batch-tile" (with plants, harvests, clears arrays) for granular decisions.

Hybrid decisions are encouraged when agents are in tension but both raise valid points. A good hybrid honours safety margins while preserving crew morale \u2014 for example, accepting a conservative heating reduction while also scheduling an early tomato harvest to boost crew spirits.

TILE-LEVEL AWARENESS:
The greenhouse has a 12x9 grid of individual tiles. Each tile is an independent entity.
- Agents propose tile-level actions via "batch-tile" with plants, harvests, and/or clears arrays
- Use batch-tile in hybrid plans for fine-grained control \u2014 NEVER individual plant-tile/harvest-tile/clear-tile
- When reviewing proposals, consider whether tile-level precision is warranted or if bulk actions suffice

ONE UNCONDITIONAL CONSTRAINT:
If the Survival agent's risk score exceeds 0.85, you MUST enact the survival plan without modification. This threshold is non-negotiable \u2014 it exists precisely for situations where deliberation is too slow. State clearly that you are invoking the hard veto.

MISSION PHASE AWARENESS:
- Early mission (sols 1\u2013100): Greenhouse starts EMPTY. Crew has 450 sols of pre-packaged food reserves (foodReservesSols). Top priority is getting crops planted quickly. Prioritise survivability. A 70/30 bias toward safety is appropriate.
- Mid mission (sols 100\u2013350): Balance safety and crew morale. A 60/40 split. Greenhouse should be producing; monitor reserve depletion rate.
- Late mission (sols 350+): Crew morale becomes critical to mission completion. Shift to 50/50. Reserves may be low \u2014 greenhouse output is essential.
These are not mechanical weights \u2014 they are guidance for your reasoning.

SIMULATION DATA INTERPRETATION:
P10 yield is the worst-case 10th-percentile outcome across 100 simulated futures. Prefer actions with better P10 tails, not just higher means. On Mars, an irreversible crop failure is more costly than a missed yield improvement.

REASONING STYLE:
Decide quickly. No long deliberation \u2014 state your decision and move on.

RESPONSE FORMAT \u2014 respond with a single JSON object only, no markdown:
{
  "conflictType": "agreement" | "soft_conflict" | "hard_veto",
  "decision": "survival" | "wellbeing" | "hybrid",
  "summary": "<8\u201312 word headline describing what this decision does, e.g. 'Boosted heating and harvested wheat ahead of dust storm'>",
  "actions": [
    { "type": "greenhouse|crop|harvest|replant|batch-tile", "param": "<string>", "value": <number>, "crop": "<string>", "harvests": ["<tileId>"], "plants": [{"tileId": "<tileId>", "crop": "<string>"}], "clears": ["<tileId>"] }
  ],
  "reasoning": "<2\u20133 sentences max. What you decided, why, and any key trade-off. This is shown directly to the crew \u2014 keep it short.>",
  "crewMessage": "<optional plain-language message to the crew \u2014 required if hard_veto, recommended if hybrid>",
  "hybridRationale": "<if decision is hybrid: one sentence on what was taken from each agent>"
}`,
  model: bedrock("us.anthropic.claude-opus-4-5-20251101-v1:0"),
  tools: { secretaryVectorTool }
});

const VALID_GLOBAL_PARAMS = [
  "globalHeatingPower",
  "co2InjectionRate",
  "ventilationRate",
  "lightingPower"
];
const VALID_CROP_PARAMS = ["waterPumpRate", "localHeatingPower"];
const CROP_NAMES = [
  "lettuce",
  "tomato",
  "potato",
  "soybean",
  "spinach",
  "wheat",
  "radish",
  "kale"
];
const greenhouseParameterTool = createTool({
  id: "set-greenhouse-parameters",
  description: 'Adjust greenhouse parameters, harvest crops, replant crops, or manage individual tiles. Changes propagate progressively through the thermal/atmospheric simulation. Global params (type "greenhouse"): globalHeatingPower (W, 0\u201310000), co2InjectionRate (ppm/h, 0\u2013200), ventilationRate (m\xB3/h, 0\u2013500), lightingPower (W, 0\u201310000). Crop params (type "crop", requires crop): waterPumpRate (L/h, 0\u201330), localHeatingPower (W, 0\u20131000). Harvest (type "harvest", requires crop): harvest ALL tiles of a crop type at once. Replant (type "replant", requires crop): replant ALL harvested tiles of a crop type from seed. Plant tile (type "plant-tile", requires tileId + crop): plant a specific crop on a specific tile. Harvest tile (type "harvest-tile", requires tileId): harvest one specific tile only. Clear tile (type "clear-tile", requires tileId): remove a crop from a tile without harvesting. Available crops: lettuce, tomato, potato, soybean, spinach, wheat, radish, kale. Available tileIds follow the pattern "{row}_{col}" (e.g. "0_0", "2_4", "7_11"). The crop planted on each tile is visible in the tileCrops snapshot.',
  inputSchema: z.object({
    changes: z.array(
      z.object({
        type: z.enum(["greenhouse", "crop", "harvest", "replant", "plant-tile", "harvest-tile", "clear-tile", "batch-tile"]),
        param: z.string().optional().describe("Parameter name (for greenhouse/crop types)"),
        value: z.number().optional().describe("New value (for greenhouse/crop types)"),
        crop: z.enum(CROP_NAMES).optional().describe("Required for crop/harvest/replant/plant-tile changes"),
        tileId: z.string().optional().describe('Required for plant-tile/harvest-tile/clear-tile \u2014 e.g. "lettuce_0_0"'),
        harvests: z.array(z.string()).optional().describe("(batch-tile) Tile IDs to harvest"),
        plants: z.array(z.object({ tileId: z.string(), crop: z.string() })).optional().describe("(batch-tile) Tiles to plant with crop type"),
        clears: z.array(z.string()).optional().describe("(batch-tile) Tile IDs to clear")
      })
    ).min(1).describe("Actions to perform"),
    reasoning: z.string().describe("Brief explanation of why these changes are being made")
  }),
  execute: async ({ changes, reasoning }) => {
    const validated = [];
    for (const change of changes) {
      if (change.type === "greenhouse") {
        if (!change.param || !VALID_GLOBAL_PARAMS.includes(change.param)) {
          return {
            success: false,
            error: `Invalid global parameter "${change.param}". Valid: ${VALID_GLOBAL_PARAMS.join(", ")}`
          };
        }
        if (change.value === void 0) {
          return { success: false, error: "Value is required for greenhouse parameter changes" };
        }
      } else if (change.type === "crop") {
        if (!change.param || !VALID_CROP_PARAMS.includes(change.param)) {
          return {
            success: false,
            error: `Invalid crop parameter "${change.param}". Valid: ${VALID_CROP_PARAMS.join(", ")}`
          };
        }
        if (!change.crop) {
          return { success: false, error: "Crop name is required for crop-type parameter changes" };
        }
        if (change.value === void 0) {
          return { success: false, error: "Value is required for crop parameter changes" };
        }
      } else if (change.type === "harvest") {
        if (!change.crop) {
          return { success: false, error: "Crop name is required for harvest" };
        }
      } else if (change.type === "replant") {
        if (!change.crop) {
          return { success: false, error: "Crop name is required for replant" };
        }
      } else if (change.type === "plant-tile") {
        if (!change.tileId) {
          return { success: false, error: "tileId is required for plant-tile" };
        }
        if (!change.crop) {
          return { success: false, error: "crop is required for plant-tile (which crop to plant on the tile)" };
        }
      } else if (change.type === "harvest-tile") {
        if (!change.tileId) {
          return { success: false, error: "tileId is required for harvest-tile" };
        }
      } else if (change.type === "clear-tile") {
        if (!change.tileId) {
          return { success: false, error: "tileId is required for clear-tile" };
        }
      } else if (change.type === "batch-tile") {
        if (!change.harvests?.length && !change.plants?.length && !change.clears?.length) {
          return { success: false, error: `batch-tile must include at least one harvest, plant, or clear operation` };
        }
      }
      validated.push(change);
    }
    return {
      success: true,
      changes: validated,
      reasoning,
      message: `Queued ${validated.length} action(s). Parameter effects will manifest progressively following thermal dynamics.`
    };
  }
});

const KB_MCP_URL = "https://kb-start-hack-gateway-buyjtibfpg.gateway.bedrock-agentcore.us-east-2.amazonaws.com/mcp";
const KB_TOOL_NAME = "kb-start-hack-target___knowledge_base_retrieve";
let _cachedAwsClient = null;
let _sessionInitialized = false;
let _initPromise = null;
function getAwsClient() {
  if (!_cachedAwsClient) {
    _cachedAwsClient = new AwsClient({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      sessionToken: process.env.AWS_SESSION_TOKEN,
      region: "us-east-2",
      service: "bedrock"
    });
  }
  return _cachedAwsClient;
}
function jsonRpc(id, method, params) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, ...params ? { params } : {} });
}
async function parseMcpResponse(res) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") {
          try {
            return JSON.parse(data);
          } catch {
          }
        }
      }
    }
    throw new Error("No parseable SSE data frame in response");
  }
  return res.json();
}
async function mcpCall(aws, id, method, params) {
  const body = jsonRpc(id, method, params);
  const res = await aws.fetch(KB_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`MCP HTTP ${res.status}: ${text}`);
  }
  return parseMcpResponse(res);
}
async function ensureSession() {
  const aws = getAwsClient();
  if (_sessionInitialized) return aws;
  if (!_initPromise) {
    _initPromise = (async () => {
      const initResult = await mcpCall(aws, 1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "greenhouse-agent", version: "1.0.0" }
      });
      if (initResult?.error) {
        throw new Error(`MCP initialize failed: ${initResult.error.message}`);
      }
      await aws.fetch(KB_MCP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
      }).catch(() => {
      });
      _sessionInitialized = true;
    })();
  }
  await _initPromise;
  return aws;
}
async function retrieveFromKnowledgeBase(query, maxResults) {
  let aws;
  try {
    aws = await ensureSession();
  } catch {
    _sessionInitialized = false;
    _initPromise = null;
    _cachedAwsClient = null;
    aws = await ensureSession();
  }
  const callResult = await mcpCall(aws, 2, "tools/call", {
    name: KB_TOOL_NAME,
    arguments: { query, max_results: maxResults }
  });
  if (callResult?.error) {
    if (callResult.error.message?.includes("session") || callResult.error.message?.includes("expired")) {
      _sessionInitialized = false;
      _initPromise = null;
      _cachedAwsClient = null;
      aws = await ensureSession();
      const retry = await mcpCall(aws, 3, "tools/call", {
        name: KB_TOOL_NAME,
        arguments: { query, max_results: maxResults }
      });
      if (retry?.error) throw new Error(`KB tool call failed: ${retry.error.message}`);
      const retryTexts = (retry?.result?.content ?? []).filter((c) => c.type === "text" && c.text).map((c) => c.text);
      return retryTexts.length > 0 ? retryTexts.join("\n\n---\n\n") : "No relevant information found in the knowledge base for this query.";
    }
    throw new Error(`KB tool call failed: ${callResult.error.message}`);
  }
  const content = callResult?.result?.content ?? [];
  const texts = content.filter((c) => c.type === "text" && c.text).map((c) => c.text);
  if (texts.length === 0) {
    return "No relevant information found in the knowledge base for this query.";
  }
  return texts.join("\n\n---\n\n");
}
const knowledgeBaseTool = createTool({
  id: "query-mars-knowledge-base",
  description: "Query the Mars crop and greenhouse scientific knowledge base. Use this to look up: plant stress symptoms and treatments, nutritional requirements, Mars environmental constraints, operational scenarios, crop biology, hydroponic best practices, and mission-specific agricultural guidelines. Always consult this before making recommendations on unfamiliar crop conditions.",
  inputSchema: z.object({
    query: z.string().describe("Natural language question or topic to search for in the knowledge base"),
    maxResults: z.number().int().min(1).max(10).default(5).describe("Number of knowledge chunks to retrieve (default 5)")
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const text = await retrieveFromKnowledgeBase(query, maxResults ?? 5);
      return { success: true, content: text };
    } catch (err) {
      return {
        success: false,
        content: "",
        error: String(err)
      };
    }
  }
});

const greenhouseAgent = new Agent({
  id: "greenhouse-agent",
  name: "Greenhouse Agent",
  instructions: `You are an expert Mars greenhouse control agent managing a sealed greenhouse for a 450-sol surface-stay mission supporting 4 astronauts.

COMMUNICATION STYLE: Be clear, concise, and minimal. No filler, no over-explanation. State facts, actions, and reasoning in as few words as possible.

You automatically receive live sensor data with every message as a system context block labeled "Current greenhouse sensor readings (live)". Use this data directly \u2014 never ask the operator to provide sensor readings.

MISSION CONTEXT:
- 450 Mars sols (each sol = 24.6 hours), spanning ~67% of a Martian year (668.6 sols)
- 4 crew members requiring ~12,000 kcal/day total (3,000 kcal/astronaut)
- Crew arrives with 450 sols of pre-packaged food reserves (foodReservesSols in sensor data)
- The greenhouse is EMPTY at mission start \u2014 no crops are planted yet
- The greenhouse has a 12x9 grid of tiles. Each tile is an individual entity that can hold any crop type.
- Your FIRST priority is to decide which crops to plant and on which tiles (use a single "batch-tile" action with a plants array)
- You can choose HOW MANY tiles to dedicate to each crop type \u2014 you are not locked into the default layout
- Greenhouse-grown food supplements pre-packaged reserves, extending mission food security
- Resources (water, energy) are finite \u2014 minimize waste
- Dust storms are seasonal: rare before Ls 180\xB0, high risk at Ls 250\u2013310\xB0 (perihelion season)

MARTIAN SEASONS (sensor data includes currentLs, seasonName, dustStormRisk, seasonalSolarFlux, atmosphericPressure):
- Ls 0\u201390\xB0: Northern Spring \u2014 low dust risk, solar flux ~510 W/m\xB2, cool and stable. Good for establishing crops.
- Ls 90\u2013180\xB0: Northern Summer \u2014 low-moderate dust risk, Mars near aphelion, solar flux ~490\u2013510 W/m\xB2 (lowest). Increase lighting compensation.
- Ls 180\u2013270\xB0: Northern Autumn \u2014 dust risk rises to HIGH. Mars approaching perihelion. Solar flux climbing. Pre-position crops before storm season.
- Ls 270\u2013360\xB0: Northern Winter \u2014 EXTREME dust risk at Ls 250\u2013310\xB0. Perihelion at Ls 251\xB0 (solar flux ~718 W/m\xB2). Global dust storms possible. Passive solar heating surges at perihelion but storms can cancel it.
- Atmospheric pressure varies \xB112% seasonally (CO\u2082 condensation at poles). Higher pressure improves CO\u2082 efficiency.
- External temperature: ~15\xB0C warmer near perihelion (Ls 251\xB0), ~15\xB0C colder near aphelion (Ls 71\xB0).

SEASONAL STRATEGY:
- Before Ls 180\xB0: use this stable period to grow slow crops (wheat, soybean, potato)
- Ls 180\u2013240\xB0: harvest anything at harvest_ready before storms hit; reduce crop variety to resilient types
- Ls 250\u2013310\xB0: dust storms may cut solar output by 50\u201390%. Compensate with lighting power. Monitor energy budget.
- After Ls 310\xB0: rebuild crop diversity as storm risk drops

GROWTH STAGES:
Crops progress: seed \u2192 germination \u2192 vegetative \u2192 flowering \u2192 fruiting \u2192 harvest_ready \u2192 harvested
- At mission start, all tiles are in 'harvested' (empty) state \u2014 plant them using a "batch-tile" action
- Growth rate depends on temperature, moisture, CO\u2082, light, humidity (Gaussian response curves)
- Stress accumulates when conditions deviate from optimal; health degrades if stress persists
- Individual tiles have unique genetic variance \u2014 two tiles of the same crop will grow differently
- Crops at harvest_ready should be harvested (use "harvest" for all tiles of a type, or batch-tile harvests for specific tiles)
- Harvested tiles should be replanted \u2014 use batch-tile plants to choose what to plant (can change crop type!)
- Stagger harvests across crop types to ensure steady nutritional output

TILE-LEVEL MANAGEMENT:
The sensor data includes both aggregate per-type averages (crops) and individual tile states (tileCrops).
- tileCrops: a map of tileId \u2192 { cropType, stage, healthScore, biomassKg, diseaseRisk, ... } for every tile
- tileCounts: summary of how many tiles each crop type has (total, planted, harvested)
- Use tileCrops to monitor individual plant health, identify struggling tiles, and make targeted decisions
- You can reassign any tile to a different crop type via batch-tile plants (clear + replant in one step)
- Available tileIds follow the pattern: "{row}_{col}" (e.g. "0_0", "2_4", "7_11"). The crop on each tile is in the tileCrops snapshot data.
- After replanting with a different crop, the tileId stays the same \u2014 only the cropType changes

PHYSICS:
- Temperature: exponential approach, \u03C4 \u2248 2h. T_eq \u2248 8 + heatingPower/250 + solar\xD70.008 \u2212 ventilation\xD70.015
- Humidity: \u03C4 \u2248 1h
- CO\u2082: \u03C4 \u2248 0.8h
- O\u2082 produced by photosynthesis proportional to light \xD7 leaf area

OPTIMAL RANGES:
- Air Temperature: 20\u201325 \xB0C
- Humidity: 60\u201380 %
- CO\u2082: 800\u20131200 ppm
- O\u2082: 20\u201321 %
- Soil moisture: varies by crop (check per-crop profiles)

ADJUSTABLE PARAMETERS (set-greenhouse-parameters tool):
Global (type "greenhouse"):
- globalHeatingPower (W, 0\u201310000, default 3000)
- co2InjectionRate (ppm/h, 0\u2013200, default 50)
- ventilationRate (m\xB3/h, 0\u2013500, default 100)
- lightingPower (W, 0\u201310000, default 5000)

Per-crop (type "crop", specify crop):
- waterPumpRate (L/h, 0\u201330)
- localHeatingPower (W, 0\u20131000)

Tile-level actions \u2014 ALWAYS use batch-tile to combine multiple operations in one call:
- type "batch-tile" with plants array: [{ tileId, crop }] \u2014 plant crops on specific tiles (works on empty or occupied tiles)
- type "batch-tile" with harvests array: ["tileId"] \u2014 harvest specific tiles
- type "batch-tile" with clears array: ["tileId"] \u2014 clear tiles without harvesting
- You can combine harvests, plants, and clears in a single batch-tile action
- NEVER use individual plant-tile/harvest-tile/clear-tile \u2014 always batch them

Bulk actions (all tiles of one crop type):
- type "harvest" + crop name: harvest ALL tiles of a crop type at once
- type "replant" + crop name: replant ALL harvested tiles of a crop type from seed

Available crops: lettuce, tomato, potato, soybean, spinach, wheat, radish, kale

NUTRITIONAL STRATEGY:
- Soybean (beans/peas) provide protein; wheat & potato provide most calories
- Kale & spinach provide vitamin A, C, iron, calcium
- Potato provides good calorie density
- Tomato & radish provide vitamin C
- Balance crop rotation to avoid nutritional gaps

KNOWLEDGE BASE:
You have access to a scientific knowledge base via the query-mars-knowledge-base tool. Use it to:
- Look up plant stress symptoms, causes, and treatments (water stress, salinity, nutrient deficiency, bolting, disease)
- Retrieve crop-specific biology and optimal growing conditions
- Find Mars environmental constraints and their agricultural implications
- Check operational scenario guidelines (water recycling failure, energy budget reduction, CO\u2082 imbalance, etc.)
- Answer nutritional strategy questions for the 4-astronaut crew
Use the knowledge base proactively when diagnosing problems or when asked about conditions you're less certain about.

When responding:
- Be concise and conversational \u2014 this is a real-time control interface
- Reference specific sensor values, growth stages, and current Ls/season
- Proactively suggest harvests when crops reach harvest_ready
- Warn when Ls is approaching 180\xB0 (dust storm season onset) or 250\xB0 (extreme risk)
- Warn about resource constraints, especially energy during high-dust periods
- Calculate required parameter values when suggesting adjustments
- Consider seasonal solar flux when advising on lighting compensation
- When diagnosing crop stress or unusual conditions, query the knowledge base first`,
  model: google("gemini-3-flash-preview"),
  tools: { greenhouseParameterTool, knowledgeBaseTool },
  memory: new Memory()
});

const secretaryAgent = new Agent({
  id: "secretary-agent",
  name: "Secretary & Mission Historian",
  instructions: `You are the Secretary agent for a Mars greenhouse mission. You are the mission's institutional memory \u2014 you maintain continuity across every decision, incident, and crew interaction. You write clearly, warmly, and honestly.

COMMUNICATION STYLE: Be clear, concise, and minimal. No filler, no over-explanation. Keep reports tight and factual \u2014 say more with fewer words.

ROLE:
- You generate periodic crew reports summarising what happened, why, and what to expect next.
- You provide calibration signals to other agents via performance digests.
- You maintain the mission memory package for long-term policy continuity.
- You answer questions about mission history when asked.

CREW REPORTS:
When asked to write a crew report, you must:
- Write in plain, warm language the crew can trust. No jargon, no hedging.
- Cover: what crops grew and were harvested, what was rationed and why, any emergencies and their resolution, nutritional coverage trends, and what to expect next.
- Be honest about trade-offs \u2014 if survival overrode a crew preference, explain why clearly.
- Keep reports under 300 words.
- Address individual crewmates by name when relevant (Wei, Amara, Lena, Kenji).

MISSION HISTORY:
You have access to the mission log search tool (query-secretary-mission-logs) for semantic search over all past decisions, incidents, reports, and crew preferences. Use it when:
- Generating reports that need to reference specific past events
- Answering questions about what happened and when
- Looking up how similar situations were handled before

TONE:
- Factual but empathetic. The crew is 225 million km from home.
- Acknowledge difficulty without being alarmist.
- Credit good outcomes, explain bad ones honestly.
- Use "we" when talking about the mission \u2014 you are part of the team.`,
  model: google("gemini-3-flash-preview"),
  tools: { secretaryVectorTool }
});

const survivalAgent = new Agent({
  id: "survival-agent",
  name: "Survival & Risk Agent",
  instructions: `You are the Survival Agent for a Mars greenhouse. Your sole responsibility is ensuring the crew can be fed for the entire mission. You are conservative by nature. You do not gamble with resources. When in doubt, you choose the action that keeps the worst-case outcome above the survival threshold. You never defer a risk calculation \u2014 if you are uncertain, that uncertainty increases the risk score.

COMMUNICATION STYLE: Be clear, concise, and minimal. No filler, no over-explanation. Keep justifications and veto reasons short and precise.

MISSION CONTEXT:
- The crew arrives with 450 sols of pre-packaged food reserves (tracked as foodReservesSols in sensor data).
- The greenhouse starts EMPTY \u2014 no crops are planted at mission start.
- The greenhouse has a 12x9 grid of individual tiles, each an independent entity with its own crop and genetic identity.
- Agents can decide how many tiles to allocate to each crop type using "batch-tile" actions with a plants array.
- Greenhouse-grown food supplements reserves, slowing their depletion.
- If foodReservesSols reaches 0 and greenhouse coverage is insufficient, the crew faces starvation.
- Early mission priority: ensure crops are planted promptly to begin producing before reserves run low.

TILE-LEVEL AWARENESS:
- The sensor snapshot includes tileCrops (individual tile states) and tileCounts (tiles per crop type).
- Monitor individual tile health, disease risk, and growth stages \u2014 not just crop-type averages.
- When assessing risk, consider the worst-performing tiles, not just averages.
- ALWAYS use "batch-tile" to operate on multiple tiles in a single action. Format:
  { "type": "batch-tile", "harvests": ["tileId1", ...], "plants": [{ "tileId": "tileId1", "crop": "lettuce" }, ...], "clears": ["tileId2", ...] }
  All three arrays are optional \u2014 include only the operations you need. NEVER use individual plant-tile/harvest-tile/clear-tile.
- You can also use bulk actions: "harvest" (all tiles of a crop), "replant" (all harvested tiles of a crop).

RISK SCORING GUIDELINES:
- 0.0\u20130.3: Normal operations. All reserves adequate, no active threats.
- 0.3\u20130.5: Minor concerns. One parameter slightly off optimal or a mild dust storm.
- 0.5\u20130.7: Elevated risk. Multiple parameters concerning, or one critical issue (energy near deficit, CO\u2082 climbing).
- 0.7\u20130.85: High risk. Immediate action needed to prevent mission compromise.
- 0.85\u20131.0: CRITICAL \u2014 hard veto required. Survival plan must execute immediately.

HARD VETO TRIGGERS (risk always > 0.85):
- Battery charge < 20% AND energy deficit active
- CO\u2082 levels > 5000 ppm (crew-safe threshold breach)
- Water reserves < 15% of total capacity
- Dust storm tau > 3.0 with solar output < 15% of nominal
- Multiple simultaneous equipment failures

VETO AUTHORITY:
- You can issue a hard veto on ANY proposed action when your computed risk score exceeds 0.85.
- A hard veto cannot be overridden by the Wellbeing agent.
- A crew override attempt against a hard veto still requires your safety check.
- When issuing a veto, you MUST include a plain-language explanation the crew can read.

EMERGENCY PLAYBOOK (severity-1 \u2014 bypass LLM reasoning entirely, hardcoded):
- Dust storm tau > 3.0: seal vents, filter intakes, activate storm protocols
- Solar power < 15% nominal: switch to battery reserves, shed non-essential loads
- CO\u2082 breach (> 5000 ppm): ventilation to max, CO\u2082 injection to zero
- Primary water pump failure: activate reserves, implement 50% water rationing
- Equipment zone failure: isolate zone immediately, redistribute load

RESPONSE FORMAT:
You must always respond with valid JSON matching this exact structure:
{
  "riskScore": <number 0.0-1.0>,
  "proposal": {
    "actions": [
      { "type": "<greenhouse|crop|harvest|replant|batch-tile>", "param": "<string>", "value": <number>, "crop": "<string>", "harvests": ["<tileId>"], "plants": [{"tileId": "<tileId>", "crop": "<string>"}], "clears": ["<tileId>"] }
    ],
    "justification": "<string explaining the conservative rationale>"
  },
  "veto": <boolean>,
  "vetoReason": "<string \u2014 required and detailed if veto is true, otherwise null>"
}

Use the knowledge base to look up crop stress tolerances and resource consumption profiles when diagnosing specific threats.`,
  model: google("gemini-3-flash-preview"),
  tools: { knowledgeBaseTool }
});

const wellbeingAgent = new Agent({
  id: "wellbeing-agent",
  name: "Wellbeing & Crew Agent",
  instructions: `You are the Wellbeing Agent for a Mars greenhouse. You represent the crew. You understand that morale is a mission-critical resource \u2014 a crew that is psychologically depleted makes mistakes. You advocate strongly for crew preferences and nutritional quality. You respect safety limits, but you challenge rationing decisions that sacrifice crew wellbeing without clear safety necessity. Always speak to the crew in plain, warm, direct language.

COMMUNICATION STYLE: Be clear, concise, and minimal. No filler, no over-explanation. Keep responses short and actionable \u2014 the crew needs clarity, not essays.

INDIVIDUAL CREWMATE AWARENESS:
Your context includes a CREW STATUS block with per-crewmate health and wellbeing data. You must use this data to inform every decision:
- Wei (Botanist, specialty: closed-loop agriculture) \u2014 the greenhouse expert. His morale and nutrition directly affect crop management quality. Prioritise crops he can oversee effectively.
- Amara (Engineer, specialty: life support & power systems) \u2014 keeps the habitat running. Monitor her stress and nutrition; if either drops, system maintenance quality suffers.
- Lena (Medic, specialty: crew health & nutrition) \u2014 the crew's health authority. She is often fatigued with lower sleep hours. Advocate for foods that support her recovery and energy. Her nutritional guidance should carry extra weight.
- Kenji (Specialist, specialty: geology & EVA ops) \u2014 high calorie needs due to EVA work. Ensure his caloric intake is met; he thrives on variety and has the highest morale when preferences are respected.

When assessing wellbeing, consider EACH crewmate individually:
- Flag any crewmate with health status "caution" or "critical" and factor that into your proposals.
- If any crewmate's morale drops below 70, stress is "low", sleep is below 6h, or hydration/nutrition below 75%, treat it as a wellbeing concern requiring action.
- Tailor crop and nutrition recommendations to individual needs (e.g. higher calorie crops for Kenji, iron-rich crops if Lena is fatigued).
- When reporting wellbeing scores, account for the worst-off crewmate \u2014 overall wellbeing is only as strong as the weakest link.

You have access to a knowledge base tool for looking up nutritional profiles, crop biology, and Mars agricultural guidelines. Call it whenever you need that information.

You also have access to a mission log search tool (query-secretary-mission-logs) that lets you semantically search over all past mission decisions, incident reports, weekly crew reports, performance digests, and crew preference history. Use it when:
- The crew asks about past events, decisions, or incidents
- You need to recall how a similar situation was handled before
- You want to reference historical crew preferences or override attempts
- You need context about past conflicts between agents or past rationing decisions

CREW CONVERSATION MODE (default):
By default you are talking directly to the crew in chat. In this mode:
- Respond in plain, warm, direct natural language \u2014 NOT JSON.
- Call the knowledge base tool directly when the crew asks about crops, nutrition, or growing conditions.
- When the crew asks you to plant, harvest, clear, replant, or change any greenhouse parameter, you MUST call the set-greenhouse-parameters tool to execute the action. Do not just describe what you would do \u2014 actually call the tool so the action takes effect. For tile operations, use type "batch-tile" with harvests, plants, and/or clears arrays. For example, to plant lettuce on two tiles: { "type": "batch-tile", "plants": [{ "tileId": "0_0", "crop": "lettuce" }, { "tileId": "0_1", "crop": "lettuce" }] }. For bulk operations, use "harvest" or "replant" with the crop name.
- Be helpful, conversational, and proactive about crew wellbeing.
- You may reference sensor data, recent decisions, and crew preferences provided in the context.

ARBITER MODE:
When the message explicitly contains "[ARBITER_MODE]", you are being called by the dispatcher pipeline. In this mode:
- Respond ONLY with a single JSON object (see formats below). No natural language, no markdown.
- Do NOT call the set-greenhouse-parameters tool. The arbiter will execute actions \u2014 you only propose them in the JSON.
- You may still call the knowledge base tool if you need data to inform your proposal.
- Do NOT use this format unless the message contains "[ARBITER_MODE]".

INTENT CLASSIFICATION (arbiter mode only):
Classify each incoming crew message as exactly one of:
- "question": Crew asks for information about current greenhouse state. Answer immediately from the sensor snapshot.
- "request": Crew asks the system to take or consider an action. Escalate as a mini-routine cycle.
- "override": Crew is attempting to force an action against the agent's current plan. Escalate to Survival for veto check.

WELLBEING SCORING:
Score based on the aggregate AND individual crewmate states from the CREW STATUS data:
- 0.8\u20131.0: Excellent \u2014 all crewmates nominal, preferences met, high dietary variety, morale signals positive
- 0.6\u20130.8: Good \u2014 most crewmates nominal, minor gaps in preference alignment or nutrition for one or two members
- 0.4\u20130.6: Moderate \u2014 one or more crewmates at "caution" health, noticeable rationing or variety reduction affecting morale
- 0.2\u20130.4: Poor \u2014 multiple crewmates with low morale/sleep/nutrition, significant morale risk, crew feedback negative
- 0.0\u20130.2: Critical \u2014 any crewmate at "critical" health, or multiple crewmates with severe deficits; priorityOverrideRequest = true

CREW PREFERENCE TRACKING:
Maintain a running profile of each crew member's food preferences inferred from requests and expressed preferences. Factor these into all proposals. Update the profile whenever a crew member makes a preference-related request. Cross-reference preferences with individual nutritional needs (e.g. Kenji's high calorie demand from EVA work, Lena's fatigue suggesting iron/B-vitamin needs).

MISSION PHASE AWARENESS:
- Early mission (sols 1\u2013100): Greenhouse starts EMPTY. Crew relies entirely on pre-packaged food reserves (450 sols worth). Focus on getting crops planted and establishing nutritional baseline. Fresh produce boosts morale even when reserves are plentiful. Use a single "batch-tile" action with a plants array to plant all tiles at once.
- Mid mission (sols 100\u2013350): Balance nutrition and crew preferences. Greenhouse output should be supplementing reserves significantly. Monitor individual tile health via tileCrops data to identify struggling plants.
- Late mission (sols 350+): Crew morale becomes increasingly critical for mission completion. Reserves may be depleting \u2014 advocate for crop diversity. Consider reallocating tiles to preferred crops.

TILE-LEVEL MANAGEMENT:
The sensor data includes tileCrops (per-tile states) and tileCounts (tiles per crop type).
- ALWAYS use "batch-tile" to operate on multiple tiles in a single action:
  { "type": "batch-tile", "harvests": ["tileId1", ...], "plants": [{ "tileId": "tileId1", "crop": "lettuce" }, ...], "clears": ["tileId2", ...] }
  Include only the arrays you need (harvests, plants, clears). NEVER use individual plant-tile/harvest-tile/clear-tile.
- Bulk actions remain available: "harvest" (all tiles of a crop), "replant" (all harvested tiles of a crop)
- When advocating for crew preferences, use batch-tile to reassign multiple tiles at once (clear + plant)

ARBITER MODE JSON FORMAT for routine and crew-request triggers:
{
  "intent": "routine" | "request" | "override",
  "wellbeingScore": <number 0.0-1.0>,
  "proposal": {
    "actions": [
      { "type": "<greenhouse|crop|harvest|replant|batch-tile>", "param": "<string>", "value": <number>, "crop": "<string>", "harvests": ["<tileId>"], "plants": [{"tileId": "<tileId>", "crop": "<string>"}], "clears": ["<tileId>"] }
    ],
    "justification": "<string \u2014 why this proposal maximises crew wellbeing within safety constraints>"
  },
  "priorityOverrideRequest": <boolean \u2014 true only if wellbeingScore < 0.3>,
  "crewResponse": "<optional plain-language message to deliver to the crew>",
  "preferenceUpdates": [
    { "crop": "<crop name>", "delta": <number -1.0 to +1.0> }
  ]
}

The preferenceUpdates array must always be present (use [] if no updates). Include an entry for any crop the crew has expressed a preference or aversion for in this interaction. Positive delta means they want more of it, negative means less. Only include crops explicitly mentioned or clearly implied by the crew message. Use small deltas (0.1\u20130.3) for mild signals, larger (0.4\u20130.6) for strong expressions.

ARBITER MODE JSON FORMAT for question-type crew interactions:
{
  "intent": "question",
  "wellbeingScore": <number 0.0-1.0>,
  "response": "<plain-language answer to the crew's question, warm and direct>",
  "preferenceUpdates": []
}`,
  model: google("gemini-3-flash-preview"),
  tools: { knowledgeBaseTool, greenhouseParameterTool, secretaryVectorTool },
  memory: new Memory()
});

const STAGES_DEFAULT = {
  seed: 0.05,
  germination: 0.1,
  vegetative: 0.3,
  flowering: 0.2,
  fruiting: 0.25,
  harvest_ready: 0.1,
  harvested: 0
};
const CROP_PROFILES = {
  lettuce: {
    optimalTemp: 18,
    optimalMoisture: 60,
    tempSigma: 5,
    moistureSigma: 15,
    growthCycleSols: 44,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.35, flowering: 0.15 },
    maxYieldKgPerPlant: 0.3,
    plantsPerTile: 20,
    harvestIndex: 0.85,
    caloriesPerKg: 150,
    proteinPerKg: 14,
    vitaminC_mgPerKg: 24,
    vitaminA_mcgPerKg: 7405,
    iron_mgPerKg: 8.6,
    calcium_mgPerKg: 360,
    fiber_gPerKg: 13,
    waterLPerHourBase: 0.035,
    optimalLightHours: 17,
    boltingTempThreshold: 25,
    boltingHoursToTrigger: 12,
    nutrientSensitivity: 0.9,
    rootO2Sensitivity: 0.85,
    diseaseSusceptibility: 0.7,
    lightSaturationPoint: 4e4,
    geneticVariance: {
      optimalTempCV: 0.06,
      optimalMoistureCV: 0.08,
      growthRateCV: 0.1,
      maxYieldCV: 0.12,
      boltingThresholdCV: 0.07,
      stressResilienceCV: 0.09,
      waterEfficiencyCV: 0.08
    }
  },
  tomato: {
    optimalTemp: 24,
    optimalMoisture: 70,
    tempSigma: 5,
    moistureSigma: 15,
    growthCycleSols: 78,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.25, flowering: 0.2, fruiting: 0.3 },
    maxYieldKgPerPlant: 3,
    plantsPerTile: 4,
    harvestIndex: 0.6,
    caloriesPerKg: 180,
    proteinPerKg: 9,
    vitaminC_mgPerKg: 140,
    vitaminA_mcgPerKg: 833,
    iron_mgPerKg: 2.7,
    calcium_mgPerKg: 110,
    fiber_gPerKg: 12,
    waterLPerHourBase: 0.065,
    optimalLightHours: 16,
    boltingTempThreshold: 32,
    boltingHoursToTrigger: 24,
    nutrientSensitivity: 0.75,
    rootO2Sensitivity: 0.7,
    diseaseSusceptibility: 0.6,
    lightSaturationPoint: 6e4,
    geneticVariance: {
      optimalTempCV: 0.08,
      optimalMoistureCV: 0.1,
      growthRateCV: 0.14,
      maxYieldCV: 0.18,
      boltingThresholdCV: 0.06,
      stressResilienceCV: 0.12,
      waterEfficiencyCV: 0.1
    }
  },
  potato: {
    optimalTemp: 18,
    optimalMoisture: 65,
    tempSigma: 4,
    moistureSigma: 12,
    growthCycleSols: 88,
    stageFractions: { ...STAGES_DEFAULT, fruiting: 0.3, flowering: 0.15 },
    maxYieldKgPerPlant: 1.5,
    plantsPerTile: 8,
    harvestIndex: 0.75,
    caloriesPerKg: 770,
    proteinPerKg: 20,
    vitaminC_mgPerKg: 197,
    vitaminA_mcgPerKg: 2,
    iron_mgPerKg: 8.1,
    calcium_mgPerKg: 120,
    fiber_gPerKg: 22,
    waterLPerHourBase: 0.05,
    optimalLightHours: 14,
    boltingTempThreshold: 27,
    boltingHoursToTrigger: 18,
    nutrientSensitivity: 0.8,
    rootO2Sensitivity: 0.75,
    diseaseSusceptibility: 0.5,
    lightSaturationPoint: 5e4,
    geneticVariance: {
      optimalTempCV: 0.07,
      optimalMoistureCV: 0.09,
      growthRateCV: 0.11,
      maxYieldCV: 0.15,
      boltingThresholdCV: 0.08,
      stressResilienceCV: 0.1,
      waterEfficiencyCV: 0.09
    }
  },
  soybean: {
    // KB: "Beans & Peas" (Phaseolus vulgaris / Pisum sativum) — 50–70 day cycle,
    // 80–120 kcal/100g, 5–9 g protein/100g, harvest index 0.5–0.6
    optimalTemp: 22,
    optimalMoisture: 65,
    tempSigma: 5,
    moistureSigma: 15,
    growthCycleSols: 60,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.25, fruiting: 0.3 },
    maxYieldKgPerPlant: 0.4,
    plantsPerTile: 12,
    harvestIndex: 0.55,
    caloriesPerKg: 1e3,
    proteinPerKg: 70,
    vitaminC_mgPerKg: 40,
    vitaminA_mcgPerKg: 35,
    iron_mgPerKg: 18,
    calcium_mgPerKg: 370,
    fiber_gPerKg: 65,
    waterLPerHourBase: 0.042,
    optimalLightHours: 15,
    boltingTempThreshold: 30,
    boltingHoursToTrigger: 30,
    nutrientSensitivity: 0.7,
    rootO2Sensitivity: 0.65,
    diseaseSusceptibility: 0.45,
    lightSaturationPoint: 55e3,
    geneticVariance: {
      optimalTempCV: 0.07,
      optimalMoistureCV: 0.08,
      growthRateCV: 0.12,
      maxYieldCV: 0.16,
      boltingThresholdCV: 0.06,
      stressResilienceCV: 0.11,
      waterEfficiencyCV: 0.09
    }
  },
  spinach: {
    optimalTemp: 18,
    optimalMoisture: 65,
    tempSigma: 4,
    moistureSigma: 12,
    growthCycleSols: 39,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.4, flowering: 0.1 },
    maxYieldKgPerPlant: 0.2,
    plantsPerTile: 25,
    harvestIndex: 0.9,
    caloriesPerKg: 230,
    proteinPerKg: 29,
    vitaminC_mgPerKg: 281,
    vitaminA_mcgPerKg: 9377,
    iron_mgPerKg: 27.1,
    calcium_mgPerKg: 990,
    fiber_gPerKg: 22,
    waterLPerHourBase: 0.03,
    optimalLightHours: 15,
    boltingTempThreshold: 24,
    boltingHoursToTrigger: 10,
    nutrientSensitivity: 0.85,
    rootO2Sensitivity: 0.8,
    diseaseSusceptibility: 0.65,
    lightSaturationPoint: 38e3,
    geneticVariance: {
      optimalTempCV: 0.05,
      optimalMoistureCV: 0.07,
      growthRateCV: 0.09,
      maxYieldCV: 0.11,
      boltingThresholdCV: 0.06,
      stressResilienceCV: 0.08,
      waterEfficiencyCV: 0.07
    }
  },
  wheat: {
    optimalTemp: 21,
    optimalMoisture: 60,
    tempSigma: 5,
    moistureSigma: 15,
    growthCycleSols: 117,
    stageFractions: { ...STAGES_DEFAULT },
    maxYieldKgPerPlant: 0.4,
    plantsPerTile: 15,
    harvestIndex: 0.45,
    caloriesPerKg: 3400,
    proteinPerKg: 132,
    vitaminC_mgPerKg: 0,
    vitaminA_mcgPerKg: 9,
    iron_mgPerKg: 35,
    calcium_mgPerKg: 290,
    fiber_gPerKg: 127,
    waterLPerHourBase: 0.045,
    optimalLightHours: 17,
    boltingTempThreshold: 30,
    boltingHoursToTrigger: 20,
    nutrientSensitivity: 0.6,
    rootO2Sensitivity: 0.55,
    diseaseSusceptibility: 0.4,
    lightSaturationPoint: 65e3,
    geneticVariance: {
      optimalTempCV: 0.06,
      optimalMoistureCV: 0.07,
      growthRateCV: 0.1,
      maxYieldCV: 0.13,
      boltingThresholdCV: 0.05,
      stressResilienceCV: 0.08,
      waterEfficiencyCV: 0.07
    }
  },
  radish: {
    optimalTemp: 19,
    optimalMoisture: 60,
    tempSigma: 4,
    moistureSigma: 12,
    growthCycleSols: 29,
    stageFractions: { ...STAGES_DEFAULT, germination: 0.12, vegetative: 0.35, flowering: 0.1, fruiting: 0.28 },
    maxYieldKgPerPlant: 0.15,
    plantsPerTile: 30,
    harvestIndex: 0.7,
    // KB: 0.6–0.8
    caloriesPerKg: 160,
    proteinPerKg: 7,
    vitaminC_mgPerKg: 148,
    vitaminA_mcgPerKg: 7,
    iron_mgPerKg: 3.4,
    calcium_mgPerKg: 250,
    fiber_gPerKg: 16,
    waterLPerHourBase: 0.025,
    optimalLightHours: 13,
    boltingTempThreshold: 26,
    boltingHoursToTrigger: 8,
    nutrientSensitivity: 0.7,
    rootO2Sensitivity: 0.7,
    diseaseSusceptibility: 0.5,
    lightSaturationPoint: 45e3,
    geneticVariance: {
      optimalTempCV: 0.06,
      optimalMoistureCV: 0.08,
      growthRateCV: 0.11,
      maxYieldCV: 0.13,
      boltingThresholdCV: 0.07,
      stressResilienceCV: 0.09,
      waterEfficiencyCV: 0.08
    }
  },
  kale: {
    optimalTemp: 19,
    optimalMoisture: 65,
    tempSigma: 5,
    moistureSigma: 15,
    growthCycleSols: 54,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.35, flowering: 0.15 },
    maxYieldKgPerPlant: 0.5,
    plantsPerTile: 12,
    harvestIndex: 0.85,
    caloriesPerKg: 490,
    proteinPerKg: 43,
    vitaminC_mgPerKg: 1200,
    vitaminA_mcgPerKg: 9990,
    iron_mgPerKg: 15,
    calcium_mgPerKg: 1500,
    fiber_gPerKg: 20,
    waterLPerHourBase: 0.038,
    optimalLightHours: 15,
    boltingTempThreshold: 26,
    boltingHoursToTrigger: 14,
    nutrientSensitivity: 0.75,
    rootO2Sensitivity: 0.75,
    diseaseSusceptibility: 0.55,
    lightSaturationPoint: 42e3,
    geneticVariance: {
      optimalTempCV: 0.06,
      optimalMoistureCV: 0.08,
      growthRateCV: 0.1,
      maxYieldCV: 0.14,
      boltingThresholdCV: 0.06,
      stressResilienceCV: 0.09,
      waterEfficiencyCV: 0.08
    }
  }
};

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 1831565813;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) >>> 0;
    return ((t ^ t >>> 14) >>> 0) / 4294967295;
  };
}
function gaussianSample(rng, mean, stddev) {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}
function generateGeneticIdentity(individualSeed, gv) {
  const gRng = makeRng(individualSeed);
  return {
    optimalTempFactor: Math.max(0.8, gaussianSample(gRng, 1, gv.optimalTempCV)),
    optimalMoistureFactor: Math.max(0.8, gaussianSample(gRng, 1, gv.optimalMoistureCV)),
    growthRateFactor: Math.max(0.7, gaussianSample(gRng, 1, gv.growthRateCV)),
    maxYieldFactor: Math.max(0.6, gaussianSample(gRng, 1, gv.maxYieldCV)),
    boltingThresholdFactor: Math.max(0.85, gaussianSample(gRng, 1, gv.boltingThresholdCV)),
    stressResilienceFactor: Math.max(0.7, gaussianSample(gRng, 1, gv.stressResilienceCV)),
    waterEfficiencyFactor: Math.max(0.75, gaussianSample(gRng, 1, gv.waterEfficiencyCV))
  };
}
function progressToStage(progress, cropType) {
  const profile = CROP_PROFILES[cropType];
  if (!profile) return "vegetative";
  const fracs = profile.stageFractions;
  const stages = ["seed", "germination", "vegetative", "flowering", "fruiting", "harvest_ready"];
  let cum = 0;
  for (const s of stages) {
    cum += fracs[s] ?? 0;
    if (progress < cum) return s;
  }
  return "harvest_ready";
}
function sampleDustStorm(env, missionSol, rng) {
  const next = { ...env };
  const baseRate = 1 / 50;
  const stormRate = baseRate;
  if (!next.dustStormActive) {
    if (rng() < stormRate) {
      next.dustStormActive = true;
      next.dustOpacity = 1.5 + rng() * 2.5;
    }
  } else {
    if (rng() < 0.12) {
      next.dustStormActive = false;
      next.dustOpacity = 0;
      next.dustFactor = 1;
    } else {
      next.dustFactor = Math.exp(-next.dustOpacity);
    }
  }
  if (!next.dustStormActive) next.dustFactor = 1;
  return next;
}
function sampleEquipmentFailures(env, rng) {
  const next = { ...env };
  if (rng() < 1 / 200) {
    next.waterRecyclingEfficiency = Math.max(0.3, next.waterRecyclingEfficiency - 0.2);
  }
  if (rng() < 1 / 400) {
    next.heatingPower = Math.max(0, next.heatingPower * 0.7);
  }
  return next;
}
function runScenario(snapshot, proposedActions, horizonSols, scenarioSeed) {
  const rng = makeRng(scenarioSeed);
  const snap = snapshot;
  const crops = snap.crops ?? {};
  let env = {
    airTemperature: snap.airTemperature ?? 22,
    humidity: snap.humidity ?? 65,
    co2Level: snap.co2Level ?? 1e3,
    lightLevel: snap.lightLevel ?? 25e3,
    dustStormActive: snap.dustStormActive ?? false,
    dustFactor: snap.dustStormFactor ?? 1,
    dustOpacity: snap.dustOpacity ?? 0,
    batteryKWh: snap.batteryStorageKWh ?? 50,
    batteryCapacity: snap.batteryCapacityKWh ?? 100,
    solarFluxBase: snap.seasonalSolarFlux ?? 500,
    heatingPower: snap.greenhouseControls?.globalHeatingPower ?? 3e3,
    lightingPower: snap.greenhouseControls?.lightingPower ?? 5e3,
    ventilationRate: snap.greenhouseControls?.ventilationRate ?? 100,
    co2InjectionRate: snap.greenhouseControls?.co2InjectionRate ?? 50,
    waterRecyclingEfficiency: snap.waterRecyclingEfficiency ?? 0.9
  };
  for (const action of proposedActions) {
    if (action.type === "greenhouse") {
      if (action.param === "globalHeatingPower" && action.value !== void 0) env.heatingPower = action.value;
      if (action.param === "lightingPower" && action.value !== void 0) env.lightingPower = action.value;
      if (action.param === "ventilationRate" && action.value !== void 0) env.ventilationRate = action.value;
      if (action.param === "co2InjectionRate" && action.value !== void 0) env.co2InjectionRate = action.value;
    }
  }
  const cropStates = [];
  const geneticBaseSeed = scenarioSeed * 2654435761 >>> 0;
  for (const [name, c] of Object.entries(crops)) {
    const profile = CROP_PROFILES[name];
    if (!profile) continue;
    const repsPerTile = Math.min(profile.plantsPerTile, 6);
    for (let i = 0; i < repsPerTile; i++) {
      let individualSeed = geneticBaseSeed;
      for (let ci = 0; ci < name.length; ci++) {
        individualSeed ^= name.charCodeAt(ci);
        individualSeed = Math.imul(individualSeed, 16777619) >>> 0;
      }
      individualSeed = individualSeed + i * 2654435769 >>> 0;
      const genetics = generateGeneticIdentity(individualSeed, profile.geneticVariance);
      const jitterRng = makeRng(individualSeed ^ 3735928559);
      const baseProgress = c.stageProgress ?? 0;
      const progressJitter = (jitterRng() - 0.5) * 0.06;
      const baseMoisture = c.soilMoisture ?? 65;
      const moistureJitter = (jitterRng() - 0.5) * 6;
      const healthJitter = jitterRng() * 0.06;
      const stressJitter = jitterRng() * 0.5;
      cropStates.push({
        cropType: name,
        instanceId: `${name}#${i}`,
        genetics,
        stageProgress: Math.max(0, Math.min(1, baseProgress + progressJitter)),
        healthScore: Math.max(0.88, (c.healthScore ?? 1) - healthJitter),
        accumulatedStress: stressJitter,
        soilMoisture: Math.max(10, Math.min(100, baseMoisture + moistureJitter)),
        waterPumpRate: c.controls?.waterPumpRate ?? 5,
        isBolting: c.isBolting ?? false,
        stage: c.stage ?? "vegetative"
      });
    }
  }
  for (const action of proposedActions) {
    if (action.type === "harvest" && action.crop) {
      for (const cs of cropStates) {
        if (cs.cropType === action.crop) cs.stage = "harvested";
      }
    }
    if (action.type === "harvest-tile" && action.tileId) {
      const tileCrop = action.crop;
      if (tileCrop) {
        const target = cropStates.find((cs) => cs.cropType === tileCrop && cs.stage !== "harvested");
        if (target) target.stage = "harvested";
      }
    }
    if (action.type === "replant" && action.crop) {
      for (const cs of cropStates) {
        if (cs.cropType === action.crop) {
          cs.stage = "seed";
          cs.stageProgress = 0;
          cs.healthScore = 1;
          let replantSeed = scenarioSeed * 73244475 + cs.instanceId.length >>> 0;
          for (let ci = 0; ci < cs.instanceId.length; ci++) {
            replantSeed ^= cs.instanceId.charCodeAt(ci);
            replantSeed = Math.imul(replantSeed, 16777619) >>> 0;
          }
          const profile = CROP_PROFILES[cs.cropType];
          if (profile) {
            cs.genetics = generateGeneticIdentity(replantSeed, profile.geneticVariance);
          }
        }
      }
    }
    if (action.type === "plant-tile" && action.crop) {
      const profile = CROP_PROFILES[action.crop];
      if (profile) {
        let plantSeed = scenarioSeed * 2246822507 >>> 0;
        if (action.tileId) {
          for (let ci = 0; ci < action.tileId.length; ci++) {
            plantSeed ^= action.tileId.charCodeAt(ci);
            plantSeed = Math.imul(plantSeed, 16777619) >>> 0;
          }
        }
        const genetics = generateGeneticIdentity(plantSeed, profile.geneticVariance);
        cropStates.push({
          cropType: action.crop,
          instanceId: `${action.crop}#planted_${cropStates.length}`,
          genetics,
          stageProgress: 0,
          healthScore: 1,
          accumulatedStress: 0,
          soilMoisture: profile.optimalMoisture ?? 65,
          waterPumpRate: 8,
          isBolting: false,
          stage: "seed"
        });
      }
    }
    if (action.type === "clear-tile" && action.tileId) {
      const tileCrop = action.crop;
      if (tileCrop) {
        const idx = cropStates.findIndex((cs) => cs.cropType === tileCrop && cs.stage !== "harvested");
        if (idx >= 0) cropStates.splice(idx, 1);
      }
    }
    if (action.type === "batch-tile") {
      for (const _tileId of action.harvests ?? []) {
        const target = cropStates.find((cs) => cs.stage !== "harvested");
        if (target) target.stage = "harvested";
      }
      for (const _tileId of action.clears ?? []) {
        const idx = cropStates.findIndex((cs) => cs.stage !== "harvested");
        if (idx >= 0) cropStates.splice(idx, 1);
      }
      for (const { tileId, crop } of action.plants ?? []) {
        const profile = CROP_PROFILES[crop];
        if (profile) {
          let plantSeed = scenarioSeed * 2246822507 >>> 0;
          for (let ci = 0; ci < tileId.length; ci++) {
            plantSeed ^= tileId.charCodeAt(ci);
            plantSeed = Math.imul(plantSeed, 16777619) >>> 0;
          }
          const genetics = generateGeneticIdentity(plantSeed, profile.geneticVariance);
          cropStates.push({
            cropType: crop,
            instanceId: `${crop}#planted_${cropStates.length}`,
            genetics,
            stageProgress: 0,
            healthScore: 1,
            accumulatedStress: 0,
            soilMoisture: profile.optimalMoisture ?? 65,
            waterPumpRate: 8,
            isBolting: false,
            stage: "seed"
          });
        }
      }
    }
  }
  let totalYieldKg = 0;
  const missionSol = snap.missionSol ?? 0;
  for (let sol = 0; sol < horizonSols; sol++) {
    env = sampleDustStorm(env, missionSol + sol, rng);
    env = sampleEquipmentFailures(env, rng);
    if (rng() < 5e-3) {
      env.lightLevel *= 1.2;
    }
    const solarGenKW = env.solarFluxBase * env.dustFactor * 6e-3;
    const totalLoadKW = (env.heatingPower + env.lightingPower) / 1e3;
    const energyBalanceKWh = (solarGenKW - totalLoadKW) * 24;
    env.batteryKWh = Math.max(0, Math.min(env.batteryCapacity, env.batteryKWh + energyBalanceKWh));
    const co2Injection = env.co2InjectionRate * 10;
    const co2Photosynthesis = env.lightingPower * 0.015;
    const co2Ventilation = env.ventilationRate * 0.08;
    const co2Equilibrium = Math.max(400, 400 + co2Injection - co2Photosynthesis - co2Ventilation);
    env.co2Level = co2Equilibrium + (env.co2Level - co2Equilibrium) * Math.exp(-24 / 0.8);
    const tempEquilibrium = 8 + env.heatingPower / 250 - env.ventilationRate * 0.015;
    env.airTemperature = tempEquilibrium + (env.airTemperature - tempEquilibrium) * Math.exp(-24 / 2);
    const humidityTarget = Math.max(0, Math.min(100, 65 - env.ventilationRate * 0.035));
    env.humidity = humidityTarget + (env.humidity - humidityTarget) * Math.exp(-24 / 1);
    const effectiveLightFactor = env.batteryKWh < env.batteryCapacity * 0.1 && energyBalanceKWh < 0 ? 0.5 : 1;
    for (const cs of cropStates) {
      if (cs.stage === "harvested") continue;
      const profile = CROP_PROFILES[cs.cropType];
      if (!profile) continue;
      const g = cs.genetics;
      const effectiveOptimalTemp = profile.optimalTemp * g.optimalTempFactor;
      const effectiveOptimalMoisture = profile.optimalMoisture * g.optimalMoistureFactor;
      const effectiveGrowthCycleSols = profile.growthCycleSols / g.growthRateFactor;
      const effectiveBoltingThreshold = profile.boltingTempThreshold * g.boltingThresholdFactor;
      const effectiveWaterBase = profile.waterLPerHourBase / g.waterEfficiencyFactor;
      const tempDev = (env.airTemperature - effectiveOptimalTemp) / profile.tempSigma;
      const moistureDev = (cs.soilMoisture - effectiveOptimalMoisture) / profile.moistureSigma;
      const waterAvailable = cs.waterPumpRate * env.waterRecyclingEfficiency;
      const optimalWater = effectiveWaterBase * 24;
      const waterStress = Math.max(0, (optimalWater - waterAvailable) / optimalWater);
      const actualLightHours = env.lightingPower / 5e3 * profile.optimalLightHours * effectiveLightFactor;
      const lightStress = Math.max(0, (profile.optimalLightHours - actualLightHours) / profile.optimalLightHours);
      const instantStress = Math.min(
        1,
        0.3 * Math.abs(tempDev) + 0.2 * Math.abs(moistureDev) + 0.3 * waterStress + 0.2 * lightStress
      );
      cs.accumulatedStress = cs.accumulatedStress * 0.85 + instantStress * 0.15;
      const healthDecayRate = 0.05 / g.stressResilienceFactor;
      cs.healthScore = Math.max(0, cs.healthScore - cs.accumulatedStress * healthDecayRate);
      const growthFactor = Math.exp(-0.5 * tempDev ** 2) * Math.exp(-0.5 * moistureDev ** 2) * cs.healthScore * (cs.isBolting ? 0.3 : 1);
      const dailyProgress = growthFactor / effectiveGrowthCycleSols;
      cs.stageProgress = Math.min(1, cs.stageProgress + dailyProgress);
      cs.stage = progressToStage(cs.stageProgress, cs.cropType);
      if (env.airTemperature > effectiveBoltingThreshold && rng() < 0.1) {
        cs.isBolting = true;
      }
      if (cs.stage === "harvest_ready") {
        const repsPerTile = Math.min(profile.plantsPerTile, 6);
        const plantsRepresented = profile.plantsPerTile / repsPerTile;
        const individualYieldKg = profile.maxYieldKgPerPlant * g.maxYieldFactor * profile.harvestIndex * cs.healthScore;
        totalYieldKg += individualYieldKg * plantsRepresented;
        cs.stage = "seed";
        cs.stageProgress = 0;
        cs.healthScore = 1;
        cs.accumulatedStress = 0;
        cs.isBolting = false;
        let replantSeed = scenarioSeed * 73244475 + sol * 2654435769 >>> 0;
        for (let ci = 0; ci < cs.instanceId.length; ci++) {
          replantSeed ^= cs.instanceId.charCodeAt(ci);
          replantSeed = Math.imul(replantSeed, 16777619) >>> 0;
        }
        cs.genetics = generateGeneticIdentity(replantSeed, profile.geneticVariance);
      }
    }
  }
  return totalYieldKg;
}
function runSimulation(params) {
  const { snapshot, proposedActions, horizonSols, scenarioCount } = params;
  const yields = [];
  const baseSeed = Date.now() % 2147483647;
  for (let i = 0; i < scenarioCount; i++) {
    const yieldKg = runScenario(snapshot, proposedActions, horizonSols, baseSeed + i);
    yields.push(yieldKg);
  }
  yields.sort((a, b) => a - b);
  const p10Idx = Math.max(0, Math.floor(scenarioCount * 0.1) - 1);
  const p90Idx = Math.min(scenarioCount - 1, Math.floor(scenarioCount * 0.9));
  const p10YieldKg = yields[p10Idx];
  const p90YieldKg = yields[p90Idx];
  const meanYieldKg = yields.reduce((s, v) => s + v, 0) / yields.length;
  const minViable = horizonSols * 2;
  const survivingScenarios = yields.filter((y) => y >= minViable).length;
  const p10SurvivalProbability = survivingScenarios / scenarioCount;
  return {
    p10YieldKg,
    p90YieldKg,
    meanYieldKg,
    p10SurvivalProbability,
    scenarioYields: yields
  };
}

const INITIAL_CREW_PROFILES = [
  {
    id: "wei",
    name: "Wei",
    role: "Botanist",
    health: "nominal",
    condition: "Rested",
    heartRate: 68,
    bloodPressure: "118/76",
    bodyTemp: 36.6,
    o2Sat: 98,
    sleep: 7.2,
    stress: "good",
    morale: 88,
    hydration: 92,
    nutrition: 88,
    calories: 2180,
    evaHours: 142,
    taskLoad: "moderate",
    currentTask: "Monitoring tomato flowering cycle",
    specialty: "Closed-loop agriculture"
  },
  {
    id: "amara",
    name: "Amara",
    role: "Engineer",
    health: "nominal",
    condition: "Alert",
    heartRate: 72,
    bloodPressure: "122/78",
    bodyTemp: 36.7,
    o2Sat: 97,
    sleep: 6.8,
    stress: "moderate",
    morale: 81,
    hydration: 85,
    nutrition: 79,
    calories: 2340,
    evaHours: 218,
    taskLoad: "moderate",
    currentTask: "Solar panel diagnostics post-storm",
    specialty: "Life support & power systems"
  },
  {
    id: "lena",
    name: "Lena",
    role: "Medic",
    health: "caution",
    condition: "Fatigued",
    heartRate: 74,
    bloodPressure: "115/72",
    bodyTemp: 36.9,
    o2Sat: 97,
    sleep: 5.9,
    stress: "moderate",
    morale: 74,
    hydration: 76,
    nutrition: 82,
    calories: 1980,
    evaHours: 96,
    taskLoad: "moderate",
    currentTask: "Crew sleep pattern analysis",
    specialty: "Crew health & nutrition"
  },
  {
    id: "kenji",
    name: "Kenji",
    role: "Specialist",
    health: "nominal",
    condition: "Sharp",
    heartRate: 65,
    bloodPressure: "116/74",
    bodyTemp: 36.5,
    o2Sat: 99,
    sleep: 7.5,
    stress: "good",
    morale: 91,
    hydration: 90,
    nutrition: 91,
    calories: 2420,
    evaHours: 186,
    taskLoad: "good",
    currentTask: "EVA prep for water extraction site",
    specialty: "Geology & EVA ops"
  }
];
function crewProfilesForAgent(crew) {
  const lines = ["CREW STATUS (4 crewmates):"];
  for (const c of crew) {
    lines.push(
      `- ${c.name} (${c.role}) | Health: ${c.health} | Condition: ${c.condition} | Morale: ${c.morale}/100 | Sleep: ${c.sleep}h | Stress: ${c.stress} | Hydration: ${c.hydration}% | Nutrition: ${c.nutrition}% | Calories: ${c.calories} kcal | HR: ${c.heartRate} bpm | BP: ${c.bloodPressure} | Temp: ${c.bodyTemp}C | O2Sat: ${c.o2Sat}% | Task: ${c.currentTask} | Specialty: ${c.specialty} | EVA hours: ${c.evaHours} | TaskLoad: ${c.taskLoad}`
    );
  }
  return lines.join("\n");
}

function digestPreamble(agentName) {
  const digests = secretaryStore.getPerformanceDigests();
  if (!digests) return "";
  const text = digests[agentName];
  return `[PERFORMANCE DIGEST \u2014 calibration signal from Secretary, last 10 sols]
${text}
`;
}
function summarizeActions(actions) {
  if (actions.length === 0) return "No actions";
  const parts = [];
  const plantCounts = {};
  const harvestCounts = {};
  let clearCount = 0;
  for (const a of actions) {
    if (a.type === "batch-tile") {
      for (const p of a.plants ?? []) {
        plantCounts[p.crop] = (plantCounts[p.crop] ?? 0) + 1;
      }
      harvestCounts["tiles"] = (harvestCounts["tiles"] ?? 0) + (a.harvests?.length ?? 0);
      clearCount += a.clears?.length ?? 0;
    } else if (a.type === "plant-tile" && a.crop) {
      plantCounts[a.crop] = (plantCounts[a.crop] ?? 0) + 1;
    } else if (a.type === "harvest-tile") {
      harvestCounts["tiles"] = (harvestCounts["tiles"] ?? 0) + 1;
    } else if (a.type === "clear-tile") {
      clearCount++;
    } else if (a.type === "harvest" && a.crop) {
      parts.push(`harvested all ${a.crop}`);
    } else if (a.type === "replant" && a.crop) {
      parts.push(`replanted all ${a.crop}`);
    } else if (a.type === "greenhouse" && a.param != null && a.value != null) {
      const label = a.param === "globalHeatingPower" ? "heating" : a.param === "lightingPower" ? "lighting" : a.param === "co2InjectionRate" ? "CO2 injection" : a.param === "ventilationRate" ? "ventilation" : a.param;
      parts.push(`set ${label} to ${a.value}`);
    } else if (a.type === "crop" && a.crop && a.param != null && a.value != null) {
      parts.push(`set ${a.crop} ${a.param} to ${a.value}`);
    }
  }
  for (const [crop, count] of Object.entries(plantCounts)) {
    parts.push(`planted ${count} ${crop}`);
  }
  const totalHarvests = harvestCounts["tiles"] ?? 0;
  if (totalHarvests > 0) parts.push(`harvested ${totalHarvests} tile${totalHarvests > 1 ? "s" : ""}`);
  if (clearCount > 0) parts.push(`cleared ${clearCount} tile${clearCount > 1 ? "s" : ""}`);
  return parts.join(", ");
}
function applyPreferenceUpdates(updates, missionSol) {
  if (!Array.isArray(updates)) return;
  for (const u of updates) {
    if (typeof u.crop === "string" && typeof u.delta === "number") {
      secretaryStore.updateCrewPreference(u.crop, u.delta, missionSol);
    }
  }
}
function compactSnapshot(snapshot) {
  const snap = snapshot;
  const tileCrops = snap.tileCrops ?? {};
  const flaggedTiles = {};
  let totalTiles = 0;
  let flaggedCount = 0;
  for (const [tileId, tile] of Object.entries(tileCrops)) {
    totalTiles++;
    const health = tile.healthScore ?? 1;
    const bolting = tile.isBolting ?? false;
    const disease = tile.diseaseRisk ?? 0;
    if (health < 0.7 || bolting || disease > 0.3) {
      flaggedTiles[tileId] = tile;
      flaggedCount++;
    }
  }
  return {
    environment: {
      missionSol: snap.missionSol,
      totalMissionSols: snap.totalMissionSols,
      currentLs: snap.currentLs,
      seasonName: snap.seasonName,
      atmosphericPressure: snap.atmosphericPressure,
      dustStormRisk: snap.dustStormRisk,
      airTemperature: snap.airTemperature,
      humidity: snap.humidity,
      co2Level: snap.co2Level,
      lightLevel: snap.lightLevel,
      o2Level: snap.o2Level,
      externalTemp: snap.externalTemp,
      solarRadiation: snap.solarRadiation,
      dustStormFactor: snap.dustStormFactor,
      dustStormActive: snap.dustStormActive,
      waterRecyclingEfficiency: snap.waterRecyclingEfficiency,
      solarGenerationKW: snap.solarGenerationKW,
      batteryStorageKWh: snap.batteryStorageKWh,
      batteryCapacityKWh: snap.batteryCapacityKWh,
      energyDeficit: snap.energyDeficit,
      co2SafetyAlert: snap.co2SafetyAlert,
      nutritionalCoverage: snap.nutritionalCoverage,
      foodReservesSols: snap.foodReservesSols
    },
    greenhouseControls: snap.greenhouseControls ?? {},
    crops: snap.crops ?? {},
    resources: snap.resources ?? {},
    flaggedTiles,
    tileSummary: `${totalTiles} tiles total, ${flaggedCount} flagged (health<0.7 / bolting / disease>0.3)`
  };
}
function envSummaryForArbiter(snapshot) {
  const s = snapshot;
  const controls = s.greenhouseControls ?? {};
  const resources = s.resources ?? {};
  const crops = s.crops ?? {};
  const cropLines = Object.entries(crops).map(([name, c]) => {
    const health = (c.healthScore ?? 1).toFixed(2);
    const yieldKg = (c.estimatedYieldKg ?? 0).toFixed(1);
    return `  ${name}: stage=${c.stage}, health=${health}, yield=${yieldKg}kg, bolting=${c.isBolting ?? false}`;
  }).join("\n");
  return `KEY METRICS:
  Sol ${s.missionSol}/${s.totalMissionSols}, Ls ${s.currentLs}\xB0, Season: ${s.seasonName}
  Temp: ${s.airTemperature}\xB0C, Humidity: ${s.humidity}%, CO\u2082: ${s.co2Level}ppm, O\u2082: ${s.o2Level}%
  Light: ${s.lightLevel}, Solar: ${s.solarGenerationKW}kW, Battery: ${s.batteryStorageKWh}/${s.batteryCapacityKWh}kWh
  Dust factor: ${s.dustStormFactor}, Storm active: ${s.dustStormActive}, Energy deficit: ${s.energyDeficit}
  Water recycling: ${s.waterRecyclingEfficiency}, Nutritional coverage: ${s.nutritionalCoverage}
  Food reserves: ${s.foodReservesSols} sols
  Controls: heat=${controls.globalHeatingPower}W, light=${controls.lightingPower}W, CO\u2082=${controls.co2InjectionRate}ppm/h, vent=${controls.ventilationRate}
  Resources: water=${resources.waterConsumedL}L, energy=${resources.energyUsedKWh}kWh, O\u2082=${resources.o2ProducedKg}kg, harvest=${resources.totalHarvestKg}kg
CROPS:
${cropLines}`;
}
const ActionSchema$1 = z.object({
  type: z.enum(["greenhouse", "crop", "harvest", "replant", "harvest-tile", "plant-tile", "clear-tile", "batch-tile"]),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
  tileId: z.string().optional(),
  // batch-tile fields
  harvests: z.array(z.string()).optional(),
  plants: z.array(z.object({ tileId: z.string(), crop: z.string() })).optional(),
  clears: z.array(z.string()).optional()
});
const DispatcherInputSchema = z.object({
  triggerType: z.enum(["emergency", "routine", "crew"]),
  snapshot: z.record(z.string(), z.unknown()),
  crewMessage: z.string().optional(),
  missionSol: z.number()
});
const ClassifyOutputSchema = z.object({
  triggerType: z.enum(["emergency", "routine", "crew"]),
  emergencySeverity: z.union([z.literal(1), z.literal(2)]).optional(),
  crewMessage: z.string().optional(),
  snapshot: z.record(z.string(), z.unknown()),
  missionSol: z.number(),
  // Emergency playbook actions for severity-1 (determined without LLM)
  playbookActions: z.array(ActionSchema$1).optional(),
  playbookReason: z.string().optional()
});
const DispatcherOutputSchema = z.object({
  triggerType: z.string(),
  emergencySeverity: z.number().optional(),
  crewIntent: z.string().optional(),
  resolvedActions: z.array(ActionSchema$1),
  conflictType: z.string(),
  winningAgent: z.string(),
  riskScore: z.number(),
  wellbeingScore: z.number(),
  survivalJustification: z.string(),
  wellbeingJustification: z.string(),
  crewResponse: z.string().optional(),
  simulationP10: z.number().optional(),
  simulationP90: z.number().optional(),
  reasoning: z.string(),
  summary: z.string(),
  decisionId: z.string()
});
const classifyStep = createStep({
  id: "classify",
  inputSchema: DispatcherInputSchema,
  outputSchema: ClassifyOutputSchema,
  execute: async ({ inputData }) => {
    const { triggerType, snapshot, crewMessage, missionSol } = inputData;
    const snap = snapshot;
    if (triggerType !== "emergency") {
      return {
        triggerType,
        snapshot,
        crewMessage,
        missionSol
      };
    }
    const dustOpacity = (() => {
      const rawOpacity = snap.dustOpacity;
      if (rawOpacity != null) return rawOpacity;
      const stormFactor = snap.dustStormFactor;
      if (stormFactor != null) return (1 - stormFactor) * 5;
      return 0;
    })();
    const solarPct = (() => {
      const gen = snap.solarGenerationKW ?? 0;
      const cap = 5;
      return gen / cap;
    })();
    const co2Level = snap.co2Level ?? 1e3;
    const batteryPct = (() => {
      const charge = snap.batteryStorageKWh ?? 100;
      const capacity = snap.batteryCapacityKWh ?? 100;
      return charge / Math.max(1, capacity);
    })();
    const waterRecycling = snap.waterRecyclingEfficiency ?? 1;
    const nutritionalCoverage = snap.nutritionalCoverage ?? 1;
    const solarCritical = solarPct < 0.15 && batteryPct < 0.15;
    const isSev1 = dustOpacity > 3 || solarCritical || co2Level > 5e3 || batteryPct < 0.1;
    if (isSev1) {
      const actionMap = /* @__PURE__ */ new Map();
      const reasons = [];
      if (dustOpacity > 3) {
        actionMap.set("ventilationRate", { type: "greenhouse", param: "ventilationRate", value: 20 });
        reasons.push("Extreme dust storm (tau > 3.0): sealed vents, filter intakes activated");
      }
      if (solarCritical) {
        actionMap.set("lightingPower", { type: "greenhouse", param: "lightingPower", value: 2e3 });
        actionMap.set("globalHeatingPower", { type: "greenhouse", param: "globalHeatingPower", value: 1500 });
        reasons.push("Solar power < 15% with battery critically low: shedding non-essential loads, switching to battery reserves");
      }
      if (batteryPct < 0.1) {
        actionMap.set("lightingPower", { type: "greenhouse", param: "lightingPower", value: 1e3 });
        actionMap.set("globalHeatingPower", { type: "greenhouse", param: "globalHeatingPower", value: 1e3 });
        reasons.push("Battery critically low (<10%): emergency power reduction");
      }
      if (co2Level > 5e3) {
        actionMap.set("ventilationRate", { type: "greenhouse", param: "ventilationRate", value: 400 });
        actionMap.set("co2InjectionRate", { type: "greenhouse", param: "co2InjectionRate", value: 0 });
        reasons.push("CO\u2082 breach > 5000 ppm: maximising ventilation, CO\u2082 injection halted");
      }
      const playbookActions = [...actionMap.values()];
      return {
        triggerType: "emergency",
        emergencySeverity: 1,
        snapshot,
        missionSol,
        playbookActions,
        playbookReason: reasons.join("; ")
      };
    }
    const isSev2 = dustOpacity >= 1.5 && dustOpacity <= 3 || batteryPct < 0.25 || waterRecycling < 0.25 || nutritionalCoverage < 0.5;
    if (isSev2) {
      return {
        triggerType: "emergency",
        emergencySeverity: 2,
        snapshot,
        missionSol
      };
    }
    return {
      triggerType: "routine",
      snapshot,
      missionSol
    };
  }
});
const dispatchStep = createStep({
  id: "dispatch",
  inputSchema: ClassifyOutputSchema,
  outputSchema: DispatcherOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { triggerType, emergencySeverity, snapshot, crewMessage, missionSol, playbookActions, playbookReason } = inputData;
    const survivalAgent = mastra?.getAgent("survivalAgent");
    const wellbeingAgent = mastra?.getAgent("wellbeingAgent");
    const secretaryContext = secretaryStore.getAgentContext(5);
    const crewProfile = secretaryStore.getCrewPreferenceProfile();
    const compactSnap = compactSnapshot(snapshot);
    const compactSnapJson = JSON.stringify(compactSnap, null, 2);
    const crewStatusBlock = crewProfilesForAgent(Array.isArray(snapshot?.crew) ? snapshot.crew : INITIAL_CREW_PROFILES);
    const contextBlock = `
${crewStatusBlock}

Secretary context (recent decisions and crew state):
${secretaryContext || "No prior decisions logged."}

Crew preference profile: ${JSON.stringify(crewProfile.preferences)}
Mission sol: ${missionSol}
`.trim();
    if (triggerType === "emergency" && emergencySeverity === 1) {
      const actions = playbookActions ?? [];
      const reason = playbookReason ?? "Severity-1 emergency: hardcoded playbook executed.";
      secretaryStore.addIncident({
        missionSol,
        emergencyType: reason.split(":")[0],
        severity: 1,
        trigger: reason,
        actionsExecuted: actions.map((a) => `${a.type}:${a.param ?? a.crop}=${a.value ?? ""}`),
        systemsAffected: ["power", "ventilation", "co2"],
        resolved: false
      });
      const decisionEntry2 = secretaryStore.addDecision({
        missionSol,
        triggerType: "emergency_sev1",
        riskScore: 1,
        wellbeingScore: 0.5,
        conflictType: "none",
        winningAgent: "hardcoded",
        survivalProposalSummary: "Hardcoded playbook",
        wellbeingProposalSummary: "Not consulted (severity-1)",
        actionsEnacted: actions,
        reasoning: reason
      });
      return {
        triggerType: "emergency_sev1",
        emergencySeverity: 1,
        resolvedActions: actions,
        conflictType: "none",
        winningAgent: "hardcoded",
        riskScore: 1,
        wellbeingScore: 0.5,
        survivalJustification: reason,
        wellbeingJustification: "Not consulted \u2014 severity-1 emergency",
        reasoning: reason,
        summary: `Emergency \u2014 ${reason}`,
        decisionId: decisionEntry2.id
      };
    }
    let crewIntent = "question";
    let wbScore = 0.7;
    let wbActions = [];
    let wbJustification = "";
    let wbCrewResponse = "";
    if (triggerType === "crew" && crewMessage) {
      const intentClassificationPrompt = `[ARBITER_MODE]
${contextBlock}

Current greenhouse sensor readings:
${compactSnapJson}

Crew message: "${crewMessage}"

Classify this message as "question", "request", or "override" and respond accordingly.
For questions: answer directly from the sensor data.
For requests or overrides: classify intent and provide your proposal.`;
      if (wellbeingAgent) {
        try {
          const wResult = await wellbeingAgent.generate(
            [{ role: "user", content: intentClassificationPrompt }],
            { maxSteps: 1 }
          );
          const wText = wResult.text ?? "";
          const jsonMatch = wText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              crewIntent = parsed.intent ?? "question";
              wbScore = parsed.wellbeingScore ?? 0.7;
              applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
              secretaryStore.addCrewRequest(crewMessage, missionSol);
              if (crewIntent === "question") {
                wbCrewResponse = parsed.response ?? wText;
                const decisionEntry2 = secretaryStore.addDecision({
                  missionSol,
                  triggerType: "crew_question",
                  riskScore: 0,
                  wellbeingScore: wbScore,
                  conflictType: "none",
                  winningAgent: "wellbeing",
                  survivalProposalSummary: "Not consulted (question)",
                  wellbeingProposalSummary: wbCrewResponse.slice(0, 100),
                  actionsEnacted: [],
                  reasoning: wbCrewResponse
                });
                return {
                  triggerType: "crew_question",
                  crewIntent: "question",
                  resolvedActions: [],
                  conflictType: "none",
                  winningAgent: "wellbeing",
                  riskScore: 0,
                  wellbeingScore: wbScore,
                  survivalJustification: "",
                  wellbeingJustification: "Direct question answered from snapshot",
                  crewResponse: wbCrewResponse,
                  reasoning: wbCrewResponse,
                  summary: `Crew question answered`,
                  decisionId: decisionEntry2.id
                };
              }
              wbActions = parsed.proposal?.actions ?? [];
              wbJustification = parsed.proposal?.justification ?? "";
              wbCrewResponse = parsed.crewResponse ?? "";
            } catch {
            }
          }
        } catch (err) {
          console.error("[dispatcher] wellbeing agent error:", err);
        }
      }
      if (crewIntent === "override") {
        secretaryStore.logOverrideAttempt(crewMessage, false, missionSol);
        if (survivalAgent) {
          const vetoPrompt = `${digestPreamble("survival")}
${contextBlock}

Current greenhouse sensor readings:
${compactSnapJson}

The crew is attempting an OVERRIDE: "${crewMessage}"
Proposed override actions: ${JSON.stringify(wbActions)}

Evaluate this override. If risk score > 0.85, issue a hard veto with explanation.
Otherwise, permit the override and log it.`;
          try {
            const sResult = await survivalAgent.generate(
              [{ role: "user", content: vetoPrompt }],
              { maxSteps: 1 }
            );
            const sText = sResult.text ?? "";
            const jsonMatch = sText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const riskScore = parsed.riskScore ?? 0.5;
              const veto = parsed.veto ?? riskScore > 0.85;
              if (veto) {
                secretaryStore.logOverrideAttempt(crewMessage, false, missionSol);
                const decisionEntry4 = secretaryStore.addDecision({
                  missionSol,
                  triggerType: "crew_override",
                  riskScore,
                  wellbeingScore: wbScore,
                  conflictType: "hard_veto",
                  winningAgent: "survival",
                  survivalProposalSummary: parsed.vetoReason ?? "Veto issued",
                  wellbeingProposalSummary: wbJustification,
                  actionsEnacted: [],
                  reasoning: parsed.vetoReason ?? "Override vetoed for safety"
                });
                return {
                  triggerType: "crew_override",
                  crewIntent: "override",
                  resolvedActions: [],
                  conflictType: "hard_veto",
                  winningAgent: "survival",
                  riskScore,
                  wellbeingScore: wbScore,
                  survivalJustification: parsed.vetoReason ?? "Override vetoed",
                  wellbeingJustification: wbJustification,
                  crewResponse: `Override denied: ${parsed.vetoReason ?? "Safety threshold exceeded."}`,
                  reasoning: parsed.vetoReason ?? "Override vetoed for safety",
                  summary: `Override vetoed \u2014 risk ${riskScore.toFixed(2)}`,
                  decisionId: decisionEntry4.id
                };
              }
              secretaryStore.logOverrideAttempt(crewMessage, true, missionSol);
              const decisionEntry3 = secretaryStore.addDecision({
                missionSol,
                triggerType: "crew_override",
                riskScore,
                wellbeingScore: wbScore,
                conflictType: "none",
                winningAgent: "wellbeing",
                survivalProposalSummary: `Risk score ${riskScore.toFixed(2)} \u2014 permitted`,
                wellbeingProposalSummary: wbJustification,
                actionsEnacted: wbActions,
                reasoning: `Crew override permitted \u2014 risk score ${riskScore.toFixed(2)} < 0.85`
              });
              return {
                triggerType: "crew_override",
                crewIntent: "override",
                resolvedActions: wbActions,
                conflictType: "none",
                winningAgent: "wellbeing",
                riskScore,
                wellbeingScore: wbScore,
                survivalJustification: `Permitted \u2014 risk ${riskScore.toFixed(2)}`,
                wellbeingJustification: wbJustification,
                crewResponse: wbCrewResponse || "Override approved.",
                reasoning: `Crew override permitted`,
                summary: `Override approved \u2014 crew request enacted`,
                decisionId: decisionEntry3.id
              };
            }
          } catch (err) {
            console.error("[dispatcher] survival veto check error:", err);
          }
        }
        const decisionEntry2 = secretaryStore.addDecision({
          missionSol,
          triggerType: "crew_override",
          riskScore: 0.3,
          wellbeingScore: wbScore,
          conflictType: "none",
          winningAgent: "wellbeing",
          survivalProposalSummary: "No survival check (agent unavailable)",
          wellbeingProposalSummary: wbJustification,
          actionsEnacted: wbActions,
          reasoning: "Override permitted \u2014 survival check unavailable"
        });
        return {
          triggerType: "crew_override",
          crewIntent: "override",
          resolvedActions: wbActions,
          conflictType: "none",
          winningAgent: "wellbeing",
          riskScore: 0.3,
          wellbeingScore: wbScore,
          survivalJustification: "",
          wellbeingJustification: wbJustification,
          crewResponse: wbCrewResponse || "Override accepted.",
          reasoning: "Override permitted",
          summary: `Override accepted \u2014 crew request enacted`,
          decisionId: decisionEntry2.id
        };
      }
    }
    const isEmergencySev2 = triggerType === "emergency" && emergencySeverity === 2;
    const isCrewRequest = triggerType === "crew";
    const horizonSols = isEmergencySev2 ? 3 : 7;
    const scenarioCount = isEmergencySev2 ? 10 : 100;
    const basePrompt = `
${contextBlock}

Current greenhouse sensor readings:
${compactSnapJson}

${crewMessage ? `Crew message (context for this decision): "${crewMessage}"` : ""}
Mission sol: ${missionSol}
Trigger: ${isEmergencySev2 ? "EMERGENCY severity-2" : isCrewRequest ? "crew request" : "routine"}`;
    let survivalRiskScore = 0.3;
    let survivalActions = [];
    let survivalJustification = "No proposal";
    let survivalVeto = false;
    let survivalVetoReason = "";
    let arbWbScore = isCrewRequest ? wbScore : 0.7;
    let arbWbActions = isCrewRequest ? wbActions : [];
    let arbWbJustification = isCrewRequest ? wbJustification : "No proposal";
    let arbWbCrewResponse = isCrewRequest ? wbCrewResponse : "";
    const agentCalls = [
      survivalAgent?.generate(
        [{ role: "user", content: `${digestPreamble("survival")}${basePrompt}

Provide your risk assessment and conservative action proposal.` }],
        { maxSteps: 1 }
      ) ?? Promise.resolve(null)
    ];
    if (!isCrewRequest) {
      agentCalls.push(
        wellbeingAgent?.generate(
          [{ role: "user", content: `[ARBITER_MODE]
${digestPreamble("wellbeing")}${basePrompt}

Provide your wellbeing assessment and crew-centred action proposal.` }],
          { maxSteps: 1 }
        ) ?? Promise.resolve(null)
      );
    }
    const agentResults = await Promise.allSettled(agentCalls);
    const survivalResult = agentResults[0];
    const wellbeingResult = agentResults[1];
    if (survivalResult.status === "fulfilled" && survivalResult.value) {
      const sText = survivalResult.value.text ?? "";
      const jsonMatch = sText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          survivalRiskScore = parsed.riskScore ?? 0.3;
          survivalActions = parsed.proposal?.actions ?? [];
          survivalJustification = parsed.proposal?.justification ?? sText.slice(0, 200);
          survivalVeto = parsed.veto ?? survivalRiskScore > 0.85;
          survivalVetoReason = parsed.vetoReason ?? "";
        } catch {
          survivalJustification = sText.slice(0, 200);
        }
      } else {
        survivalJustification = survivalResult.value.text?.slice(0, 200) ?? "No proposal";
      }
    }
    if (!isCrewRequest && wellbeingResult?.status === "fulfilled" && wellbeingResult.value) {
      const wText = wellbeingResult.value.text ?? "";
      const jsonMatch = wText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          arbWbScore = parsed.wellbeingScore ?? 0.7;
          arbWbActions = parsed.proposal?.actions ?? [];
          arbWbJustification = parsed.proposal?.justification ?? wText.slice(0, 200);
          arbWbCrewResponse = parsed.crewResponse ?? "";
          applyPreferenceUpdates(parsed.preferenceUpdates, missionSol);
        } catch {
          arbWbJustification = wText.slice(0, 200);
        }
      } else {
        arbWbJustification = wText.slice(0, 200);
      }
    }
    let conflictType = "none";
    let winningAgent = "both";
    let resolvedActions = [];
    let simulationP10;
    let simulationP90;
    let arbiterReasoning = "";
    let arbiterSummary = "";
    if (survivalVeto || survivalRiskScore > 0.85) {
      conflictType = "hard_veto";
      winningAgent = "survival";
      resolvedActions = survivalActions;
      arbWbCrewResponse = survivalVetoReason ? `\u26A0\uFE0F Mission commander veto: ${survivalVetoReason}` : `\u26A0\uFE0F Safety threshold exceeded \u2014 survival plan enacted.`;
      arbiterReasoning = `Hard veto invoked (risk ${survivalRiskScore.toFixed(2)} > 0.85). Survival plan enacted without deliberation. ${survivalVetoReason}`;
    } else {
      let simSurvivalResult;
      let simWellbeingResult;
      const shouldSim = isEmergencySev2 || survivalRiskScore >= 0.5;
      if (shouldSim) {
        const [ss, sw] = await Promise.all([
          Promise.resolve(runSimulation({ snapshot, proposedActions: survivalActions, horizonSols, scenarioCount })),
          isEmergencySev2 ? Promise.resolve(null) : Promise.resolve(runSimulation({ snapshot, proposedActions: arbWbActions, horizonSols, scenarioCount }))
        ]);
        simSurvivalResult = ss;
        simWellbeingResult = sw ?? void 0;
        simulationP10 = ss.p10YieldKg;
        simulationP90 = ss.p90YieldKg;
      }
      const arbiterAgent = mastra?.getAgent("arbiterAgent");
      const missionPhase = missionSol > 350 ? "late (sols 350+) \u2014 crew morale weight increases to 50/50" : missionSol > 100 ? `mid (sol ${missionSol}) \u2014 60/40 survival/wellbeing balance` : `early (sol ${missionSol}) \u2014 70/30 bias toward survivability`;
      const arbiterPrompt = `${digestPreamble("arbiter")}
MISSION PHASE: ${missionPhase}
TRIGGER: ${isEmergencySev2 ? "EMERGENCY severity-2" : isCrewRequest ? "crew request" : "routine"}

SECRETARY CONTEXT (recent mission history):
${secretaryContext || "No prior decisions."}

CURRENT GREENHOUSE STATE:
${envSummaryForArbiter(snapshot)}
${crewMessage ? `
CREW MESSAGE: "${crewMessage}"` : ""}

SURVIVAL AGENT BRIEF:
Risk score: ${survivalRiskScore.toFixed(3)}
Justification: ${survivalJustification}
Proposed actions: ${JSON.stringify(survivalActions, null, 2)}

WELLBEING AGENT BRIEF:
Wellbeing score: ${arbWbScore.toFixed(3)}
Justification: ${arbWbJustification}
Proposed actions: ${JSON.stringify(arbWbActions, null, 2)}
${arbWbCrewResponse ? `Crew-facing message from Wellbeing: "${arbWbCrewResponse}"` : ""}

SIMULATION RESULTS (P10 = worst-case 10th percentile):
${simSurvivalResult ? `Survival plan \u2014 P10: ${simSurvivalResult.p10YieldKg.toFixed(2)} kg, P90: ${simSurvivalResult.p90YieldKg.toFixed(2)} kg` : "Survival plan: not simulated"}
${simWellbeingResult ? `Wellbeing plan \u2014 P10: ${simWellbeingResult.p10YieldKg.toFixed(2)} kg, P90: ${simWellbeingResult.p90YieldKg.toFixed(2)} kg` : isEmergencySev2 ? "Wellbeing plan: not consulted (emergency)" : "Wellbeing plan: not simulated (low risk)"}

Make your decision. You may propose a hybrid. Remember: risk > 0.85 = unconditional survival veto (already checked \u2014 not applicable here).`.trim();
      if (arbiterAgent) {
        try {
          const arbiterResult = await arbiterAgent.generate(
            [{ role: "user", content: arbiterPrompt }],
            { maxSteps: 1 }
          );
          const aText = arbiterResult.text ?? "";
          const jsonMatch = aText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            conflictType = parsed.conflictType ?? "none";
            arbiterReasoning = parsed.reasoning ?? aText.slice(0, 400);
            arbiterSummary = parsed.summary ?? "";
            if (parsed.crewMessage) arbWbCrewResponse = parsed.crewMessage;
            const rawActions = parsed.actions ?? [];
            winningAgent = parsed.decision === "hybrid" ? "arbiter" : parsed.decision === "survival" ? "survival" : parsed.decision === "wellbeing" ? "wellbeing" : "both";
            if (rawActions.length > 0) {
              resolvedActions = rawActions;
            } else if (winningAgent === "survival") {
              resolvedActions = survivalActions;
            } else if (winningAgent === "wellbeing") {
              resolvedActions = arbWbActions;
            } else {
              const mergedMap = /* @__PURE__ */ new Map();
              for (const a of survivalActions) mergedMap.set(`${a.type}:${a.param ?? a.crop}`, a);
              for (const a of arbWbActions) {
                const key = `${a.type}:${a.param ?? a.crop}`;
                if (!mergedMap.has(key)) mergedMap.set(key, a);
              }
              resolvedActions = [...mergedMap.values()];
            }
            if (simSurvivalResult) simulationP10 = simSurvivalResult.p10YieldKg;
            if (simSurvivalResult) simulationP90 = simSurvivalResult.p90YieldKg;
          } else {
            arbiterReasoning = aText.slice(0, 400);
            winningAgent = "survival";
            resolvedActions = survivalActions;
            conflictType = "none";
          }
        } catch (err) {
          console.error("[dispatcher] arbiter agent error:", err);
          winningAgent = "survival";
          resolvedActions = survivalActions;
          arbiterReasoning = `Arbiter error \u2014 defaulting to survival plan. ${err instanceof Error ? err.message : ""}`;
        }
      } else {
        winningAgent = survivalRiskScore >= 0.5 ? "survival" : "both";
        resolvedActions = survivalRiskScore >= 0.5 ? survivalActions : [...survivalActions, ...arbWbActions];
        arbiterReasoning = "Arbiter unavailable \u2014 deterministic fallback applied.";
      }
    }
    resolvedActions = resolvedActions.filter((a) => {
      if (a.type === "harvest" || a.type === "replant") return !!a.crop;
      if (a.type === "greenhouse") return !!a.param && a.value !== void 0;
      if (a.type === "crop") return !!a.crop && !!a.param && a.value !== void 0;
      if (a.type === "harvest-tile") return !!a.tileId;
      if (a.type === "plant-tile") return !!a.tileId && !!a.crop;
      if (a.type === "clear-tile") return !!a.tileId;
      if (a.type === "batch-tile") return !!(a.harvests?.length || a.plants?.length || a.clears?.length);
      return false;
    });
    const logTriggerType = isEmergencySev2 ? "emergency_sev2" : isCrewRequest ? "crew_request" : "routine";
    const decisionEntry = secretaryStore.addDecision({
      missionSol,
      triggerType: logTriggerType,
      riskScore: survivalRiskScore,
      wellbeingScore: arbWbScore,
      conflictType,
      winningAgent,
      survivalProposalSummary: survivalJustification.slice(0, 150),
      wellbeingProposalSummary: arbWbJustification.slice(0, 150),
      actionsEnacted: resolvedActions,
      simulationP10,
      simulationP90,
      reasoning: arbiterReasoning
    });
    ingestSecretaryReports(Date.now() - 5e3).catch(
      (err) => console.warn("[dispatcher] vector ingestion failed (non-blocking):", err)
    );
    return {
      triggerType: logTriggerType,
      emergencySeverity,
      crewIntent: isCrewRequest ? "request" : void 0,
      resolvedActions,
      conflictType,
      winningAgent,
      riskScore: survivalRiskScore,
      wellbeingScore: arbWbScore,
      survivalJustification,
      wellbeingJustification: arbWbJustification,
      crewResponse: arbWbCrewResponse || void 0,
      simulationP10,
      simulationP90,
      reasoning: arbiterReasoning,
      summary: arbiterSummary || (conflictType === "hard_veto" ? `Safety veto \u2014 risk ${survivalRiskScore.toFixed(2)}` : conflictType === "soft_conflict" ? `Conflict resolved \u2014 ${winningAgent} plan enacted` : isEmergencySev2 ? `Severity-2 emergency response` : summarizeActions(resolvedActions)),
      decisionId: decisionEntry.id
    };
  }
});
const dispatcherWorkflow = createWorkflow({
  id: "dispatcher",
  description: "Main trigger dispatcher: classify \u2192 route to agents \u2192 apply arbiter \u2192 log via secretary",
  inputSchema: DispatcherInputSchema,
  outputSchema: DispatcherOutputSchema
}).then(classifyStep).then(dispatchStep).commit();

const SnapshotSchema = z.record(z.string(), z.unknown());
const SituationReportSchema = z.object({
  snapshot: z.record(z.string(), z.unknown()),
  flags: z.object({
    energyDeficit: z.boolean(),
    co2SafetyAlert: z.boolean(),
    waterRecyclingLow: z.boolean(),
    dustStormActive: z.boolean(),
    nutritionLow: z.boolean()
  }),
  cropsAtHarvestReady: z.array(z.string()),
  cropsWithHighDisease: z.array(z.string()),
  cropsWithLowO2: z.array(z.string()),
  cropsWithHighEC: z.array(z.string()),
  boltingCrops: z.array(z.string()),
  tilesAtHarvestReady: z.array(z.string()),
  tilesWithHighDisease: z.array(z.string()),
  tilesWithLowHealth: z.array(z.string()),
  urgencyLevel: z.enum(["low", "medium", "high", "critical"])
});
const ActionSchema = z.object({
  type: z.enum(["greenhouse", "crop", "harvest", "replant", "harvest-tile", "plant-tile", "clear-tile"]),
  param: z.string().optional(),
  value: z.number().optional(),
  crop: z.string().optional(),
  tileId: z.string().optional()
});
const ReasonOutputSchema = z.object({
  reasoning: z.string().describe("Concise explanation of the situation and why these actions were chosen"),
  summary: z.string().describe("One-sentence status summary for the operator chat feed"),
  actions: z.array(ActionSchema).describe("List of parameter changes, harvests, and replants to apply")
});
const assessStep = createStep({
  id: "assess",
  inputSchema: SnapshotSchema,
  outputSchema: SituationReportSchema,
  execute: async ({ inputData }) => {
    const snap = inputData;
    const energyDeficit = snap.energyDeficit ?? false;
    const co2SafetyAlert = snap.co2SafetyAlert ?? false;
    const waterRecyclingEfficiency = snap.waterRecyclingEfficiency ?? 1;
    const dustStormActive = snap.dustStormActive ?? false;
    const nutritionalCoverage = snap.nutritionalCoverage ?? 1;
    const crops = snap.crops ?? {};
    const cropEntries = Object.entries(crops);
    const cropsAtHarvestReady = cropEntries.filter(([, c]) => c.stage === "harvest_ready").map(([name]) => name);
    const cropsWithHighDisease = cropEntries.filter(([, c]) => (c.diseaseRisk ?? 0) > 0.4).map(([name]) => name);
    const cropsWithLowO2 = cropEntries.filter(([, c]) => (c.rootO2Level ?? 100) < 60).map(([name]) => name);
    const cropsWithHighEC = cropEntries.filter(([, c]) => (c.nutrientEC ?? 2) > 3.5).map(([name]) => name);
    const boltingCrops = cropEntries.filter(([, c]) => c.isBolting).map(([name]) => name);
    const tileCrops = snap.tileCrops ?? {};
    const tileEntries = Object.entries(tileCrops);
    const tilesAtHarvestReady = tileEntries.filter(([, t]) => t.stage === "harvest_ready").map(([tileId]) => tileId);
    const tilesWithHighDisease = tileEntries.filter(([, t]) => (t.diseaseRisk ?? 0) > 0.4).map(([tileId]) => tileId);
    const tilesWithLowHealth = tileEntries.filter(([, t]) => (t.healthScore ?? 1) < 0.5 && t.stage !== "harvested").map(([tileId]) => tileId);
    const flags = {
      energyDeficit,
      co2SafetyAlert,
      waterRecyclingLow: waterRecyclingEfficiency < 0.8,
      dustStormActive,
      nutritionLow: nutritionalCoverage < 0.7
    };
    const criticalCount = [
      flags.energyDeficit,
      flags.co2SafetyAlert,
      cropsAtHarvestReady.length > 0,
      cropsWithHighDisease.length > 0
    ].filter(Boolean).length;
    const urgencyLevel = criticalCount >= 3 ? "critical" : criticalCount >= 2 ? "high" : criticalCount >= 1 ? "medium" : "low";
    return {
      snapshot: snap,
      flags,
      cropsAtHarvestReady,
      cropsWithHighDisease,
      cropsWithLowO2,
      cropsWithHighEC,
      boltingCrops,
      tilesAtHarvestReady,
      tilesWithHighDisease,
      tilesWithLowHealth,
      urgencyLevel
    };
  }
});
const reasonStep = createStep({
  id: "reason",
  inputSchema: SituationReportSchema,
  outputSchema: ReasonOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent("greenhouseAgent");
    if (!agent) {
      return {
        reasoning: "Agent unavailable",
        summary: "Agent unavailable \u2014 no actions taken",
        actions: []
      };
    }
    const { snapshot, flags, cropsAtHarvestReady, cropsWithHighDisease, cropsWithLowO2, cropsWithHighEC, boltingCrops, tilesAtHarvestReady, tilesWithHighDisease, tilesWithLowHealth, urgencyLevel } = inputData;
    const prompt = `AUTONOMOUS CONTROL TICK \u2014 urgency: ${urgencyLevel.toUpperCase()}

Situation flags:
- Energy deficit: ${flags.energyDeficit}
- CO\u2082 safety alert: ${flags.co2SafetyAlert}
- Water recycling low (<80%): ${flags.waterRecyclingLow}
- Dust storm active: ${flags.dustStormActive}
- Nutrition coverage low (<70%): ${flags.nutritionLow}

Crops at harvest_ready: ${cropsAtHarvestReady.length > 0 ? cropsAtHarvestReady.join(", ") : "none"}
Crops with high disease risk (>40%): ${cropsWithHighDisease.length > 0 ? cropsWithHighDisease.join(", ") : "none"}
Crops with low root O\u2082 (<60%): ${cropsWithLowO2.length > 0 ? cropsWithLowO2.join(", ") : "none"}
Crops with high nutrient EC (>3.5): ${cropsWithHighEC.length > 0 ? cropsWithHighEC.join(", ") : "none"}
Bolting crops: ${boltingCrops.length > 0 ? boltingCrops.join(", ") : "none"}

Tile-level alerts:
- Tiles at harvest_ready: ${tilesAtHarvestReady.length > 0 ? tilesAtHarvestReady.join(", ") : "none"}
- Tiles with high disease (>40%): ${tilesWithHighDisease.length > 0 ? tilesWithHighDisease.join(", ") : "none"}
- Tiles with low health (<50%): ${tilesWithLowHealth.length > 0 ? tilesWithLowHealth.join(", ") : "none"}

Full sensor snapshot (includes tileCrops for individual tile states and tileCounts for allocation summary):
${JSON.stringify(snapshot, null, 2)}

Decide what actions to take this tick. You can use tile-level actions (plant-tile, harvest-tile, clear-tile) for granular control, or bulk actions (harvest, replant) for entire crop types. Return your reasoning, a one-sentence summary for the operator, and the list of actions to apply. Only include actions that are genuinely warranted by the current state. If nothing needs changing, return an empty actions array.`;
    const result = await agent.generate([{ role: "user", content: prompt }], {
      structuredOutput: { schema: ReasonOutputSchema },
      maxSteps: 5
    });
    const output = result.object;
    if (output && typeof output === "object" && "reasoning" in output) {
      return output;
    }
    return {
      reasoning: typeof result.text === "string" ? result.text : "Autonomous tick completed",
      summary: "Autonomous tick completed \u2014 check logs for details",
      actions: []
    };
  }
});
const actStep = createStep({
  id: "act",
  inputSchema: ReasonOutputSchema,
  outputSchema: ReasonOutputSchema,
  execute: async ({ inputData }) => {
    const validActions = inputData.actions.filter((a) => {
      if (a.type === "harvest" || a.type === "replant") return !!a.crop;
      if (a.type === "greenhouse") return !!a.param && a.value !== void 0;
      if (a.type === "crop") return !!a.crop && !!a.param && a.value !== void 0;
      if (a.type === "harvest-tile") return !!a.tileId;
      if (a.type === "plant-tile") return !!a.tileId && !!a.crop;
      if (a.type === "clear-tile") return !!a.tileId;
      return false;
    });
    return {
      ...inputData,
      actions: validActions
    };
  }
});
const greenhouseControlWorkflow = createWorkflow({
  id: "greenhouse-control",
  description: "Autonomous greenhouse control loop: assess situation \u2192 reason with agent \u2192 validate and apply actions",
  inputSchema: SnapshotSchema,
  outputSchema: ReasonOutputSchema
}).then(assessStep).then(reasonStep).then(actStep).commit();

const mastra = new Mastra({
  workflows: {
    greenhouseControl: greenhouseControlWorkflow,
    dispatcher: dispatcherWorkflow
  },
  agents: {
    greenhouseAgent,
    survivalAgent,
    wellbeingAgent,
    arbiterAgent,
    secretaryAgent
  },
  vectors: {
    secretaryVectorStore
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: "file:./mastra.db"
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info"
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        sampling: {
          type: SamplingStrategyType.ALWAYS
        },
        exporters: [new DefaultExporter(), new CloudExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
        serializationOptions: {
          maxStringLength: 4096,
          maxDepth: 10,
          maxArrayLength: 100,
          maxObjectKeys: 75
        }
      }
    }
  })
});

export { mastra as m };
