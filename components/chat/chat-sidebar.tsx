"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { useAnimationConfig } from "@/lib/use-animation-config";

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
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 pt-16 pb-4 scrollbar-none"
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
