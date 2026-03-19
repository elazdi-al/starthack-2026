"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChatMessage, type ChatMessageData } from "./chat-message";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui/button";
import { SidebarSimpleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const MOCK_MESSAGES: ChatMessageData[] = [
  {
    id: "1",
    role: "assistant",
    content: "Welcome to the greenhouse dashboard. How can I help you today?",
  },
  {
    id: "2",
    role: "user",
    content: "What's the current temperature in zone A?",
  },
  {
    id: "3",
    role: "assistant",
    content:
      "Zone A is currently at 24.3°C with 68% humidity. All readings are within the optimal range for your crop type.",
  },
  {
    id: "4",
    role: "user",
    content: "Can you lower it by 2 degrees?",
  },
  {
    id: "5",
    role: "assistant",
    content:
      "Done — I've adjusted the target temperature for Zone A to 22.3°C. The climate system will reach the new setpoint in approximately 12 minutes.",
  },
];

interface ChatSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSidebar({ open, onOpenChange }: ChatSidebarProps) {
  const [messages, setMessages] =
    React.useState<ChatMessageData[]>(MOCK_MESSAGES);
  const [inputValue, setInputValue] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages.length, scrollToBottom]);

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text) return;

    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    setTimeout(() => {
      const reply: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Thanks for your message. This is a mock response — connect a backend to enable real conversations.",
      };
      setMessages((prev) => [...prev, reply]);
    }, 600);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 340 }}
          className="fixed top-0 right-0 z-50 flex h-full w-[360px] flex-col border-l border-[var(--dial-border)] bg-[var(--dial-glass-bg)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="type-label text-[var(--dial-text-primary)]">
              Chat
            </span>
            <Button
              aria-label="Close chat"
              variant="ghost"
              size="icon-xs"
              className="text-[var(--dial-text-label)] hover:text-[var(--dial-text-primary)]"
              onClick={() => onOpenChange(false)}
            >
              <SidebarSimpleIcon size={18} weight="fill" />
            </Button>
          </div>

          <div className="mx-5 h-px bg-[var(--dial-border)]" />

          {/* Messages */}
          <div
            ref={scrollRef}
            className={cn(
              "flex-1 overflow-y-auto px-5 py-4 space-y-2.5",
              "scrollbar-none"
            )}
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <ChatMessage message={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="px-5 pb-5 pt-3">
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleSubmit}
              placeholder="Message…"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
