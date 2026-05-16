"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/api";
import { useChatStore } from "@/stores/chat";
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
      content: `正在上传文件: ${file.name}...`,
      timestamp: Date.now(),
    });

    try {
      const result = await uploadFile(file);
      if (result.success) {
        toast.success(`文件已上传: ${result.table_name}`);
        addMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: `文件 "${file.name}" 已上传并注册为表 \`${result.table_name}\`，可用 SQL 查询。`,
          timestamp: Date.now(),
        });
      } else {
        toast.error(result.error || "上传失败");
      }
    } catch (err) {
      toast.error("文件上传失败");
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-end gap-2 p-4 border-t border-border bg-background/80 backdrop-blur">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json,.parquet"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={() => fileRef.current?.click()}
        title="上传数据文件"
        className="shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </Button>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
        disabled={disabled}
        rows={1}
        className="min-h-[44px] max-h-[120px] resize-none"
      />
      <Button onClick={handleSend} disabled={disabled || !input.trim()} className="shrink-0">
        发送
      </Button>
    </div>
  );
}
