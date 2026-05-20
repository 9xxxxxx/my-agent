"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { streamChat, type ChatEvent } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import InputBar from "./InputBar";
import { toast } from "sonner";
import { createAssistantMessage, messageToPlainText, messageReasoning } from "@/lib/messages";

export default function ChatPanel({ mounted = true }: { mounted?: boolean }) {
  const messages = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return conv?.messages || [];
  });
  const isLoading = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return conv?.isLoading ?? false;
  });
  const currentTool = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return conv?.currentTool ?? null;
  });
  const currentAgent = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return conv?.currentAgent ?? null;
  });
  const truncateFromIndex = useChatStore((s) => s.truncateFromIndex);
  const getActiveLLM = useConnectionStore((s) => s.getActiveLLM);
  const getActiveDB = useConnectionStore((s) => s.getActiveDB);
  const assembleDbUrl = useConnectionStore((s) => s.assembleDbUrl);
  const fontSize = useConnectionStore((s) => s.fontSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortMapRef = useRef<Map<string, AbortController>>(new Map());
  const [editContent, setEditContent] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAutoScrollRef = useRef(true);
  const prevMsgCountRef = useRef(0);

  // Track whether user is near bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      isAutoScrollRef.current = nearBottom;
      setShowScrollBtn(!nearBottom && el.scrollHeight > el.clientHeight + 200);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll: smooth for new messages, instant for streaming updates
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!isAutoScrollRef.current) return;

    const isNewMessage = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;

    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: isNewMessage ? "smooth" : "instant",
      });
    });
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAutoScrollRef.current = true;
    setShowScrollBtn(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Abort all streams on unmount
  useEffect(() => {
    return () => {
      abortMapRef.current.forEach((controller) => controller.abort());
      abortMapRef.current.clear();
    };
  }, []);

  const handleStop = useCallback(() => {
    const activeId = useChatStore.getState().activeId;
    if (activeId) {
      abortMapRef.current.get(activeId)?.abort();
    }
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

      // Capture conversation ID at send time to scope all streaming writes
      const convId = useChatStore.getState().activeId;
      if (!convId) return;

      const store = useChatStore.getState();

      const currentMessages = store.conversations.find((c) => c.id === convId)?.messages || [];
      const history = currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: messageToPlainText(m),
          reasoning: m.reasoning || messageReasoning(m),
          toolCalls: m.toolCalls,
        }));

      // Abort any existing stream for this conversation
      abortMapRef.current.get(convId)?.abort();

      // Add user message AFTER building history to avoid sending it twice
      store.addMessageTo(convId, {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: Date.now(),
      });
      store.addMessageTo(convId, createAssistantMessage(crypto.randomUUID()));
      store.setLoadingOf(convId, true);

      // Force scroll to bottom when user sends a message
      isAutoScrollRef.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
      store.setCurrentToolOf(convId, null);
      store.setCurrentAgentOf(convId, null);

      const controller = new AbortController();
      abortMapRef.current.set(convId, controller);
      const dbProfile = getActiveDB() ?? undefined;
      const dbUrl = assembleDbUrl(dbProfile);

      // --- 自适应弹性打字机 (Adaptive Elastic Typewriter) 与 Reasoning 直出 ---
      // reasoning 思考过程无延迟一帧直出；text 正文通过自适应打字机缓冲区平滑播放。
      // 当积压字符较多（网络合并返回或生成暴增）时，打字速度会自适应提速以避免播放滞后，
      // 且严格控制非文本事件与文本的先后执行顺序，保障极佳的逐字流式感和系统健壮性。
      type QueueItem =
        | { type: "text"; content: string }
        | { type: "reasoning"; content: string }
        | { type: "event"; event: ChatEvent };

      const streamQueue: QueueItem[] = [];
      let playTextBuffer = "";
      let rafId = 0;

      const processEvent = (event: ChatEvent, s: ReturnType<typeof useChatStore.getState>) => {
        switch (event.type) {
          case "tool_call":
            if (event.tool) {
              s.addToolCallTo(convId, { name: event.tool, arguments: event.arguments });
              s.setCurrentToolOf(convId, event.tool);
            }
            break;
          case "tool_result":
            s.setToolOutputOf(convId, event.call_id, event.content || "");
            s.setCurrentToolOf(convId, null);
            break;
          case "chart":
            try { s.setChartOf(convId, JSON.parse(event.content || "{}")); } catch {}
            break;
          case "agent_change":
            if (event.display_name) s.setCurrentAgentOf(convId, event.display_name);
            break;
          case "agent_status":
            s.applyEventToAssistantOf(convId, event);
            if (event.display_name) s.setCurrentAgentOf(convId, event.display_name);
            break;
          case "handoff":
            if (event.target_display) {
              s.addMessageTo(convId, { id: crypto.randomUUID(), role: "system", content: `切换至 ${event.target_display}`, timestamp: Date.now() });
              s.setCurrentAgentOf(convId, event.target_display);
            }
            break;
          case "error":
            toast.error(event.content || "发生错误");
            s.applyEventToAssistantOf(convId, { type: "error", code: event.code ?? "UNKNOWN_ERROR", message: event.message ?? event.content ?? "发生错误", recoverable: event.recoverable ?? true });
            break;
          case "done":
            s.applyEventToAssistantOf(convId, event);
            break;
        }
      };

      const flushPendingSync = () => {
        const s = useChatStore.getState();
        // 健壮性保障：若用户已经切换当前活动对话，直接废弃未消费的数据以防止串屏
        if (s.activeId !== convId) {
          streamQueue.length = 0;
          playTextBuffer = "";
          return;
        }

        let textBatch = "";
        let reasoningBatch = "";

        const flushText = () => {
          if (textBatch) {
            s.appendToAssistantOf(convId, textBatch);
            textBatch = "";
          }
          if (reasoningBatch) {
            s.appendToReasoningOf(convId, reasoningBatch);
            reasoningBatch = "";
          }
        };

        // 1. 同步清空当前的打字播放缓冲区
        if (playTextBuffer) {
          textBatch += playTextBuffer;
          playTextBuffer = "";
        }

        // 2. 同步处理完队列中残余的所有项目
        while (streamQueue.length > 0) {
          const item = streamQueue.shift()!;
          if (item.type === "reasoning") {
            reasoningBatch += item.content;
          } else if (item.type === "text") {
            textBatch += item.content;
          } else {
            flushText();
            processEvent(item.event, s);
          }
        }
        flushText();
      };

      const processQueue = () => {
        const s = useChatStore.getState();
        if (s.activeId !== convId) {
          rafId = 0;
          streamQueue.length = 0;
          playTextBuffer = "";
          return;
        }

        let textBatch = "";
        let reasoningBatch = "";

        const flushText = () => {
          if (textBatch) {
            s.appendToAssistantOf(convId, textBatch);
            textBatch = "";
          }
          if (reasoningBatch) {
            s.appendToReasoningOf(convId, reasoningBatch);
            reasoningBatch = "";
          }
        };

        // 1. 只有当前没有正文待播放时，才从流队列中提取消费新项目，确保文本与事件发生的时序正确
        while (streamQueue.length > 0 && playTextBuffer === "") {
          const item = streamQueue.shift()!;
          if (item.type === "reasoning") {
            // reasoning 过程无延迟一帧全部消费直出
            reasoningBatch += item.content;
          } else if (item.type === "text") {
            playTextBuffer += item.content;
          } else {
            flushText();
            processEvent(item.event, s);
          }
        }

        // 2. 自适应打字机处理
        if (playTextBuffer !== "") {
          const len = playTextBuffer.length;
          // 自适应速率计算：积压越长字速越快，力求在 ~6 帧 (100ms) 内播放完积压文字，小量积压时维持每帧至少 1 字的逐字吐字感
          const charsThisFrame = Math.max(1, Math.min(len, Math.ceil(len / 6)));
          textBatch += playTextBuffer.slice(0, charsThisFrame);
          playTextBuffer = playTextBuffer.slice(charsThisFrame);
        }

        flushText();

        // 3. 调度下一帧
        if (streamQueue.length > 0 || playTextBuffer !== "") {
          rafId = requestAnimationFrame(processQueue);
        } else {
          rafId = 0;
        }
      };

      try {
        for await (const event of streamChat(message, llm.config, controller.signal, dbUrl || undefined, history)) {
          // 健壮性保障：切换对话时即刻跳出循环，中止后台流接收
          if (useChatStore.getState().activeId !== convId) {
            break;
          }
          if (event.type === "text_delta") {
            const text = event.content || "";
            if (text) streamQueue.push({ type: "text", content: text });
          } else if (event.type === "reasoning_delta") {
            const text = event.content || "";
            if (text) streamQueue.push({ type: "reasoning", content: text });
          } else {
            streamQueue.push({ type: "event", event });
          }

          if (!rafId) {
            rafId = requestAnimationFrame(processQueue);
          }
        }
        // 等待所有排队播放的字和事件彻底消耗完
        await new Promise<void>((resolve) => {
          const check = () => {
            if (streamQueue.length === 0 && playTextBuffer === "" && rafId === 0) {
              resolve();
              return;
            }
            requestAnimationFrame(check);
          };
          check();
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          toast.error(err.message);
          useChatStore.getState().appendToAssistantOf(convId, `\n\n**错误**: ${err.message}`);
        }
      } finally {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        flushPendingSync();

        const s = useChatStore.getState();
        s.setLoadingOf(convId, false);
        s.setCurrentToolOf(convId, null);
        abortMapRef.current.delete(convId);
        s.flushConversation();
      }
    },
    [getActiveLLM, getActiveDB, assembleDbUrl],
  );

  const handleRetry = useCallback(() => {
    const state = useChatStore.getState();
    const convId = state.activeId;
    if (!convId) return;
    const conv = state.conversations.find((c) => c.id === convId);
    const msgs = conv?.messages || [];
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    state.removeLastAssistantOf(convId);
    void handleSend(messageToPlainText(lastUser));
  }, [handleSend]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto transition-opacity duration-200">
        {!mounted || messages.length === 0 ? (
          /* Empty state — centered welcome with input (ChatGPT style) */
          <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6">
            <div className="max-w-[680px] w-full">
              {/* Logo + Title */}
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[--primary]/10 to-[--primary]/5 mx-auto mb-5 flex items-center justify-center shadow-sm">
                  <svg className="w-7 h-7 text-[--primary]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left hover:bg-[--muted] active:scale-[0.99] transition-all duration-200 cursor-pointer"
                    role="listitem"
                  >
                    <span className="text-[--muted-foreground] group-hover:text-[--primary] transition-colors">
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
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-4 space-y-4" style={{ "--chat-font-size": `${fontSize}px` } as React.CSSProperties}>
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
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--primary]/10">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[--muted] text-[13px] text-[--muted-foreground] border border-[--border]/50">
                  {currentAgent && (
                    <span className="text-[11px] font-medium text-[--primary] bg-[--primary]/8 px-1.5 py-0.5 rounded-md">{currentAgent}</span>
                  )}
                  <div className="w-1.5 h-1.5 rounded-full bg-[--primary] animate-pulse" />
                  <span>正在调用 <span className="font-mono font-medium text-[--foreground]">{currentTool}</span></span>
                </div>
              </div>
            )}

            {isLoading && !currentTool && (
              <div className="flex items-center gap-3 py-2 message-enter" role="status" aria-live="polite">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--primary]/10">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[--muted] border border-[--border]/50">
                  {currentAgent && (
                    <span className="text-[11px] font-medium text-[--primary] bg-[--primary]/8 px-1.5 py-0.5 rounded-md">{currentAgent}</span>
                  )}
                  <div className="w-1.5 h-1.5 rounded-full bg-[--primary] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[--primary]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[--primary]/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-[--card] border border-[--border] px-3 py-1.5 text-[12px] font-medium text-[--muted-foreground] shadow-md hover:shadow-lg hover:text-[--foreground] transition-all duration-200 cursor-pointer animate-in"
          aria-label="滚动到底部"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          回到最新
        </button>
      )}

      {/* Gradient fade + input bar */}
      {mounted && messages.length > 0 && (
        <div className="shrink-0 relative">
          <div className="absolute -top-16 left-0 right-0 h-16 bg-gradient-to-t from-[--background] to-transparent pointer-events-none" />
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 pb-4 sm:pb-5 pt-2">
            <InputBar
              key={editContent ?? "composer"}
              onSend={(msg) => { setEditContent(null); handleSend(msg); }}
              disabled={false}
              defaultValue={editContent}
              isLoading={isLoading}
              onStop={handleStop}
            />
          </div>
        </div>
      )}
    </div>
  );
}
