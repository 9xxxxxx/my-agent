"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { streamChat } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { toast } from "sonner";
import { createAssistantMessage, messageToPlainText } from "@/lib/messages";

export default function ChatPanel({ mounted = true }: { mounted?: boolean }) {
  const messages = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return conv?.messages || [];
  });
  const isLoading = useChatStore((s) => s.isLoading);
  const currentTool = useChatStore((s) => s.currentTool);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToLastAssistant = useChatStore((s) => s.appendToLastAssistant);
  const appendToLastReasoning = useChatStore((s) => s.appendToLastReasoning);
  const addToolCall = useChatStore((s) => s.addToolCall);
  const setLastToolOutput = useChatStore((s) => s.setLastToolOutput);
  const setLastChart = useChatStore((s) => s.setLastChart);
  const removeLastAssistant = useChatStore((s) => s.removeLastAssistant);
  const truncateFromIndex = useChatStore((s) => s.truncateFromIndex);
  const flushConversation = useChatStore((s) => s.flushConversation);
  const setLoading = useChatStore((s) => s.setLoading);
  const setCurrentTool = useChatStore((s) => s.setCurrentTool);
  const currentAgent = useChatStore((s) => s.currentAgent);
  const setCurrentAgent = useChatStore((s) => s.setCurrentAgent);
  const getActiveLLM = useConnectionStore((s) => s.getActiveLLM);
  const getActiveDB = useConnectionStore((s) => s.getActiveDB);
  const assembleDbUrl = useConnectionStore((s) => s.assembleDbUrl);
  const fontSize = useConnectionStore((s) => s.fontSize);
  const mode = useConnectionStore((s) => s.mode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [editContent, setEditContent] = useState<string | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll if user is near the bottom (within 150px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Abort stream on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleEdit = useCallback((content: string) => {
    // 找到被编辑消息的索引，截断该消息及之后的所有消息
    const state = useChatStore.getState();
    const msgs = state.getMessages();
    const idx = msgs.findIndex((m) => m.role === "user" && messageToPlainText(m) === content);
    if (idx >= 0) {
      truncateFromIndex(idx);
    }
    // 将消息内容放入输入框
    setEditContent(content);
  }, [truncateFromIndex]);

  const handleSend = useCallback(
    async (message: string) => {
      const llm = getActiveLLM();
      if (!llm) {
        toast.error("请先在连接设置中配置 LLM");
        return;
      }

      const currentMessages = useChatStore.getState().getMessages();
      const history = currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: messageToPlainText(m),
          reasoning: m.reasoning,
          toolCalls: m.toolCalls,
        }));

      // Add user message AFTER building history to avoid sending it twice
      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      });
      addMessage(createAssistantMessage(crypto.randomUUID()));
      setLoading(true);
      setCurrentTool(null);
      setCurrentAgent(null);

      abortRef.current = new AbortController();
      const dbProfile = getActiveDB() ?? undefined;
      const dbUrl = assembleDbUrl(dbProfile);

      try {
        for await (const event of streamChat(message, llm.config, abortRef.current.signal, dbUrl || undefined, history, mode)) {
          switch (event.type) {
            case "text_delta":
              appendToLastAssistant(event.content || "");
              break;
            case "reasoning_delta":
              appendToLastReasoning(event.content || "");
              break;
            case "tool_call":
              if (event.tool) {
                addToolCall({ name: event.tool, arguments: event.arguments });
                setCurrentTool(event.tool);
              }
              break;
            case "tool_result":
              setLastToolOutput(event.call_id, event.content || "");
              setCurrentTool(null);
              break;
            case "chart":
              try {
                setLastChart(JSON.parse(event.content || "{}"));
              } catch {}
              break;
            case "agent_change":
              if (event.display_name) {
                setCurrentAgent(event.display_name);
              }
              break;
            case "handoff":
              if (event.target_display) {
                // 添加系统消息显示 Agent 切换
                addMessage({
                  id: crypto.randomUUID(),
                  role: "system",
                  content: `切换至 ${event.target_display}`,
                  timestamp: Date.now(),
                });
                setCurrentAgent(event.target_display);
              }
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
        flushConversation();
      }
    },
    [getActiveLLM, getActiveDB, assembleDbUrl, addMessage, appendToLastAssistant, appendToLastReasoning, addToolCall, setLastToolOutput, setLastChart, setLoading, setCurrentTool, setCurrentAgent, flushConversation, mode],
  );

  const handleRetry = useCallback(() => {
    const state = useChatStore.getState();
    const conv = state.conversations.find((c) => c.id === state.activeId);
    const msgs = conv?.messages || [];
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    removeLastAssistant();
    // handleSend reads from useChatStore.getState(), so no setTimeout needed
    void handleSend(messageToPlainText(lastUser));
  }, [handleSend, removeLastAssistant]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto transition-opacity duration-200">
        {!mounted || messages.length === 0 ? (
          /* Empty state — centered welcome with input (ChatGPT style) */
          <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="max-w-[680px] w-full">
              {/* Logo + Title */}
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-[--muted] mx-auto mb-5 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[--muted-foreground]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h1 className="text-[24px] font-bold text-[--foreground] mb-2 tracking-tight">数据分析助手</h1>
                <p className="text-[15px] text-[--muted-foreground] leading-relaxed">
                  上传数据文件或连接数据库，用自然语言提问
                </p>
              </div>

              {/* Centered input bar */}
              <div className="mb-8">
                <InputBar onSend={handleSend} disabled={false} />
              </div>

              {/* Quick actions — list style */}
              <div className="space-y-1" role="list" aria-label="快捷操作">
                {[
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
                    title: "数据趋势分析",
                    desc: "分析销售数据的变化趋势",
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
                    title: "探索数据结构",
                    desc: "查看表结构和字段信息",
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
                    title: "生成分析报告",
                    desc: "自动生成月度数据报告",
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
                    title: "对比分析",
                    desc: "对比不同时间段的数据",
                  },
                ].map((q) => (
                  <button
                    key={q.title}
                    onClick={() => handleSend(q.desc)}
                    className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-[--muted] transition-colors cursor-pointer"
                    role="listitem"
                  >
                    <span className="text-[--muted-foreground] group-hover:text-[--foreground] transition-colors">
                      {q.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] text-[--foreground]">{q.title}</span>
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[--muted-foreground] opacity-0 group-hover:opacity-100 transition-opacity">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4" style={{ "--chat-font-size": `${fontSize}px` } as React.CSSProperties}>
            {messages.map((msg, i) => {
              // 跳过空的 assistant 消息（流式传输尚未到达），避免与 loading 指示器重复
              if (msg.role === "assistant" && !msg.content && isLoading && i === messages.length - 1) {
                return null;
              }
              return (
                <div key={msg.id} className="message-enter">
                  <MessageBubble
                    message={msg}
                    onRetry={
                      msg.role === "assistant" && i === messages.length - 1 && !isLoading
                        ? handleRetry
                        : undefined
                    }
                    onEdit={msg.role === "user" ? handleEdit : undefined}
                  />
                </div>
              );
            })}

            {isLoading && currentTool && (
              <div className="flex items-center gap-3 py-2 message-enter" role="status" aria-live="polite">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--muted]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[--muted] text-[13px] text-[--muted-foreground]">
                  {currentAgent && (
                    <span className="text-[11px] font-medium text-[--primary] bg-[--primary]/5 px-1.5 py-0.5 rounded">{currentAgent}</span>
                  )}
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground] animate-pulse" />
                  <span>正在调用 <span className="font-mono font-medium text-[--foreground]">{currentTool}</span></span>
                </div>
              </div>
            )}

            {isLoading && !currentTool && (
              <div className="flex items-center gap-3 py-2 message-enter" role="status" aria-live="polite">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--muted]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[--muted]">
                  {currentAgent && (
                    <span className="text-[11px] font-medium text-[--primary] bg-[--primary]/5 px-1.5 py-0.5 rounded">{currentAgent}</span>
                  )}
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar with stop button — hidden during welcome state */}
      {messages.length > 0 && (
        <div className="shrink-0 border-t border-[--border] safe-area-bottom">
          <div className="max-w-[1000px] mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {isLoading ? (
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[--border] hover:bg-[--muted] text-[13px] text-[--muted-foreground] hover:text-[--foreground] transition-colors cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                停止生成
              </button>
            ) : (
              <InputBar
                key={editContent ?? "composer"}
                onSend={(msg) => { setEditContent(null); handleSend(msg); }}
                disabled={false}
                defaultValue={editContent}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
