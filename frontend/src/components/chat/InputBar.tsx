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
    <div className="shrink-0">
      <div className="flex items-end gap-2 bg-transparent px-1 py-1">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json,.parquet"
          className="hidden"
          onChange={handleFileUpload}
          aria-label="上传数据文件"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="上传数据文件"
          className="p-2 rounded-md hover:bg-[--muted] text-[--muted-foreground] hover:text-[--foreground] shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题，按 Enter 发送..."
          disabled={disabled}
          rows={1}
          aria-label="消息输入"
          className="flex-1 resize-none border-0 outline-none text-[15px] text-[--foreground] placeholder:text-[--muted-foreground]/50 bg-transparent py-2 min-h-[40px] max-h-[200px] leading-[1.5]"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          aria-label="发送消息"
          className="p-2 rounded-full transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed bg-[--primary] text-[--primary-foreground] hover:opacity-90 cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <p className="text-[11px] text-[--muted-foreground]/50 text-center mt-1.5">
        支持上传 CSV、Excel、JSON、Parquet 数据文件
      </p>
    </div>
  );
}
