"use client";

import type { Conversation } from "@/stores/chat";
import { messageToPlainText } from "@/lib/messages";
import { MessageSquare, Plus, Settings, Trash2 } from "lucide-react";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function preview(conversation: Conversation): string {
  const last = [...conversation.messages].reverse().find((message) => message.role !== "system");
  return last ? messageToPlainText(last).replace(/\s+/g, " ").slice(0, 54) : "还没有消息";
}

export function ConversationSidebar({
  conversations,
  activeId,
  onCreate,
  onSelect,
  onDelete,
  onOpenSettings,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[--border] bg-[--sidebar]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[--border] px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[--primary] text-[--primary-foreground]">
          <MessageSquare size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">Data Agent</div>
          <div className="truncate text-[11px] text-[--muted-foreground]">对话与数据分析</div>
        </div>
        <button onClick={onCreate} className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]" aria-label="新建对话">
          <Plus size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {conversations.map((conversation) => {
          const active = conversation.id === activeId;
          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={`group mb-1 grid w-full grid-cols-[1fr_auto] gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                active ? "bg-[--muted] text-[--foreground]" : "text-[--muted-foreground] hover:bg-[--muted]/70 hover:text-[--foreground]"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{conversation.title}</span>
                <span className="mt-0.5 block truncate text-[11px] opacity-75">{preview(conversation)}</span>
                <span className="mt-1 block text-[10px] opacity-60">{formatDate(conversation.updatedAt)} · {conversation.messages.length} 条</span>
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(conversation.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(conversation.id);
                  }
                }}
                className="self-start rounded p-1 opacity-0 transition-opacity hover:bg-[--card] group-hover:opacity-100"
                aria-label="删除对话"
              >
                <Trash2 size={13} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-[--border] p-2">
        <button onClick={onOpenSettings} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]">
          <Settings size={15} />
          连接设置
        </button>
      </div>
    </aside>
  );
}
