"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Phone, PhoneDisconnect } from "@phosphor-icons/react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { useAnimationConfig } from "@/lib/use-animation-config";
import { useElevenLabsCall } from "@/lib/use-eleven-labs-call";

interface ChatSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSidebar({ open }: ChatSidebarProps) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [inputValue, setInputValue] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const anim = useAnimationConfig();
  const { status, isSpeaking, startCall, endCall } = useElevenLabsCall();

  const isConnected = status === "connected";

  const handleCallToggle = React.useCallback(() => {
    if (isConnected) {
      endCall();
    } else {
      startCall();
    }
  }, [isConnected, startCall, endCall]);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages / stream updates
  React.useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, scrollToBottom]);

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue("");
    sendMessage(text);
  };

  return (
    <aside
      className={cn(
        "fixed top-0 right-0 z-50 flex h-full w-[360px] flex-col",
        "border-l border-[var(--dial-border)] bg-[var(--dial-glass-bg)]",
        "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Header — Call button (pt-7 aligns vertical center with sidebar toggle at top-6) */}
      <div className="shrink-0 px-5 pt-7 pb-4 flex items-center">
        <button
          type="button"
          onClick={handleCallToggle}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full",
            "text-[12px] font-medium tracking-[0.01em] transition-colors duration-150",
            "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            isConnected
              ? "bg-red-500/12 text-red-500 dark:bg-red-400/15 dark:text-red-400 hover:bg-red-500/18 dark:hover:bg-red-400/22"
              : "bg-[var(--dial-surface)] text-[var(--dial-text-secondary)] hover:bg-[var(--dial-surface-hover)] hover:text-[var(--dial-text-primary)]",
          )}
        >
          {isConnected ? (
            <PhoneDisconnect size={14} weight="fill" />
          ) : (
            <Phone size={14} weight="fill" />
          )}
          <span>{isConnected ? "End" : "Call"}</span>
          {isConnected && isSpeaking && (
            <span className="ml-0.5 size-1.5 rounded-full bg-current animate-pulse" />
          )}
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 pt-4 pb-4 scrollbar-none"
      >
        <div className="flex flex-col gap-[6px]">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const isGrouped = prev?.role === msg.role;
              const isLastAssistant =
                msg.role === "assistant" && i === messages.length - 1;

              return (
                <motion.div
                  key={msg.id}
                  initial={anim.enabled ? { opacity: 0, y: 8, scale: 0.97 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={anim.enabled ? { opacity: 0, y: -6 } : undefined}
                  transition={anim.enabled ? { duration: 0.2, ease: [0.32, 0.72, 0, 1] } : anim.instant}
                  className={cn(!isGrouped && i > 0 && "mt-2")}
                >
                  <ChatMessage
                    message={msg}
                    isGrouped={isGrouped}
                    isStreaming={isStreaming && isLastAssistant}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-5 pb-5 pt-2">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          disabled={isStreaming}
          placeholder="Message..."
        />
      </div>
    </aside>
  );
}
