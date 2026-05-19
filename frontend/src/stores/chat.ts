import { create } from "zustand";
import {
  fetchConversation,
  fetchConversations,
  saveConversation,
  updateConversation,
  deleteConversationApi,
  type ChatEvent,
} from "@/lib/api";
import {
  applyChatEvent,
  migrateMessage,
  messageToPlainText,
  type BlockMessage,
  type LegacyMessage,
} from "@/lib/messages";

export interface ToolCall {
  name: string;
  arguments?: string;
  output?: string;
}

export type Message = BlockMessage & {
  content?: string;
  reasoning?: string;
  chart?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  timestamp?: number;
};

export type StoredMessage = Message | LegacyMessage;

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  isLoading?: boolean;
  currentTool?: string | null;
  currentAgent?: string | null;
}

interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface LLMConfig {
  provider: "openai" | "deepseek" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  thinking_mode: "thinking" | "fast";
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;

  createConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  batchDeleteConversations: (ids: string[]) => void;
  renameConversation: (id: string, title: string) => void;

  getActive: () => Conversation | null;
  getMessages: () => Message[];

  addMessage: (msg: StoredMessage) => void;
  appendToLastAssistant: (delta: string) => void;
  appendToLastReasoning: (delta: string) => void;
  addToolCall: (tool: ToolCall) => void;
  setLastToolOutput: (callId: string | undefined, output: string) => void;
  setLastChart: (chart: Record<string, unknown>) => void;
  applyEventToLastAssistant: (event: ChatEvent) => void;
  removeLastAssistant: () => void;
  truncateFromIndex: (index: number) => void;
  flushConversation: () => void;

  setLoading: (loading: boolean) => void;
  setCurrentTool: (tool: string | null) => void;
  setCurrentAgent: (agent: string | null) => void;

  // Conversation-scoped mutators (target by ID, not activeId)
  addMessageTo: (conversationId: string, msg: StoredMessage) => void;
  appendToAssistantOf: (conversationId: string, delta: string) => void;
  appendToReasoningOf: (conversationId: string, delta: string) => void;
  addToolCallTo: (conversationId: string, tool: ToolCall) => void;
  setToolOutputOf: (conversationId: string, callId: string | undefined, output: string) => void;
  setChartOf: (conversationId: string, chart: Record<string, unknown>) => void;
  applyEventToAssistantOf: (conversationId: string, event: ChatEvent) => void;
  removeLastAssistantOf: (conversationId: string) => void;
  setLoadingOf: (conversationId: string, loading: boolean) => void;
  setCurrentToolOf: (conversationId: string, tool: string | null) => void;
  setCurrentAgentOf: (conversationId: string, agent: string | null) => void;
}

const STORAGE_KEY = "chat-conversations";
const ACTIVE_KEY = "chat-active-id";

function withLegacyFields(message: BlockMessage, existing?: Partial<StoredMessage>): Message {
  return {
    ...message,
    content: messageToPlainText(message),
    reasoning: existing && "reasoning" in existing ? existing.reasoning : undefined,
    chart: existing && "chart" in existing ? existing.chart : undefined,
    toolCalls: existing && "toolCalls" in existing ? existing.toolCalls : undefined,
    timestamp: message.createdAt,
  };
}

function normalizeMessage(message: StoredMessage): Message {
  return withLegacyFields(migrateMessage(message), message);
}

function normalizeConversation(conv: StoredConversation): Conversation {
  return {
    ...conv,
    messages: conv.messages.map(normalizeMessage),
  };
}

function loadConversations(): { conversations: Conversation[]; activeId: string | null } {
  if (typeof window === "undefined") return { conversations: [], activeId: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as StoredConversation[] : [];
    const conversations = parsed.map(normalizeConversation);
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

// Debounced save for high-frequency streaming updates
let _saveTimeout: ReturnType<typeof setTimeout> | null = null;
let _pendingConversations: Conversation[] | null = null;
function saveConversationsDebounced(conversations: Conversation[]) {
  _pendingConversations = conversations;
  if (_saveTimeout) return;
  _saveTimeout = setTimeout(() => {
    _saveTimeout = null;
    if (_pendingConversations) {
      saveConversations(_pendingConversations);
      _pendingConversations = null;
    }
  }, 500);
}

function saveActiveId(id: string | null) {
  if (typeof window !== "undefined") {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }
}

async function syncFromBackend() {
  try {
    const summaries = await fetchConversations();
    if (summaries.length === 0) return;

    const convs: Conversation[] = await Promise.all(
      summaries.map(async (summary) => {
        try {
          const detail = await fetchConversation(summary.id);
          return normalizeConversation({
            id: detail.id,
            title: detail.title,
            messages: detail.messages as StoredMessage[],
            createdAt: detail.created_at,
            updatedAt: detail.updated_at,
          });
        } catch (e) {
          console.warn("[chat] Failed to fetch conversation", summary.id, e);
          return null;
        }
      }),
    ).then((results) => results.filter(Boolean) as Conversation[]);

    if (convs.length > 0) {
      useChatStore.setState({ conversations: convs });
      saveConversations(convs);
      const activeId = useChatStore.getState().activeId;
      if (!activeId || !convs.find((conv) => conv.id === activeId)) {
        useChatStore.setState({ activeId: convs[0].id });
        saveActiveId(convs[0].id);
      }
    }
  } catch (e) {
    console.warn("[chat] Backend sync failed, using localStorage:", e);
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
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return "新对话";
  const text = messageToPlainText(firstUser).trim();
  return text.length > 30 ? `${text.slice(0, 30)}...` : text || "新对话";
}

function updateActiveConversation(
  state: ChatState,
  updater: (conversation: Conversation) => Conversation,
): Conversation[] {
  return state.conversations.map((conversation) => {
    if (conversation.id !== state.activeId) return conversation;
    return updater(conversation);
  });
}

function updateConversationById(
  state: ChatState,
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): Conversation[] {
  return state.conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    return updater(conversation);
  });
}

function updateLastAssistantMessage(message: Message, updater: (message: Message) => Message): Message {
  if (message.role !== "assistant") return message;
  return updater(message);
}

const init = loadConversations();
const initialConv = init.conversations.length > 0 ? init.conversations[0] : createNewConversation();
const initialConversations = init.conversations.length > 0 ? init.conversations : [initialConv];

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: initialConversations,
  activeId: init.activeId || initialConv.id,

  createConversation: () => {
    const conv = createNewConversation();
    set((state) => {
      const conversations = [conv, ...state.conversations];
      saveConversations(conversations);
      saveActiveId(conv.id);
      return { conversations, activeId: conv.id };
    });
    void saveConversation({
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
    set((state) => {
      const conversations = state.conversations.filter((conversation) => conversation.id !== id);
      let activeId = state.activeId;

      if (conversations.length === 0) {
        const fallback = createNewConversation();
        conversations.push(fallback);
        activeId = fallback.id;
        void saveConversation({
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
    void deleteConversationApi(id);
  },

  batchDeleteConversations: (ids) => {
    const idSet = new Set(ids);
    set((state) => {
      const conversations = state.conversations.filter((c) => !idSet.has(c.id));
      let activeId = state.activeId;

      if (conversations.length === 0) {
        const fallback = createNewConversation();
        conversations.push(fallback);
        activeId = fallback.id;
        void saveConversation({
          id: fallback.id,
          title: fallback.title,
          messages: fallback.messages,
          created_at: fallback.createdAt,
          updated_at: fallback.updatedAt,
        });
      } else if (activeId && idSet.has(activeId)) {
        activeId = conversations[0].id;
      }

      saveConversations(conversations);
      saveActiveId(activeId);
      return { conversations, activeId };
    });
    for (const id of ids) {
      void deleteConversationApi(id);
    }
  },

  renameConversation: (id, title) => {
    set((state) => {
      const updatedAt = Date.now();
      const conversations = state.conversations.map((conversation) =>
        conversation.id === id ? { ...conversation, title, updatedAt } : conversation,
      );
      saveConversations(conversations);
      return { conversations };
    });
    void updateConversation(id, { title, updated_at: Date.now() });
  },

  getActive: () => {
    const { conversations, activeId } = get();
    return conversations.find((conversation) => conversation.id === activeId) || conversations[0] || null;
  },

  getMessages: () => get().getActive()?.messages || [],

  addMessage: (msg) =>
    set((state) => {
      const message = normalizeMessage(msg);
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages, message];
        const title = conversation.title === "新对话" ? deriveTitle(messages) : conversation.title;
        const updatedAt = Date.now();
        void updateConversation(conversation.id, { title, messages, updated_at: updatedAt });
        return { ...conversation, messages, title, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  appendToLastAssistant: (delta) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last) {
          const updated = withLegacyFields(applyChatEvent(last, { type: "text_delta", content: delta }), last);
          messages[messages.length - 1] = updateLastAssistantMessage(last, () => updated);
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  appendToLastReasoning: (delta) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          const updated = withLegacyFields(applyChatEvent(last, { type: "reasoning_delta", content: delta }), last);
          messages[messages.length - 1] = updated;
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  addToolCall: (tool) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          const toolCalls = [...(last.toolCalls || []), tool];
          const updated = withLegacyFields(applyChatEvent(last, { type: "tool_call", tool: tool.name, arguments: tool.arguments }), { ...last, toolCalls });
          messages[messages.length - 1] = { ...updated, toolCalls };
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  setLastToolOutput: (_callId, output) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          const toolCalls = [...(last.toolCalls || [])];
          const index = toolCalls.findLastIndex((tool) => !tool.output);
          if (index >= 0) toolCalls[index] = { ...toolCalls[index], output };
          const updated = withLegacyFields(applyChatEvent(last, { type: "tool_result", content: output }), { ...last, toolCalls });
          messages[messages.length - 1] = { ...updated, toolCalls };
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  setLastChart: (chart) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = withLegacyFields(
            { ...last, blocks: [...last.blocks, { id: `${last.id}-chart-${last.blocks.length}`, type: "chart", option: chart }], updatedAt: Date.now() },
            { ...last, chart },
          );
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  applyEventToLastAssistant: (event) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = withLegacyFields(applyChatEvent(last, event), last);
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  removeLastAssistant: () =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") messages.pop();
        const updatedAt = Date.now();
        void updateConversation(conversation.id, { messages, updated_at: updatedAt });
        return { ...conversation, messages, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  truncateFromIndex: (index) =>
    set((state) => {
      const conversations = updateActiveConversation(state, (conversation) => {
        const messages = conversation.messages.slice(0, index);
        const updatedAt = Date.now();
        void updateConversation(conversation.id, { messages, updated_at: updatedAt });
        return { ...conversation, messages, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  flushConversation: () => {
    const conv = get().getActive();
    if (conv) {
      void updateConversation(conv.id, {
        title: conv.title,
        messages: conv.messages,
        updated_at: conv.updatedAt,
      });
    }
  },

  setLoading: (loading) => set((state) => {
    if (!state.activeId) return state;
    const conversations = updateConversationById(state, state.activeId, (c) => ({ ...c, isLoading: loading }));
    return { conversations };
  }),
  setCurrentTool: (tool) => set((state) => {
    if (!state.activeId) return state;
    const conversations = updateConversationById(state, state.activeId, (c) => ({ ...c, currentTool: tool }));
    return { conversations };
  }),
  setCurrentAgent: (agent) => set((state) => {
    if (!state.activeId) return state;
    const conversations = updateConversationById(state, state.activeId, (c) => ({ ...c, currentAgent: agent }));
    return { conversations };
  }),

  // Conversation-scoped mutators
  addMessageTo: (conversationId, msg) =>
    set((state) => {
      const message = normalizeMessage(msg);
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages, message];
        const title = conversation.title === "新对话" ? deriveTitle(messages) : conversation.title;
        const updatedAt = Date.now();
        void updateConversation(conversation.id, { title, messages, updated_at: updatedAt });
        return { ...conversation, messages, title, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  appendToAssistantOf: (conversationId, delta) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last) {
          const updated = withLegacyFields(applyChatEvent(last, { type: "text_delta", content: delta }), last);
          messages[messages.length - 1] = updateLastAssistantMessage(last, () => updated);
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  appendToReasoningOf: (conversationId, delta) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          const updated = withLegacyFields(applyChatEvent(last, { type: "reasoning_delta", content: delta }), last);
          messages[messages.length - 1] = updated;
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  addToolCallTo: (conversationId, tool) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          const toolCalls = [...(last.toolCalls || []), tool];
          const updated = withLegacyFields(applyChatEvent(last, { type: "tool_call", tool: tool.name, arguments: tool.arguments }), { ...last, toolCalls });
          messages[messages.length - 1] = { ...updated, toolCalls };
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  setToolOutputOf: (conversationId, _callId, output) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          const toolCalls = [...(last.toolCalls || [])];
          const index = toolCalls.findLastIndex((tool) => !tool.output);
          if (index >= 0) toolCalls[index] = { ...toolCalls[index], output };
          const updated = withLegacyFields(applyChatEvent(last, { type: "tool_result", content: output }), { ...last, toolCalls });
          messages[messages.length - 1] = { ...updated, toolCalls };
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  setChartOf: (conversationId, chart) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = withLegacyFields(
            { ...last, blocks: [...last.blocks, { id: `${last.id}-chart-${last.blocks.length}`, type: "chart", option: chart }], updatedAt: Date.now() },
            { ...last, chart },
          );
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  applyEventToAssistantOf: (conversationId, event) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = withLegacyFields(applyChatEvent(last, event), last);
        }
        return { ...conversation, messages, updatedAt: Date.now() };
      });
      saveConversationsDebounced(conversations);
      return { conversations };
    }),

  removeLastAssistantOf: (conversationId) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (conversation) => {
        const messages = [...conversation.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") messages.pop();
        const updatedAt = Date.now();
        void updateConversation(conversation.id, { messages, updated_at: updatedAt });
        return { ...conversation, messages, updatedAt };
      });
      saveConversations(conversations);
      return { conversations };
    }),

  setLoadingOf: (conversationId, loading) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (c) => ({ ...c, isLoading: loading }));
      return { conversations };
    }),

  setCurrentToolOf: (conversationId, tool) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (c) => ({ ...c, currentTool: tool }));
      return { conversations };
    }),

  setCurrentAgentOf: (conversationId, agent) =>
    set((state) => {
      const conversations = updateConversationById(state, conversationId, (c) => ({ ...c, currentAgent: agent }));
      return { conversations };
    }),
}));

if (typeof window !== "undefined") {
  void syncFromBackend();
}
