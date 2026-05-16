import type { LLMConfig } from "@/stores/chat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatEvent {
  type: "text_delta" | "tool_call" | "tool_result" | "chart" | "error" | "done";
  content?: string;
  tool?: string;
}

export async function* streamChat(
  message: string,
  config: LLMConfig,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      model: config.model,
      api_key: config.apiKey,
      base_url: config.baseUrl,
    }),
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
