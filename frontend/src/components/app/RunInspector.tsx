"use client";

import type { Message } from "@/stores/chat";
import { Activity, CircleAlert, Wrench } from "lucide-react";

export function RunInspector({
  messages,
  currentAgent,
  currentTool,
}: {
  messages: Message[];
  currentAgent: string | null;
  currentTool: string | null;
}) {
  const traceBlocks = messages.flatMap((message) =>
    message.blocks.filter((block) => block.type === "agent_status" || block.type === "tool" || block.type === "error"),
  );

  return (
    <aside className="hidden min-h-0 flex-col border-l border-[--border] bg-[--card] xl:flex">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[--border] px-4">
        <Activity size={16} />
        <span className="text-[13px] font-semibold">运行状态</span>
      </div>
      <div className="space-y-3 overflow-y-auto p-3 text-[12px] text-[--muted-foreground]">
        <div className="rounded-md bg-[--muted] p-3">
          <div className="mb-1 text-[11px] uppercase text-[--muted-foreground]">Agent</div>
          <div className="truncate text-[13px] font-medium text-[--foreground]">{currentAgent || "待命"}</div>
        </div>
        <div className="rounded-md bg-[--muted] p-3">
          <div className="mb-1 text-[11px] uppercase text-[--muted-foreground]">Tool</div>
          <div className="truncate text-[13px] font-medium text-[--foreground]">{currentTool || "无活动工具"}</div>
        </div>
        <div className="space-y-2">
          {traceBlocks.map((block) => (
            <div key={block.id} className="rounded-md border border-[--border] p-2">
              <div className="flex items-center gap-2 text-[--foreground]">
                {block.type === "error" ? <CircleAlert size={14} /> : <Wrench size={14} />}
                <span>{block.type}</span>
              </div>
              <div className="mt-1 truncate">{block.type === "agent_status" ? block.label : block.type === "tool" ? block.name : block.message}</div>
            </div>
          ))}
          {traceBlocks.length === 0 && <div className="px-2 py-8 text-center">暂无运行记录</div>}
        </div>
      </div>
    </aside>
  );
}
