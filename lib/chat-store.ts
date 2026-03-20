import { create } from "zustand";
import type { ChatMessageData, ToolCallData } from "@/components/chat/chat-message";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { saveJSON, loadJSON, STORAGE_KEYS } from "@/lib/persistence";

// ─── Persistence helpers ─────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessageData = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to the Mars greenhouse. I can help you monitor conditions, adjust parameters, and optimize crop growth. What would you like to know?",
};

interface PersistedChat {
  messages: ChatMessageData[];
  threadId: string;
}

function loadPersistedChat(): { messages: ChatMessageData[]; threadId: string } {
  const saved = loadJSON<PersistedChat>(STORAGE_KEYS.chat);
  if (saved?.messages && saved.messages.length > 0) {
    return { messages: saved.messages, threadId: saved.threadId ?? `thread-${Date.now()}` };
  }
  return { messages: [WELCOME_MESSAGE], threadId: `thread-${Date.now()}` };
}

function persistChat(messages: ChatMessageData[], threadId: string): void {
  // Cap stored messages to the last 200 to avoid bloating localStorage
  saveJSON(STORAGE_KEYS.chat, { messages: messages.slice(-200), threadId });
}

// ─── Store ───────────────────────────────────────────────────────────────────────

export interface ChatState {
  messages: ChatMessageData[];
  isStreaming: boolean;
  threadId: string;

  addMessage: (message: ChatMessageData) => void;
  updateMessage: (id: string, patch: Partial<ChatMessageData>) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
  sendMessage: (text: string) => Promise<void>;
  hydrateFromStorage: () => void;
}

const initialChat = { messages: [WELCOME_MESSAGE], threadId: "thread-init" };

export const useChatStore = create<ChatState>((set, get) => ({
  messages: initialChat.messages,
  isStreaming: false,
  threadId: initialChat.threadId,

  addMessage: (message) =>
    set((state) => {
      const messages = [...state.messages, message];
      persistChat(messages, state.threadId);
      return { messages };
    }),

  updateMessage: (id, patch) =>
    set((state) => {
      const messages = state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      );
      persistChat(messages, state.threadId);
      return { messages };
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  clearMessages: () => {
    const threadId = `thread-${Date.now()}`;
    persistChat([], threadId);
    set({
      messages: [],
      threadId,
    });
  },

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

                const batchOps = { harvests: [] as string[], plants: [] as { tileId: string; crop: string }[], clears: [] as string[] };

                for (const c of parsed.result.changes as Array<{ type: string; param?: string; value?: number; crop?: string; harvests?: string[]; plants?: Array<{ tileId: string; crop: string }>; clears?: string[] }>) {
                  if (c.type === "batch-tile") {
                    if (c.harvests) batchOps.harvests.push(...c.harvests);
                    if (c.plants) batchOps.plants.push(...c.plants);
                    if (c.clears) batchOps.clears.push(...c.clears);
                  } else if (c.type === "harvest" && c.crop) {
                    store.doHarvest(c.crop as Parameters<typeof store.doHarvest>[0]);
                  } else if (c.type === "replant" && c.crop) {
                    store.doReplant(c.crop as Parameters<typeof store.doReplant>[0]);
                  } else if ((c.type === "greenhouse" || c.type === "crop") && c.param && c.value !== undefined) {
                    paramChanges.push(c as typeof paramChanges[number]);
                  }
                }

                if (batchOps.harvests.length > 0 || batchOps.plants.length > 0 || batchOps.clears.length > 0) {
                  store.doBatchTile(batchOps);
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

  hydrateFromStorage: () => {
    const loaded = loadPersistedChat();
    set({ messages: loaded.messages, threadId: loaded.threadId });
  },
}));
