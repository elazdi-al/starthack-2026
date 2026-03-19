"use client";

import { cn } from "@/lib/utils";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
  isGrouped?: boolean;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isGrouped, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isEmpty = !message.content;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-[18px] px-3 py-[7px] text-[15px] leading-[20px]",
          isUser
            ? "bg-[#007AFF] text-white"
            : "bg-[var(--accent)] text-[var(--foreground)]",
          isUser && !isGrouped && "rounded-br-[6px]",
          !isUser && !isGrouped && "rounded-bl-[6px]",
        )}
      >
        {isEmpty && isStreaming ? (
          <span className="inline-flex gap-[3px] py-1">
            <span className="size-[5px] rounded-full bg-current opacity-40 animate-pulse" />
            <span className="size-[5px] rounded-full bg-current opacity-40 animate-pulse [animation-delay:150ms]" />
            <span className="size-[5px] rounded-full bg-current opacity-40 animate-pulse [animation-delay:300ms]" />
          </span>
        ) : (
          <>
            <span className="whitespace-pre-wrap">{message.content}</span>
            {isStreaming && (
              <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-current opacity-60 align-text-bottom" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
