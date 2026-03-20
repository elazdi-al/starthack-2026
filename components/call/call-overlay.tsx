"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowsIn,
  ArrowsOut,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
} from "@phosphor-icons/react";
import { ElevenLabsHomeOrb } from "@/components/call/elevenlabs-home-orb";
import { useElevenLabsCall } from "@/lib/use-eleven-labs-call";

const SHARED_LAYOUT_TRANSITION = {
  layout: {
    type: "spring" as const,
    stiffness: 400,
    damping: 40,
    duration: 0.6,
  },
};

const OVERLAY_PRESENCE_TRANSITION = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
  mass: 0.9,
};

const PILL_SHELL_STYLE: React.CSSProperties = {
  boxShadow:
    "0px 6px 16px 0px rgba(78, 50, 23, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)",
  height: "52px",
  minWidth: "180px",
  borderRadius: "30px",
};

const CARD_SHELL_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(245, 242, 239, 0.8)",
  boxShadow:
    "0px 6px 16px 0px rgba(78, 50, 23, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.1)",
  minHeight: "440px",
  borderRadius: "30px",
};

function useCallTimer(isActive: boolean) {
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(0);

  React.useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }

    startRef.current = Date.now();

    const intervalId = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isActive]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function MinimizedCallView({
  timer,
  getInputVolume,
  getOutputVolume,
  onExpand,
}: {
  timer: string;
  getInputVolume: () => number;
  getOutputVolume: () => number;
  onExpand: () => void;
}) {
  return (
    <motion.div
      key="pill"
      className="pointer-events-auto flex items-center justify-between rounded-[30px] bg-[#F5F2EF]/80 p-3 pl-[14px] pr-3 backdrop-blur-lg"
      layoutId="floating-agent"
      style={PILL_SHELL_STYLE}
      transition={SHARED_LAYOUT_TRANSITION}
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="relative"
          layoutId="orb"
          style={{ width: 31.5, height: 28 }}
        >
          <ElevenLabsHomeOrb
            displaySize={28}
            getInputVolume={getInputVolume}
            getOutputVolume={getOutputVolume}
          />
        </motion.div>

        <motion.span
          animate={{ opacity: 1 }}
          className="font-mono text-[12px] font-medium leading-none tabular-nums text-[rgba(0,0,0,0.5)]"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut", delay: 0.2 }}
        >
          {timer}
        </motion.span>
      </div>

      <motion.button
        aria-label="Expand"
        className="flex size-8 items-center justify-center rounded-[30px] bg-[rgba(0,0,0,0.06)] transition-colors duration-300 ease-in-out hover:bg-[rgba(0,0,0,0.1)]"
        layoutId="minimize-button"
        onClick={onExpand}
        type="button"
      >
        <ArrowsOut size={14} weight="bold" />
      </motion.button>
    </motion.div>
  );
}

function ExpandedCallView({
  timer,
  isMuted,
  getInputVolume,
  getOutputVolume,
  onMinimize,
  onToggleMute,
  onEndCall,
}: {
  timer: string;
  isMuted: boolean;
  getInputVolume: () => number;
  getOutputVolume: () => number;
  onMinimize: () => void;
  onToggleMute: () => void;
  onEndCall: () => void;
}) {
  return (
    <motion.div
      key="card"
      className="pointer-events-auto flex w-full max-w-[400px] flex-col items-center gap-2 rounded-[30px] px-8 pb-8 pt-4 backdrop-blur-xl"
      layoutId="floating-agent"
      style={CARD_SHELL_STYLE}
      transition={SHARED_LAYOUT_TRANSITION}
    >
      <div className="relative mb-8 flex w-full items-center justify-center">
        <span className="font-mono text-[14px] font-medium leading-none tabular-nums text-[rgba(0,0,0,0.5)]">
          {timer}
        </span>
        <motion.button
          animate={{ opacity: 1 }}
          aria-label="Minimize"
          className="absolute right-0 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.06)] transition-colors duration-300 ease-in-out hover:bg-[rgba(0,0,0,0.1)]"
          initial={{ opacity: 0 }}
          onClick={onMinimize}
          transition={{ duration: 0.3, delay: 0.2 }}
          type="button"
        >
          <ArrowsIn size={14} weight="bold" />
        </motion.button>
      </div>

      <div className="mb-4 flex flex-col items-center">
        <motion.div
          className="relative mb-4"
          layoutId="orb"
          style={{ width: 288, height: 256 }}
        >
          <ElevenLabsHomeOrb
            displaySize={256}
            getInputVolume={getInputVolume}
            getOutputVolume={getOutputVolume}
          />
        </motion.div>

        <div className="mb-7 flex flex-col items-center">
          <span className="text-[15px] font-medium text-[rgba(0,0,0,0.85)]">
            Flora
          </span>
          <span className="text-[12px] text-[rgba(0,0,0,0.5)]">
            Mars greenhouse assistant
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex size-12 items-center justify-center rounded-full bg-[rgba(0,0,0,0.06)] transition-colors duration-300 ease-in-out hover:bg-[rgba(0,0,0,0.1)]"
          onClick={onToggleMute}
          title={isMuted ? "Unmute" : "Mute"}
          type="button"
        >
          {isMuted ? (
            <MicrophoneSlash size={20} weight="fill" />
          ) : (
            <Microphone size={20} weight="fill" />
          )}
        </button>

        <button
          className="flex size-12 items-center justify-center rounded-full bg-[#FF6554] text-white transition-colors duration-300 ease-in-out hover:bg-[#E94735]"
          onClick={onEndCall}
          title="End call"
          type="button"
        >
          <PhoneDisconnect size={20} weight="fill" />
        </button>
      </div>
    </motion.div>
  );
}

export function CallOverlay() {
  const {
    status,
    isMuted,
    endCall,
    toggleMute,
    getInputVolume,
    getOutputVolume,
  } = useElevenLabsCall();
  const [expanded, setExpanded] = React.useState(false);
  const isConnected = status === "connected";
  const timer = useCallTimer(isConnected);

  React.useEffect(() => {
    if (!isConnected) {
      setExpanded(false);
    }
  }, [isConnected]);

  return (
    <AnimatePresence initial={false}>
      {isConnected ? (
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="pointer-events-none fixed bottom-4 left-0 z-50 flex w-full justify-center px-4"
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={OVERLAY_PRESENCE_TRANSITION}
        >
          <AnimatePresence initial={false}>
            {expanded ? (
              <ExpandedCallView
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
                isMuted={isMuted}
                onEndCall={endCall}
                onMinimize={() => setExpanded(false)}
                onToggleMute={toggleMute}
                timer={timer}
              />
            ) : (
              <MinimizedCallView
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
                onExpand={() => setExpanded(true)}
                timer={timer}
              />
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
