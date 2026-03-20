"use client";

import * as React from "react";
import { useConversation } from "@elevenlabs/react";
import { useGreenhouseStore } from "./greenhouse-store";
import type { CropType } from "./greenhouse-store";

// ── Context ─────────────────────────────────────────────────────────────────────

interface ElevenLabsCallState {
  status: string;
  isSpeaking: boolean;
  isMuted: boolean;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  getInputVolume: () => number;
  getOutputVolume: () => number;
}

const ElevenLabsCallContext = React.createContext<ElevenLabsCallState | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────────

export function ElevenLabsCallProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = React.useState(false);

  const conversation = useConversation({
    micMuted: isMuted,
    clientTools: {
      getEnvironmentSnapshot: async () => {
        const snap = useGreenhouseStore.getState().getEnvironmentSnapshot();
        return JSON.stringify(snap);
      },
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
      harvestCrop: async (params: { crop: string }) => {
        useGreenhouseStore.getState().doHarvest(params.crop as CropType);
        return `Harvested all ${params.crop} tiles`;
      },
      replantCrop: async (params: { crop: string }) => {
        useGreenhouseStore.getState().doReplant(params.crop as CropType);
        return `Replanted all harvested ${params.crop} tiles`;
      },
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
      setSimulationSpeed: async (params: { speed: string }) => {
        useGreenhouseStore
          .getState()
          .setSpeed(
            params.speed as
              | "x1"
              | "x2"
              | "x5"
              | "x10"
              | "x20"
              | "x50"
              | "x100"
              | "x1000"
              | "x5000"
              | "x10000",
          );
        return `Simulation speed set to ${params.speed}`;
      },
      toggleAutonomousAgent: async (params: { enabled: boolean }) => {
        useGreenhouseStore.getState().setAutonomousEnabled(params.enabled);
        return `Autonomous agent ${params.enabled ? "enabled" : "disabled"}`;
      },
    },
    onConnect: () => console.log("[ElevenLabs] Connected"),
    onDisconnect: () => {
      console.log("[ElevenLabs] Disconnected");
      setIsMuted(false);
    },
    onError: (error: unknown) => console.error("[ElevenLabs] Error:", error),
  });

  const conversationRef = React.useRef(conversation);

  React.useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const startCall = React.useCallback(async () => {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    if (!agentId) {
      console.error("[ElevenLabs] NEXT_PUBLIC_ELEVENLABS_AGENT_ID is not set");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId, connectionType: "webrtc" });
    } catch (err) {
      console.error("[ElevenLabs] Failed to start session:", err);
    }
  }, [conversation]);

  const endCall = React.useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("[ElevenLabs] Failed to end session:", err);
    }
  }, [conversation]);

  const toggleMute = React.useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const getInputVolume = React.useCallback(() => {
    return conversationRef.current.getInputVolume();
  }, []);

  const getOutputVolume = React.useCallback(() => {
    return conversationRef.current.getOutputVolume();
  }, []);

  const value = React.useMemo<ElevenLabsCallState>(
    () => ({
      status: conversation.status,
      isSpeaking: conversation.isSpeaking,
      isMuted,
      startCall,
      endCall,
      toggleMute,
      getInputVolume,
      getOutputVolume,
    }),
    [
      conversation.status,
      conversation.isSpeaking,
      isMuted,
      startCall,
      endCall,
      toggleMute,
      getInputVolume,
      getOutputVolume,
    ],
  );

  return (
    <ElevenLabsCallContext.Provider value={value}>
      {children}
    </ElevenLabsCallContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useElevenLabsCall(): ElevenLabsCallState {
  const ctx = React.useContext(ElevenLabsCallContext);
  if (!ctx) {
    throw new Error(
      "useElevenLabsCall must be used within <ElevenLabsCallProvider>",
    );
  }
  return ctx;
}
