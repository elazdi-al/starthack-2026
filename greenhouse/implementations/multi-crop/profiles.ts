import type { CropType, GrowthStage } from './types';

export interface CropProfile {
  optimalTemp: number;
  optimalMoisture: number;
  tempSigma: number;
  moistureSigma: number;

  growthCycleSols: number;
  stageFractions: Record<GrowthStage, number>;

  maxYieldKgPerPlant: number;
  plantsPerTile: number;
  harvestIndex: number;

  caloriesPerKg: number;
  proteinPerKg: number;
  vitaminC_mgPerKg: number;
  vitaminA_mcgPerKg: number;
  iron_mgPerKg: number;
  calcium_mgPerKg: number;
  fiber_gPerKg: number;

  waterLPerHourBase: number;
  optimalLightHours: number;

  // Extended realism parameters
  boltingTempThreshold: number;   // °C — airTemp above this risks bolting
  boltingHoursToTrigger: number;  // continuous hours above threshold to trigger
  nutrientSensitivity: number;    // 0–1 multiplier for EC-deviation stress
  rootO2Sensitivity: number;      // 0–1 multiplier for hypoxia stress
  diseaseSusceptibility: number;  // 0–1 baseline accumulation rate factor
  lightSaturationPoint: number;   // lux — above this photoinhibition begins

  // Genetic variance coefficients (CV = coefficient of variation, unitless)
  // These define the standard deviation as a fraction of the mean for per-individual variation.
  // A CV of 0.08 means ±8% 1-σ spread around the profile baseline.
  geneticVariance: {
    optimalTempCV: number;          // variance in temperature preference
    optimalMoistureCV: number;      // variance in moisture preference
    growthRateCV: number;           // variance in growth cycle speed
    maxYieldCV: number;             // variance in genetic yield potential
    boltingThresholdCV: number;     // variance in bolting sensitivity
    stressResilienceCV: number;     // variance in stress tolerance (healthScore decay)
    waterEfficiencyCV: number;      // variance in water uptake efficiency
  };
}

const STAGES_DEFAULT: Record<GrowthStage, number> = {
  seed: 0.05,
  germination: 0.10,
  vegetative: 0.30,
  flowering: 0.20,
  fruiting: 0.25,
  harvest_ready: 0.10,
  harvested: 0,
};

export const CROP_PROFILES: Record<CropType, CropProfile> = {
  lettuce: {
    optimalTemp: 18, optimalMoisture: 60, tempSigma: 5, moistureSigma: 15,
    growthCycleSols: 44,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.35, flowering: 0.15 },
    maxYieldKgPerPlant: 0.3, plantsPerTile: 20, harvestIndex: 0.85,
    caloriesPerKg: 150, proteinPerKg: 14, vitaminC_mgPerKg: 24,
    vitaminA_mcgPerKg: 7405, iron_mgPerKg: 8.6, calcium_mgPerKg: 360, fiber_gPerKg: 13,
    waterLPerHourBase: 0.035, optimalLightHours: 17,
    boltingTempThreshold: 25, boltingHoursToTrigger: 12,
    nutrientSensitivity: 0.9, rootO2Sensitivity: 0.85, diseaseSusceptibility: 0.7,
    lightSaturationPoint: 40000,
    geneticVariance: {
      optimalTempCV: 0.06, optimalMoistureCV: 0.08, growthRateCV: 0.10,
      maxYieldCV: 0.12, boltingThresholdCV: 0.07, stressResilienceCV: 0.09,
      waterEfficiencyCV: 0.08,
    },
  },
  tomato: {
    optimalTemp: 24, optimalMoisture: 70, tempSigma: 5, moistureSigma: 15,
    growthCycleSols: 78,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.25, flowering: 0.20, fruiting: 0.30 },
    maxYieldKgPerPlant: 3.0, plantsPerTile: 4, harvestIndex: 0.60,
    caloriesPerKg: 180, proteinPerKg: 9, vitaminC_mgPerKg: 140,
    vitaminA_mcgPerKg: 833, iron_mgPerKg: 2.7, calcium_mgPerKg: 110, fiber_gPerKg: 12,
    waterLPerHourBase: 0.065, optimalLightHours: 16,
    boltingTempThreshold: 32, boltingHoursToTrigger: 24,
    nutrientSensitivity: 0.75, rootO2Sensitivity: 0.7, diseaseSusceptibility: 0.6,
    lightSaturationPoint: 60000,
    geneticVariance: {
      optimalTempCV: 0.08, optimalMoistureCV: 0.10, growthRateCV: 0.14,
      maxYieldCV: 0.18, boltingThresholdCV: 0.06, stressResilienceCV: 0.12,
      waterEfficiencyCV: 0.10,
    },
  },
  potato: {
    optimalTemp: 18, optimalMoisture: 65, tempSigma: 4, moistureSigma: 12,
    growthCycleSols: 88,
    stageFractions: { ...STAGES_DEFAULT, fruiting: 0.30, flowering: 0.15 },
    maxYieldKgPerPlant: 1.5, plantsPerTile: 8, harvestIndex: 0.75,
    caloriesPerKg: 770, proteinPerKg: 20, vitaminC_mgPerKg: 197,
    vitaminA_mcgPerKg: 2, iron_mgPerKg: 8.1, calcium_mgPerKg: 120, fiber_gPerKg: 22,
    waterLPerHourBase: 0.050, optimalLightHours: 14,
    boltingTempThreshold: 27, boltingHoursToTrigger: 18,
    nutrientSensitivity: 0.8, rootO2Sensitivity: 0.75, diseaseSusceptibility: 0.5,
    lightSaturationPoint: 50000,
    geneticVariance: {
      optimalTempCV: 0.07, optimalMoistureCV: 0.09, growthRateCV: 0.11,
      maxYieldCV: 0.15, boltingThresholdCV: 0.08, stressResilienceCV: 0.10,
      waterEfficiencyCV: 0.09,
    },
  },
  soybean: {
    optimalTemp: 25, optimalMoisture: 65, tempSigma: 5, moistureSigma: 15,
    growthCycleSols: 97,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.25, fruiting: 0.30 },
    maxYieldKgPerPlant: 0.5, plantsPerTile: 12, harvestIndex: 0.40,
    caloriesPerKg: 1730, proteinPerKg: 166, vitaminC_mgPerKg: 60,
    vitaminA_mcgPerKg: 9, iron_mgPerKg: 155, calcium_mgPerKg: 2770, fiber_gPerKg: 92,
    waterLPerHourBase: 0.042, optimalLightHours: 15,
    boltingTempThreshold: 34, boltingHoursToTrigger: 30,
    nutrientSensitivity: 0.7, rootO2Sensitivity: 0.65, diseaseSusceptibility: 0.45,
    lightSaturationPoint: 55000,
    geneticVariance: {
      optimalTempCV: 0.07, optimalMoistureCV: 0.08, growthRateCV: 0.12,
      maxYieldCV: 0.16, boltingThresholdCV: 0.06, stressResilienceCV: 0.11,
      waterEfficiencyCV: 0.09,
    },
  },
  spinach: {
    optimalTemp: 18, optimalMoisture: 65, tempSigma: 4, moistureSigma: 12,
    growthCycleSols: 39,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.40, flowering: 0.10 },
    maxYieldKgPerPlant: 0.2, plantsPerTile: 25, harvestIndex: 0.90,
    caloriesPerKg: 230, proteinPerKg: 29, vitaminC_mgPerKg: 281,
    vitaminA_mcgPerKg: 9377, iron_mgPerKg: 27.1, calcium_mgPerKg: 990, fiber_gPerKg: 22,
    waterLPerHourBase: 0.030, optimalLightHours: 15,
    boltingTempThreshold: 24, boltingHoursToTrigger: 10,
    nutrientSensitivity: 0.85, rootO2Sensitivity: 0.8, diseaseSusceptibility: 0.65,
    lightSaturationPoint: 38000,
    geneticVariance: {
      optimalTempCV: 0.05, optimalMoistureCV: 0.07, growthRateCV: 0.09,
      maxYieldCV: 0.11, boltingThresholdCV: 0.06, stressResilienceCV: 0.08,
      waterEfficiencyCV: 0.07,
    },
  },
  wheat: {
    optimalTemp: 21, optimalMoisture: 60, tempSigma: 5, moistureSigma: 15,
    growthCycleSols: 117,
    stageFractions: { ...STAGES_DEFAULT },
    maxYieldKgPerPlant: 0.4, plantsPerTile: 15, harvestIndex: 0.45,
    caloriesPerKg: 3400, proteinPerKg: 132, vitaminC_mgPerKg: 0,
    vitaminA_mcgPerKg: 9, iron_mgPerKg: 35, calcium_mgPerKg: 290, fiber_gPerKg: 127,
    waterLPerHourBase: 0.045, optimalLightHours: 17,
    boltingTempThreshold: 30, boltingHoursToTrigger: 20,
    nutrientSensitivity: 0.6, rootO2Sensitivity: 0.55, diseaseSusceptibility: 0.4,
    lightSaturationPoint: 65000,
    geneticVariance: {
      optimalTempCV: 0.06, optimalMoistureCV: 0.07, growthRateCV: 0.10,
      maxYieldCV: 0.13, boltingThresholdCV: 0.05, stressResilienceCV: 0.08,
      waterEfficiencyCV: 0.07,
    },
  },
  radish: {
    optimalTemp: 19, optimalMoisture: 60, tempSigma: 4, moistureSigma: 12,
    growthCycleSols: 29,
    stageFractions: { ...STAGES_DEFAULT, germination: 0.12, vegetative: 0.35, flowering: 0.10, fruiting: 0.28 },
    maxYieldKgPerPlant: 0.15, plantsPerTile: 30, harvestIndex: 0.80,
    caloriesPerKg: 160, proteinPerKg: 7, vitaminC_mgPerKg: 148,
    vitaminA_mcgPerKg: 7, iron_mgPerKg: 3.4, calcium_mgPerKg: 250, fiber_gPerKg: 16,
    waterLPerHourBase: 0.025, optimalLightHours: 13,
    boltingTempThreshold: 26, boltingHoursToTrigger: 8,
    nutrientSensitivity: 0.7, rootO2Sensitivity: 0.7, diseaseSusceptibility: 0.5,
    lightSaturationPoint: 45000,
    geneticVariance: {
      optimalTempCV: 0.06, optimalMoistureCV: 0.08, growthRateCV: 0.11,
      maxYieldCV: 0.13, boltingThresholdCV: 0.07, stressResilienceCV: 0.09,
      waterEfficiencyCV: 0.08,
    },
  },
  kale: {
    optimalTemp: 19, optimalMoisture: 65, tempSigma: 5, moistureSigma: 15,
    growthCycleSols: 54,
    stageFractions: { ...STAGES_DEFAULT, vegetative: 0.35, flowering: 0.15 },
    maxYieldKgPerPlant: 0.5, plantsPerTile: 12, harvestIndex: 0.85,
    caloriesPerKg: 490, proteinPerKg: 43, vitaminC_mgPerKg: 1200,
    vitaminA_mcgPerKg: 9990, iron_mgPerKg: 15, calcium_mgPerKg: 1500, fiber_gPerKg: 20,
    waterLPerHourBase: 0.038, optimalLightHours: 15,
    boltingTempThreshold: 26, boltingHoursToTrigger: 14,
    nutrientSensitivity: 0.75, rootO2Sensitivity: 0.75, diseaseSusceptibility: 0.55,
    lightSaturationPoint: 42000,
    geneticVariance: {
      optimalTempCV: 0.06, optimalMoistureCV: 0.08, growthRateCV: 0.10,
      maxYieldCV: 0.14, boltingThresholdCV: 0.06, stressResilienceCV: 0.09,
      waterEfficiencyCV: 0.08,
    },
  },
};
