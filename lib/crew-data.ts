/**
 * Shared crew profiles for the four Mars mission crewmates.
 *
 * This is the single source of truth used by both UI components and the
 * agent context injection (wellbeing agent, dispatcher, chat route).
 */

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

export const CREW_PROFILES: CrewmateProfile[] = [
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

/**
 * Returns a concise text summary of all crew profiles for agent context injection.
 */
export function crewProfilesForAgent(): string {
  const lines = ['CREW STATUS (4 crewmates):'];
  for (const c of CREW_PROFILES) {
    lines.push(
      `- ${c.name} (${c.role}) | Health: ${c.health} | Condition: ${c.condition} | ` +
      `Morale: ${c.morale}/100 | Sleep: ${c.sleep}h | Stress: ${c.stress} | ` +
      `Hydration: ${c.hydration}% | Nutrition: ${c.nutrition}% | Calories: ${c.calories} kcal | ` +
      `HR: ${c.heartRate} bpm | BP: ${c.bloodPressure} | Temp: ${c.bodyTemp}C | O2Sat: ${c.o2Sat}% | ` +
      `Task: ${c.currentTask} | Specialty: ${c.specialty} | EVA hours: ${c.evaHours} | TaskLoad: ${c.taskLoad}`
    );
  }
  return lines.join('\n');
}
