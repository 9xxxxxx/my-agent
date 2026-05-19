"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import EChart from "@/components/chart/EChart";
import type { EChartsOption } from "echarts";
import type { ResponseBlock } from "@/lib/messages";
import { AlertTriangle, CheckCircle2, Clock3, Wrench } from "lucide-react";

function DataTable({ block }: { block: Extract<ResponseBlock, { type: "table" }> }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[--border]">
      {block.title && <div className="border-b border-[--border] px-3 py-2 text-[12px] font-semibold">{block.title}</div>}
      <table className="w-full text-[13px]">
        <thead className="bg-[--muted] text-[--muted-foreground]">
          <tr>
            {block.columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[--border]/60">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2">{String(cell ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolBlock({ block }: { block: Extract<ResponseBlock, { type: "tool" }> }) {
  const done = block.status === "done";
  const inputStr = block.input
    ? (typeof block.input === "object" ? JSON.stringify(block.input, null, 2) : String(block.input))
    : "";
  return (
    <details open className="rounded-md border border-[--border] bg-[--muted]/50 px-3 py-2 text-[12px] text-[--muted-foreground]">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        {done ? <CheckCircle2 size={14} className="text-[--success]" /> : <Wrench size={14} />}
        <span className="font-mono text-[--foreground]">{block.name}</span>
        <span className="ml-auto">{done ? "完成" : "运行中"}</span>
      </summary>
        <>
          {inputStr && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[--muted-foreground]/60 mb-1">输入参数</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[--card] p-2 text-[11px] leading-relaxed">{inputStr}</pre>
            </div>
          )}
          {block.outputPreview && (
            <div className={inputStr ? "mt-2" : "mt-2"}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[--muted-foreground]/60 mb-1">输出结果</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-[--card] p-2 text-[11px] leading-relaxed">{block.outputPreview}</pre>
            </div>
          )}
          {!inputStr && !block.outputPreview && (
            <div className="mt-2 text-[11px] text-[--muted-foreground]/50 italic">等待中...</div>
          )}
        </>
    </details>
  );
}

export function MessageBlocks({ blocks }: { blocks: ResponseBlock[] }) {
  const visibleBlocks = blocks.filter((block) => block.type !== "agent_status" && block.type !== "thinking");

  return (
    <div className="space-y-3">
      {visibleBlocks.map((block) => {
        if (block.type === "markdown") {
          return (
            <div key={block.id} className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
            </div>
          );
        }

        if (block.type === "chart") {
          return (
            <div key={block.id} className="rounded-md border border-[--border] bg-[--card] p-2">
              {block.title && <div className="px-1 pb-2 text-[12px] font-semibold">{block.title}</div>}
              <EChart option={block.option as EChartsOption} />
            </div>
          );
        }

        if (block.type === "table") return <DataTable key={block.id} block={block} />;
        if (block.type === "tool") return <ToolBlock key={block.id} block={block} />;

        if (block.type === "error") {
          return (
            <div key={block.id} role="alert" className="flex gap-2 rounded-md border border-[--destructive]/30 bg-[--destructive]/5 px-3 py-2 text-[13px] text-[--destructive]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{block.message}</span>
            </div>
          );
        }

        return null;
      })}

      {visibleBlocks.length === 0 && (
        <div className="inline-flex items-center gap-2 rounded-md bg-[--muted] px-3 py-2 text-[13px] text-[--muted-foreground]">
          <Clock3 size={14} />
          生成中
        </div>
      )}
    </div>
  );
}
