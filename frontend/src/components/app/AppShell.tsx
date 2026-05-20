"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Activity, Download, LogIn, Menu, Settings, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from "lucide-react";
import ChatPanel from "@/components/chat/ChatPanel";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { ConversationSidebar } from "@/components/app/ConversationSidebar";
import { RunInspector } from "@/components/app/RunInspector";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useChatStore } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { messageToPlainText } from "@/lib/messages";
import { testConnection } from "@/lib/api";
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const createConversation = useChatStore((state) => state.createConversation);
  const switchConversation = useChatStore((state) => state.switchConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const batchDeleteConversations = useChatStore((state) => state.batchDeleteConversations);
  const messages = useChatStore((state) => state.getMessages());
  const currentAgent = useChatStore((state) => {
    const conv = state.conversations.find((c) => c.id === state.activeId);
    return conv?.currentAgent ?? null;
  });
  const currentTool = useChatStore((state) => {
    const conv = state.conversations.find((c) => c.id === state.activeId);
    return conv?.currentTool ?? null;
  });
  const activeLLM = useConnectionStore((state) => state.getActiveLLM());
  const activeDB = useConnectionStore((state) => state.getActiveDB());
  const assembleDbUrl = useConnectionStore((state) => state.assembleDbUrl);
  const [dbStatus, setDbStatus] = useState<"unknown" | "testing" | "connected" | "failed">("unknown");

  // Test DB connection when active DB profile changes
  useEffect(() => {
    if (!mounted || !activeDB) { setDbStatus("unknown"); return; }
    const url = assembleDbUrl(activeDB);
    if (!url) { setDbStatus("unknown"); return; }

    let cancelled = false;
    setDbStatus("testing");
    testConnection(url)
      .then((res) => { if (!cancelled) setDbStatus(res.success ? "connected" : "failed"); })
      .catch(() => { if (!cancelled) setDbStatus("failed"); });
    return () => { cancelled = true; };
  }, [mounted, activeDB?.id]);

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
    <div
      className="grid h-dvh grid-cols-1 overflow-hidden bg-[--background] lg:grid-cols-[var(--left-sidebar)_minmax(0,1fr)] xl:grid-cols-[var(--left-sidebar)_minmax(0,1fr)_var(--right-sidebar)]"
      style={{ "--left-sidebar": leftCollapsed ? "48px" : "280px", "--right-sidebar": rightCollapsed ? "48px" : "300px" } as React.CSSProperties}
    >
      {/* Left sidebar */}
      <div className="hidden min-h-0 lg:flex flex-col">
        {!leftCollapsed ? (
          <div className="flex-1 min-h-0">
            <ConversationSidebar
              conversations={displayConversations}
              activeId={activeId}
              onCreate={createConversation}
              onSelect={switchConversation}
              onDelete={deleteConversation}
              onBatchDelete={batchDeleteConversations}
              collapseButton={
                <button
                  onClick={() => setLeftCollapsed(true)}
                  className="rounded-md p-1.5 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-90 transition-all duration-150 cursor-pointer"
                  aria-label="收起对话列表"
                >
                  <PanelLeftClose size={16} />
                </button>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col items-center pt-3">
            <button
              onClick={() => setLeftCollapsed(false)}
              className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-90 transition-all duration-150 cursor-pointer"
              aria-label="展开对话列表"
            >
              <PanelLeft size={18} />
            </button>
          </div>
        )}
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
            onBatchDelete={(ids) => {
              batchDeleteConversations(ids);
              setSidebarOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 bg-[--card] px-3 sm:px-4">
          <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-90 transition-all duration-150 lg:hidden cursor-pointer" onClick={() => setSidebarOpen(true)} aria-label="打开对话列表">
            <Menu size={18} />
          </button>
          <div className="truncate text-[14px] font-semibold text-[--foreground]">{mounted ? (activeConversation?.title || "数据分析助手") : "数据分析助手"}</div>
          {/* Status bar — pushed right, never shrinks */}
          {mounted && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {/* LLM chip */}
              <button
                onClick={() => setSettingsOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer ${
                  activeLLM?.config.apiKey
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeLLM?.config.apiKey ? "bg-emerald-500" : "bg-amber-400"}`} />
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="hidden sm:inline">{activeLLM?.config.model || "未配置"}</span>
              </button>
              {/* DB chip */}
              <button
                onClick={() => setSettingsOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all duration-150 cursor-pointer ${
                  dbStatus === "connected"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : dbStatus === "testing"
                      ? "border-sky-300 bg-sky-50 text-sky-700"
                      : dbStatus === "failed"
                        ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  dbStatus === "connected"
                    ? "bg-emerald-500"
                    : dbStatus === "testing"
                      ? "bg-sky-400 animate-pulse"
                      : dbStatus === "failed"
                        ? "bg-red-400"
                        : "bg-amber-400"
                }`} />
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                <span className="hidden sm:inline">{activeDB?.name || "未连接"}</span>
              </button>
              {/* Agent chip — only when active */}
              {currentAgent && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-blue-300 bg-blue-50 text-blue-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                  <span>{currentAgent}</span>
                </span>
              )}
            </div>
          )}
          {mounted && activeConversation && activeConversation.messages.length > 0 && (
            <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-90 transition-all duration-150 shrink-0 cursor-pointer" onClick={handleExport} aria-label="导出对话">
              <Download size={17} />
            </button>
          )}
          <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-90 transition-all duration-150 shrink-0 cursor-pointer" onClick={() => setSettingsOpen(true)} aria-label="设置">
            <Settings size={17} />
          </button>
          <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[--muted-foreground] border border-[--border] hover:bg-[--muted] hover:text-[--foreground] active:scale-95 transition-all duration-150 shrink-0 cursor-pointer" aria-label="登录">
            <LogIn size={14} />
            <span className="hidden sm:inline">登录</span>
          </button>
        </header>
        <ChatPanel mounted={mounted} />
      </main>

      {/* Right sidebar */}
      <div className="hidden min-h-0 xl:flex flex-col border-l border-[--border] bg-[--card]">
        <div className="flex h-14 shrink-0 items-center gap-2 px-3">
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="rounded-md p-1.5 text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] active:scale-90 transition-all duration-150 cursor-pointer"
            aria-label={rightCollapsed ? "展开运行状态" : "收起运行状态"}
          >
            {rightCollapsed ? <PanelRight size={16} /> : <PanelRightClose size={16} />}
          </button>
          {!rightCollapsed && (
            <>
              <Activity size={15} className="text-[--muted-foreground]" />
              <span className="text-[13px] font-semibold text-[--foreground]">运行状态</span>
            </>
          )}
        </div>
        {!rightCollapsed && (
          <RunInspector messages={messages} currentAgent={currentAgent} currentTool={currentTool} />
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent showCloseButton={false} className="!max-w-[1280px] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] p-0 gap-0 rounded-xl overflow-hidden border border-[--border] shadow-lg max-h-[90vh] lg:max-h-[85vh]">
          <DialogTitle className="sr-only">连接配置</DialogTitle>
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
