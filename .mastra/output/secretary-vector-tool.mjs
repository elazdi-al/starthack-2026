import { LibSQLVector } from '@mastra/libsql';
import { createVectorQueryTool, MDocument } from '@mastra/rag';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { embedMany } from 'ai';

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
const EMBEDDING_DIMENSIONS = 1024;
const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"
});
const secretaryEmbeddingModel = bedrock.embedding("amazon.nova-embed-text-v2:0");
const secretaryVectorStore = new LibSQLVector({
  id: "secretary-vector-store",
  url: "file:./secretary-vectors.db"
});
let indexReady = false;
async function ensureIndex() {
  if (indexReady) return;
  const indexes = await secretaryVectorStore.listIndexes();
  if (!indexes.includes(VECTOR_INDEX_NAME)) {
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
    await secretaryVectorStore.upsert({
      indexName: VECTOR_INDEX_NAME,
      vectors: embeddings,
      metadata: allChunks.map((c) => ({
        ...c.metadata,
        text: c.text
      }))
    });
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

export { secretaryStore as a, secretaryVectorStore as b, ingestSecretaryReports as i, secretaryVectorTool as s };
