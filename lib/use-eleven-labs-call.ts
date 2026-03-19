"use client";

import { useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { useGreenhouseStore } from "./greenhouse-store";
import type { CropType } from "./greenhouse-store";

/**
 * Hook wrapping the ElevenLabs Conversational AI agent with client tools
 * that mirror the Mastra greenhouse agent's capabilities.
 *
 * Requires NEXT_PUBLIC_ELEVENLABS_AGENT_ID in env.
 */
export function useElevenLabsCall() {
  const conversation = useConversation({
    clientTools: {
      // ── Observation ──────────────────────────────────────────────
      getEnvironmentSnapshot: async () => {
        const snapshot = useGreenhouseStore.getState().getEnvironmentSnapshot();
        return JSON.stringify(snapshot);
      },

      // ── Global + per-crop parameter control ──────────────────────
      setGreenhouseParameters: async (params: {
        changes: Array<{
          type: "greenhouse" | "crop";
          param: string;
          value: number;
          crop?: string;
        }>;
      }) => {
        useGreenhouseStore.getState().applyParameterChanges(params.changes);
        return "Parameters applied successfully";
      },

      // ── Bulk crop lifecycle ──────────────────────────────────────
      harvestCrop: async (params: { crop: string }) => {
        useGreenhouseStore.getState().doHarvest(params.crop as CropType);
        return `Harvested all ${params.crop} tiles`;
      },

      replantCrop: async (params: { crop: string }) => {
        useGreenhouseStore.getState().doReplant(params.crop as CropType);
        return `Replanted all harvested ${params.crop} tiles`;
      },

      // ── Per-tile operations ──────────────────────────────────────
      harvestTile: async (params: { tileId: string }) => {
        useGreenhouseStore.getState().doHarvestTile(params.tileId);
        return `Harvested tile ${params.tileId}`;
      },

      plantTile: async (params: { tileId: string; crop: string }) => {
        useGreenhouseStore
          .getState()
          .doPlantTile(params.tileId, params.crop as CropType);
        return `Planted ${params.crop} on tile ${params.tileId}`;
      },

      clearTile: async (params: { tileId: string }) => {
        useGreenhouseStore.getState().doClearTile(params.tileId);
        return `Cleared tile ${params.tileId}`;
      },

      // ── Simulation controls ──────────────────────────────────────
      setSimulationSpeed: async (params: { speed: string }) => {
        useGreenhouseStore.getState().setSpeed(params.speed as "x1" | "x2" | "x5" | "x10" | "x20" | "x50" | "x100" | "x1000" | "x5000" | "x10000");
        return `Simulation speed set to ${params.speed}`;
      },

      toggleAutonomousAgent: async (params: { enabled: boolean }) => {
        useGreenhouseStore.getState().setAutonomousEnabled(params.enabled);
        return `Autonomous agent ${params.enabled ? "enabled" : "disabled"}`;
      },
    },

    onConnect: () => console.log("[ElevenLabs] Connected"),
    onDisconnect: () => console.log("[ElevenLabs] Disconnected"),
    onError: (error) => console.error("[ElevenLabs] Error:", error),
  });

  const startCall = useCallback(async () => {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    if (!agentId) {
      console.error(
        "[ElevenLabs] NEXT_PUBLIC_ELEVENLABS_AGENT_ID is not set"
      );
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId, connectionType: "webrtc" });
    } catch (err) {
      console.error("[ElevenLabs] Failed to start session:", err);
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("[ElevenLabs] Failed to end session:", err);
    }
  }, [conversation]);

  return {
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
    startCall,
    endCall,
  } as const;
}
