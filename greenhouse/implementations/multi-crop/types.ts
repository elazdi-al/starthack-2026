import type { Environment, GreenhouseState, SimulationState, State } from '../../state/types';

export type CropType = "lettuce" | "tomato" | "potato" | "soybean" | "spinach" | "wheat" | "radish" | "kale";

export type SeasonName = 'northern_spring' | 'northern_summer' | 'northern_autumn' | 'northern_winter';
export type DustStormRisk = 'low' | 'moderate' | 'high' | 'extreme';

export interface ManualOverrides {
  externalTempEnabled:        boolean;
  externalTemp:               number;   // °C, range −120 → +20
  solarRadiationEnabled:      boolean;
  solarRadiation:             number;   // W/m², range 0 → 800
  dustStormEnabled:           boolean;
  dustStormSeverity:          number;   // 0 (clear) → 1 (fully opaque)
  atmosphericPressureEnabled: boolean;
  atmosphericPressure:        number;   // Pa, range 400 → 800
  timeOfDayLocked:            boolean;
  timeOfDayFraction:          number;   // 0 (midnight) → 1, 0.5 = noon
}

export const ALL_CROP_TYPES: CropType[] = [
  "lettuce", "tomato", "potato", "soybean", "spinach", "wheat", "radish", "kale",
];

export type GrowthStage = 'seed' | 'germination' | 'vegetative' | 'flowering' | 'fruiting' | 'harvest_ready' | 'harvested';

export const GROWTH_STAGES: GrowthStage[] = [
  'seed', 'germination', 'vegetative', 'flowering', 'fruiting', 'harvest_ready',
];

export const STAGE_TO_GROWTH_INDEX: Record<GrowthStage, number> = {
  seed: 0,
  germination: 1,
  vegetative: 2,
  flowering: 3,
  fruiting: 4,
  harvest_ready: 5,
  harvested: 0,
};

export interface CropEnvironment {
  soilMoisture: number;
  soilTemperature: number;

  stage: GrowthStage;
  stageProgress: number;
  daysSincePlanting: number;

  healthScore: number;
  stressAccumulator: number;

  biomassKg: number;
  estimatedYieldKg: number;

  plantGrowth: number;
  leafArea: number;
  fruitCount: number;
}

export interface CropControls {
  waterPumpRate: number;
  localHeatingPower: number;
}

export interface ConcreteEnvironment extends Environment {
  timestamp: number;
  missionStartMs: number;
  missionElapsedHours: number;
  missionSol: number;
  solFraction: number;

  // Martian seasons
  missionStartLs: number;
  currentLs: number;
  seasonName: SeasonName;
  seasonalSolarFlux: number;
  atmosphericPressure: number;
  dustStormRisk: DustStormRisk;

  airTemperature: number;
  humidity: number;
  co2Level: number;
  lightLevel: number;
  o2Level: number;
  externalTemp: number;
  solarRadiation: number;
  dustStormFactor: number;

  waterConsumedL: number;
  energyUsedKWh: number;
  o2ProducedKg: number;

  crops: Record<CropType, CropEnvironment>;
}

export interface ConcreteGreenhouseState extends GreenhouseState {
  lightingPower: number;
  globalHeatingPower: number;
  co2InjectionRate: number;
  ventilationRate: number;
  crops: Record<CropType, CropControls>;
  overrides: ManualOverrides;
}

export interface ConcreteState extends State {
  simulation: SimulationState<ConcreteEnvironment>;
  greenhouse: ConcreteGreenhouseState;
}

export interface SimEvent {
  sol: number;
  type: 'harvest' | 'replant' | 'stress_alert' | 'dust_storm_start' | 'dust_storm_end' | 'resource_warning' | 'crop_death' | 'stage_change';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  crop?: CropType;
  data?: Record<string, unknown>;
}

export interface NutritionalOutput {
  caloriesPerDay: number;
  proteinGPerDay: number;
  vitaminC_mgPerDay: number;
  vitaminA_mcgPerDay: number;
  iron_mgPerDay: number;
  calcium_mgPerDay: number;
  fiber_gPerDay: number;
}

export interface MissionResources {
  waterConsumedL: number;
  energyUsedKWh: number;
  o2ProducedKg: number;
  totalHarvestKg: number;
}

export const CREW_DAILY_TARGETS = {
  calories: 10_000,
  proteinG: 224,
  vitaminC_mg: 360,
  vitaminA_mcg: 3_600,
  iron_mg: 48,
  calcium_mg: 4_000,
  fiber_g: 100,
} as const;
