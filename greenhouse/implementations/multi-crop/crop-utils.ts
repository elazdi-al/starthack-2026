/**
 * Shared crop utilities — extracted to break the circular dependency
 * between initial.ts and simulation.ts.
 *
 * This module contains pure functions and types that both initial.ts,
 * simulation.ts, and transformation.ts need. It only depends on
 * types.ts and profiles.ts (leaf modules with no intra-module imports).
 */

import type {
  CropType, CropEnvironment, GrowthStage, TileCropEnvironment,
} from './types';
import { ALL_CROP_TYPES, GROWTH_STAGES } from './types';
import { CROP_PROFILES } from './profiles';

// ─── Seeded pseudo-random (mulberry32) ───────────────────────────────────────

export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

/** Box-Muller transform for Gaussian samples from a seeded uniform RNG. */
export function gaussianSample(rng: () => number, mean: number, stddev: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

/** Hash a string into a 32-bit integer (FNV-1a). */
export function hashTileId(tileId: string): number {
  let h = 2166136261;
  for (let i = 0; i < tileId.length; i++) {
    h ^= tileId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ─── Per-tile genetic identity generation ────────────────────────────────────

export interface GeneticFactors {
  optimalTempFactor: number;
  optimalMoistureFactor: number;
  growthRateFactor: number;
  maxYieldFactor: number;
  boltingThresholdFactor: number;
  stressResilienceFactor: number;
  waterEfficiencyFactor: number;
}

export function generateGeneticFactors(seed: number, ct: CropType): GeneticFactors {
  const gv = CROP_PROFILES[ct].geneticVariance;
  const rng = makeRng(seed);
  return {
    optimalTempFactor:       Math.max(0.80, gaussianSample(rng, 1.0, gv.optimalTempCV)),
    optimalMoistureFactor:   Math.max(0.80, gaussianSample(rng, 1.0, gv.optimalMoistureCV)),
    growthRateFactor:        Math.max(0.70, gaussianSample(rng, 1.0, gv.growthRateCV)),
    maxYieldFactor:          Math.max(0.60, gaussianSample(rng, 1.0, gv.maxYieldCV)),
    boltingThresholdFactor:  Math.max(0.85, gaussianSample(rng, 1.0, gv.boltingThresholdCV)),
    stressResilienceFactor:  Math.max(0.70, gaussianSample(rng, 1.0, gv.stressResilienceCV)),
    waterEfficiencyFactor:   Math.max(0.75, gaussianSample(rng, 1.0, gv.waterEfficiencyCV)),
  };
}

// ─── Crop building ───────────────────────────────────────────────────────────

export function buildCropAtProgress(ct: CropType, fraction: number): CropEnvironment {
  const profile = CROP_PROFILES[ct];

  // Fraction 0 means unplanted — return an empty/harvested tile
  if (fraction <= 0) {
    return {
      soilMoisture: profile.optimalMoisture,
      soilTemperature: profile.optimalTemp,
      stage: 'harvested',
      stageProgress: 0,
      daysSincePlanting: 0,
      healthScore: 0,
      stressAccumulator: 0,
      biomassKg: 0,
      estimatedYieldKg: 0,
      plantGrowth: 0,
      leafArea: 0,
      fruitCount: 0,
      rootO2Level: 90,
      nutrientEC: 2.0,
      diseaseRisk: 0,
      isBolting: false,
      boltingHoursAccumulated: 0,
    };
  }

  let accumulated = 0;
  let stage: GrowthStage = 'seed';
  let stageProgress = 0;

  for (const s of GROWTH_STAGES) {
    const sf = profile.stageFractions[s] || 0;
    if (accumulated + sf > fraction) {
      stage = s;
      stageProgress = (fraction - accumulated) / sf;
      break;
    }
    accumulated += sf;
    stage = s;
    stageProgress = 1;
  }

  const daysSincePlanting = fraction * profile.growthCycleSols;
  const totalProgress = fraction;
  const maxBiomass = profile.maxYieldKgPerPlant * profile.plantsPerTile;
  const biomassKg = maxBiomass * totalProgress;
  const estimatedYieldKg = biomassKg * profile.harvestIndex;

  return {
    soilMoisture: profile.optimalMoisture,
    soilTemperature: profile.optimalTemp,
    stage,
    stageProgress,
    daysSincePlanting,
    healthScore: 1,
    stressAccumulator: 0,
    biomassKg,
    estimatedYieldKg,
    plantGrowth: totalProgress * 100,
    leafArea: totalProgress * profile.plantsPerTile * 0.02,
    fruitCount: (stage === 'fruiting' || stage === 'harvest_ready')
      ? Math.floor(profile.plantsPerTile * stageProgress * 0.8)
      : 0,
    rootO2Level: 90,
    nutrientEC: 2.0,
    diseaseRisk: 0,
    isBolting: false,
    boltingHoursAccumulated: 0,
  };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregate per-tile states into per-type averages.
 * Used to keep backward-compatible `crops: Record<CropType, CropEnvironment>`.
 */
export function aggregateTileCrops(tileCrops: Record<string, TileCropEnvironment>): Record<CropType, CropEnvironment> {
  const sums: Record<string, {
    total: CropEnvironment;
    count: number;
    stageCounts: Record<string, number>;
    anyBolting: boolean;
  }> = {};

  for (const tile of Object.values(tileCrops)) {
    const ct = tile.cropType;
    if (!sums[ct]) {
      sums[ct] = {
        total: { ...tile },
        count: 1,
        stageCounts: { [tile.stage]: 1 },
        anyBolting: tile.isBolting,
      };
    } else {
      const t = sums[ct].total;
      t.soilMoisture += tile.soilMoisture;
      t.soilTemperature += tile.soilTemperature;
      t.healthScore += tile.healthScore;
      t.stressAccumulator += tile.stressAccumulator;
      t.biomassKg += tile.biomassKg;
      t.estimatedYieldKg += tile.estimatedYieldKg;
      t.plantGrowth += tile.plantGrowth;
      t.leafArea += tile.leafArea;
      t.fruitCount += tile.fruitCount;
      t.rootO2Level += tile.rootO2Level;
      t.nutrientEC += tile.nutrientEC;
      t.diseaseRisk += tile.diseaseRisk;
      t.daysSincePlanting += tile.daysSincePlanting;
      t.stageProgress += tile.stageProgress;
      t.boltingHoursAccumulated += tile.boltingHoursAccumulated;
      sums[ct].count++;
      sums[ct].stageCounts[tile.stage] = (sums[ct].stageCounts[tile.stage] ?? 0) + 1;
      if (tile.isBolting) sums[ct].anyBolting = true;
    }
  }

  const result = {} as Record<CropType, CropEnvironment>;
  for (const ct of ALL_CROP_TYPES) {
    if (!sums[ct]) {
      // Fallback: no tiles of this type — build default (unplanted)
      result[ct] = buildCropAtProgress(ct, 0);
      continue;
    }
    const { total: t, count: n, stageCounts, anyBolting } = sums[ct];

    // Determine the most common stage across tiles of this type
    let mostCommonStage: GrowthStage = 'seed';
    let maxStageCount = 0;
    for (const [s, cnt] of Object.entries(stageCounts)) {
      if (cnt > maxStageCount) {
        maxStageCount = cnt;
        mostCommonStage = s as GrowthStage;
      }
    }

    result[ct] = {
      // Averaged values (per-tile metrics)
      soilMoisture: t.soilMoisture / n,
      soilTemperature: t.soilTemperature / n,
      stageProgress: t.stageProgress / n,
      daysSincePlanting: t.daysSincePlanting / n,
      healthScore: t.healthScore / n,
      stressAccumulator: t.stressAccumulator / n,
      plantGrowth: t.plantGrowth / n,
      rootO2Level: t.rootO2Level / n,
      nutrientEC: t.nutrientEC / n,
      diseaseRisk: t.diseaseRisk / n,
      boltingHoursAccumulated: t.boltingHoursAccumulated / n,
      // Summed values (totals across all tiles of this type)
      biomassKg: t.biomassKg,
      estimatedYieldKg: t.estimatedYieldKg,
      leafArea: t.leafArea,
      fruitCount: t.fruitCount,
      // Correctly aggregated discrete values
      stage: mostCommonStage,
      isBolting: anyBolting,
    };
  }
  return result;
}
