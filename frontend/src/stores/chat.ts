import { create } from "zustand";
import {
  fetchConversations,
  fetchConversation,
  saveConversation,
  updateConversation,
  deleteConversationApi,
} from "@/lib/api";

// ─── Types ───

export interface ToolCall {
  name: string;
  arguments?: string;
  output?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  chart?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface LLMConfig {
  provider: "openai" | "deepseek" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

// ─── Store ───

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  currentTool: string | null;
  currentAgent: string | null;

  // Conversation CRUD
  createConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;

  // Active conversation selectors
  getActive: () => Conversation | null;
  getMessages: () => Message[];

  // Message operations (on active conversation)
  addMessage: (msg: Message) => void;
  appendToLastAssistant: (delta: string) => void;
  appendToLastReasoning: (delta: string) => void;
  addToolCall: (tool: ToolCall) => void;
  setLastToolOutput: (callId: string | undefined, output: string) => void;
  setLastChart: (chart: Record<string, unknown>) => void;
  removeLastAssistant: () => void;
  truncateFromIndex: (index: number) => void;
  flushConversation: () => void;

  // Streaming state
  setLoading: (loading: boolean) => void;
  setCurrentTool: (tool: string | null) => void;
  setCurrentAgent: (agent: string | null) => void;
}

// ─── Storage ───

const STORAGE_KEY = "chat-conversations";
const ACTIVE_KEY = "chat-active-id";

function loadConversations(): { conversations: Conversation[]; activeId: string | null } {
  if (typeof window === "undefined") return { conversations: [], activeId: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const conversations: Conversation[] = raw ? JSON.parse(raw) : [];
    const activeId = localStorage.getItem(ACTIVE_KEY);
    return { conversations, activeId };
  } catch {
    return { conversations: [], activeId: null };
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }
}

// ─── Backend sync ───

async function syncFromBackend() {
  try {
    const summaries = await fetchConversations();
    if (summaries.length === 0) return;

    // Load full conversations (with messages) from backend
    const convs: Conversation[] = await Promise.all(
      summaries.map(async (s) => {
        try {
          const detail = await fetchConversation(s.id);
          return {
            id: detail.id,
            title: detail.title,
            messages: detail.messages as Message[],
            createdAt: detail.created_at,
            updatedAt: detail.updated_at,
          };
        } catch {
          return null;
        }
      }),
    ).then((results) => results.filter(Boolean) as Conversation[]);

    if (convs.length > 0) {
      useChatStore.setState({ conversations: convs });
      saveConversations(convs);
      const activeId = useChatStore.getState().activeId;
      if (!activeId || !convs.find((c) => c.id === activeId)) {
        useChatStore.setState({ activeId: convs[0].id });
        saveActiveId(convs[0].id);
      }
    }
  } catch {
    // Backend unavailable, use localStorage
  }
}

function saveActiveId(id: string | null) {
  if (typeof window !== "undefined") {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }
}

function createNewConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "新对话";
  const text = firstUser.content.trim();
  return text.length > 30 ? text.slice(0, 30) + "..." : text || "新对话";
}

// ─── Init ───

const init = loadConversations();
const initialConv = init.conversations.length > 0
  ? init.conversations[0]
  : createNewConversation();

const initialConversations = init.conversations.length > 0
  ? init.conversations
  : [initialConv];

// ─── Export store ───

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: initialConversations,
  activeId: init.activeId || initialConv.id,
  isLoading: false,
  currentTool: null,
  currentAgent: null,

  // ── Conversation CRUD ──

  createConversation: () => {
    const conv = createNewConversation();
    set((s) => {
      const conversations = [conv, ...s.conversations];
      saveConversations(conversations);
      saveActiveId(conv.id);
      return { conversations, activeId: conv.id };
    });
    saveConversation({
      id: conv.id,
      title: conv.title,
      messages: conv.messages,
      created_at: conv.createdAt,
      updated_at: conv.updatedAt,
    });
    return conv.id;
  },

  switchConversation: (id) => {
    set({ activeId: id });
    saveActiveId(id);
  },

  deleteConversation: (id) => {
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      let activeId = s.activeId;

      if (conversations.length === 0) {
        const fallback = createNewConversation();
        conversations.push(fallback);
        activeId = fallback.id;
        saveConversation({
          id: fallback.id,
          title: fallback.title,
          messages: fallback.messages,
          created_at: fallback.createdAt,
          updated_at: fallback.updatedAt,
        });
      } else if (activeId === id) {
        activeId = conversations[0].id;
      }

      saveConversations(conversations);
      saveActiveId(activeId);
      return { conversations, activeId };
    });
    deleteConversationApi(id);
  },

  renameConversation: (id, title) => {
    set((s) => {
      const conversations = s.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
      );
      saveConversations(conversations);
      return { conversations };
    });
    updateConversation(id, { title, updated_at: Date.now() });
  },

  // ── Selectors ──

  getActive: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId) || conversations[0] || null;
  },

  getMessages: () => {
    const active = get().getActive();
    return active?.messages || [];
  },

  // ── Message operations (on active conversation) ──

  addMessage: (msg) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const messages = [...c.messages, msg];
        const title = c.title === "新对话" ? deriveTitle(messages) : c.title;
        const updatedAt = Date.now();
        // Sync to backend
        updateConversation(c.id, { title, messages, updated_at: updatedAt });
        return { ...c, messages, title, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  appendToLastAssistant: (delta) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: last.content + delta };
        }
        return { ...c, messages: msgs, updatedAt: Date.now() };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  appendToLastReasoning: (delta) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, reasoning: (last.reasoning || "") + delta };
        }
        return { ...c, messages: msgs };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  addToolCall: (tool) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          const toolCalls = [...(last.toolCalls || []), tool];
          msgs[msgs.length - 1] = { ...last, toolCalls };
        }
        return { ...c, messages: msgs };
      });
      return { conversations };
    }),

  setLastToolOutput: (callId, output) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant" && last.toolCalls) {
          const toolCalls = [...last.toolCalls];
          // Set output on the last tool call without output yet
          const idx = toolCalls.findLastIndex((t) => !t.output);
          if (idx >= 0) {
            toolCalls[idx] = { ...toolCalls[idx], output };
          }
          msgs[msgs.length - 1] = { ...last, toolCalls };
        }
        return { ...c, messages: msgs };
      });
      return { conversations };
    }),

  setLastChart: (chart) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, chart };
        }
        return { ...c, messages: msgs };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  removeLastAssistant: () =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") {
          msgs.pop();
        }
        const updatedAt = Date.now();
        updateConversation(c.id, { messages: msgs, updated_at: updatedAt });
        return { ...c, messages: msgs, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  truncateFromIndex: (index) =>
    set((s) => {
      const conversations = s.conversations.map((c) => {
        if (c.id !== s.activeId) return c;
        const msgs = c.messages.slice(0, index);
        const updatedAt = Date.now();
        updateConversation(c.id, { messages: msgs, updated_at: updatedAt });
        return { ...c, messages: msgs, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  flushConversation: () => {
    const { conversations, activeId } = get();
    const conv = conversations.find((c) => c.id === activeId);
    if (conv) {
      updateConversation(conv.id, {
        title: conv.title,
        messages: conv.messages,
        updated_at: conv.updatedAt,
      });
    }
  },

  // ── Streaming state ──

  setLoading: (loading) => set({ isLoading: loading }),
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setCurrentAgent: (agent) => set({ currentAgent: agent }),
}));

// Sync from backend on client init
if (typeof window !== "undefined") {
  syncFromBackend();
}
