import type { ChatEvent } from "@/lib/api";
import type { ToolCall } from "@/stores/chat";

export type MessageRole = "user" | "assistant" | "system";

export type ThinkingStep =
  | { type: "reasoning"; content: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error"; input?: unknown; outputPreview?: string };

export type ResponseBlock =
  | { id: string; type: "markdown"; content: string }
  | { id: string; type: "chart"; option: Record<string, unknown>; title?: string }
  | { id: string; type: "table"; columns: string[]; rows: unknown[][]; title?: string }
  | { id: string; type: "tool"; name: string; status: "running" | "done" | "error"; input?: unknown; outputPreview?: string }
  | { id: string; type: "thinking"; steps: ThinkingStep[]; startedAt?: number; completedAt?: number }
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

  // Build thinking block from legacy tool calls + reasoning
  if (legacy.toolCalls?.length || legacy.reasoning?.trim()) {
    const steps: ThinkingStep[] = [];
    if (legacy.reasoning?.trim()) {
      steps.push({ type: "reasoning", content: legacy.reasoning });
    }
    if (legacy.toolCalls?.length) {
      legacy.toolCalls.forEach((tool) => {
        steps.push({
          type: "tool",
          name: tool.name,
          status: tool.output ? "done" : "running",
          input: tool.arguments,
          outputPreview: tool.output,
        });
      });
    }
    blocks.push({ id: blockId(message.id, "thinking-0"), type: "thinking", steps });
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

export function messageReasoning(message: BlockMessage): string | undefined {
  for (const block of message.blocks) {
    if (block.type === "thinking") {
      const parts = block.steps
        .filter((s): s is Extract<ThinkingStep, { type: "reasoning" }> => s.type === "reasoning")
        .map((s) => s.content);
      if (parts.length > 0) return parts.join("\n");
    }
  }
  return undefined;
}

function appendMarkdown(blocks: ResponseBlock[], content: string, messageId: string): ResponseBlock[] {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.type === "chart" || b.type === "table" || b.type === "error") {
      break;
    }
    if (b.type === "markdown") {
      const newBlocks = [...blocks];
      newBlocks[i] = { ...b, content: b.content + content };
      return newBlocks;
    }
  }
  return [...blocks, { id: blockId(messageId, `markdown-${blocks.length}`), type: "markdown", content }];
}

function getOrCreateThinkingBlock(blocks: ResponseBlock[], messageId: string): { blocks: ResponseBlock[]; thinking: Extract<ResponseBlock, { type: "thinking" }> } {
  const last = blocks[blocks.length - 1];
  if (last?.type === "thinking") return { blocks, thinking: last };
  const newBlock: Extract<ResponseBlock, { type: "thinking" }> = { id: blockId(messageId, `thinking-${blocks.length}`), type: "thinking", steps: [], startedAt: Date.now() };
  return { blocks: [...blocks, newBlock], thinking: newBlock };
}

function markThinkingCompleted(blocks: ResponseBlock[], now: number): ResponseBlock[] {
  return blocks.map((b) =>
    b.type === "thinking" && !b.completedAt ? { ...b, completedAt: now } : b,
  );
}

export function applyChatEvent(message: BlockMessage, event: ChatEvent): BlockMessage {
  const now = Date.now();

  switch (event.type) {
    case "text_delta": {
      return { ...message, blocks: appendMarkdown(markThinkingCompleted(message.blocks, now), event.content ?? "", message.id), updatedAt: now };
    }
    case "reasoning_delta": {
      const { blocks, thinking } = getOrCreateThinkingBlock(message.blocks, message.id);
      const steps = [...thinking.steps];
      const lastStep = steps[steps.length - 1];
      if (lastStep?.type === "reasoning") {
        steps[steps.length - 1] = { ...lastStep, content: lastStep.content + (event.content ?? "") };
      } else {
        steps.push({ type: "reasoning", content: event.content ?? "" });
      }
      const updatedThinking = { ...thinking, steps, startedAt: thinking.startedAt ?? now };
      return { ...message, blocks: [...blocks.slice(0, -1), updatedThinking], updatedAt: now };
    }
    case "tool_call": {
      const { blocks, thinking } = getOrCreateThinkingBlock(message.blocks, message.id);
      const updatedThinking = {
        ...thinking,
        steps: [...thinking.steps, { type: "tool" as const, name: event.tool ?? "unknown", status: "running" as const, input: event.arguments }],
      };
      return { ...message, blocks: [...blocks.slice(0, -1), updatedThinking], updatedAt: now };
    }
    case "tool_result": {
      const lastThinking = [...message.blocks].reverse().find((b) => b.type === "thinking");
      if (!lastThinking || lastThinking.type !== "thinking") return message;
      const steps = [...lastThinking.steps];
      const idx = steps.findLastIndex((s) => s.type === "tool" && s.status === "running");
      if (idx >= 0) {
        const step = steps[idx] as Extract<ThinkingStep, { type: "tool" }>;
        steps[idx] = { ...step, status: "done", outputPreview: event.content };
      }
      const updatedThinking = { ...lastThinking, steps };
      return { ...message, blocks: message.blocks.map((b) => b === lastThinking ? updatedThinking : b), updatedAt: now };
    }
    case "chart": {
      let option: Record<string, unknown> = {};
      try {
        option = JSON.parse(event.content ?? "{}") as Record<string, unknown>;
      } catch {
        // Malformed chart JSON - skip this block
        return message;
      }
      return {
        ...message,
        blocks: [
          ...message.blocks,
          {
            id: blockId(message.id, `chart-${message.blocks.length}`),
            type: "chart",
            option,
          },
        ],
        updatedAt: now,
      };
    }
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
          ...markThinkingCompleted(message.blocks, now),
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
    case "done":
      return { ...message, blocks: markThinkingCompleted(message.blocks, now), updatedAt: now };
    default:
      return message;
  }
}
