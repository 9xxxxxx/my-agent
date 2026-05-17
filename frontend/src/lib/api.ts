import type { LLMConfig } from "@/stores/chat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatEvent {
  type: "text_delta" | "reasoning_delta" | "tool_call" | "tool_result" | "chart" | "agent_change" | "agent_status" | "handoff" | "error" | "done";
  content?: string;
  tool?: string;
  arguments?: string;
  call_id?: string;
  agent?: string;
  display_name?: string;
  target?: string;
  target_display?: string;
  status?: "entered" | "running" | "done";
  code?: string;
  message?: string;
  recoverable?: boolean;
}

export interface ChatHistoryMessage {
  role: string;
  content: string;
  reasoning?: string;
  toolCalls?: Array<{ name: string; arguments?: string; output?: string }>;
}

export async function* streamChat(
  message: string,
  config: LLMConfig,
  signal?: AbortSignal,
  databaseUrl?: string,
  history?: ChatHistoryMessage[],
  mode: "dev" | "prod" = "prod",
): AsyncGenerator<ChatEvent> {
  const body: Record<string, unknown> = {
    message,
    model: config.model,
    api_key: config.apiKey,
    base_url: config.baseUrl,
    mode,
  };
  if (databaseUrl) body.database_url = databaseUrl;
  if (history && history.length > 0) body.history = history;

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as ChatEvent;
          yield event;
        } catch {
          // skip malformed JSON
        }
      }
    }
  }
}

export async function uploadFile(file: File): Promise<{
  success?: boolean;
  table_name?: string;
  message?: string;
  error?: string;
}> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: form,
  });

  return response.json();
}

export async function getUploadedTables(): Promise<{
  tables: Array<{ table_name: string; source_file: string; rows: number; columns: number }>;
}> {
  const response = await fetch(`${API_BASE}/api/upload/tables`);
  return response.json();
}

export async function testConnection(databaseUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/db/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database_url: databaseUrl }),
  });
  return response.json();
}

// ─── Storage API (对话记录 & 配置持久化) ───

interface ConversationSummary {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

interface ConversationDetail {
  id: string;
  title: string;
  messages: unknown[];
  created_at: number;
  updated_at: number;
}

interface ProfileRow {
  id: string;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: number;
}

// Conversations

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_BASE}/api/conversations`);
  return res.json();
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`);
  return res.json();
}

export async function saveConversation(conv: {
  id: string;
  title: string;
  messages: unknown[];
  created_at: number;
  updated_at: number;
}): Promise<void> {
  await fetch(`${API_BASE}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conv),
  }).catch(() => {});
}

export async function updateConversation(id: string, patch: {
  title?: string;
  messages?: unknown[];
  updated_at?: number;
}): Promise<void> {
  await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

export async function deleteConversationApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: "DELETE",
  }).catch(() => {});
}

// LLM Profiles

export async function fetchLLMProfiles(): Promise<ProfileRow[]> {
  const res = await fetch(`${API_BASE}/api/connections/llm`);
  return res.json();
}

export async function saveLLMProfile(profile: {
  id: string;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: number;
}): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  }).catch(() => {});
}

export async function updateLLMProfile(id: string, patch: { name?: string; config?: Record<string, unknown> }): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

export async function deleteLLMProfileApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm/${id}`, {
    method: "DELETE",
  }).catch(() => {});
}

export async function activateLLMProfile(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm/${id}/activate`, {
    method: "PUT",
  }).catch(() => {});
}

// DB Profiles

export async function fetchDBProfiles(): Promise<ProfileRow[]> {
  const res = await fetch(`${API_BASE}/api/connections/db`);
  return res.json();
}

export async function saveDBProfile(profile: {
  id: string;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: number;
}): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  }).catch(() => {});
}

export async function updateDBProfile(id: string, patch: { name?: string; config?: Record<string, unknown> }): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

export async function deleteDBProfileApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db/${id}`, {
    method: "DELETE",
  }).catch(() => {});
}

export async function activateDBProfile(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db/${id}/activate`, {
    method: "PUT",
  }).catch(() => {});
}
