"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ChatPanel from "@/components/chat/ChatPanel";
import SettingsPanel from "@/components/settings/SettingsPanel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChatStore, type Conversation } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { toast } from "sonner";
import { messageToPlainText } from "@/lib/messages";

// ─── Hooks ───

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── Date grouping ───

function groupByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: Record<string, Conversation[]> = {
    "今天": [],
    "昨天": [],
    "过去 7 天": [],
    "更早": [],
  };

  for (const c of conversations) {
    const t = c.updatedAt;
    if (t >= today) groups["今天"].push(c);
    else if (t >= yesterday) groups["昨天"].push(c);
    else if (t >= weekAgo) groups["过去 7 天"].push(c);
    else groups["更早"].push(c);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

// ─── Export conversation as markdown ───

function exportAsMarkdown(conv: Conversation): string {
  const lines: string[] = [`# ${conv.title}`, ""];
  for (const msg of conv.messages) {
    if (msg.role === "system") {
      lines.push(`> ${messageToPlainText(msg)}`, "");
    } else if (msg.role === "user") {
      lines.push(`**You:** ${messageToPlainText(msg)}`, "");
    } else {
      lines.push(`**AI:** ${messageToPlainText(msg)}`, "");
    }
  }
  return lines.join("\n");
}

// ─── Shared helpers ───

function useSharedState() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const createConversation = useChatStore((s) => s.createConversation);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const getActiveLLM = useConnectionStore((s) => s.getActiveLLM);
  const getActiveDB = useConnectionStore((s) => s.getActiveDB);
  const llmProfiles = useConnectionStore((s) => s.llmProfiles);
  const setActiveLLM = useConnectionStore((s) => s.setActiveLLM);
  const activeLLM = getActiveLLM();
  const activeDB = getActiveDB();

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  return { conversations, activeId, createConversation, switchConversation, deleteConversation, activeLLM, activeDB, activeConv, llmProfiles, setActiveLLM };
}

// ─── Mobile Layout ───

function MobilePage() {
  const { conversations, activeId, createConversation, switchConversation, deleteConversation, activeLLM, activeDB, activeConv } = useSharedState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const groups = useMemo(() => groupByDate(conversations), [conversations]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteConversation(deletingId);
      setDeletingId(null);
    }
  };

  const handleShare = useCallback(async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    try {
      await navigator.clipboard.writeText(exportAsMarkdown(conv));
      toast.success("对话已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  }, [conversations]);

  const handleSelectConversation = (id: string) => {
    switchConversation(id);
    setMenuOpen(false);
  };

  const handleNewConversation = () => {
    createConversation();
    setMenuOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {/* ── Chat Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--card)", flexShrink: 0, gap: "12px",
      }}>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="打开对话列表"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: 10, border: "none",
            background: "var(--muted)", color: "var(--muted-foreground)",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <span style={{
          flex: 1, fontSize: 15, fontWeight: 600, color: "var(--foreground)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {activeConv?.title || "数据分析助手"}
        </span>

        {mounted && activeConv && activeConv.messages.length > 0 && (
          <button
            onClick={() => handleShare(activeConv.id)}
            aria-label="导出对话"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--card)", color: "var(--muted-foreground)",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        )}
      </header>

      {/* ── Chat Content ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ChatPanel />
      </div>

      {/* ── Full-screen Conversation Menu ── */}
      {menuOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", flexDirection: "column",
          background: "var(--sidebar)",
        }}>
          {/* Menu header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid var(--sidebar-border)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
              对话列表
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleNewConversation}
                aria-label="新建对话"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 40, height: 40, borderRadius: 10, border: "none",
                  background: "var(--primary)", color: "var(--primary-foreground)",
                  cursor: "pointer",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="关闭菜单"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 40, height: 40, borderRadius: 10, border: "none",
                  background: "var(--muted)", color: "var(--muted-foreground)",
                  cursor: "pointer",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 12px" }}>
            {groups.map((group) => (
              <div key={group.label}>
                <div style={{
                  fontSize: 11, color: "var(--muted-foreground)", padding: "8px 12px",
                  textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
                }}>
                  {group.label}
                </div>
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "14px 16px", borderRadius: 14, marginBottom: 4,
                      cursor: "pointer", fontSize: 14,
                      background: conv.id === activeId ? "#f0f0f0" : "transparent",
                      color: conv.id === activeId ? "var(--foreground)" : "var(--muted-foreground)",
                      border: "1px solid transparent",
                      transition: "all 0.15s ease",
                      transform: conv.id === activeId ? "none" : undefined,
                    }}
                    onMouseDown={(e) => { if (conv.id !== activeId) (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.title}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                      aria-label="删除对话"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: 8, border: "none",
                        background: "transparent", color: "var(--muted-foreground)",
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {conversations.length === 0 && (
              <div style={{ padding: "24px 12px", fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
                暂无对话
              </div>
            )}
          </div>

          {/* Settings button */}
          <div style={{
            padding: "12px 16px", borderTop: "1px solid var(--sidebar-border)", flexShrink: 0,
          }}>
            <button
              onClick={() => { setMenuOpen(false); setConfigOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "14px 16px", borderRadius: 14,
                border: "none", background: "transparent",
                color: "var(--muted-foreground)", cursor: "pointer", fontSize: 14,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              连接设置
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", opacity: 0.7 }}>
                {activeLLM?.name || ""}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deletingId && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setDeletingId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)",
              padding: "24px 20px", maxWidth: 340, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>删除对话</h3>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginBottom: 24, lineHeight: 1.5 }}>
              确定要删除这个对话吗？此操作无法撤销。
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  padding: "10px 20px", borderRadius: 12, border: "none",
                  background: "var(--muted)", color: "var(--muted-foreground)",
                  cursor: "pointer", fontSize: 14, fontWeight: 500,
                }}
              >取消</button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: "10px 20px", borderRadius: 12, border: "none",
                  background: "#ef4444", color: "#fff",
                  cursor: "pointer", fontSize: 14, fontWeight: 600,
                }}
              >删除</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Dialog ── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent
          showCloseButton={false}
          className="!max-w-[1280px] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] p-0 gap-0 rounded-xl overflow-hidden border border-[--border] shadow-lg max-h-[90vh] lg:max-h-[85vh]"
        >
          <DialogTitle className="sr-only">连接配置</DialogTitle>
          <SettingsPanel onClose={() => setConfigOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Desktop Layout ───

function DesktopPage() {
  const { conversations, activeId, createConversation, switchConversation, deleteConversation, activeLLM, activeDB, activeConv, llmProfiles, setActiveLLM } = useSharedState();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Keyboard shortcuts: Ctrl+K to open search, ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setContextMenu(null);
        setModelDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groups = useMemo(() => groupByDate(conversations), [conversations]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      return c.messages.some((m) => messageToPlainText(m).toLowerCase().includes(q));
    });
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => groupByDate(filteredConversations), [filteredConversations]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setContextMenu(null);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteConversation(deletingId);
      setDeletingId(null);
    }
  };

  const handleShare = useCallback(async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    try {
      await navigator.clipboard.writeText(exportAsMarkdown(conv));
      toast.success("对话已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
    setContextMenu(null);
  }, [conversations]);

  const handleContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[--background]">
      {/* Sidebar */}
      <aside
        className={`
          w-[240px] lg:w-[240px] shrink-0 flex flex-col bg-[--sidebar] overflow-hidden border-r border-[--border]
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-2xl
          max-lg:transition-transform max-lg:duration-200 max-lg:ease-out
          ${sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}
          lg:transition-all lg:duration-200 lg:ease-out
          ${sidebarOpen ? "" : "lg:w-0 lg:border-r-0"}
        `}
        role="navigation"
        aria-label="对话历史"
      >
        <div className="h-12 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[--primary] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold tracking-tight text-[--foreground]">Data Agent</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭侧边栏"
            className="p-1.5 -mr-1 rounded-md hover:bg-[--sidebar-accent] text-[--muted-foreground] lg:hidden cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-2 pb-1 flex items-center gap-1">
          <button
            onClick={createConversation}
            aria-label="新建对话"
            className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-[--muted-foreground] hover:bg-[--sidebar-accent] hover:text-[--foreground] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新对话
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="搜索对话"
            className="p-2 rounded-lg text-[--muted-foreground] hover:bg-[--sidebar-accent] hover:text-[--foreground] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-2 py-1 overflow-y-auto">
          {mounted && groups.map((group) => (
            <div key={group.label} className="mb-1">
              <div suppressHydrationWarning className="text-[10px] text-[--muted-foreground] px-2.5 py-1.5 uppercase tracking-wider font-medium">
                {group.label}
              </div>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => { switchConversation(conv.id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  onContextMenu={(e) => handleContextMenu(conv.id, e)}
                  role="button"
                  tabIndex={0}
                  className={`group/item relative flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] cursor-pointer transition-all duration-150 mb-0.5 ${
                    conv.id === activeId
                      ? "text-[--foreground] font-medium"
                      : "text-[--muted-foreground] hover:bg-[--muted]/70 hover:text-[--foreground] active:scale-[0.98]"
                  }`}
                  style={conv.id === activeId ? { background: "#f0f0f0" } : undefined}
                >
                  <span className="flex-1 truncate pr-6" suppressHydrationWarning>{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu({ id: conv.id, x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom });
                    }}
                    aria-label="更多操作"
                    className="absolute right-1 p-1 rounded-md opacity-0 group-hover/item:opacity-100 hover:bg-[--muted] text-[--muted-foreground] transition-all cursor-pointer"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
          {mounted && conversations.length === 0 && (
            <div className="px-2.5 py-4 text-[12px] text-[--muted-foreground] text-center">
              暂无对话
            </div>
          )}
        </div>

        <div className="p-2 shrink-0">
          <button
            onClick={() => setConfigOpen(true)}
            aria-label="设置"
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-[--muted-foreground] hover:bg-[--sidebar-accent] hover:text-[--foreground] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            设置
          </button>
        </div>
      </aside>

      {/* Search dialog */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40" onClick={() => setSearchOpen(false)}>
          <div
            className="relative z-10 w-full max-w-2xl mx-4 bg-[--card] rounded-xl border border-[--border] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[--border]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索对话标题或内容..."
                autoFocus
                className="flex-1 border-0 outline-none text-[15px] text-[--foreground] placeholder:text-[--muted-foreground]/50 bg-transparent"
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[--muted-foreground] bg-[--muted] border border-[--border]">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {(searchQuery.trim() ? filteredConversations : conversations).slice(0, 20).map((conv) => {
                const d = new Date(conv.updatedAt);
                const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                return (
                  <button
                    key={conv.id}
                    onClick={() => { switchConversation(conv.id); setSearchOpen(false); setSearchQuery(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer hover:bg-[#f0f0f0] ${
                      conv.id === activeId ? "bg-[#f0f0f0]" : ""
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="flex-1 min-w-0 text-[14px] text-[--foreground] truncate">{conv.title}</span>
                    <span className="shrink-0 text-[12px] text-[--muted-foreground] tabular-nums">{timeStr}</span>
                  </button>
                );
              })}
              {searchQuery.trim() && filteredConversations.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-[--muted-foreground]">
                  未找到匹配的对话
                </div>
              )}
              {!searchQuery.trim() && conversations.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-[--muted-foreground]">
                  暂无对话
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-36 rounded-lg bg-[--card] border border-[--border] shadow-md py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleShare(contextMenu.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground] cursor-pointer transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              导出
            </button>
            <div className="my-1 border-t border-[--border]" />
            <button
              onClick={(e) => handleDelete(contextMenu.id, e)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[#ef4444] hover:bg-[#ef4444]/[0.06] cursor-pointer transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              删除
            </button>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingId(null)}>
          <div className="bg-[--card] rounded-xl border border-[--border] shadow-xl p-5 max-w-sm w-full mx-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[--foreground] mb-2">删除对话</h3>
            <p className="text-[13px] text-[--muted-foreground] mb-6">确定要删除这个对话吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg text-[13px] text-[--muted-foreground] hover:bg-[--accent] cursor-pointer transition-colors">取消</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-[#ef4444] text-white hover:bg-[#dc2626] cursor-pointer transition-colors">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent
          showCloseButton={false}
          className="!max-w-[1280px] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] p-0 gap-0 rounded-xl overflow-hidden border border-[--border] shadow-lg max-h-[90vh] lg:max-h-[85vh]"
        >
          <DialogTitle className="sr-only">连接配置</DialogTitle>
          <SettingsPanel onClose={() => setConfigOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Main area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-10 shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
                className="p-1.5 -ml-1 rounded-md hover:bg-[--muted] text-[--muted-foreground] cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>

              {/* Model selector dropdown */}
              <div className="relative">
                <button
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[--muted] text-[13px] text-[--muted-foreground] hover:text-[--foreground] transition-colors cursor-pointer"
                >
                  <span suppressHydrationWarning className="font-medium text-[--foreground]">
                    {activeLLM?.config.model || "未配置"}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-150 ${modelDropdownOpen ? "rotate-180" : ""}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {modelDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg bg-[--card] border border-[--border] shadow-md py-1">
                      <div className="px-3 py-1.5 text-[11px] text-[--muted-foreground] font-medium uppercase tracking-wider">
                        切换模型
                      </div>
                      {llmProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => {
                            setActiveLLM(profile.id);
                            setModelDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                            profile.id === activeLLM?.id
                              ? "bg-[--primary]/5 text-[--primary]"
                              : "text-[--foreground] hover:bg-[--muted]"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${profile.id === activeLLM?.id ? "bg-[--primary]" : "bg-[--border]"}`} />
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium truncate">{profile.name}</div>
                            <div className="text-[11px] text-[--muted-foreground] truncate">{profile.config.model}</div>
                          </div>
                          {profile.id === activeLLM?.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[--primary]">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                      <div className="my-1 border-t border-[--border]" />
                      <button
                        onClick={() => { setModelDropdownOpen(false); setConfigOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] cursor-pointer transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                        管理模型配置
                      </button>
                    </div>
                  </>
                )}
              </div>

              <span suppressHydrationWarning className="text-[14px] font-medium text-[--foreground] truncate">{activeConv?.title || "与 AI 分析师对话"}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* DB config name */}
              {mounted && activeDB && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[--muted-foreground] bg-[--muted] px-2 py-1 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-[--success]" />
                  {activeDB.name}
                </span>
              )}

              {/* Export button */}
              {mounted && activeConv && activeConv.messages.length > 0 && (
                <button
                  onClick={() => handleShare(activeConv.id)}
                  aria-label="导出对话"
                  className="p-1.5 rounded-md text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground] transition-colors cursor-pointer"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
              )}
            </div>
          </header>

          <ChatPanel />
        </div>
      </main>
    </div>
  );
}

// ─── Main Export ───

export default function Home() {
  const isMobile = useIsMobile();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  // Avoid hydration mismatch: render nothing on server/first client render
  if (!hasMounted) {
    return <div style={{ height: "100dvh", background: "var(--background)" }} />;
  }

  return isMobile ? <MobilePage /> : <DesktopPage />;
}
