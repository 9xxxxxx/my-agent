"use client";

import ReactMarkdown from "react-markdown";
import EChart from "@/components/chart/EChart";
import type { EChartsOption } from "echarts";
import type { Message } from "@/stores/chat";
import { cn } from "@/lib/utils";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : isSystem
              ? "bg-muted/50 text-muted-foreground border border-border/50"
              : "bg-card border border-border/50",
        )}
      >
        {/* 工具调用指示器 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.toolCalls.map((tool, i) => (
              <span
                key={i}
                className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
              >
                {tool}
              </span>
            ))}
          </div>
        )}

        {/* 文本内容 */}
        {message.content && (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* 图表 */}
        {message.chart && (
          <div className="mt-3">
            <EChart option={message.chart as EChartsOption} />
          </div>
        )}
      </div>
    </div>
  );
}
