import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  chart?: Record<string, unknown>;
  toolCalls?: string[];
  timestamp: number;
}

export interface LLMConfig {
  provider: "openai" | "deepseek" | "custom";
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentTool: string | null;
  llmConfig: LLMConfig;
  addMessage: (msg: Message) => void;
  updateLastAssistant: (content: string) => void;
  appendToLastAssistant: (delta: string) => void;
  setLastChart: (chart: Record<string, unknown>) => void;
  setLoading: (loading: boolean) => void;
  setCurrentTool: (tool: string | null) => void;
  setLLMConfig: (config: Partial<LLMConfig>) => void;
  clearMessages: () => void;
}

const defaultConfig: LLMConfig = {
  provider: "deepseek",
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  temperature: 0,
};

// 从 localStorage 恢复配置
const loadConfig = (): LLMConfig => {
  if (typeof window === "undefined") return defaultConfig;
  try {
    const saved = localStorage.getItem("llm-config");
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  } catch {
    return defaultConfig;
  }
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  currentTool: null,
  llmConfig: loadConfig(),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistant: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),

  appendToLastAssistant: (delta) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + delta };
      }
      return { messages: msgs };
    }),

  setLastChart: (chart: Record<string, unknown>) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, chart };
      }
      return { messages: msgs };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setCurrentTool: (tool) => set({ currentTool: tool }),

  setLLMConfig: (config) =>
    set((s) => {
      const newConfig = { ...s.llmConfig, ...config };
      if (typeof window !== "undefined") {
        localStorage.setItem("llm-config", JSON.stringify(newConfig));
      }
      return { llmConfig: newConfig };
    }),

  clearMessages: () => set({ messages: [] }),
}));
