import type { ChatEvent } from "@/lib/api";
import type { ToolCall } from "@/stores/chat";

export type MessageRole = "user" | "assistant" | "system";

export type ResponseBlock =
  | { id: string; type: "markdown"; content: string }
  | { id: string; type: "chart"; option: Record<string, unknown>; title?: string }
  | { id: string; type: "table"; columns: string[]; rows: unknown[][]; title?: string }
  | { id: string; type: "tool"; name: string; status: "running" | "done" | "error"; input?: unknown; outputPreview?: string }
  | { id: string; type: "agent_status"; agent: string; label: string; status: "entered" | "running" | "done" }
  | { id: string; type: "error"; code: string; message: string; recoverable: boolean };

export interface BlockMessage {
  id: string;
  role: MessageRole;
  blocks: ResponseBlock[];
  createdAt: number;
  updatedAt: number;
}

export interface LegacyMessage {
  id: string;
  role: MessageRole;
  content?: string;
  reasoning?: string;
  chart?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  timestamp?: number;
}

export function createAssistantMessage(id: string, now = Date.now()): BlockMessage {
  return { id, role: "assistant", blocks: [], createdAt: now, updatedAt: now };
}

export function createUserMessage(content: string, id = crypto.randomUUID(), now = Date.now()): BlockMessage {
  return {
    id,
    role: "user",
    blocks: [{ id: `${id}-markdown-0`, type: "markdown", content }],
    createdAt: now,
    updatedAt: now,
  };
}

function blockId(messageId: string, suffix: string): string {
  return `${messageId}-${suffix}`;
}

export function migrateMessage(message: LegacyMessage | BlockMessage): BlockMessage {
  if ("blocks" in message && Array.isArray(message.blocks)) return message;

  const legacy = message as LegacyMessage;
  const createdAt = legacy.timestamp ?? Date.now();
  const blocks: ResponseBlock[] = [];

  if (legacy.toolCalls?.length) {
    legacy.toolCalls.forEach((tool, index) => {
      blocks.push({
        id: blockId(message.id, `tool-${index}`),
        type: "tool",
        name: tool.name,
        status: tool.output ? "done" : "running",
        input: tool.arguments,
        outputPreview: tool.output,
      });
    });
  }

  if (legacy.content?.trim()) {
    blocks.push({ id: blockId(legacy.id, "markdown-0"), type: "markdown", content: legacy.content });
  }

  if (legacy.chart) {
    blocks.push({ id: blockId(legacy.id, "chart-0"), type: "chart", option: legacy.chart });
  }

  return { id: legacy.id, role: legacy.role, blocks, createdAt, updatedAt: createdAt };
}

export function messageToPlainText(message: BlockMessage): string {
  return message.blocks
    .map((block) => {
      if (block.type === "markdown") return block.content;
      if (block.type === "error") return `错误: ${block.message}`;
      if (block.type === "tool") return `[工具] ${block.name}${block.outputPreview ? `\n${block.outputPreview}` : ""}`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function appendMarkdown(blocks: ResponseBlock[], content: string, messageId: string): ResponseBlock[] {
  const last = blocks[blocks.length - 1];
  if (last?.type === "markdown") {
    return [...blocks.slice(0, -1), { ...last, content: last.content + content }];
  }
  return [...blocks, { id: blockId(messageId, `markdown-${blocks.length}`), type: "markdown", content }];
}

export function applyChatEvent(message: BlockMessage, event: ChatEvent): BlockMessage {
  const now = Date.now();

  switch (event.type) {
    case "text_delta":
      return { ...message, blocks: appendMarkdown(message.blocks, event.content ?? "", message.id), updatedAt: now };
    case "tool_call":
      return {
        ...message,
        blocks: [
          ...message.blocks,
          {
            id: blockId(message.id, `tool-${message.blocks.length}`),
            type: "tool",
            name: event.tool ?? "unknown",
            status: "running",
            input: event.arguments,
          },
        ],
        updatedAt: now,
      };
    case "tool_result":
      return {
        ...message,
        blocks: message.blocks.map((block) =>
          block.type === "tool" && block.status === "running"
            ? { ...block, status: "done", outputPreview: event.content }
            : block,
        ),
        updatedAt: now,
      };
    case "chart":
      return {
        ...message,
        blocks: [
          ...message.blocks,
          {
            id: blockId(message.id, `chart-${message.blocks.length}`),
            type: "chart",
            option: JSON.parse(event.content ?? "{}") as Record<string, unknown>,
          },
        ],
        updatedAt: now,
      };
    case "agent_status":
      return {
        ...message,
        blocks: [
          ...message.blocks,
          {
            id: blockId(message.id, `agent-${message.blocks.length}`),
            type: "agent_status",
            agent: event.agent ?? "unknown",
            label: event.display_name ?? event.agent ?? "Agent",
            status: event.status ?? "running",
          },
        ],
        updatedAt: now,
      };
    case "error":
      return {
        ...message,
        blocks: [
          ...message.blocks,
          {
            id: blockId(message.id, `error-${message.blocks.length}`),
            type: "error",
            code: event.code ?? "UNKNOWN_ERROR",
            message: event.message ?? event.content ?? "发生错误",
            recoverable: event.recoverable ?? true,
          },
        ],
        updatedAt: now,
      };
    default:
      return message;
  }
}
