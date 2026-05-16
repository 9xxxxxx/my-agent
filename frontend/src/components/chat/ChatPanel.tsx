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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (message: string) => {
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
                setLastChart(JSON.parse(event.content || "{}"));
              } catch {}
              break;
            case "tool_result":
              setCurrentTool(null);
              break;
            case "error":
              toast.error(event.content || "发生错误");
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* 空状态 */
          <div className="h-full flex flex-col items-center justify-center px-6">
            <div className="max-w-md text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#e8e7e4] mx-auto mb-5 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5a5a52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
                </svg>
              </div>
              <h2 className="text-lg font-medium text-[#2d2d2d] mb-2">数据分析助手</h2>
              <p className="text-[13px] text-[#7a7a72] leading-relaxed mb-8">
                上传数据文件或连接数据库，用自然语言提问，<br />我会帮你分析数据、生成图表和报告。
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { icon: " ", text: "帮我分析销售数据的趋势" },
                  { icon: " ", text: "上传的 CSV 有哪些字段" },
                  { icon: " ", text: "生成一份月度分析报告" },
                ].map((q) => (
                  <button
                    key={q.text}
                    onClick={() => handleSend(q.text)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#e5e4e1] bg-white hover:bg-[#f9f9f7] text-left text-[13px] text-[#5a5a52] transition-colors"
                  >
                    <span className="text-base">{q.icon}</span>
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 消息列表 */
          <div className="max-w-[720px] mx-auto px-6 py-6 space-y-1">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* 工具调用指示 */}
            {isLoading && currentTool && (
              <div className="flex items-center gap-2 py-3 text-[12px] text-[#9a9a92]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5a7c6f] animate-pulse" />
                <span>正在调用 {currentTool}</span>
              </div>
            )}

            {isLoading && !currentTool && (
              <div className="flex items-center gap-2 py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b0afa8] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b0afa8] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b0afa8] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <InputBar onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
