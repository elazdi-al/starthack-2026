import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import {
  GreenhouseActionSchema,
  ReasonOutputSchema,
  SituationReportSchema,
  SnapshotSchema,
} from '../workflows/greenhouse-control';

const CropNameSchema = z.enum([
  'lettuce',
  'tomato',
  'potato',
  'soybean',
  'spinach',
  'wheat',
  'radish',
  'kale',
]);

const CROP_NAMES = CropNameSchema.options;
type CropName = z.infer<typeof CropNameSchema>;
type WorkflowInput = z.infer<typeof SnapshotSchema>;
type WorkflowOutput = z.infer<typeof ReasonOutputSchema>;
type AssessOutput = z.infer<typeof SituationReportSchema>;
type Action = z.infer<typeof GreenhouseActionSchema>;
type CropControlSnapshot = {
  controls?: {
    waterPumpRate?: number;
  };
};

type ScenarioExpectations = {
  requireAnyAction?: boolean;
  requireBatchPlanting?: boolean;
  minPlantCount?: number;
  minDistinctPlantCrops?: number;
  preferredPlantCrops?: CropName[];
  minPreferredPlantCrops?: number;
  requireHarvestReadyHandling?: boolean;
  requireCo2Mitigation?: boolean;
  requireEnergyMitigation?: boolean;
  requireWaterMitigation?: boolean;
  requireDiseaseMitigation?: boolean;
  forbidEnergyIncrease?: boolean;
  maxActions?: number;
};

export type GreenhouseControlScenarioGroundTruth = {
  scenarioId: string;
  scenarioName: string;
  category: string;
  variant: number;
  expectations: ScenarioExpectations;
};

const GREENHOUSE_PARAM_RANGES = {
  globalHeatingPower: [0, 10_000],
  co2InjectionRate: [0, 200],
  ventilationRate: [0, 500],
  lightingPower: [0, 10_000],
} as const;

const CROP_PARAM_RANGES = {
  waterPumpRate: [0, 30],
  localHeatingPower: [0, 1_000],
} as const;

function normalizeStringArray(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function arraysMatch(actual: string[], expected: string[]): boolean {
  return JSON.stringify(normalizeStringArray(actual)) === JSON.stringify(normalizeStringArray(expected));
}

function deriveExpectedAssess(snapshot: WorkflowInput | undefined) {
  const source = snapshot ?? {};
  const energyDeficit = (source.energyDeficit as boolean | undefined) ?? false;
  const co2SafetyAlert = (source.co2SafetyAlert as boolean | undefined) ?? false;
  const waterRecyclingEfficiency = (source.waterRecyclingEfficiency as number | undefined) ?? 1;
  const dustStormActive = (source.dustStormActive as boolean | undefined) ?? false;
  const nutritionalCoverage = (source.nutritionalCoverage as number | undefined) ?? 1;
  const crops = (source.crops ?? {}) as Record<string, {
    stage?: string;
    diseaseRisk?: number;
    rootO2Level?: number;
    nutrientEC?: number;
    isBolting?: boolean;
  }>;
  const tileCrops = (source.tileCrops ?? {}) as Record<string, {
    stage?: string;
    diseaseRisk?: number;
    healthScore?: number;
  }>;

  const cropEntries = Object.entries(crops);
  const tileEntries = Object.entries(tileCrops);

  const cropsAtHarvestReady = cropEntries
    .filter(([, crop]) => crop.stage === 'harvest_ready')
    .map(([name]) => name);

  const cropsWithHighDisease = cropEntries
    .filter(([, crop]) => (crop.diseaseRisk ?? 0) > 0.4)
    .map(([name]) => name);

  const cropsWithLowO2 = cropEntries
    .filter(([, crop]) => (crop.rootO2Level ?? 100) < 60)
    .map(([name]) => name);

  const cropsWithHighEC = cropEntries
    .filter(([, crop]) => (crop.nutrientEC ?? 2) > 3.5)
    .map(([name]) => name);

  const boltingCrops = cropEntries
    .filter(([, crop]) => crop.isBolting)
    .map(([name]) => name);

  const tilesAtHarvestReady = tileEntries
    .filter(([, tile]) => tile.stage === 'harvest_ready')
    .map(([tileId]) => tileId);

  const tilesWithHighDisease = tileEntries
    .filter(([, tile]) => (tile.diseaseRisk ?? 0) > 0.4)
    .map(([tileId]) => tileId);

  const tilesWithLowHealth = tileEntries
    .filter(([, tile]) => (tile.healthScore ?? 1) < 0.5 && tile.stage !== 'harvested')
    .map(([tileId]) => tileId);

  const flags = {
    energyDeficit,
    co2SafetyAlert,
    waterRecyclingLow: waterRecyclingEfficiency < 0.8,
    dustStormActive,
    nutritionLow: nutritionalCoverage < 0.7,
  };

  const criticalCount = [
    flags.energyDeficit,
    flags.co2SafetyAlert,
    cropsAtHarvestReady.length > 0,
    cropsWithHighDisease.length > 0,
  ].filter(Boolean).length;

  const urgencyLevel =
    criticalCount >= 3 ? 'critical'
    : criticalCount >= 2 ? 'high'
    : criticalCount >= 1 ? 'medium'
    : 'low';

  return {
    flags,
    cropsAtHarvestReady,
    cropsWithHighDisease,
    cropsWithLowO2,
    cropsWithHighEC,
    boltingCrops,
    tilesAtHarvestReady,
    tilesWithHighDisease,
    tilesWithLowHealth,
    urgencyLevel,
  };
}

function analyzeAssessOutput(input: WorkflowInput | undefined, output: AssessOutput | undefined) {
  if (!output) {
    return {
      score: 0,
      reason: 'Assess step did not return an output payload.',
    };
  }

  const expected = deriveExpectedAssess(input);
  const checks = [
    { label: 'flags', pass: JSON.stringify(output.flags) === JSON.stringify(expected.flags) },
    { label: 'cropsAtHarvestReady', pass: arraysMatch(output.cropsAtHarvestReady, expected.cropsAtHarvestReady) },
    { label: 'cropsWithHighDisease', pass: arraysMatch(output.cropsWithHighDisease, expected.cropsWithHighDisease) },
    { label: 'cropsWithLowO2', pass: arraysMatch(output.cropsWithLowO2, expected.cropsWithLowO2) },
    { label: 'cropsWithHighEC', pass: arraysMatch(output.cropsWithHighEC, expected.cropsWithHighEC) },
    { label: 'boltingCrops', pass: arraysMatch(output.boltingCrops, expected.boltingCrops) },
    { label: 'tilesAtHarvestReady', pass: arraysMatch(output.tilesAtHarvestReady, expected.tilesAtHarvestReady) },
    { label: 'tilesWithHighDisease', pass: arraysMatch(output.tilesWithHighDisease, expected.tilesWithHighDisease) },
    { label: 'tilesWithLowHealth', pass: arraysMatch(output.tilesWithLowHealth, expected.tilesWithLowHealth) },
    { label: 'urgencyLevel', pass: output.urgencyLevel === expected.urgencyLevel },
  ];

  const passedChecks = checks.filter(check => check.pass).length;
  const failed = checks.filter(check => !check.pass).map(check => check.label);

  return {
    score: checks.length === 0 ? 1 : passedChecks / checks.length,
    reason: failed.length === 0 ? 'Assess step matches the deterministic snapshot-derived expectations.' : `Assess step mismatches: ${failed.join(', ')}`,
  };
}

function isCropName(value: string | undefined): value is CropName {
  return !!value && CROP_NAMES.includes(value as CropName);
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function collectActionStats(snapshot: WorkflowInput, actions: Action[]) {
  const plantedTiles = new Set<string>();
  const plantedCrops = new Set<CropName>();
  const harvestedTiles = new Set<string>();
  const clearedTiles = new Set<string>();
  const harvestedCrops = new Set<string>();
  const greenhouseParamTargets = new Map<string, number>();
  const cropParamTargets = new Map<string, number>();
  const duplicatePlantTargets = new Set<string>();
  let hasBatchPlanting = false;
  let increasesCriticalPower = false;
  let lowersLighting = false;
  let lowersHeating = false;
  let raisesVentilation = false;
  let lowersCo2Injection = false;

  for (const action of actions) {
    if (action.type === 'harvest' && action.crop) {
      harvestedCrops.add(action.crop);
    }

    if (action.type === 'batch-tile') {
      if (action.harvests?.length) {
        for (const tileId of action.harvests) harvestedTiles.add(tileId);
      }
      if (action.clears?.length) {
        for (const tileId of action.clears) clearedTiles.add(tileId);
      }
      if (action.plants?.length) {
        hasBatchPlanting = true;
        for (const plant of action.plants) {
          if (plantedTiles.has(plant.tileId)) duplicatePlantTargets.add(plant.tileId);
          plantedTiles.add(plant.tileId);
          if (isCropName(plant.crop)) plantedCrops.add(plant.crop);
        }
      }
    }

    if (action.type === 'greenhouse' && action.param && action.value !== undefined) {
      greenhouseParamTargets.set(action.param, (greenhouseParamTargets.get(action.param) ?? 0) + 1);
      const controls = (snapshot.greenhouseControls ?? {}) as Record<string, number>;
      if (action.param === 'lightingPower') {
        lowersLighting ||= action.value < (controls.lightingPower ?? 0);
        increasesCriticalPower ||= action.value > (controls.lightingPower ?? 0);
      }
      if (action.param === 'globalHeatingPower') {
        lowersHeating ||= action.value < (controls.globalHeatingPower ?? 0);
        increasesCriticalPower ||= action.value > (controls.globalHeatingPower ?? 0);
      }
      if (action.param === 'ventilationRate') {
        raisesVentilation ||= action.value > (controls.ventilationRate ?? 0);
      }
      if (action.param === 'co2InjectionRate') {
        lowersCo2Injection ||= action.value < (controls.co2InjectionRate ?? 0);
      }
    }

    if (action.type === 'crop' && action.crop && action.param) {
      cropParamTargets.set(`${action.crop}:${action.param}`, (cropParamTargets.get(`${action.crop}:${action.param}`) ?? 0) + 1);
    }
  }

  const readyTileIds = new Set(
    Object.values((snapshot.tileCrops ?? {}) as Record<string, { tileId: string; stage?: string }>)
      .filter(tile => tile.stage === 'harvest_ready')
      .map(tile => tile.tileId),
  );

  const readyCrops = new Set(
    Object.entries((snapshot.crops ?? {}) as Record<string, { stage?: string }>)
      .filter(([, crop]) => crop?.stage === 'harvest_ready')
      .map(([crop]) => crop),
  );

  const diseasedTileIds = new Set(
    Object.values((snapshot.tileCrops ?? {}) as Record<string, { tileId: string; diseaseRisk?: number }>)
      .filter(tile => (tile.diseaseRisk ?? 0) > 0.4)
      .map(tile => tile.tileId),
  );

  const diseasedCrops = new Set(
    Object.entries((snapshot.crops ?? {}) as Record<string, { diseaseRisk?: number }>)
      .filter(([, crop]) => (crop?.diseaseRisk ?? 0) > 0.4)
      .map(([crop]) => crop),
  );

  const waterStressCrops = new Set(
    Object.entries((snapshot.crops ?? {}) as Record<string, { rootO2Level?: number; nutrientEC?: number }>)
      .filter(([, crop]) => (crop?.rootO2Level ?? 100) < 60 || (crop?.nutrientEC ?? 0) > 3.5)
      .map(([crop]) => crop),
  );

  const waterReducedCrops = new Set(
    actions
      .filter(action => action.type === 'crop' && action.param === 'waterPumpRate' && action.crop && action.value !== undefined)
      .filter((action) => {
        const crops = (snapshot.crops ?? {}) as Record<string, CropControlSnapshot>;
        const controls = crops[action.crop as CropName]?.controls ?? {};
        return action.value! < (controls.waterPumpRate ?? 0);
      })
      .map(action => action.crop!),
  );

  const targetedDiseaseMitigation = [...diseasedTileIds].some(tileId => harvestedTiles.has(tileId) || clearedTiles.has(tileId))
    || [...diseasedCrops].some(crop => harvestedCrops.has(crop))
    || raisesVentilation;

  const targetedHarvestHandling = [...readyTileIds].some(tileId => harvestedTiles.has(tileId))
    || [...readyCrops].some(crop => harvestedCrops.has(crop));

  const targetedWaterMitigation = [...waterStressCrops].some(crop => waterReducedCrops.has(crop))
    || [...diseasedTileIds].some(tileId => harvestedTiles.has(tileId) || clearedTiles.has(tileId));

  return {
    totalPlants: plantedTiles.size,
    distinctPlantCrops: plantedCrops,
    harvestedTiles,
    harvestedCrops,
    duplicateGreenhouseTargets: [...greenhouseParamTargets.entries()].filter(([, count]) => count > 1).map(([param]) => param),
    duplicateCropTargets: [...cropParamTargets.entries()].filter(([, count]) => count > 1).map(([param]) => param),
    duplicatePlantTargets: [...duplicatePlantTargets],
    hasBatchPlanting,
    lowersLighting,
    lowersHeating,
    raisesVentilation,
    lowersCo2Injection,
    increasesCriticalPower,
    handlesHarvestReady: readyTileIds.size === 0 && readyCrops.size === 0 ? true : targetedHarvestHandling,
    handlesDiseaseRisk: diseasedTileIds.size === 0 && diseasedCrops.size === 0 ? true : targetedDiseaseMitigation,
    handlesWaterStress: waterStressCrops.size === 0 ? true : targetedWaterMitigation,
  };
}

function analyzeActionSafety(input: WorkflowInput | undefined, output: WorkflowOutput | undefined) {
  if (!output) {
    return {
      score: 0,
      reason: 'Workflow did not return an output payload.',
    };
  }

  const snapshot = input ?? {};
  const issues: string[] = [];
  const actions = output.actions ?? [];
  const stats = collectActionStats(snapshot, actions);

  if (!output.summary.trim()) issues.push('summary is empty');
  if (!output.reasoning.trim()) issues.push('reasoning is empty');
  if (stats.duplicateGreenhouseTargets.length > 0) issues.push(`duplicate greenhouse params: ${stats.duplicateGreenhouseTargets.join(', ')}`);
  if (stats.duplicateCropTargets.length > 0) issues.push(`duplicate crop param targets: ${stats.duplicateCropTargets.join(', ')}`);
  if (stats.duplicatePlantTargets.length > 0) issues.push(`duplicate plant targets: ${stats.duplicatePlantTargets.join(', ')}`);

  for (const action of actions) {
    if (action.type === 'greenhouse') {
      if (!action.param || action.value === undefined) {
        issues.push('greenhouse action is missing param or value');
        continue;
      }
      const range = GREENHOUSE_PARAM_RANGES[action.param as keyof typeof GREENHOUSE_PARAM_RANGES];
      if (!range) {
        issues.push(`invalid greenhouse param: ${action.param}`);
      } else if (!inRange(action.value, range[0], range[1])) {
        issues.push(`greenhouse param out of range: ${action.param}=${action.value}`);
      }
    }

    if (action.type === 'crop') {
      if (!action.crop || !action.param || action.value === undefined) {
        issues.push('crop action is missing crop, param, or value');
        continue;
      }
      if (!isCropName(action.crop)) {
        issues.push(`invalid crop name: ${action.crop}`);
        continue;
      }
      const range = CROP_PARAM_RANGES[action.param as keyof typeof CROP_PARAM_RANGES];
      if (!range) {
        issues.push(`invalid crop param: ${action.param}`);
      } else if (!inRange(action.value, range[0], range[1])) {
        issues.push(`crop param out of range: ${action.crop}.${action.param}=${action.value}`);
      }
    }

    if ((action.type === 'harvest' || action.type === 'replant') && !isCropName(action.crop)) {
      issues.push(`${action.type} action references invalid crop`);
    }

    if (action.type === 'batch-tile') {
      if (!action.harvests?.length && !action.plants?.length && !action.clears?.length) {
        issues.push('batch-tile action is empty');
      }
      if (action.harvests?.some(tileId => !tileId.match(/^\d+_\d+$/))) {
        issues.push('batch-tile harvest target uses invalid tile id');
      }
      if (action.clears?.some(tileId => !tileId.match(/^\d+_\d+$/))) {
        issues.push('batch-tile clear target uses invalid tile id');
      }
      if (action.plants?.some(plant => !plant.tileId.match(/^\d+_\d+$/) || !isCropName(plant.crop))) {
        issues.push('batch-tile plant target is invalid');
      }
    }
  }

  if ((snapshot.energyDeficit as boolean | undefined) && stats.increasesCriticalPower) {
    issues.push('increases heating or lighting during an energy deficit');
  }

  if ((snapshot.co2SafetyAlert as boolean | undefined)) {
    const controls = (snapshot.greenhouseControls ?? {}) as Record<string, number>;
    const raisesCo2 = actions.some(
      action =>
        action.type === 'greenhouse'
        && action.param === 'co2InjectionRate'
        && action.value !== undefined
        && action.value > (controls.co2InjectionRate ?? 0),
    );
    if (raisesCo2) issues.push('raises CO2 injection during a CO2 safety alert');
  }

  const penalty = Math.min(issues.length * 0.12, 1);
  return {
    score: Math.max(0, 1 - penalty),
    reason: issues.length === 0 ? 'All emitted actions are structurally safe and aligned with the current operational constraints.' : issues.join('; '),
  };
}

function normalizeGroundTruth(groundTruth: unknown): GreenhouseControlScenarioGroundTruth | null {
  if (!groundTruth || typeof groundTruth !== 'object') return null;
  const candidate = groundTruth as Partial<GreenhouseControlScenarioGroundTruth>;
  if (!candidate.scenarioId || !candidate.scenarioName || !candidate.category || !candidate.expectations) return null;
  return candidate as GreenhouseControlScenarioGroundTruth;
}

function analyzeScenarioFit(input: WorkflowInput | undefined, output: WorkflowOutput | undefined, groundTruth: unknown) {
  if (!output) {
    return {
      score: 0,
      reason: 'Workflow did not return an output payload.',
    };
  }

  const scenario = normalizeGroundTruth(groundTruth);
  if (!scenario) {
    return {
      score: 0,
      reason: 'Missing scenario expectations in ground truth.',
    };
  }

  const snapshot = input ?? {};
  const expectations = scenario.expectations;
  const actions = output.actions ?? [];
  const stats = collectActionStats(snapshot, actions);
  const checks: Array<{ label: string; pass: boolean }> = [];

  if (expectations.maxActions !== undefined) {
    checks.push({
      label: `keeps action count at or below ${expectations.maxActions}`,
      pass: actions.length <= expectations.maxActions,
    });
  }

  if (expectations.requireAnyAction) {
    checks.push({ label: 'produces at least one action', pass: actions.length > 0 });
  }

  if (expectations.requireBatchPlanting) {
    checks.push({ label: 'uses batch-tile planting', pass: stats.hasBatchPlanting });
  }

  if (expectations.minPlantCount !== undefined) {
    checks.push({
      label: `plants at least ${expectations.minPlantCount} tiles`,
      pass: stats.totalPlants >= expectations.minPlantCount,
    });
  }

  if (expectations.minDistinctPlantCrops !== undefined) {
    checks.push({
      label: `plants at least ${expectations.minDistinctPlantCrops} crop types`,
      pass: stats.distinctPlantCrops.size >= expectations.minDistinctPlantCrops,
    });
  }

  if (expectations.preferredPlantCrops?.length) {
    const preferredMatches = expectations.preferredPlantCrops.filter(crop => stats.distinctPlantCrops.has(crop)).length;
    checks.push({
      label: `plants at least ${expectations.minPreferredPlantCrops ?? 1} preferred crops`,
      pass: preferredMatches >= (expectations.minPreferredPlantCrops ?? 1),
    });
  }

  if (expectations.requireHarvestReadyHandling) {
    checks.push({ label: 'handles harvest-ready crops or tiles', pass: stats.handlesHarvestReady });
  }

  if (expectations.requireCo2Mitigation) {
    checks.push({
      label: 'mitigates the CO2 alert',
      pass: stats.raisesVentilation || stats.lowersCo2Injection,
    });
  }

  if (expectations.requireEnergyMitigation) {
    checks.push({
      label: 'reduces critical power draw',
      pass: stats.lowersHeating || stats.lowersLighting,
    });
  }

  if (expectations.requireWaterMitigation) {
    checks.push({
      label: 'mitigates water or root-zone stress',
      pass: stats.handlesWaterStress,
    });
  }

  if (expectations.requireDiseaseMitigation) {
    checks.push({
      label: 'mitigates disease risk',
      pass: stats.handlesDiseaseRisk,
    });
  }

  if (expectations.forbidEnergyIncrease) {
    checks.push({
      label: 'avoids increasing heating or lighting',
      pass: !stats.increasesCriticalPower,
    });
  }

  const passedChecks = checks.filter(check => check.pass).length;
  const failedChecks = checks.filter(check => !check.pass).map(check => check.label);

  return {
    score: checks.length === 0 ? 1 : passedChecks / checks.length,
    reason: failedChecks.length === 0 ? `Workflow output fits the ${scenario.scenarioName} expectations.` : failedChecks.join('; '),
  };
}

export const greenhouseControlAssessScorer = createScorer({
  id: 'greenhouse-control-assess-scorer',
  name: 'Greenhouse Control Assess Scorer',
  description: 'Checks whether the assess step deterministically derives the correct flags and urgency from the snapshot.',
  type: {
    input: SnapshotSchema,
    output: SituationReportSchema,
  },
})
  .preprocess(({ run }) => analyzeAssessOutput(run.input, run.output))
  .generateScore(({ results }) => results.preprocessStepResult.score)
  .generateReason(({ results }) => results.preprocessStepResult.reason);

export const greenhouseControlActionSafetyScorer = createScorer({
  id: 'greenhouse-control-action-safety-scorer',
  name: 'Greenhouse Control Action Safety Scorer',
  description: 'Checks that greenhouse-control actions are structurally valid and do not escalate active safety risks.',
  type: {
    input: SnapshotSchema,
    output: ReasonOutputSchema,
  },
})
  .preprocess(({ run }) => analyzeActionSafety(run.input, run.output))
  .generateScore(({ results }) => results.preprocessStepResult.score)
  .generateReason(({ results }) => results.preprocessStepResult.reason);

export const greenhouseControlScenarioFitScorer = createScorer({
  id: 'greenhouse-control-scenario-fit-scorer',
  name: 'Greenhouse Control Scenario Fit Scorer',
  description: 'Checks whether the workflow output matches the mission-specific expectations for each eval scenario.',
  type: {
    input: SnapshotSchema,
    output: ReasonOutputSchema,
  },
})
  .preprocess(({ run }) => analyzeScenarioFit(run.input, run.output, run.groundTruth))
  .generateScore(({ results }) => results.preprocessStepResult.score)
  .generateReason(({ results }) => results.preprocessStepResult.reason);

export const greenhouseControlWorkflowScorers = [
  greenhouseControlActionSafetyScorer,
  greenhouseControlScenarioFitScorer,
];
