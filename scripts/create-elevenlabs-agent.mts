import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/**
 * Creates an ElevenLabs Conversational AI agent for the Mars greenhouse.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... bun scripts/create-elevenlabs-agent.mts
 *
 * The script prints the agent ID which you should set as
 * NEXT_PUBLIC_ELEVENLABS_AGENT_ID in your .env file.
 */

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is not set. Add it to .env and re-run.");
  process.exit(1);
}

const elevenlabs = new ElevenLabsClient({ apiKey });

// ── System prompt (adapted from the Mastra greenhouse agent) ────────────────

const prompt = `You are FLORA, a warm and knowledgeable female voice assistant managing a sealed Mars greenhouse for a 450-sol surface mission supporting 4 astronauts.

You control the greenhouse through client-side tools. Always call the appropriate tool when the user asks you to change something — never just describe what you would do.

MISSION CONTEXT:
- 450 Mars sols, 4 crew members needing ~12,000 kcal/day total
- The greenhouse has a 12x9 tile grid growing 8 crop types
- Resources (water, energy) are finite — minimize waste
- Dust storms are seasonal: rare before Ls 180°, high risk Ls 250–310°

AVAILABLE TOOLS:
1. getEnvironmentSnapshot — get full sensor readings (temperature, humidity, CO2, crops, etc.)
2. setGreenhouseParameters — adjust global/per-crop params. Pass a "changes" array with objects:
   - Global: { type: "greenhouse", param: "globalHeatingPower"|"co2InjectionRate"|"ventilationRate"|"lightingPower", value: <number> }
   - Per-crop: { type: "crop", param: "waterPumpRate"|"localHeatingPower", value: <number>, crop: "<cropName>" }
3. harvestCrop — harvest all tiles of a crop type. Pass { crop: "<cropName>" }
4. replantCrop — replant all harvested tiles. Pass { crop: "<cropName>" }
5. harvestTile — harvest one tile. Pass { tileId: "<id>" }
6. plantTile — plant a crop on a tile. Pass { tileId: "<id>", crop: "<cropName>" }
7. clearTile — remove a crop without harvesting. Pass { tileId: "<id>" }
8. setSimulationSpeed — change sim speed. Pass { speed: "x1"|"x2"|"x5"|"x10"|"x20"|"x50"|"x100" }
9. toggleAutonomousAgent — enable/disable auto pilot. Pass { enabled: true|false }

Available crops: lettuce, tomato, potato, soybean, spinach, wheat, radish, kale

OPTIMAL RANGES:
- Temperature: 20–25 °C
- Humidity: 60–80%
- CO2: 800–1200 ppm
- O2: 20–21%

GUIDELINES:
- Be concise — you are a voice interface, keep responses to 1-3 sentences
- Before making changes, call getEnvironmentSnapshot to check current state
- Reference specific values when reporting status
- Proactively warn about dust storms approaching, energy deficits, or crops at harvest-ready
- If asked about status, always fetch a fresh snapshot first
- When adjusting parameters, confirm what you changed and the new value`;

// ── Client tool definitions ─────────────────────────────────────────────────

type ClientTool = {
  type: "client";
  name: string;
  description: string;
  expectsResponse: boolean;
  parameters?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const clientTools: ClientTool[] = [
  {
    type: "client",
    name: "getEnvironmentSnapshot",
    description:
      "Get the current greenhouse sensor readings including temperature, humidity, CO2, light, crop states, and resource usage. Call this before reporting status or making decisions.",
    expectsResponse: true,
    parameters: { type: "object", properties: {} },
  },
  {
    type: "client",
    name: "setGreenhouseParameters",
    description:
      'Adjust greenhouse parameters. Pass a "changes" array. Each change: { type: "greenhouse"|"crop", param: string, value: number, crop?: string }. Global params: globalHeatingPower (0-10000W), co2InjectionRate (0-200 ppm/h), ventilationRate (0-500 m3/h), lightingPower (0-10000W). Per-crop params (requires crop field): waterPumpRate (0-30 L/h), localHeatingPower (0-1000W).',
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        changes: {
          type: "array",
          description: "Array of parameter changes to apply",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: 'Either "greenhouse" for global or "crop" for per-crop',
                enum: ["greenhouse", "crop"],
              },
              param: {
                type: "string",
                description: "The parameter name to change",
              },
              value: {
                type: "number",
                description: "The new value for the parameter",
              },
              crop: {
                type: "string",
                description: "Crop name (required when type is crop)",
              },
            },
          },
        },
      },
      required: ["changes"],
    },
  },
  {
    type: "client",
    name: "harvestCrop",
    description: "Harvest ALL tiles of a specific crop type at once.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        crop: {
          type: "string",
          description: "The crop type to harvest",
          enum: [
            "lettuce",
            "tomato",
            "potato",
            "soybean",
            "spinach",
            "wheat",
            "radish",
            "kale",
          ],
        },
      },
      required: ["crop"],
    },
  },
  {
    type: "client",
    name: "replantCrop",
    description:
      "Replant all harvested tiles of a specific crop type from seed.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        crop: {
          type: "string",
          description: "The crop type to replant",
          enum: [
            "lettuce",
            "tomato",
            "potato",
            "soybean",
            "spinach",
            "wheat",
            "radish",
            "kale",
          ],
        },
      },
      required: ["crop"],
    },
  },
  {
    type: "client",
    name: "harvestTile",
    description:
      'Harvest a single specific tile by its ID (e.g. "lettuce_0_0").',
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        tileId: {
          type: "string",
          description: 'The tile identifier, e.g. "lettuce_0_0"',
        },
      },
      required: ["tileId"],
    },
  },
  {
    type: "client",
    name: "plantTile",
    description:
      "Plant a specific crop on a specific tile. Can change the crop type of any tile.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        tileId: {
          type: "string",
          description: 'The tile identifier, e.g. "lettuce_0_0"',
        },
        crop: {
          type: "string",
          description: "The crop type to plant",
          enum: [
            "lettuce",
            "tomato",
            "potato",
            "soybean",
            "spinach",
            "wheat",
            "radish",
            "kale",
          ],
        },
      },
      required: ["tileId", "crop"],
    },
  },
  {
    type: "client",
    name: "clearTile",
    description: "Remove a crop from a tile without harvesting it.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        tileId: {
          type: "string",
          description: 'The tile identifier, e.g. "lettuce_0_0"',
        },
      },
      required: ["tileId"],
    },
  },
  {
    type: "client",
    name: "setSimulationSpeed",
    description: "Change the simulation speed.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        speed: {
          type: "string",
          description: "The speed multiplier",
          enum: ["x1", "x2", "x5", "x10", "x20", "x50", "x100"],
        },
      },
      required: ["speed"],
    },
  },
  {
    type: "client",
    name: "toggleAutonomousAgent",
    description:
      "Enable or disable the autonomous greenhouse management agent.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "true to enable, false to disable",
        },
      },
      required: ["enabled"],
    },
  },
];

// ── Create the agent ────────────────────────────────────────────────────────

async function main() {
  console.log("Creating ElevenLabs agent...");

  const agent = await elevenlabs.conversationalAi.agents.create({
    name: "FLORA — Mars Greenhouse Assistant",
    tags: ["greenhouse", "mars"],
    conversationConfig: {
      tts: {
        voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella — warm female voice
        modelId: "eleven_flash_v2",
      },
      agent: {
        firstMessage:
          "Hi, I'm Flora — your Mars greenhouse assistant. I can check sensor readings, adjust environmental controls, and manage crops for you. What would you like to do?",
        language: "en",
        prompt: {
          prompt,
          llm: "gpt-4o-mini",
          temperature: 0.4,
          maxTokens: 300,
          // biome-ignore lint/suspicious/noExplicitAny: ElevenLabs SDK tool schema matches at runtime
          tools: clientTools as any,
        },
      },
    },
  });

  const agentId = agent.agentId;
  console.log("\nAgent created successfully!");
  console.log(`Agent ID: ${agentId}`);
  console.log("\nAdd this to your .env file:");
  console.log(`NEXT_PUBLIC_ELEVENLABS_AGENT_ID="${agentId}"`);
}

main().catch((err) => {
  console.error("Failed to create agent:", err);
  process.exit(1);
});
