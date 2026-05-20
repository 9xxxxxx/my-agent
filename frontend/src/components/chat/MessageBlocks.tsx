import { useDeferredValue, memo, useMemo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import EChart from "@/components/chart/EChart";
import type { EChartsOption } from "echarts";
import type { ResponseBlock } from "@/lib/messages";
import { AlertTriangle, CheckCircle2, Clock3, Wrench, ChevronDown } from "lucide-react";

function DataTable({ block }: { block: Extract<ResponseBlock, { type: "table" }> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[--border] shadow-sm">
      {block.title && <div className="border-b border-[--border] px-4 py-2.5 text-[13px] font-semibold text-[--foreground]">{block.title}</div>}
      <table className="w-full text-[13px]">
        <thead className="bg-[--muted] text-[--secondary-foreground]">
          <tr>
            {block.columns.map((column) => (
              <th key={column} className="px-4 py-2.5 text-left font-semibold text-[12px]">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[--border]/60 hover:bg-[--muted]/50 transition-colors">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5">{String(cell ?? "")}</td>
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
  const [isOpen, setIsOpen] = useState(!done);
  const prevDoneRef = useRef(done);

  useEffect(() => {
    if (!done) {
      setIsOpen(true);
    } else if (!prevDoneRef.current && done) {
      // 运行结束自动折叠
      setIsOpen(false);
    }
    prevDoneRef.current = done;
  }, [done]);

  const inputStr = block.input
    ? (typeof block.input === "object" ? JSON.stringify(block.input, null, 2) : String(block.input))
    : "";

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      className="rounded-xl border border-[--border]/60 bg-[--muted]/20 px-3.5 py-2.5 text-[12px] text-[--muted-foreground] transition-all duration-200"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 select-none hover:text-[--foreground] transition-colors">
        {done ? <CheckCircle2 size={13} className="text-[--success] shrink-0" /> : <Wrench size={13} className="text-[--primary]/60 animate-pulse shrink-0" />}
        <span className="font-mono text-[--foreground] font-medium">{block.name}</span>
        <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${done ? "bg-[--success]/8 text-[--success]" : "bg-[--primary]/8 text-[--primary]"}`}>
          {done ? "运行完毕" : "正在调用"}
        </span>
        <ChevronDown size={13} className={`text-[--muted-foreground]/50 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </summary>
      <div className="mt-2.5 space-y-2 border-l-2 border-[--border] pl-3">
        {inputStr && (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[--muted-foreground]/60 mb-0.5">参数输入</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[--card] p-2 text-[10px] leading-relaxed border border-[--border]/40 font-mono">{inputStr}</pre>
          </div>
        )}
        {block.outputPreview && (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[--muted-foreground]/60 mb-0.5">结果输出</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[--card] p-2 text-[10px] leading-relaxed border border-[--border]/40 font-mono">{block.outputPreview}</pre>
          </div>
        )}
        {!inputStr && !block.outputPreview && (
          <div className="text-[10px] text-[--muted-foreground]/40 italic">等待响应中...</div>
        )}
      </div>
    </details>
  );
}

const remarkPlugins = [remarkGfm];

// 极具现代感与科技感的高级代码块组件
function MarkdownCode({ inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeText = String(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (inline) {
    return (
      <code className="bg-[--primary]/6 text-[--primary] px-1.5 py-0.5 rounded font-mono text-[0.88em] border border-[--primary]/10" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[--border] bg-slate-950 text-slate-100 shadow-sm font-mono text-[13px]">
      <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2 text-[10px] font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider select-none">
        <span>{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-200 active:scale-95 transition-all duration-100 cursor-pointer"
        >
          {copied ? (
            <>
              <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium">已复制</span>
            </>
          ) : (
            <>
              <span className="text-slate-400 hover:text-slate-200">复制</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 leading-relaxed scrollbar-thin">
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
}

// 精美排版表格包裹器
function MarkdownTable({ children }: any) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-[--border] bg-[--card] shadow-sm">
      <table className="w-full border-collapse text-[13.5px]">
        {children}
      </table>
    </div>
  );
}

const MarkdownBlock = memo(function MarkdownBlock({ content }: { content: string }) {
  const deferred = useDeferredValue(content);
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          code: MarkdownCode,
          table: MarkdownTable,
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left font-semibold text-[12px] uppercase tracking-wider bg-[--muted] text-[--secondary-foreground] border-b border-[--border]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 border-b border-[--border]/60 text-[13.5px] text-[--foreground]">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[--muted]/30 transition-colors border-b border-[--border]/30 last:border-0">
              {children}
            </tr>
          ),
        }}
      >
        {deferred}
      </ReactMarkdown>
    </div>
  );
});

export function MessageBlocks({ blocks }: { blocks: ResponseBlock[] }) {
  const visibleBlocks = useMemo(
    () => blocks.filter((block) => block.type !== "agent_status" && block.type !== "thinking"),
    [blocks],
  );

  return (
    <div className="space-y-3">
      {visibleBlocks.map((block) => {
        if (block.type === "markdown") {
          return <MarkdownBlock key={block.id} content={block.content} />;
        }

        if (block.type === "chart") {
          return (
            <div key={block.id} className="rounded-xl border border-[--border] bg-[--card] p-3 shadow-sm">
              {block.title && <div className="px-1 pb-2 text-[13px] font-semibold text-[--foreground]">{block.title}</div>}
              <EChart option={block.option as EChartsOption} />
            </div>
          );
        }

        if (block.type === "table") return <DataTable key={block.id} block={block} />;
        if (block.type === "tool") return <ToolBlock key={block.id} block={block} />;

        if (block.type === "error") {
          return (
            <div key={block.id} role="alert" className="flex gap-2.5 rounded-xl border border-[--destructive]/20 bg-[--destructive]/5 px-4 py-3 text-[13px] text-[--destructive]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{block.message}</span>
            </div>
          );
        }

        return null;
      })}

      {visibleBlocks.length === 0 && (
        <div className="inline-flex items-center gap-2 rounded-lg bg-[--muted] px-3.5 py-2.5 text-[13px] text-[--muted-foreground]">
          <Clock3 size={14} className="animate-pulse" />
          生成中
        </div>
      )}
    </div>
  );
}
