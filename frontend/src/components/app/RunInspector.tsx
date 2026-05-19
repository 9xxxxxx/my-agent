"use client";

import { useState, useEffect } from "react";
import type { Message } from "@/stores/chat";
import type { ResponseBlock } from "@/lib/messages";
import { CircleAlert, Wrench, CheckCircle2, Loader2, Bot, Cpu, Activity } from "lucide-react";

type TraceBlock = Extract<ResponseBlock, { type: "agent_status" | "tool" | "error" }>;

function StatusDot({ active, color }: { active: boolean; color: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {active && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${color}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function TimeAgo({ timestamp }: { timestamp?: number }) {
  if (!timestamp) return null;
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 5) return <span className="text-[10px] text-[--muted-foreground]/60">刚刚</span>;
  if (sec < 60) return <span className="text-[10px] text-[--muted-foreground]/60">{sec}s 前</span>;
  const min = Math.floor(sec / 60);
  return <span className="text-[10px] text-[--muted-foreground]/60">{min}m 前</span>;
}

export function RunInspector({
  messages,
  currentAgent,
  currentTool,
}: {
  messages: Message[];
  currentAgent: string | null;
  currentTool: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const traceBlocks: TraceBlock[] = mounted ? messages.flatMap((message) =>
    message.blocks.flatMap((block): TraceBlock[] => {
      if (block.type === "agent_status" || block.type === "error" || block.type === "tool") return [block];
      if (block.type === "thinking") {
        return block.steps
          .filter((step): step is Extract<typeof step, { type: "tool" }> => step.type === "tool")
          .map((step, i): TraceBlock => ({
            id: `${block.id}-step-${i}`,
            type: "tool",
            name: step.name,
            status: step.status,
            input: step.input,
            outputPreview: step.outputPreview,
          }));
      }
      return [];
    }),
  ) : [];

  const toolBlocks = traceBlocks.filter((b) => b.type === "tool");
  const errorBlocks = traceBlocks.filter((b) => b.type === "error");
  const agentBlocks = traceBlocks.filter((b) => b.type === "agent_status");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {/* Agent & Tool status cards */}
        <div className="space-y-2">
          {/* Agent card */}
          <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 ${
            currentAgent ? "bg-blue-50 border border-blue-200" : "bg-[--muted]"
          }`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              currentAgent ? "bg-blue-100 text-blue-600" : "bg-[--secondary] text-[--muted-foreground]"
            }`}>
              <Bot size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[--muted-foreground]/60">Agent</div>
              <div className={`truncate text-[13px] font-medium ${
                currentAgent ? "text-blue-700" : "text-[--muted-foreground]"
              }`}>
                {currentAgent || "待命"}
              </div>
            </div>
            <StatusDot active={!!currentAgent} color="bg-blue-500" />
          </div>

          {/* Tool card */}
          <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200 ${
            currentTool ? "bg-amber-50 border border-amber-200" : "bg-[--muted]"
          }`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              currentTool ? "bg-amber-100 text-amber-600" : "bg-[--secondary] text-[--muted-foreground]"
            }`}>
              <Cpu size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[--muted-foreground]/60">Tool</div>
              <div className={`truncate text-[13px] font-medium ${
                currentTool ? "text-amber-700" : "text-[--muted-foreground]"
              }`}>
                {currentTool || "无活动工具"}
              </div>
            </div>
            {currentTool && <Loader2 size={14} className="shrink-0 text-amber-500 animate-spin" />}
          </div>
        </div>

        {/* Stats summary */}
        {traceBlocks.length > 0 && (
          <div className="mt-3 flex items-center gap-2 px-1">
            {toolBlocks.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-[--muted-foreground]">
                <Wrench size={11} className="opacity-60" />
                {toolBlocks.length}
              </span>
            )}
            {errorBlocks.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-red-500">
                <CircleAlert size={11} />
                {errorBlocks.length}
              </span>
            )}
            {agentBlocks.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-[--muted-foreground]">
                <Bot size={11} className="opacity-60" />
                {agentBlocks.length}
              </span>
            )}
          </div>
        )}

        {/* Trace timeline */}
        <div className="mt-3 space-y-1.5">
          {traceBlocks.map((block, i) => {
            const isError = block.type === "error";
            const isTool = block.type === "tool";
            const isAgent = block.type === "agent_status";
            const isDone = isTool && block.status === "done";

            return (
              <div
                key={block.id}
                className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150 ${
                  isError
                    ? "bg-red-50 hover:bg-red-100"
                    : isTool
                      ? isDone ? "bg-[--muted]/60 hover:bg-[--muted]" : "bg-amber-50/60 hover:bg-amber-50"
                      : "bg-[--muted]/40 hover:bg-[--muted]/80"
                }`}
              >
                {/* Icon */}
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                  isError
                    ? "text-red-500"
                    : isTool
                      ? isDone ? "text-emerald-500" : "text-amber-500"
                      : "text-blue-500"
                }`}>
                  {isError ? (
                    <CircleAlert size={13} />
                  ) : isTool ? (
                    isDone ? <CheckCircle2 size={13} /> : <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Bot size={13} />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12px] font-medium ${
                      isError ? "text-red-700" : "text-[--foreground]"
                    }`}>
                      {isError ? "错误" : isTool ? block.name : block.label}
                    </span>
                    {isTool && (
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        isDone
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-amber-100 text-amber-600"
                      }`}>
                        {isDone ? "完成" : "运行中"}
                      </span>
                    )}
                  </div>
                  {isError && (
                    <div className="mt-0.5 text-[11px] text-red-600 leading-relaxed">{block.message}</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {traceBlocks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--muted] text-[--muted-foreground]/40 mb-3">
                <Activity size={18} />
              </div>
              <p className="text-[12px] font-medium text-[--muted-foreground]/60">暂无运行记录</p>
              <p className="mt-1 text-[11px] text-[--muted-foreground]/40">发送消息后这里会显示执行过程</p>
            </div>
          )}
        </div>
    </div>
  );
}
