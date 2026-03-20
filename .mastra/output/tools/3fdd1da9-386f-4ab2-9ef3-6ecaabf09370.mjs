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
function runBaseline(snapshot, horizonSols, scenarioCount) {
  return runSimulation({ snapshot, proposedActions: [], horizonSols, scenarioCount });
}

export { runBaseline, runSimulation };
