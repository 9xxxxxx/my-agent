"use client";

import { useState, useRef } from "react";
import { useChatStore } from "@/stores/chat";
import { uploadFile } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addMessage = useChatStore((s) => s.addMessage);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    });
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addMessage({
      id: crypto.randomUUID(),
      role: "system",
      content: `正在上传 ${file.name}...`,
      timestamp: Date.now(),
    });

    try {
      const result = await uploadFile(file);
      if (result.success) {
        toast.success(`已上传: ${result.table_name}`);
        addMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: `"${file.name}" 已注册为表 ${result.table_name}`,
          timestamp: Date.now(),
        });
      } else {
        toast.error(result.error || "上传失败");
      }
    } catch {
      toast.error("上传失败");
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="shrink-0 border-t border-[#e5e4e1]/60 bg-[#f9f9f7]">
      <div className="max-w-[720px] mx-auto px-4 py-3">
        <div className="flex items-end gap-2 bg-white rounded-2xl border border-[#e5e4e1] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-3 py-2 focus-within:border-[#b0afa8] focus-within:shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json,.parquet"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-[#f0efed] text-[#9a9a92] hover:text-[#5a5a52] shrink-0"
            title="上传数据文件"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none border-0 outline-none text-[14px] text-[#1a1a1a] placeholder:text-[#b0afa8] bg-transparent py-1 min-h-[28px] max-h-[120px] leading-relaxed"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="p-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed bg-[#2d2d2d] text-white hover:bg-[#1a1a1a] disabled:hover:bg-[#2d2d2d]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-[#b0afa8] text-center mt-2">
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
