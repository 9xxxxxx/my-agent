"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, Copy, RotateCcw, SquarePen, Sparkles } from "lucide-react";
import type { Message } from "@/stores/chat";
import { messageToPlainText, type ThinkingStep } from "@/lib/messages";
import { MessageBlocks } from "@/components/chat/MessageBlocks";
import { CheckCircle2, Wrench, Brain } from "lucide-react";
import { toast } from "sonner";

/** Mask password in database connection URLs like postgresql+psycopg2://user:***@host:port/db */
function maskDbUrl(str: string): string {
  return str.replace(/((?:postgresql|mysql|sqlite|duckdb)\+\w+:\/\/[^:]*:)([^@]+)(@)/g, "$1***$3");
}

/** Format tool arguments for display: parse JSON, mask passwords, pretty-print */
function formatToolArgs(input: unknown): string {
  if (!input) return "";
  let obj: Record<string, unknown>;
  if (typeof input === "object") {
    obj = input as Record<string, unknown>;
  } else {
    try { obj = JSON.parse(String(input)); } catch { return String(input); }
  }
  // Mask database_url password
  if (typeof obj.database_url === "string" && obj.database_url) {
    obj = { ...obj, database_url: maskDbUrl(obj.database_url) };
  }
  return JSON.stringify(obj, null, 2);
}

interface Props {
  message: Message;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
}

/** Format thinking duration in seconds */
function formatDuration(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt) return null;
  const end = completedAt ?? Date.now();
  const seconds = ((end - startedAt) / 1000).toFixed(1);
  return `${seconds} 秒`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("复制失败");
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] active:scale-95 transition-all duration-150 ${
        copied
          ? "bg-[--success]/10 text-[--success]"
          : "text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
      }`}
      aria-label={copied ? "已复制" : "复制"}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export default function MessageBubble({ message, onRetry, onEdit }: Props) {
  const text = messageToPlainText(message);

  if (message.role === "system") {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-[--muted] px-3 py-1 text-[12px] text-[--muted-foreground]">{text}</span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="group flex justify-end py-2">
        <div className="max-w-[86%] sm:max-w-[72%]">
          <div className="rounded-2xl rounded-br-md bg-[--primary]/[0.06] px-4 py-3 text-[15px] leading-7 text-[--foreground] shadow-sm border border-[--primary]/10">
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
          <div className="mt-1 flex justify-end gap-1 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 focus-within:opacity-100 focus-within:translate-y-0">
            {text && <CopyButton text={text} />}
            {onEdit && (
              <button
                onClick={() => onEdit(text)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-95 transition-transform duration-100"
                aria-label="编辑并重新发送"
              >
                <SquarePen size={13} />
                编辑
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const thinkingBlocks = message.blocks.filter((b): b is Extract<typeof b, { type: "thinking" }> => b.type === "thinking");

  // Merge all thinking blocks + standalone tool blocks into one flat step list
  const toolBlocks = useMemo(
    () => message.blocks.filter((b): b is Extract<typeof b, { type: "tool" }> => b.type === "tool"),
    [message.blocks],
  );
  const allThinkingSteps = useMemo(() => {
    const steps: ThinkingStep[] = [...thinkingBlocks.flatMap((b) => b.steps)];
    // Append standalone tool blocks that aren't already inside a thinking block
    for (const tb of toolBlocks) {
      if (!steps.some((s) => s.type === "tool" && s.name === tb.name && s.input === tb.input)) {
        steps.push({ type: "tool", name: tb.name, status: tb.status, input: tb.input, outputPreview: tb.outputPreview });
      }
    }
    return steps;
  }, [thinkingBlocks, toolBlocks]);

  const earliestStart = thinkingBlocks.find((b) => b.startedAt)?.startedAt;
  const latestCompleted = [...thinkingBlocks].reverse().find((b) => b.completedAt)?.completedAt;

  // Live-updating timer while thinking is in progress
  const [tick, setTick] = useState(0);
  const isThinking = thinkingBlocks.some((b) => b.startedAt && !b.completedAt && b.steps.length > 0);
  useEffect(() => {
    if (!isThinking) return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [isThinking]);

  // 控制思考面板的折叠状态：思考中默认展开，历史消息/思考完成默认折叠
  const [isDetailsOpen, setIsDetailsOpen] = useState(isThinking);
  const prevIsThinkingRef = useRef(isThinking);

  useEffect(() => {
    if (isThinking) {
      setIsDetailsOpen(true);
    } else if (prevIsThinkingRef.current && !isThinking) {
      // 思考刚结束，自动收起
      setIsDetailsOpen(false);
    }
    prevIsThinkingRef.current = isThinking;
  }, [isThinking]);

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    setIsDetailsOpen(e.currentTarget.open);
  };

  // Blocks to pass to MessageBlocks (exclude standalone tool blocks, they're inside thinking now)
  const contentBlocks = useMemo(
    () => message.blocks.filter((b) => b.type !== "tool"),
    [message.blocks],
  );

  const durationStr = formatDuration(earliestStart, latestCompleted);

  // Legacy 历史消息思考过程默认折叠
  const [isLegacyOpen, setIsLegacyOpen] = useState(false);

  return (
    <div className="group flex justify-start gap-2.5 py-3">
      {/* Assistant avatar */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[--primary]/15 to-[--primary]/5 text-[--primary]">
        <Sparkles size={14} />
      </div>
      <div className="max-w-[min(820px,100%)] flex-1 min-w-0">
        {allThinkingSteps.length > 0 && (
          <details
            open={isDetailsOpen}
            onToggle={handleToggle}
            className="mb-3 rounded-xl bg-[--primary]/[0.03] px-4 py-3 text-[12px] border border-[--primary]/6 transition-all duration-300"
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 select-none hover:text-[--primary] transition-colors">
              <Brain size={13} className="shrink-0 text-[--primary]/70" />
              <span className="text-[12px] font-medium text-[--primary]/80">思考过程</span>
              {durationStr && (
                <span className="text-[11px] font-normal text-[--muted-foreground]">(用时 {durationStr})</span>
              )}
              {isThinking && (
                <span className="flex h-1.5 w-1.5 relative ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[--primary] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[--primary]"></span>
                </span>
              )}
              <svg
                className={`ml-auto shrink-0 text-[--muted-foreground]/50 transition-transform duration-200 ${isDetailsOpen ? "rotate-180" : ""}`}
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="mt-2.5 space-y-2 border-l-2 border-[--primary]/15 pl-3 transition-opacity duration-200">
              {allThinkingSteps.map((step, i) => {
                if (step.type === "reasoning") {
                  return (
                    <div key={i} className="whitespace-pre-wrap leading-relaxed text-[12px] text-[--muted-foreground] italic">{step.content}</div>
                  );
                }
                // tool step
                const toolDone = step.status === "done";
                const inputStr = formatToolArgs(step.input);
                return (
                  <details key={i} className="border-t border-[--border]/40 pt-1.5">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 select-none">
                      {toolDone ? <CheckCircle2 size={12} className="text-[--success] shrink-0" /> : <Wrench size={12} className="shrink-0" />}
                      <span className="font-mono text-[--foreground]">{step.name}</span>
                      <svg className="shrink-0 text-[--muted-foreground]/50" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                      <span className="ml-auto text-[10px]">{toolDone ? "完成" : "运行中"}</span>
                    </summary>
                    {inputStr && (
                      <div className="mt-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[--muted-foreground]/50 mb-0.5">输入</div>
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[--muted] p-1.5 text-[10px] leading-relaxed">{inputStr}</pre>
                      </div>
                    )}
                    {step.outputPreview && (
                      <div className="mt-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[--muted-foreground]/50 mb-0.5">输出</div>
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[--muted] p-1.5 text-[10px] leading-relaxed">{step.outputPreview}</pre>
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          </details>
        )}
        {/* Fallback for legacy messages with reasoning field but no thinking blocks */}
        {!allThinkingSteps.length && message.reasoning && (
          <details
            open={isLegacyOpen}
            onToggle={(e) => setIsLegacyOpen(e.currentTarget.open)}
            className="mb-3 rounded-xl bg-[--primary]/[0.03] px-4 py-3 text-[12px] border border-[--primary]/6 transition-all duration-300"
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 select-none hover:text-[--primary] transition-colors">
              <Brain size={13} className="shrink-0 text-[--primary]/70" />
              <span className="text-[12px] font-medium text-[--primary]/80">思考过程</span>
              <svg
                className={`ml-auto shrink-0 text-[--muted-foreground]/50 transition-transform duration-200 ${isLegacyOpen ? "rotate-180" : ""}`}
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <div className="mt-2.5 border-l-2 border-[--primary]/15 pl-3 transition-opacity duration-200">
              <div className="whitespace-pre-wrap leading-relaxed text-[12px] text-[--muted-foreground] italic">{message.reasoning}</div>
            </div>
          </details>
        )}
        <div className="px-1 text-[--foreground]">
          <MessageBlocks blocks={contentBlocks} />
        </div>
        <div className="mt-2 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity duration-200">
          {text && <CopyButton text={text} />}
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-95 transition-transform duration-100"
              aria-label="重新生成"
            >
              <RotateCcw size={13} />
              重新生成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
