"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Download, Menu, Settings } from "lucide-react";
import ChatPanel from "@/components/chat/ChatPanel";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { ConversationSidebar } from "@/components/app/ConversationSidebar";
import { RunInspector } from "@/components/app/RunInspector";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useChatStore } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { messageToPlainText } from "@/lib/messages";
import { toast } from "sonner";

function exportConversation(title: string, messages: ReturnType<typeof useChatStore.getState>["conversations"][number]["messages"]): string {
  const lines = [`# ${title}`, ""];
  messages.forEach((message) => {
    const text = messageToPlainText(message);
    if (!text) return;
    if (message.role === "user") lines.push(`**You:** ${text}`, "");
    else if (message.role === "assistant") lines.push(`**AI:** ${text}`, "");
    else lines.push(`> ${text}`, "");
  });
  return lines.join("\n");
}

const emptySubscribe = () => () => {};
const isClient = () => typeof window !== "undefined";

export default function AppShell() {
  const mounted = useSyncExternalStore(emptySubscribe, isClient, () => false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const createConversation = useChatStore((state) => state.createConversation);
  const switchConversation = useChatStore((state) => state.switchConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const messages = useChatStore((state) => state.getMessages());
  const currentAgent = useChatStore((state) => state.currentAgent);
  const currentTool = useChatStore((state) => state.currentTool);
  const activeLLM = useConnectionStore((state) => state.getActiveLLM());
  const activeDB = useConnectionStore((state) => state.getActiveDB());

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || conversations[0] || null,
    [activeId, conversations],
  );

  const displayConversations = mounted ? conversations : [];

  const handleExport = async () => {
    if (!activeConversation) return;
    try {
      await navigator.clipboard.writeText(exportConversation(activeConversation.title, activeConversation.messages));
      toast.success("对话已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-[--background] lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
      <div className="hidden min-h-0 lg:block">
        <ConversationSidebar
          conversations={displayConversations}
          activeId={activeId}
          onCreate={createConversation}
          onSelect={switchConversation}
          onDelete={deleteConversation}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[320px] max-w-[90vw] gap-0 p-0">
          <SheetTitle className="sr-only">对话列表</SheetTitle>
          <ConversationSidebar
            conversations={displayConversations}
            activeId={activeId}
            onCreate={() => {
              createConversation();
              setSidebarOpen(false);
            }}
            onSelect={(id) => {
              switchConversation(id);
              setSidebarOpen(false);
            }}
            onDelete={deleteConversation}
            onOpenSettings={() => {
              setSidebarOpen(false);
              setSettingsOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[--border] bg-[--card] px-3 sm:px-4">
          <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="打开对话列表">
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-[--foreground]">{mounted ? (activeConversation?.title || "数据分析助手") : "数据分析助手"}</div>
            <div className="truncate text-[11px] text-[--muted-foreground]">
              {mounted ? (`${activeLLM?.config.model || "未配置模型"} · ${activeDB?.name || "未连接数据源"} · ${currentAgent || "待命"}`) : "未配置模型 · 未连接数据源 · 待命"}
            </div>
          </div>
          {mounted && activeConversation && activeConversation.messages.length > 0 && (
            <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted]" onClick={handleExport} aria-label="导出对话">
              <Download size={17} />
            </button>
          )}
          <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted]" onClick={() => setSettingsOpen(true)} aria-label="设置">
            <Settings size={17} />
          </button>
        </header>
        <ChatPanel mounted={mounted} />
      </main>

      <RunInspector messages={messages} currentAgent={currentAgent} currentTool={currentTool} />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent showCloseButton={false} className="!max-w-[1280px] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] p-0 gap-0 rounded-xl overflow-hidden border border-[--border] shadow-lg max-h-[90vh] lg:max-h-[85vh]">
          <DialogTitle className="sr-only">连接配置</DialogTitle>
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
