"use client";

import { useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { streamChat } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { toast } from "sonner";

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const currentTool = useChatStore((s) => s.currentTool);
  const llmConfig = useChatStore((s) => s.llmConfig);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToLastAssistant = useChatStore((s) => s.appendToLastAssistant);
  const setLastChart = useChatStore((s) => s.setLastChart);
  const setLoading = useChatStore((s) => s.setLoading);
  const setCurrentTool = useChatStore((s) => s.setCurrentTool);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (message: string) => {
      // 创建 assistant 消息占位
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: Date.now(),
      });
      setLoading(true);
      setCurrentTool(null);

      abortRef.current = new AbortController();
      const toolCalls: string[] = [];

      try {
        for await (const event of streamChat(message, llmConfig, abortRef.current.signal)) {
          switch (event.type) {
            case "text_delta":
              appendToLastAssistant(event.content || "");
              break;
            case "tool_call":
              if (event.tool) {
                toolCalls.push(event.tool);
                setCurrentTool(event.tool);
              }
              break;
            case "chart":
              try {
                const chartOption = JSON.parse(event.content || "{}");
                setLastChart(chartOption);
              } catch {
                // skip malformed chart
              }
              break;
            case "tool_result":
              setCurrentTool(null);
              break;
            case "error":
              toast.error(event.content || "发生错误");
              break;
            case "done":
              break;
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error(err.message);
          appendToLastAssistant(`\n\n**错误**: ${err.message}`);
        }
      } finally {
        setLoading(false);
        setCurrentTool(null);
        abortRef.current = null;
      }
    },
    [llmConfig, addMessage, appendToLastAssistant, setLastChart, setLoading, setCurrentTool],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 消息区域 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="text-6xl mb-4"> </div>
            <h2 className="text-xl font-semibold mb-2">数据分析 Agent</h2>
            <p className="text-sm text-center max-w-md">
              上传数据文件或连接数据库，用自然语言提问，我会帮你分析数据、生成图表和报告。
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {["帮我分析销售数据的趋势", "上传的 CSV 有什么字段", "生成一份月度报告"].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-3 py-1.5 text-xs rounded-full border border-border hover:bg-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {/* 工具调用指示器 */}
        {isLoading && currentTool && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            正在调用: {currentTool}
          </div>
        )}
      </div>

      {/* 输入栏 */}
      <InputBar onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
