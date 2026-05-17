"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw, SquarePen } from "lucide-react";
import type { Message } from "@/stores/chat";
import { messageToPlainText } from "@/lib/messages";
import { MessageBlocks } from "@/components/chat/MessageBlocks";
import { toast } from "sonner";

interface Props {
  message: Message;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
      aria-label={copied ? "已复制" : "复制"}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export default function MessageBubble({ message, onRetry, onEdit }: Props) {
  const text = messageToPlainText(message);

  if (message.role === "system") {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-[--muted] px-3 py-1 text-[12px] text-[--muted-foreground]">{text}</span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="group flex justify-end py-2">
        <div className="max-w-[86%] sm:max-w-[72%]">
          <div className="rounded-2xl rounded-br-md bg-[--muted] px-4 py-3 text-[15px] leading-7 text-[--foreground]">
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
          <div className="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {text && <CopyButton text={text} />}
            {onEdit && (
              <button
                onClick={() => onEdit(text)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
                aria-label="编辑并重新发送"
              >
                <SquarePen size={13} />
                编辑
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start py-3">
      <div className="max-w-[min(820px,100%)] flex-1">
        <div className="px-1 text-[--foreground]">
          <MessageBlocks blocks={message.blocks} />
        </div>
        <div className="mt-2 flex items-center gap-1">
          {text && <CopyButton text={text} />}
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
              aria-label="重新生成"
            >
              <RotateCcw size={13} />
              重新生成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
