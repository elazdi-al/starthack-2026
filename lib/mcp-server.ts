/**
 * MCP Server exposing the Mars greenhouse simulation state.
 *
 * Tools:
 *  - get_greenhouse_state: Returns the full EnvironmentSnapshot (temperature,
 *    humidity, CO2, crops, energy, mission status, etc.)
 *  - get_crop_status: Returns detailed status for a specific crop.
 *  - get_environment_summary: Returns a concise human-readable summary of
 *    the current environment conditions.
 *
 * This server is stateless and reads from the in-memory snapshot cache
 * populated by the frontend via POST /api/snapshot.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSnapshot, getSnapshotAge } from "@/lib/snapshot-store";

const ALL_CROPS = [
  "lettuce", "tomato", "potato", "soybean",
  "spinach", "wheat", "radish", "kale",
] as const;

export function createMcpServer(): McpServer {
  const mcp = new McpServer(
    {
      name: "mars-greenhouse",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ── get_greenhouse_state ──────────────────────────────────────────────────
  mcp.tool(
    "get_greenhouse_state",
    "Get the complete current state of the Mars greenhouse simulation including environment sensors, " +
    "crop status, energy systems, mission progress, and nutritional output. " +
    "Returns a full EnvironmentSnapshot JSON object.",
    async () => {
      const snapshot = getSnapshot();
      if (!snapshot) {
        return {
          content: [{ type: "text", text: "No simulation data available yet. The greenhouse simulation has not started or no snapshot has been received from the frontend." }],
          isError: true,
        };
      }

      const ageMs = getSnapshotAge();
      const ageSec = Math.round(ageMs / 1000);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            _meta: { snapshotAgeSeconds: ageSec },
            ...snapshot,
          }, null, 2),
        }],
      };
    },
  );

  // ── get_crop_status ───────────────────────────────────────────────────────
  mcp.tool(
    "get_crop_status",
    "Get detailed status for a specific crop in the Mars greenhouse. " +
    "Returns soil moisture, temperature, growth stage, health, yield estimate, disease risk, and controls. " +
    "Available crops: lettuce, tomato, potato, soybean, spinach, wheat, radish, kale.",
    { crop: z.enum(ALL_CROPS).describe("The crop to query") },
    async ({ crop }) => {
      const snapshot = getSnapshot();
      if (!snapshot) {
        return {
          content: [{ type: "text", text: "No simulation data available yet." }],
          isError: true,
        };
      }

      const cropData = snapshot.crops[crop];
      if (!cropData) {
        return {
          content: [{ type: "text", text: `No data available for crop: ${crop}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ crop, ...cropData }, null, 2),
        }],
      };
    },
  );

  // ── get_environment_summary ───────────────────────────────────────────────
  mcp.tool(
    "get_environment_summary",
    "Get a concise human-readable summary of the current greenhouse environment conditions " +
    "including temperature, humidity, CO2, energy, dust storms, and mission progress.",
    async () => {
      const snapshot = getSnapshot();
      if (!snapshot) {
        return {
          content: [{ type: "text", text: "No simulation data available yet." }],
          isError: true,
        };
      }

      const s = snapshot;
      const lines = [
        `Mission Sol: ${s.missionSol} / ${s.totalMissionSols}`,
        `Season: ${s.seasonName} (Ls ${s.currentLs.toFixed(1)})`,
        "",
        "--- Greenhouse Environment ---",
        `Air Temperature: ${s.airTemperature.toFixed(1)} C`,
        `Humidity: ${s.humidity.toFixed(1)}%`,
        `CO2 Level: ${s.co2Level} ppm${s.co2SafetyAlert ? " [SAFETY ALERT]" : ""}`,
        `O2 Level: ${s.o2Level.toFixed(1)}%`,
        `Light Level: ${s.lightLevel} lux`,
        "",
        "--- External Conditions ---",
        `External Temp: ${s.externalTemp.toFixed(1)} C`,
        `Solar Radiation: ${s.solarRadiation} W/m2`,
        `Dust Storm: ${s.dustStormActive ? `ACTIVE (factor ${s.dustStormFactor.toFixed(2)})` : "None"}`,
        `Dust Storm Risk: ${s.dustStormRisk}`,
        `Atmospheric Pressure: ${s.atmosphericPressure} Pa`,
        "",
        "--- Energy ---",
        `Solar Generation: ${s.solarGenerationKW.toFixed(1)} kW`,
        `Battery: ${s.batteryStorageKWh.toFixed(1)} / ${s.batteryCapacityKWh} kWh`,
        `Energy Deficit: ${s.energyDeficit ? "YES" : "No"}`,
        "",
        "--- Resources ---",
        `Water Consumed: ${s.resources.waterConsumedL.toFixed(1)} L`,
        `Energy Used: ${s.resources.energyUsedKWh.toFixed(1)} kWh`,
        `O2 Produced: ${s.resources.o2ProducedKg.toFixed(1)} kg`,
        `Total Harvest: ${s.resources.totalHarvestKg.toFixed(1)} kg`,
        `Water Recycling Efficiency: ${(s.waterRecyclingEfficiency * 100).toFixed(1)}%`,
        "",
        "--- Nutrition (4-crew daily) ---",
        `Calories: ${s.nutritionalOutput.caloriesPerDay.toFixed(0)} kcal/day`,
        `Protein: ${s.nutritionalOutput.proteinGPerDay.toFixed(1)} g/day`,
        `Nutritional Coverage: ${(s.nutritionalCoverage * 100).toFixed(1)}%`,
        "",
        "--- Greenhouse Controls ---",
        `Heating Power: ${s.greenhouseControls.globalHeatingPower} W`,
        `CO2 Injection: ${s.greenhouseControls.co2InjectionRate} ppm/h`,
        `Ventilation: ${s.greenhouseControls.ventilationRate} m3/h`,
        `Lighting: ${s.greenhouseControls.lightingPower} W`,
        "",
        "--- Crop Overview ---",
        ...Object.entries(s.crops).map(([name, c]) =>
          c
            ? `${name}: stage=${c.stage} health=${(c.healthScore * 100).toFixed(0)}% yield=${c.estimatedYieldKg.toFixed(1)}kg biomass=${c.biomassKg.toFixed(1)}kg`
            : `${name}: no data`
        ),
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );

  return mcp;
}
