import { describe, expect, it } from "vitest";
import { applyChatEvent, createAssistantMessage, migrateMessage } from "./messages";

describe("message migration", () => {
  it("migrates legacy assistant content, tool calls, and chart into typed blocks", () => {
    const migrated = migrateMessage({
      id: "m1",
      role: "assistant",
      content: "结论",
      reasoning: "推理",
      toolCalls: [{ name: "run_sql_query", arguments: "{}", output: "2 rows" }],
      chart: { xAxis: { type: "category" } },
      timestamp: 100,
    });

    expect(migrated.blocks.map((block) => block.type)).toEqual([
      "tool",
      "markdown",
      "chart",
    ]);
    expect(migrated.createdAt).toBe(100);
  });
});

describe("stream reducer", () => {
  it("appends status, markdown, chart, and safe error blocks", () => {
    let message = createAssistantMessage("a1", 100);
    message = applyChatEvent(message, { type: "agent_status", agent: "DataAnalyst", display_name: "数据分析助手", status: "running" });
    message = applyChatEvent(message, { type: "text_delta", content: "你好" });
    message = applyChatEvent(message, { type: "chart", content: "{\"series\":[]}" });
    message = applyChatEvent(message, { type: "error", code: "MODEL_AUTH_FAILED", message: "模型认证失败，请检查当前模型配置", recoverable: true });

    expect(message.blocks.map((block) => block.type)).toEqual([
      "agent_status",
      "markdown",
      "chart",
      "error",
    ]);
  });
});
