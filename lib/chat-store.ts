import { create } from "zustand";
import type { ChatMessageData } from "@/components/chat/chat-message";
import { useGreenhouseStore } from "@/lib/greenhouse-store";

export interface ChatState {
  messages: ChatMessageData[];
  isStreaming: boolean;
  threadId: string;

  addMessage: (message: ChatMessageData) => void;
  updateMessage: (id: string, content: string) => void;
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

  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m,
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
        updateMessage(
          assistantId,
          `Sorry, something went wrong (${res.status}). ${errText}`,
        );
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        updateMessage(assistantId, "No response stream available.");
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
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
            if (typeof parsed === "string") {
              accumulated += parsed;
              updateMessage(assistantId, accumulated);
            } else if (parsed?.error) {
              updateMessage(assistantId, `Error: ${parsed.error}`);
            }
          } catch {
            // skip unparseable chunks
          }
        }
      }

      if (!accumulated) {
        updateMessage(
          assistantId,
          "I received your message but couldn't generate a response. Please try again.",
        );
      }
    } catch (err) {
      updateMessage(
        assistantId,
        `Connection error: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      setStreaming(false);
    }
  },
}));
