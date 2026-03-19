import { create } from "zustand";
import type { ChatMessageData, ToolCallData } from "@/components/chat/chat-message";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

export interface ChatState {
  messages: ChatMessageData[];
  isStreaming: boolean;
  threadId: string;

  addMessage: (message: ChatMessageData) => void;
  updateMessage: (id: string, patch: Partial<ChatMessageData>) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to the Mars greenhouse. I can help you monitor conditions, adjust parameters, and optimize crop growth. What would you like to know?",
    },
  ],
  isStreaming: false,
  threadId: `thread-${Date.now()}`,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  clearMessages: () =>
    set({
      messages: [],
      threadId: `thread-${Date.now()}`,
    }),

  sendMessage: async (text: string) => {
    const { addMessage, updateMessage, setStreaming, messages, threadId } =
      get();

    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    addMessage(userMsg);

    const assistantId = crypto.randomUUID();
    addMessage({ id: assistantId, role: "assistant", content: "" });
    setStreaming(true);

    try {
      const outgoing = [
        ...messages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      const greenhouseSnapshot =
        useGreenhouseStore.getState().getEnvironmentSnapshot();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: outgoing,
          threadId,
          resourceId: "dashboard-user",
          greenhouseState: greenhouseSnapshot,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        updateMessage(assistantId, {
          content: `Sorry, something went wrong (${res.status}). ${errText}`,
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        updateMessage(assistantId, { content: "No response stream available." });
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let toolCalls: ToolCallData[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);

            if (parsed.type === "text-delta" && typeof parsed.text === "string") {
              accumulated += parsed.text;
              updateMessage(assistantId, { content: accumulated });
            } else if (parsed.type === "tool-call") {
              const tc: ToolCallData = {
                toolCallId: parsed.toolCallId,
                toolName: parsed.toolName,
                args: parsed.args ?? {},
                status: "calling",
              };
              toolCalls = [...toolCalls, tc];
              updateMessage(assistantId, { toolCalls: [...toolCalls] });
            } else if (parsed.type === "tool-result") {
              toolCalls = toolCalls.map((tc) =>
                tc.toolCallId === parsed.toolCallId
                  ? {
                      ...tc,
                      result: parsed.result,
                      status: (parsed.result?.success === false ? "error" : "complete") as ToolCallData["status"],
                    }
                  : tc,
              );
              updateMessage(assistantId, { toolCalls: [...toolCalls] });

              if (
                parsed.toolName === "greenhouseParameterTool" &&
                parsed.result?.success &&
                Array.isArray(parsed.result.changes)
              ) {
                const store = useGreenhouseStore.getState();
                const paramChanges: Array<{ type: "greenhouse" | "crop"; param: string; value: number; crop?: string }> = [];

                for (const c of parsed.result.changes as Array<{ type: string; param?: string; value?: number; crop?: string; tileId?: string }>) {
                  if (c.type === "harvest" && c.crop) {
                    store.doHarvest(c.crop as Parameters<typeof store.doHarvest>[0]);
                  } else if (c.type === "replant" && c.crop) {
                    store.doReplant(c.crop as Parameters<typeof store.doReplant>[0]);
                  } else if (c.type === "plant-tile" && c.tileId && c.crop) {
                    store.doPlantTile(c.tileId, c.crop as Parameters<typeof store.doPlantTile>[1]);
                  } else if (c.type === "harvest-tile" && c.tileId) {
                    store.doHarvestTile(c.tileId);
                  } else if (c.type === "clear-tile" && c.tileId) {
                    store.doClearTile(c.tileId);
                  } else if ((c.type === "greenhouse" || c.type === "crop") && c.param && c.value !== undefined) {
                    paramChanges.push(c as typeof paramChanges[number]);
                  }
                }

                if (paramChanges.length > 0) {
                  useGreenhouseStore.getState().applyParameterChanges(paramChanges);
                }
              }
            } else if (parsed.type === "error") {
              updateMessage(assistantId, {
                content: accumulated || `Error: ${parsed.error}`,
              });
            } else if (typeof parsed === "string") {
              accumulated += parsed;
              updateMessage(assistantId, { content: accumulated });
            }
          } catch {
            // skip unparseable chunks
          }
        }
      }

      if (!accumulated && toolCalls.length === 0) {
        updateMessage(assistantId, {
          content:
            "I received your message but couldn't generate a response. Please try again.",
        });
      }
    } catch (err) {
      updateMessage(assistantId, {
        content: `Connection error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    } finally {
      setStreaming(false);
    }
  },
}));
