import type { LLMConfig } from "@/stores/chat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_TOKEN = process.env.NEXT_PUBLIC_APP_TOKEN || "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (APP_TOKEN) h["Authorization"] = `Bearer ${APP_TOKEN}`;
  return h;
}

function logApiError(e: unknown): void {
  console.warn("[api] Request failed:", e);
}

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
): AsyncGenerator<ChatEvent> {
  const body: Record<string, unknown> = {
    message,
    model: config.model,
    api_key: config.apiKey,
    base_url: config.baseUrl,
    thinking_mode: config.thinking_mode,
  };
  if (databaseUrl) body.database_url = databaseUrl;
  if (history && history.length > 0) body.history = history;

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: authHeaders(),
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
  let dataLines: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          dataLines.push(line.slice(6));
        } else if (line.trim() === "" && dataLines.length > 0) {
          // Empty line = end of SSE event
          try {
            const event = JSON.parse(dataLines.join("\n")) as ChatEvent;
            yield event;
            // Yield to macrotask queue so React can flush each event separately
            // (prevents automatic batching from lumping text into one chunk)
            await new Promise<void>((r) => setTimeout(r, 0));
          } catch {
            // skip malformed JSON
          }
          dataLines = [];
        }
      }
    }

    // Process any remaining data in buffer
    if (dataLines.length > 0) {
      try {
        const event = JSON.parse(dataLines.join("\n")) as ChatEvent;
        yield event;
      } catch {
        // skip malformed JSON
      }
    }
  } finally {
    reader.releaseLock();
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

  const headers: Record<string, string> = {};
  if (APP_TOKEN) headers["Authorization"] = `Bearer ${APP_TOKEN}`;
  const response = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `上传失败: HTTP ${response.status}`);
  }
  return response.json();
}

export async function getUploadedTables(): Promise<{
  tables: Array<{ table_name: string; source_file: string; rows: number; columns: number }>;
}> {
  const headers: Record<string, string> = {};
  if (APP_TOKEN) headers["Authorization"] = `Bearer ${APP_TOKEN}`;
  const response = await fetch(`${API_BASE}/api/upload/tables`, { headers });
  if (!response.ok) throw new Error(`获取文件列表失败: HTTP ${response.status}`);
  return response.json();
}

export async function testConnection(databaseUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/db/test`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ database_url: databaseUrl }),
  });
  if (!response.ok) throw new Error(`连接测试失败: HTTP ${response.status}`);
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
  if (!res.ok) throw new Error(`获取对话列表失败: HTTP ${res.status}`);
  return res.json();
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`);
  if (!res.ok) throw new Error(`获取对话详情失败: HTTP ${res.status}`);
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
    headers: authHeaders(),
    body: JSON.stringify(conv),
  }).catch(logApiError);
}

export async function updateConversation(id: string, patch: {
  title?: string;
  messages?: unknown[];
  updated_at?: number;
}): Promise<void> {
  await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  }).catch(logApiError);
}

export async function deleteConversationApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/conversations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch(logApiError);
}

// LLM Profiles

export async function fetchLLMProfiles(): Promise<ProfileRow[]> {
  const res = await fetch(`${API_BASE}/api/connections/llm`);
  if (!res.ok) throw new Error(`获取 LLM 配置失败: HTTP ${res.status}`);
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
    headers: authHeaders(),
    body: JSON.stringify(profile),
  }).catch(logApiError);
}

export async function updateLLMProfile(id: string, patch: { name?: string; config?: Record<string, unknown> }): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  }).catch(logApiError);
}

export async function deleteLLMProfileApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch(logApiError);
}

export async function activateLLMProfile(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/llm/${id}/activate`, {
    method: "PUT",
    headers: authHeaders(),
  }).catch(logApiError);
}

// DB Profiles

export async function fetchDBProfiles(): Promise<ProfileRow[]> {
  const res = await fetch(`${API_BASE}/api/connections/db`);
  if (!res.ok) throw new Error(`获取数据库配置失败: HTTP ${res.status}`);
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
    headers: authHeaders(),
    body: JSON.stringify(profile),
  }).catch(logApiError);
}

export async function updateDBProfile(id: string, patch: { name?: string; config?: Record<string, unknown> }): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  }).catch(logApiError);
}

export async function deleteDBProfileApi(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  }).catch(logApiError);
}

export async function activateDBProfile(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/connections/db/${id}/activate`, {
    method: "PUT",
    headers: authHeaders(),
  }).catch(logApiError);
}

// ─── 报告管理 API ───

export interface Report {
  id: string;
  title: string;
  filename: string;
  summary: string;
  tags: string[];
  created_at: number;
  updated_at: number;
}

export interface ReportDetail extends Report {
  content: string;
}

export interface ReportListResponse {
  items: Report[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchReports(
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  tags?: string[],
): Promise<ReportListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (search) params.set("search", search);
  if (tags?.length) params.set("tags", tags.join(","));

  const response = await fetch(`${API_BASE}/api/reports?${params}`);
  if (!response.ok) throw new Error("获取报告列表失败");
  return response.json();
}

export async function fetchReport(id: string): Promise<ReportDetail> {
  const response = await fetch(`${API_BASE}/api/reports/${id}`);
  if (!response.ok) throw new Error("获取报告详情失败");
  return response.json();
}

export async function createReport(data: {
  title: string;
  content: string;
  tags?: string[];
}): Promise<Report> {
  const response = await fetch(`${API_BASE}/api/reports`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("创建报告失败");
  return response.json();
}

export async function updateReport(
  id: string,
  data: {
    title?: string;
    content?: string;
    tags?: string[];
  },
): Promise<Report> {
  const response = await fetch(`${API_BASE}/api/reports/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("更新报告失败");
  return response.json();
}

export async function deleteReport(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/reports/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除报告失败");
}

export function getReportExportUrl(id: string, format: "pdf" | "excel" | "csv"): string {
  return `${API_BASE}/api/reports/${id}/export/${format}`;
}
