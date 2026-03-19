/**
 * Simulation Engine — Monte Carlo forward projection
 *
 * Stateless function. Receives a greenhouse snapshot and a proposed action,
 * runs N Monte Carlo scenarios forward in time, returns a scored outcome distribution.
 * Called by the Arbiter during soft-conflict resolution and by the Survival agent
 * during severity-2 emergencies. Never called during severity-1 emergencies or
 * question-type crew interactions.
 *
 * Scoring metric: P10 yield outcome (worst-case tail, not mean).
 * Optimises for the tail — on Mars, an irreversible crop failure matters more than
 * a marginally better expected yield.
 */

import { CROP_PROFILES } from '../../greenhouse/implementations/multi-crop/profiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimAction {
  type: 'greenhouse' | 'crop' | 'harvest' | 'replant';
  param?: string;
  value?: number;
  crop?: string;
}

export interface SimulationParams {
  snapshot: Record<string, unknown>;
  proposedActions: SimAction[];
  horizonSols: number;   // 7 for routine, 3 for emergency
  scenarioCount: number; // 100 for routine, 10 for emergency
}

export interface SimulationResult {
  p10YieldKg: number;           // 10th percentile — worst-case tail
  p90YieldKg: number;           // 90th percentile
  meanYieldKg: number;
  p10SurvivalProbability: number; // P(crew can be fed) at the P10 tail
  scenarioYields: number[];       // all scenario outputs for debugging
}

// ─── Seeded pseudo-random (mulberry32) ───────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ─── Crop state for simulation ───────────────────────────────────────────────

interface SimCropState {
  cropType: string;
  stageProgress: number;  // 0–1 through entire growth cycle
  healthScore: number;    // 0–1
  accumulatedStress: number;
  soilMoisture: number;
  waterPumpRate: number;
  isBolting: boolean;
  stage: string;
}

function progressToStage(progress: number, cropType: string): string {
  const profile = CROP_PROFILES[cropType as keyof typeof CROP_PROFILES];
  if (!profile) return 'vegetative';
  const fracs = profile.stageFractions;
  const stages = ['seed', 'germination', 'vegetative', 'flowering', 'fruiting', 'harvest_ready'];
  let cum = 0;
  for (const s of stages) {
    cum += fracs[s as keyof typeof fracs] ?? 0;
    if (progress < cum) return s;
  }
  return 'harvest_ready';
}

// ─── Environmental shock sampling ─────────────────────────────────────────────

interface EnvState {
  airTemperature: number;
  humidity: number;
  co2Level: number;
  lightLevel: number;
  dustStormActive: boolean;
  dustFactor: number;
  dustOpacity: number;   // tau
  batteryKWh: number;
  batteryCapacity: number;
  solarFluxBase: number;
  heatingPower: number;
  lightingPower: number;
  waterRecyclingEfficiency: number;
}

function sampleDustStorm(env: EnvState, missionSol: number, rng: () => number): EnvState {
  const next = { ...env };

  // Dust storm inter-arrival: exponential with mean 50 sols (higher near perihelion Ls 250–310)
  // Simplified: use currentLs-based rate if available
  const baseRate = 1 / 50;
  const stormRate = baseRate; // Could be increased near perihelion

  if (!next.dustStormActive) {
    if (rng() < stormRate) {
      next.dustStormActive = true;
      // Storm opacity: uniform 1.5–4.0 for a moderate storm, occasionally severe
      next.dustOpacity = 1.5 + rng() * 2.5;
      // Duration varies: use 3–15 sol lifetime, sampled per-storm
    }
  } else {
    // Each sol, 12% chance the storm ends
    if (rng() < 0.12) {
      next.dustStormActive = false;
      next.dustOpacity = 0;
      next.dustFactor = 1.0;
    } else {
      // Beer-Lambert law: irradiance = I0 * exp(-tau)
      next.dustFactor = Math.exp(-next.dustOpacity);
    }
  }

  if (!next.dustStormActive) next.dustFactor = 1.0;
  return next;
}

function sampleEquipmentFailures(env: EnvState, rng: () => number): EnvState {
  const next = { ...env };

  // Each component: pump (MTBF ~200 sols), sensor (MTBF ~300 sols), heater (MTBF ~400 sols)
  // Simplified: single combined failure probability per sol
  if (rng() < 1 / 200) {
    // Water pump failure: reduce effective water delivery
    next.waterRecyclingEfficiency = Math.max(0.3, next.waterRecyclingEfficiency - 0.2);
  }
  if (rng() < 1 / 400) {
    // Heating element failure: reduce effective heating
    next.heatingPower = Math.max(0, next.heatingPower * 0.7);
  }

  return next;
}

// ─── Single scenario run ─────────────────────────────────────────────────────

function runScenario(
  snapshot: Record<string, unknown>,
  proposedActions: SimAction[],
  horizonSols: number,
  scenarioSeed: number,
): number {
  const rng = makeRng(scenarioSeed);

  // Extract state from snapshot with safe defaults
  const snap = snapshot as Record<string, unknown>;
  const crops = (snap.crops ?? {}) as Record<string, Record<string, unknown>>;

  // Build initial environment state
  let env: EnvState = {
    airTemperature: (snap.airTemperature as number) ?? 22,
    humidity: (snap.humidity as number) ?? 65,
    co2Level: (snap.co2Level as number) ?? 1000,
    lightLevel: (snap.lightLevel as number) ?? 25000,
    dustStormActive: (snap.dustStormActive as boolean) ?? false,
    dustFactor: (snap.dustStormFactor as number) ?? 1.0,
    dustOpacity: (snap.dustOpacity as number) ?? 0,
    batteryKWh: (snap.batteryStorageKWh as number) ?? 50,
    batteryCapacity: (snap.batteryCapacityKWh as number) ?? 100,
    solarFluxBase: (snap.seasonalSolarFlux as number) ?? 500,
    heatingPower: ((snap.greenhouseControls as Record<string, number>)?.globalHeatingPower as number) ?? 3000,
    lightingPower: ((snap.greenhouseControls as Record<string, number>)?.lightingPower as number) ?? 5000,
    waterRecyclingEfficiency: (snap.waterRecyclingEfficiency as number) ?? 0.9,
  };

  // Apply proposed actions to initial parameters
  for (const action of proposedActions) {
    if (action.type === 'greenhouse') {
      if (action.param === 'globalHeatingPower' && action.value !== undefined) env.heatingPower = action.value;
      if (action.param === 'lightingPower' && action.value !== undefined) env.lightingPower = action.value;
    }
  }

  // Build crop simulation states
  const cropStates: SimCropState[] = Object.entries(crops).map(([name, c]) => ({
    cropType: name,
    stageProgress: ((c.stageProgress as number) ?? 0),
    healthScore: ((c.healthScore as number) ?? 1.0),
    accumulatedStress: 0,
    soilMoisture: ((c.soilMoisture as number) ?? 65),
    waterPumpRate: (((c.controls as Record<string, number>)?.waterPumpRate) ?? 5),
    isBolting: ((c.isBolting as boolean) ?? false),
    stage: ((c.stage as string) ?? 'vegetative'),
  }));

  // Handle immediate harvest/replant actions
  for (const action of proposedActions) {
    if (action.type === 'harvest' && action.crop) {
      const cs = cropStates.find(c => c.cropType === action.crop);
      if (cs) cs.stage = 'harvested';
    }
    if (action.type === 'replant' && action.crop) {
      const cs = cropStates.find(c => c.cropType === action.crop);
      if (cs) { cs.stage = 'seed'; cs.stageProgress = 0; cs.healthScore = 1.0; }
    }
  }

  let totalYieldKg = 0;
  const missionSol = (snap.missionSol as number) ?? 0;

  for (let sol = 0; sol < horizonSols; sol++) {
    // Sample environmental shocks
    env = sampleDustStorm(env, missionSol + sol, rng);
    env = sampleEquipmentFailures(env, rng);

    // Solar flares: low-probability, high-impact
    if (rng() < 0.005) {
      env.lightLevel *= 1.2; // increased radiation multiplier (stress crops)
    }

    // Energy balance per sol (sol ≈ 24.6h, use 24h approx)
    const solarGenKW = env.solarFluxBase * env.dustFactor * 0.006; // 6 m² × efficiency
    const totalLoadKW = (env.heatingPower + env.lightingPower) / 1000;
    const energyBalanceKWh = (solarGenKW - totalLoadKW) * 24;
    env.batteryKWh = Math.max(0, Math.min(env.batteryCapacity, env.batteryKWh + energyBalanceKWh));

    // When energy deficit: reduce effective lighting (crop stress)
    const effectiveLightFactor = env.batteryKWh < env.batteryCapacity * 0.1 && energyBalanceKWh < 0
      ? 0.5
      : 1.0;

    // Update each crop
    for (const cs of cropStates) {
      if (cs.stage === 'harvested') continue;

      const profile = CROP_PROFILES[cs.cropType as keyof typeof CROP_PROFILES];
      if (!profile) continue;

      // Temperature stress (Gaussian response)
      const tempDev = (env.airTemperature - profile.optimalTemp) / profile.tempSigma;
      const moistureDev = (cs.soilMoisture - profile.optimalMoisture) / profile.moistureSigma;

      // Water availability (affected by recycling efficiency)
      const waterAvailable = cs.waterPumpRate * env.waterRecyclingEfficiency;
      const optimalWater = profile.waterLPerHourBase * 24;
      const waterStress = Math.max(0, (optimalWater - waterAvailable) / optimalWater);

      // Light stress
      const actualLightHours = (env.lightingPower / 5000) * profile.optimalLightHours * effectiveLightFactor;
      const lightStress = Math.max(0, (profile.optimalLightHours - actualLightHours) / profile.optimalLightHours);

      // Combined stress (0=no stress, 1=max stress)
      const instantStress = Math.min(1,
        0.3 * Math.abs(tempDev) +
        0.2 * Math.abs(moistureDev) +
        0.3 * waterStress +
        0.2 * lightStress
      );

      // Accumulated stress decays 15% per sol (spec §7.3)
      cs.accumulatedStress = cs.accumulatedStress * 0.85 + instantStress * 0.15;

      // Health degrades with accumulated stress
      cs.healthScore = Math.max(0, cs.healthScore - cs.accumulatedStress * 0.05);

      // Growth factor: Gaussian response × health × no-bolting check
      const growthFactor =
        Math.exp(-0.5 * tempDev ** 2) *
        Math.exp(-0.5 * moistureDev ** 2) *
        cs.healthScore *
        (cs.isBolting ? 0.3 : 1.0);

      // Advance stage progress (1/growthCycleSols per sol at full rate)
      const dailyProgress = growthFactor / profile.growthCycleSols;
      cs.stageProgress = Math.min(1, cs.stageProgress + dailyProgress);
      cs.stage = progressToStage(cs.stageProgress, cs.cropType);

      // Bolting check (temperature threshold)
      if (env.airTemperature > profile.boltingTempThreshold && rng() < 0.1) {
        cs.isBolting = true;
      }

      // Harvest when ready
      if (cs.stage === 'harvest_ready') {
        const yieldKg = profile.maxYieldKgPerPlant * profile.plantsPerTile * profile.harvestIndex * cs.healthScore;
        totalYieldKg += yieldKg;
        // Auto-replant in simulation (continuous production assumption)
        cs.stage = 'seed';
        cs.stageProgress = 0;
        cs.healthScore = 1.0;
        cs.accumulatedStress = 0;
        cs.isBolting = false;
      }
    }
  }

  // Survival probability: can crew be fed?
  // Crew needs ~10,000 kcal/day = ~4.3 kg calories-dense food per sol (rough estimate)
  // Over horizonSols, minimum viable = 3 kg/sol * horizonSols (partial supplement)
  // The yield is a supplement, not the entire food supply
  return totalYieldKg;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run Monte Carlo simulation and return P10/P90/mean yield distribution.
 *
 * P10 is the primary scoring metric per spec §2 ("Optimise for the tail, not the mean").
 */
export function runSimulation(params: SimulationParams): SimulationResult {
  const { snapshot, proposedActions, horizonSols, scenarioCount } = params;

  const yields: number[] = [];
  const baseSeed = Date.now() % 0x7fffffff;

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

  // Survival probability: fraction of scenarios with yield > minimum viable threshold
  // Minimum: 2 kg/sol supplemental production (partial mission food contribution)
  const minViable = horizonSols * 2;
  const survivingScenarios = yields.filter(y => y >= minViable).length;
  const p10SurvivalProbability = survivingScenarios / scenarioCount;

  return {
    p10YieldKg,
    p90YieldKg,
    meanYieldKg,
    p10SurvivalProbability,
    scenarioYields: yields,
  };
}

/**
 * Run the do-nothing counterfactual baseline.
 * Agent only acts if its proposed action beats inaction by a meaningful margin (spec §7.1).
 */
export function runBaseline(snapshot: Record<string, unknown>, horizonSols: number, scenarioCount: number): SimulationResult {
  return runSimulation({ snapshot, proposedActions: [], horizonSols, scenarioCount });
}
