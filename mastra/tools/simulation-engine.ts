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
import type { CropProfile } from '../../greenhouse/implementations/multi-crop/profiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimAction {
  type: 'greenhouse' | 'crop' | 'harvest' | 'replant' | 'harvest-tile' | 'plant-tile' | 'clear-tile';
  param?: string;
  value?: number;
  crop?: string;
  tileId?: string;
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

// ─── Box-Muller Gaussian from uniform RNG ────────────────────────────────────

function gaussianSample(rng: () => number, mean: number, stddev: number): number {
  // Box-Muller transform — generates a standard normal from two uniforms
  const u1 = Math.max(1e-10, rng()); // avoid log(0)
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

// ─── Per-individual genetic identity ─────────────────────────────────────────

/**
 * Genetic identity for a single crop individual. These are fixed at "planting time"
 * (entity creation) and remain constant for the plant's lifetime. They perturb the
 * species-level CropProfile to create realistic intra-population variance.
 *
 * All values are multiplicative factors centred on 1.0:
 *   effectiveParam = profile.param × geneticFactor
 *
 * Example: optimalTempFactor of 1.05 means this individual prefers 5% warmer temps.
 */
interface GeneticIdentity {
  optimalTempFactor: number;
  optimalMoistureFactor: number;
  growthRateFactor: number;       // affects growthCycleSols inversely (faster = lower cycle)
  maxYieldFactor: number;
  boltingThresholdFactor: number;
  stressResilienceFactor: number; // higher = slower healthScore decay
  waterEfficiencyFactor: number;  // higher = needs less water
}

/**
 * Generate a genetic identity for a single crop individual.
 * Uses a dedicated RNG seeded uniquely per individual so that:
 *  - The same individual always gets the same genetics (deterministic)
 *  - Different individuals of the same species diverge
 *  - Re-running with the same scenario seed reproduces identical populations
 */
function generateGeneticIdentity(
  individualSeed: number,
  gv: CropProfile['geneticVariance'],
): GeneticIdentity {
  const gRng = makeRng(individualSeed);
  return {
    optimalTempFactor:       Math.max(0.8, gaussianSample(gRng, 1.0, gv.optimalTempCV)),
    optimalMoistureFactor:   Math.max(0.8, gaussianSample(gRng, 1.0, gv.optimalMoistureCV)),
    growthRateFactor:        Math.max(0.7, gaussianSample(gRng, 1.0, gv.growthRateCV)),
    maxYieldFactor:          Math.max(0.6, gaussianSample(gRng, 1.0, gv.maxYieldCV)),
    boltingThresholdFactor:  Math.max(0.85, gaussianSample(gRng, 1.0, gv.boltingThresholdCV)),
    stressResilienceFactor:  Math.max(0.7, gaussianSample(gRng, 1.0, gv.stressResilienceCV)),
    waterEfficiencyFactor:   Math.max(0.75, gaussianSample(gRng, 1.0, gv.waterEfficiencyCV)),
  };
}

// ─── Crop state for simulation ───────────────────────────────────────────────

interface SimCropState {
  cropType: string;
  instanceId: string;         // unique identifier: "{cropType}#{index}"
  genetics: GeneticIdentity;  // per-individual genetic perturbations
  stageProgress: number;      // 0–1 through entire growth cycle
  healthScore: number;        // 0–1
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

  // Build crop simulation states — each crop type is expanded into individual
  // plant entities, each with unique genetic identity. This ensures that two
  // plants of the same species in identical conditions diverge due to genetic
  // variation (different optimal temps, growth rates, yield potential, etc.).
  //
  // For simulation performance, we model a representative sample of individuals
  // per tile rather than every single plant. We use min(plantsPerTile, 6) reps
  // and scale yield proportionally. This keeps the simulation tractable while
  // preserving meaningful per-individual variance.

  const cropStates: SimCropState[] = [];

  // Derive a stable per-scenario genetic base seed. We mix the scenario seed
  // with a large prime so genetic seeds are independent from environmental RNG.
  const geneticBaseSeed = (scenarioSeed * 2654435761) >>> 0;

  for (const [name, c] of Object.entries(crops)) {
    const profile = CROP_PROFILES[name as keyof typeof CROP_PROFILES];
    if (!profile) continue;

    // Number of representative individuals to simulate per tile
    const repsPerTile = Math.min(profile.plantsPerTile, 6);

    for (let i = 0; i < repsPerTile; i++) {
      // Unique seed per individual: hash(geneticBase, cropName, individualIndex)
      // Using FNV-1a-like mixing for good distribution
      let individualSeed = geneticBaseSeed;
      for (let ci = 0; ci < name.length; ci++) {
        individualSeed ^= name.charCodeAt(ci);
        individualSeed = Math.imul(individualSeed, 16777619) >>> 0;
      }
      individualSeed = (individualSeed + i * 0x9e3779b9) >>> 0;

      const genetics = generateGeneticIdentity(individualSeed, profile.geneticVariance);

      // Jitter initial conditions per individual (same seed gives reproducible jitter)
      const jitterRng = makeRng(individualSeed ^ 0xdeadbeef);
      const baseProgress = (c.stageProgress as number) ?? 0;
      const progressJitter = (jitterRng() - 0.5) * 0.06; // ±3% progress
      const baseMoisture = (c.soilMoisture as number) ?? 65;
      const moistureJitter = (jitterRng() - 0.5) * 6; // ±3 percentage points
      const healthJitter = jitterRng() * 0.06; // 0–6% initial health variation
      const stressJitter = jitterRng() * 0.5;  // 0–0.5 background stress

      cropStates.push({
        cropType: name,
        instanceId: `${name}#${i}`,
        genetics,
        stageProgress: Math.max(0, Math.min(1, baseProgress + progressJitter)),
        healthScore: Math.max(0.88, ((c.healthScore as number) ?? 1.0) - healthJitter),
        accumulatedStress: stressJitter,
        soilMoisture: Math.max(10, Math.min(100, baseMoisture + moistureJitter)),
        waterPumpRate: (((c.controls as Record<string, number>)?.waterPumpRate) ?? 5),
        isBolting: ((c.isBolting as boolean) ?? false),
        stage: ((c.stage as string) ?? 'vegetative'),
      });
    }
  }

  // Handle immediate harvest/replant actions (applied to all individuals of the crop type)
  // Also handles tile-level actions (harvest-tile, plant-tile, clear-tile)
  for (const action of proposedActions) {
    if (action.type === 'harvest' && action.crop) {
      for (const cs of cropStates) {
        if (cs.cropType === action.crop) cs.stage = 'harvested';
      }
    }
    if (action.type === 'harvest-tile' && action.tileId) {
      // In simulation, tile-level harvest maps to harvesting individuals of the target crop
      // Since simulation uses representative individuals rather than actual tiles,
      // harvest one individual matching the tile's crop type
      const tileCrop = action.crop;
      if (tileCrop) {
        const target = cropStates.find(cs => cs.cropType === tileCrop && cs.stage !== 'harvested');
        if (target) target.stage = 'harvested';
      }
    }
    if (action.type === 'replant' && action.crop) {
      for (const cs of cropStates) {
        if (cs.cropType === action.crop) {
          cs.stage = 'seed';
          cs.stageProgress = 0;
          cs.healthScore = 1.0;
          // Generate fresh genetics for the new plant generation
          let replantSeed = (scenarioSeed * 0x45d9f3b + cs.instanceId.length) >>> 0;
          for (let ci = 0; ci < cs.instanceId.length; ci++) {
            replantSeed ^= cs.instanceId.charCodeAt(ci);
            replantSeed = Math.imul(replantSeed, 16777619) >>> 0;
          }
          const profile = CROP_PROFILES[cs.cropType as keyof typeof CROP_PROFILES];
          if (profile) {
            cs.genetics = generateGeneticIdentity(replantSeed, profile.geneticVariance);
          }
        }
      }
    }
    if (action.type === 'plant-tile' && action.crop) {
      // In simulation, planting a tile adds a new crop individual
      const profile = CROP_PROFILES[action.crop as keyof typeof CROP_PROFILES];
      if (profile) {
        const repsPerTile = Math.min(profile.plantsPerTile, 6);
        let plantSeed = (scenarioSeed * 0x85ebca6b) >>> 0;
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
          healthScore: 1.0,
          accumulatedStress: 0,
          soilMoisture: profile.optimalMoisture ?? 65,
          waterPumpRate: 8,
          isBolting: false,
          stage: 'seed',
        });
      }
    }
    if (action.type === 'clear-tile' && action.tileId) {
      // In simulation, clearing a tile removes one individual of the crop type
      const tileCrop = action.crop;
      if (tileCrop) {
        const idx = cropStates.findIndex(cs => cs.cropType === tileCrop && cs.stage !== 'harvested');
        if (idx >= 0) cropStates.splice(idx, 1);
      }
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

    // Update each crop individual
    for (const cs of cropStates) {
      if (cs.stage === 'harvested') continue;

      const profile = CROP_PROFILES[cs.cropType as keyof typeof CROP_PROFILES];
      if (!profile) continue;

      const g = cs.genetics;

      // Genetically-adjusted parameters for this individual
      const effectiveOptimalTemp = profile.optimalTemp * g.optimalTempFactor;
      const effectiveOptimalMoisture = profile.optimalMoisture * g.optimalMoistureFactor;
      const effectiveGrowthCycleSols = profile.growthCycleSols / g.growthRateFactor; // faster grower = shorter cycle
      const effectiveBoltingThreshold = profile.boltingTempThreshold * g.boltingThresholdFactor;
      const effectiveWaterBase = profile.waterLPerHourBase / g.waterEfficiencyFactor; // efficient = needs less

      // Temperature stress (Gaussian response) — uses this individual's optimal
      const tempDev = (env.airTemperature - effectiveOptimalTemp) / profile.tempSigma;
      const moistureDev = (cs.soilMoisture - effectiveOptimalMoisture) / profile.moistureSigma;

      // Water availability (affected by recycling efficiency)
      const waterAvailable = cs.waterPumpRate * env.waterRecyclingEfficiency;
      const optimalWater = effectiveWaterBase * 24;
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

      // Health degrades with accumulated stress — modulated by genetic resilience
      // Higher stressResilienceFactor = slower degradation
      const healthDecayRate = 0.05 / g.stressResilienceFactor;
      cs.healthScore = Math.max(0, cs.healthScore - cs.accumulatedStress * healthDecayRate);

      // Growth factor: Gaussian response × health × no-bolting check
      const growthFactor =
        Math.exp(-0.5 * tempDev ** 2) *
        Math.exp(-0.5 * moistureDev ** 2) *
        cs.healthScore *
        (cs.isBolting ? 0.3 : 1.0);

      // Advance stage progress (uses genetically-adjusted cycle length)
      const dailyProgress = growthFactor / effectiveGrowthCycleSols;
      cs.stageProgress = Math.min(1, cs.stageProgress + dailyProgress);
      cs.stage = progressToStage(cs.stageProgress, cs.cropType);

      // Bolting check (uses this individual's genetically-adjusted threshold)
      if (env.airTemperature > effectiveBoltingThreshold && rng() < 0.1) {
        cs.isBolting = true;
      }

      // Harvest when ready — yield scaled by genetic maxYieldFactor and
      // proportioned to represent all plants in the tile
      if (cs.stage === 'harvest_ready') {
        const repsPerTile = Math.min(profile.plantsPerTile, 6);
        const plantsRepresented = profile.plantsPerTile / repsPerTile;
        const individualYieldKg =
          profile.maxYieldKgPerPlant * g.maxYieldFactor *
          profile.harvestIndex * cs.healthScore;
        totalYieldKg += individualYieldKg * plantsRepresented;

        // Auto-replant in simulation (continuous production assumption)
        // New plant generation gets fresh genetics
        cs.stage = 'seed';
        cs.stageProgress = 0;
        cs.healthScore = 1.0;
        cs.accumulatedStress = 0;
        cs.isBolting = false;

        // Derive new genetic seed for the replanted individual
        let replantSeed = (scenarioSeed * 0x45d9f3b + sol * 0x9e3779b9) >>> 0;
        for (let ci = 0; ci < cs.instanceId.length; ci++) {
          replantSeed ^= cs.instanceId.charCodeAt(ci);
          replantSeed = Math.imul(replantSeed, 16777619) >>> 0;
        }
        cs.genetics = generateGeneticIdentity(replantSeed, profile.geneticVariance);
      }
    }
  }

  // Survival probability: can crew be fed?
  // Crew needs ~12,000 kcal/day = ~5.2 kg calorie-dense food per sol (rough estimate)
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
