"use client";

import { cn } from "@/lib/utils";
import { GearSix, Check, CircleNotch } from "@phosphor-icons/react";

export interface ToolCallData {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "calling" | "complete" | "error";
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallData[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  isGrouped?: boolean;
  isStreaming?: boolean;
}

const PARAM_LABELS: Record<string, string> = {
  globalHeatingPower: "Heating",
  co2InjectionRate: "CO₂ rate",
  ventilationRate: "Ventilation",
  lightingPower: "Lighting",
  waterPumpRate: "Water pump",
  localHeatingPower: "Zone heat",
};

const PARAM_UNITS: Record<string, string> = {
  globalHeatingPower: "W",
  co2InjectionRate: "ppm/h",
  ventilationRate: "m³/h",
  lightingPower: "W",
  waterPumpRate: "L/h",
  localHeatingPower: "W",
};

function ToolCallCard({ toolCall }: { toolCall: ToolCallData }) {
  const changes = (toolCall.args?.changes as Array<{
    type: string;
    param: string;
    value: number;
    crop?: string;
  }>) ?? [];

  const isCalling = toolCall.status === "calling";
  const isError = toolCall.status === "error";

  return (
    <div
      className={cn(
        "mt-1.5 rounded-xl border px-3 py-2 text-[13px] leading-[18px]",
        "border-[var(--dial-border)] bg-[var(--dial-surface)]",
        "transition-opacity duration-200",
      )}
    >
      <div className="flex items-center gap-1.5 text-[var(--dial-text-secondary)]">
        {isCalling ? (
          <CircleNotch size={13} className="animate-spin" />
        ) : isError ? (
          <GearSix size={13} className="text-red-400" />
        ) : (
          <Check size={13} weight="bold" className="text-emerald-500" />
        )}
        <span className="font-medium">
          {isCalling ? "Adjusting parameters…" : isError ? "Failed" : "Parameters adjusted"}
        </span>
      </div>

      {changes.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5 text-[var(--dial-text-tertiary)]">
          {changes.map((c, i) => (
            <div key={`${c.param}-${i}`} className="flex items-center gap-1">
              <span className="opacity-50">→</span>
              <span>
                {PARAM_LABELS[c.param] ?? c.param}
                {c.crop ? ` (${c.crop})` : ""}
              </span>
              <span className="ml-auto tabular-nums font-medium text-[var(--dial-text-secondary)]">
                {c.value} {PARAM_UNITS[c.param] ?? ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message, isGrouped, isStreaming }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isEmpty = !message.content;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasContent = !isEmpty || hasToolCalls;

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      {/* Text bubble */}
      {(!isEmpty || (isEmpty && isStreaming && !hasToolCalls)) && (
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
      )}

      {/* Tool call cards */}
      {hasToolCalls && (
        <div className="w-full max-w-[82%]">
          {message.toolCalls?.map((tc) => (
            <ToolCallCard key={tc.toolCallId} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}
