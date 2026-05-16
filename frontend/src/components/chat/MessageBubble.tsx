"use client";

import ReactMarkdown from "react-markdown";
import EChart from "@/components/chart/EChart";
import type { EChartsOption } from "echarts";
import type { Message } from "@/stores/chat";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-[12px] text-[#9a9a92] bg-[#f0efed] px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 py-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* AI 头像 */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-[#2d2d2d] flex items-center justify-center shrink-0 mt-0.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? "order-first" : ""}`}>
        {/* 工具调用标签 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {message.toolCalls.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-[#f0efed] text-[#7a7a72] font-mono"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                {tool}
              </span>
            ))}
          </div>
        )}

        {/* 消息内容 */}
        <div
          className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
            isUser
              ? "bg-[#2d2d2d] text-white rounded-br-md"
              : "bg-white border border-[#e5e4e1] text-[#1a1a1a] rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          }`}
        >
          {message.content && (
            <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}

          {message.chart && (
            <div className="mt-3 -mx-1">
              <EChart option={message.chart as EChartsOption} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
