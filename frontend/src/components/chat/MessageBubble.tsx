"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import EChart from "@/components/chart/EChart";
import type { EChartsOption } from "echarts";
import type { Message, ToolCall } from "@/stores/chat";
import { toast } from "sonner";
import { messageToPlainText } from "@/lib/messages";

interface Props {
  message: Message;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
}

// ─── Copy button ───

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "已复制" : "复制"}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition-colors cursor-pointer ${
        copied
          ? "bg-[--success]/10 text-[--success]"
          : "text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground]"
      }`}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      {label && <span>{copied ? "已复制" : label}</span>}
    </button>
  );
}

// ─── Reasoning section (collapsible) ───

function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!reasoning) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[--muted-foreground] bg-[--muted] hover:bg-[--border] transition-colors cursor-pointer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
        思考过程
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-[--border] text-[13px] text-[--muted-foreground] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto bg-[--muted]/50 rounded-r-md py-2.5 pr-3">
          {reasoning}
        </div>
      )}
    </div>
  );
}

// ─── Tool calls section ───

function ToolCallsSection({ tools }: { tools: ToolCall[] }) {
  const [expanded, setExpanded] = useState(true);

  if (tools.length === 0) return null;

  return (
    <div className="mb-3 space-y-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[--muted-foreground] bg-[--muted] hover:bg-[--border] transition-colors cursor-pointer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        调用了 {tools.length} 个工具
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="space-y-2 ml-1">
          {tools.map((tool, i) => (
            <ToolCallCard key={i} tool={tool} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ tool, index }: { tool: ToolCall; index: number }) {
  const [showArgs, setShowArgs] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const hasArgs = tool.arguments && tool.arguments !== "{}" && tool.arguments !== '""';
  const hasOutput = !!tool.output;

  let formattedArgs = "";
  if (hasArgs) {
    try {
      formattedArgs = JSON.stringify(JSON.parse(tool.arguments!), null, 2);
    } catch {
      formattedArgs = tool.arguments || "";
    }
  }

  const displayOutput = hasOutput
    ? (tool.output!.length > 800 ? tool.output!.slice(0, 800) + "..." : tool.output!)
    : "";

  return (
    <div className="rounded-lg border border-[--border] bg-[--muted]/50 overflow-hidden">
      {/* Tool name header */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="flex items-center justify-center w-4 h-4 rounded bg-[--muted] text-[--muted-foreground]">
          <span className="text-[10px] font-bold">{index + 1}</span>
        </span>
        <span className="text-[12px] font-mono font-medium text-[--foreground]">{tool.name}</span>
        {hasOutput && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[--success]" title="已完成" />
        )}
      </div>

      {/* Arguments toggle */}
      {hasArgs && (
        <div>
          <button
            onClick={() => setShowArgs(!showArgs)}
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] text-[--muted-foreground] hover:bg-[--muted] transition-colors cursor-pointer border-t border-[--border]/50"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-150 ${showArgs ? "rotate-90" : ""}`}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            参数
          </button>
          {showArgs && (
            <pre className="px-3 py-2 text-[11px] text-[--muted-foreground] bg-[--muted]/30 border-t border-[--border]/30 overflow-x-auto font-mono leading-relaxed">
              {formattedArgs}
            </pre>
          )}
        </div>
      )}

      {/* Output toggle */}
      {hasOutput && (
        <div>
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] text-[--muted-foreground] hover:bg-[--muted] transition-colors cursor-pointer border-t border-[--border]/50"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-150 ${showOutput ? "rotate-90" : ""}`}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            结果
          </button>
          {showOutput && (
            <pre className="px-3 py-2 text-[11px] text-[--muted-foreground] bg-[--muted]/30 border-t border-[--border]/30 overflow-x-auto font-mono leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap">
              {displayOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section with copy button (hover to reveal) ───

function SectionCopyButton({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = containerRef.current?.innerText || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? "已复制" : "复制此段"}
      className="absolute -right-1 -top-1 p-1 rounded-md bg-[--card] border border-[--border] shadow-sm opacity-0 group-hover/section:opacity-100 transition-opacity duration-150 cursor-pointer hover:bg-[--muted] z-10"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// Section wrappers — must be real components (hooks allowed)
function H1Section({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative group/section">
      <h1 className="text-[24px] font-bold mt-6 mb-3 text-[--foreground]">{children}</h1>
      <SectionCopyButton containerRef={ref} />
    </div>
  );
}
function H2Section({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative group/section">
      <h2 className="text-[21px] font-bold mt-5 mb-2.5 text-[--foreground]">{children}</h2>
      <SectionCopyButton containerRef={ref} />
    </div>
  );
}
function H3Section({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative group/section">
      <h3 className="text-[18px] font-semibold mt-4 mb-2 text-[--foreground]">{children}</h3>
      <SectionCopyButton containerRef={ref} />
    </div>
  );
}
function PSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative group/section">
      <p className="my-3 leading-[1.85] text-[17px]">{children}</p>
      <SectionCopyButton containerRef={ref} />
    </div>
  );
}
function BlockquoteSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative group/section">
      <blockquote className="my-3 pl-3 border-l-2 border-[--border] text-[--muted-foreground] italic">{children}</blockquote>
      <SectionCopyButton containerRef={ref} />
    </div>
  );
}

// ─── Markdown renderer with enhanced styling ───

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose-chat [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        components={{
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[--border]">
              <table className="w-full text-[14px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[--muted] text-[--muted-foreground] text-[13px] font-semibold uppercase tracking-wider">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left border-b border-[--border]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-[--border]/50">{children}</td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[--muted]/30 transition-colors">{children}</tr>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <div className="relative group/code my-3">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-white/5">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {className?.replace("language-", "") || "code"}
                    </span>
                    <CopyButton text={String(children).replace(/\n$/, "")} label="复制" />
                  </div>
                  <code className="block px-4 py-3 bg-[#111] text-[14px] text-slate-200 rounded-b-lg overflow-x-auto font-mono leading-relaxed" {...props}>
                    {children}
                  </code>
                </div>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-[--muted] text-[--foreground] text-[14px] font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          h1: ({ children }) => <H1Section>{children}</H1Section>,
          h2: ({ children }) => <H2Section>{children}</H2Section>,
          h3: ({ children }) => <H3Section>{children}</H3Section>,
          ul: ({ children }) => <ul className="my-3 pl-5 space-y-1.5 list-disc marker:text-[--muted-foreground]">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 pl-5 space-y-1.5 list-decimal marker:text-[--muted-foreground]">{children}</ol>,
          li: ({ children }) => <li className="text-[17px] leading-[1.85]">{children}</li>,
          p: ({ children }) => <PSection>{children}</PSection>,
          blockquote: ({ children }) => <BlockquoteSection>{children}</BlockquoteSection>,
          strong: ({ children }) => <strong className="font-semibold text-[--foreground]">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[--primary] underline underline-offset-2 hover:text-[--primary]/80 transition-colors">
              {children}
            </a>
          ),
          hr: () => <hr className="my-5 border-[--border]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Main component ───

export default function MessageBubble({ message, onRetry, onEdit }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const plainText = messageToPlainText(message);

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-[13px] text-[--muted-foreground] bg-[--muted] px-3 py-1 rounded-full">
          {plainText}
        </span>
      </div>
    );
  }

  const hasReasoning = !isUser && !!message.reasoning;
  const hasToolCalls = !isUser && message.toolCalls && message.toolCalls.length > 0;
  const hasContent = !!plainText;
  const hasChart = !!message.chart;

  return (
    <div className={`group flex gap-3 py-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[--muted] border border-[--border]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}

      <div className={`max-w-[88%] sm:max-w-[80%] ${isUser ? "order-first" : ""}`}>
        {/* User message — right-aligned bubble */}
        {isUser ? (
          <div style={{ background: "#f0f0f0", color: "var(--foreground)", padding: "12px 8px 12px 16px", borderRadius: "16px 16px 16px 4px" }}>
            <p className="whitespace-pre-wrap leading-[1.8]">{plainText}</p>
          </div>
        ) : (
          /* AI message — flat, no box, like ChatGPT */
          <div className="text-[--foreground]">
            <div className="px-1 py-1">
              {/* Layer 1: Reasoning */}
              {hasReasoning && <ReasoningSection reasoning={message.reasoning!} />}

              {/* Layer 2: Tool calls */}
              {hasToolCalls && <ToolCallsSection tools={message.toolCalls!} />}

              {/* Layer 3: Final reply */}
              {hasContent && <MarkdownContent content={plainText} />}

              {/* Chart */}
              {hasChart && (
                <div className="mt-4 -mx-1">
                  <EChart option={message.chart as EChartsOption} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons — agent: always visible, user: hover only */}
        <div className={`flex items-center gap-1 mt-1.5 ${isUser ? "justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200" : "justify-start"}`}>
          {hasContent && <CopyButton text={plainText} label="复制" />}
          {!isUser && onRetry && (
            <button
              onClick={onRetry}
              aria-label="重新生成"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground] transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              重新生成
            </button>
          )}
          {isUser && onEdit && (
            <button
              onClick={() => onEdit(plainText)}
              aria-label="编辑并重新发送"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground] transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              编辑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
