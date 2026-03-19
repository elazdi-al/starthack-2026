"use client";

import { cn } from "@/lib/utils";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
          isUser
            ? "bg-[#007AFF] text-white rounded-br-md"
            : "bg-[var(--accent)] text-[var(--foreground)] rounded-bl-md"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
