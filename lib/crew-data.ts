/**
 * Dynamic crew state for the four Mars mission crewmates.
 *
 * Initial profiles provide starting values. The `updateCrew()` function
 * evolves crew metrics each simulation tick based on environmental factors
 * (nutrition, dust storms, energy, CO2, water, mission phase, etc.).
 *
 * This is the single source of truth used by UI components and agent context.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "nominal" | "caution" | "critical";
export type NeedLevel = "good" | "moderate" | "low";

export interface CrewmateProfile {
  id: string;
  name: string;
  role: string;
  health: HealthStatus;
  condition: string;
  heartRate: number;
  bloodPressure: string;
  bodyTemp: number;
  o2Sat: number;
  sleep: number;
  stress: NeedLevel;
  morale: number;
  hydration: number;
  nutrition: number;
  calories: number;
  evaHours: number;
  taskLoad: NeedLevel;
  currentTask: string;
  specialty: string;
}

// ─── Initial profiles (starting values at sol 0) ──────────────────────────────

export const INITIAL_CREW_PROFILES: readonly CrewmateProfile[] = [
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
    specialty: "Closed-loop agriculture",
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
    specialty: "Life support & power systems",
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
    specialty: "Crew health & nutrition",
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
    specialty: "Geology & EVA ops",
  },
];

// ─── Per-crewmate individual sensitivity coefficients ─────────────────────────

interface CrewSensitivity {
  baseSleep: number;        // baseline sleep hours
  sleepVariance: number;    // random daily variance amplitude
  stressResilience: number; // 0-1, higher = less affected by stressors
  moraleInertia: number;    // 0-1, higher = morale changes more slowly
  calorieTarget: number;    // individual daily kcal need
  baseHR: number;           // resting heart rate
  baseBPSys: number;        // resting systolic
  baseBPDia: number;        // resting diastolic
  baseTemp: number;         // resting body temp
}

const SENSITIVITY: Record<string, CrewSensitivity> = {
  wei:   { baseSleep: 7.2, sleepVariance: 0.4, stressResilience: 0.7, moraleInertia: 0.6, calorieTarget: 2200, baseHR: 68, baseBPSys: 118, baseBPDia: 76, baseTemp: 36.6 },
  amara: { baseSleep: 6.8, sleepVariance: 0.5, stressResilience: 0.6, moraleInertia: 0.5, calorieTarget: 2400, baseHR: 72, baseBPSys: 122, baseBPDia: 78, baseTemp: 36.7 },
  lena:  { baseSleep: 5.9, sleepVariance: 0.6, stressResilience: 0.5, moraleInertia: 0.4, calorieTarget: 2000, baseHR: 74, baseBPSys: 115, baseBPDia: 72, baseTemp: 36.9 },
  kenji: { baseSleep: 7.5, sleepVariance: 0.3, stressResilience: 0.8, moraleInertia: 0.7, calorieTarget: 2500, baseHR: 65, baseBPSys: 116, baseBPDia: 74, baseTemp: 36.5 },
};

// ─── Tasks by role (selected contextually) ────────────────────────────────────

const TASKS: Record<string, { normal: string[]; storm: string[]; lowFood: string[] }> = {
  wei: {
    normal: ["Monitoring tomato flowering cycle", "Pruning lettuce beds", "Calibrating nutrient dosers", "Inspecting soybean root health", "Pollinating strawberry blossoms"],
    storm: ["Checking UV shielding on grow-lights", "Adjusting light compensation for dust storm", "Monitoring plant stress indicators"],
    lowFood: ["Optimising fast-harvest crop rotation", "Assessing emergency crop yields", "Replanting high-calorie varieties"],
  },
  amara: {
    normal: ["Solar panel diagnostics post-storm", "Running HVAC efficiency check", "Calibrating CO₂ scrubbers", "Battery health assessment", "Water recycler maintenance"],
    storm: ["Securing external sensor arrays", "Monitoring power draw under storm load", "Dust filter replacement cycle"],
    lowFood: ["Optimising power allocation to grow-lights", "Reducing non-essential energy usage", "Emergency water recycler boost"],
  },
  lena: {
    normal: ["Crew sleep pattern analysis", "Preparing vitamin supplement schedule", "Reviewing crew fitness logs", "Updating medical supply inventory"],
    storm: ["Monitoring crew respiratory metrics", "Preparing dust exposure protocols", "Checking emergency O₂ supplies"],
    lowFood: ["Adjusting crew calorie rationing plan", "Assessing nutritional deficiency risks", "Planning morale-boosting meal rotation"],
  },
  kenji: {
    normal: ["EVA prep for water extraction site", "Geological sample cataloguing", "EVA suit maintenance", "Mapping next survey route"],
    storm: ["EVA stand-down — reviewing survey data", "Suit system diagnostics during stand-down", "Planning post-storm EVA schedule"],
    lowFood: ["Scouting alternative water ice deposits", "Assessing regolith for mineral supplements", "Reducing EVA frequency to conserve calories"],
  },
};

// ─── Environment snapshot expected by updateCrew ──────────────────────────────

export interface CrewEnvInputs {
  nutritionalCoverage: number;  // 0-1
  foodReservesSols: number;     // remaining sols of reserves
  dustStormActive: boolean;
  dustStormFactor: number;      // 1.0 = clear, lower = worse
  energyDeficit: boolean;
  co2SafetyAlert: boolean;
  waterRecyclingEfficiency: number; // 0-1
  o2Level: number;              // ~20.9 nominal
  missionSol: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Deterministic-ish hash from sol + crewId for daily variance. */
function dailyNoise(sol: number, id: string): number {
  let h = 0;
  const s = `${sol}:${id}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return ((h & 0x7fffffff) % 1000) / 1000; // 0-1
}

function deriveStress(stressScore: number): NeedLevel {
  if (stressScore >= 70) return "good";
  if (stressScore >= 40) return "moderate";
  return "low";
}

function deriveHealth(morale: number, nutrition: number, hydration: number, sleep: number, stressScore: number): HealthStatus {
  const worst = Math.min(morale, nutrition, hydration, stressScore);
  if (worst < 30 || sleep < 4.5) return "critical";
  if (worst < 55 || sleep < 5.5) return "caution";
  return "nominal";
}

function deriveCondition(sleep: number, stressScore: number, morale: number): string {
  if (sleep < 5) return "Exhausted";
  if (stressScore < 35) return "Stressed";
  if (sleep < 6) return "Fatigued";
  if (morale > 85 && stressScore > 70) return "Sharp";
  if (morale > 75) return "Alert";
  if (stressScore > 60) return "Rested";
  return "Tired";
}

function deriveTaskLoad(stressScore: number, dustStormActive: boolean, energyDeficit: boolean): NeedLevel {
  let load = 50;
  if (dustStormActive) load += 20;
  if (energyDeficit) load += 15;
  if (stressScore < 40) load += 10;
  if (load >= 70) return "low"; // "low" means overloaded in NeedLevel context (low capacity)
  if (load >= 45) return "moderate";
  return "good";
}

function pickTask(id: string, env: CrewEnvInputs, noise: number): string {
  const pool = TASKS[id];
  if (!pool) return "General duties";
  let list = pool.normal;
  if (env.dustStormActive) list = pool.storm;
  else if (env.foodReservesSols < 150) list = pool.lowFood;
  return list[Math.floor(noise * list.length)] ?? list[0];
}

// ─── Main update function ─────────────────────────────────────────────────────

/**
 * Evolve all crew profiles for one tick. Designed to be called frequently
 * (every UI tick) with small `dtHours` values. Changes are continuous and
 * smooth — no sudden jumps.
 *
 * @param crew   Current crew state array (will not be mutated)
 * @param env    Current environment inputs
 * @param dtHours  Time step in simulation hours
 * @returns New crew array (same references if nothing changed)
 */
export function updateCrew(
  crew: CrewmateProfile[],
  env: CrewEnvInputs,
  dtHours: number,
): CrewmateProfile[] {
  if (dtHours <= 0) return crew;

  // Shared environmental stress factors
  const stormStress = env.dustStormActive ? (1 - env.dustStormFactor) * 30 : 0; // 0-30
  const foodStress = env.foodReservesSols < 100 ? (1 - env.foodReservesSols / 100) * 25 : 0; // 0-25
  const energyStress = env.energyDeficit ? 20 : 0;
  const co2Stress = env.co2SafetyAlert ? 25 : 0;
  const o2Stress = env.o2Level < 19 ? (19 - env.o2Level) * 15 : 0;
  const envStressTotal = stormStress + foodStress + energyStress + co2Stress + o2Stress; // 0-100

  // Nutritional input drives nutrition/hydration recovery
  const nutCov = clamp(env.nutritionalCoverage, 0, 1);
  const waterEff = clamp(env.waterRecyclingEfficiency, 0, 1);

  // Rate scaler — changes accumulate proportionally to time step
  // Normalise to "per sol" rates; dtHours / 24.66 (Mars sol hours)
  const dtSol = dtHours / 24.66;

  const sol = Math.floor(env.missionSol);
  let changed = false;

  const next = crew.map((c) => {
    const sens = SENSITIVITY[c.id] ?? SENSITIVITY.wei;
    const noise = dailyNoise(sol, c.id); // 0-1, changes daily

    // ── Stress score (internal 0-100, higher = less stressed = better) ──
    const resilienceFactor = sens.stressResilience;
    const rawStress = 100 - envStressTotal * (1 - resilienceFactor * 0.5);
    const prevStressScore = c.stress === "good" ? 85 : c.stress === "moderate" ? 55 : 25;
    const stressScore = clamp(
      prevStressScore + (rawStress - prevStressScore) * dtSol * 2,
      5, 100,
    );

    // ── Sleep (hours, shifts slowly day by day) ──
    const sleepTarget = sens.baseSleep
      - (envStressTotal > 40 ? 1.0 : envStressTotal > 20 ? 0.4 : 0)
      + (noise - 0.5) * sens.sleepVariance;
    const sleep = clamp(
      c.sleep + (sleepTarget - c.sleep) * dtSol * 0.5,
      3.5, 9.5,
    );

    // ── Nutrition (0-100) driven by greenhouse nutritional coverage ──
    const nutTarget = nutCov * 100 * (sens.calorieTarget / 2500); // scaled by individual need
    const nutrition = clamp(
      c.nutrition + (clamp(nutTarget, 20, 100) - c.nutrition) * dtSol * 1.5,
      10, 100,
    );

    // ── Hydration (0-100) driven by water recycling ──
    const hydTarget = waterEff * 100 - (envStressTotal > 30 ? 8 : 0);
    const hydration = clamp(
      c.hydration + (clamp(hydTarget, 20, 100) - c.hydration) * dtSol * 2,
      15, 100,
    );

    // ── Calories (approximate daily intake) ──
    const calories = Math.round(
      sens.calorieTarget * clamp(nutCov * 1.1, 0.5, 1.1)
      + (noise - 0.5) * 100,
    );

    // ── Morale (0-100) ── composite with inertia
    const moraleTarget =
      nutrition * 0.25 +
      hydration * 0.15 +
      stressScore * 0.3 +
      (sleep / 8) * 100 * 0.15 +
      (env.foodReservesSols > 200 ? 15 : env.foodReservesSols > 100 ? 8 : 0);
    const morale = clamp(
      c.morale + (moraleTarget - c.morale) * dtSol * (1 - sens.moraleInertia) * 2,
      5, 100,
    );

    // ── Vitals (small fluctuations around baseline) ──
    const stressDelta = (100 - stressScore) / 100; // 0-1, higher when stressed
    const heartRate = Math.round(
      sens.baseHR + stressDelta * 18 + (noise - 0.5) * 6,
    );
    const bpSys = Math.round(sens.baseBPSys + stressDelta * 12 + (noise - 0.5) * 4);
    const bpDia = Math.round(sens.baseBPDia + stressDelta * 8 + (noise - 0.5) * 3);
    const bloodPressure = `${bpSys}/${bpDia}`;
    const bodyTemp = Math.round(
      (sens.baseTemp + stressDelta * 0.3 + (noise - 0.5) * 0.2) * 10,
    ) / 10;

    // O2 sat: drops slightly under low O2 or high stress
    const o2Sat = clamp(
      Math.round(99 - (env.o2Level < 19.5 ? (19.5 - env.o2Level) * 3 : 0) - stressDelta * 2 + (noise - 0.5)),
      88, 100,
    );

    // ── Derived status fields ──
    const stress = deriveStress(stressScore);
    const health = deriveHealth(morale, nutrition, hydration, sleep, stressScore);
    const condition = deriveCondition(sleep, stressScore, morale);
    const taskLoad = deriveTaskLoad(stressScore, env.dustStormActive, env.energyDeficit);
    const currentTask = pickTask(c.id, env, noise);

    // EVA hours: Kenji accumulates faster, paused during storms
    const evaRate = c.id === "kenji" ? 0.8 : c.id === "amara" ? 0.3 : 0.1;
    const evaHours = Math.round(
      (c.evaHours + (env.dustStormActive ? 0 : evaRate * dtSol)) * 10,
    ) / 10;

    // Check if anything actually changed (avoid unnecessary re-renders)
    if (
      c.morale === Math.round(morale) &&
      c.nutrition === Math.round(nutrition) &&
      c.hydration === Math.round(hydration) &&
      c.sleep === Math.round(sleep * 10) / 10 &&
      c.stress === stress &&
      c.health === health &&
      c.heartRate === heartRate &&
      c.bloodPressure === bloodPressure &&
      c.bodyTemp === bodyTemp &&
      c.o2Sat === o2Sat &&
      c.condition === condition &&
      c.calories === calories &&
      c.taskLoad === taskLoad &&
      c.currentTask === currentTask &&
      c.evaHours === evaHours
    ) {
      return c; // no change — reuse reference
    }

    changed = true;
    return {
      ...c,
      morale: Math.round(morale),
      nutrition: Math.round(nutrition),
      hydration: Math.round(hydration),
      sleep: Math.round(sleep * 10) / 10,
      calories,
      stress,
      health,
      condition,
      heartRate,
      bloodPressure,
      bodyTemp,
      o2Sat,
      taskLoad,
      currentTask,
      evaHours,
    };
  });

  return changed ? next : crew;
}

// ─── Create initial crew state ────────────────────────────────────────────────

export function createInitialCrew(): CrewmateProfile[] {
  return INITIAL_CREW_PROFILES.map((p) => ({ ...p }));
}

// ─── Agent context formatter (accepts live crew) ──────────────────────────────

export function crewProfilesForAgent(crew: CrewmateProfile[]): string {
  const lines = ['CREW STATUS (4 crewmates):'];
  for (const c of crew) {
    lines.push(
      `- ${c.name} (${c.role}) | Health: ${c.health} | Condition: ${c.condition} | ` +
      `Morale: ${c.morale}/100 | Sleep: ${c.sleep}h | Stress: ${c.stress} | ` +
      `Hydration: ${c.hydration}% | Nutrition: ${c.nutrition}% | Calories: ${c.calories} kcal | ` +
      `HR: ${c.heartRate} bpm | BP: ${c.bloodPressure} | Temp: ${c.bodyTemp}C | O2Sat: ${c.o2Sat}% | ` +
      `Task: ${c.currentTask} | Specialty: ${c.specialty} | EVA hours: ${c.evaHours} | TaskLoad: ${c.taskLoad}`,
    );
  }
  return lines.join('\n');
}
