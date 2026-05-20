"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation } from "@/stores/chat";
import { messageToPlainText } from "@/lib/messages";
import { Check, ChevronDown, Search, SquarePen, Trash2, X } from "lucide-react";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onBatchDelete: (ids: string[]) => void;
  collapseButton?: React.ReactNode;
}

/* ── Logo ── */
function LogoMark({ size = 28, colorful = false }: { size?: number; colorful?: boolean }) {
  if (colorful) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 2L28.5 9.5V24.5L16 32L3.5 24.5V9.5L16 2Z" fill="#6366f1" opacity="0.12" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="10" y="18" width="3" height="6" rx="1" fill="#34d399" />
        <rect x="14.5" y="14" width="3" height="10" rx="1" fill="#60a5fa" />
        <rect x="19" y="10" width="3" height="14" rx="1" fill="#f472b6" />
        <circle cx="16" cy="7" r="1.5" fill="#fbbf24" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 2L28.5 9.5V24.5L16 32L3.5 24.5V9.5L16 2Z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="10" y="18" width="3" height="6" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="14.5" y="14" width="3" height="10" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="19" y="10" width="3" height="14" rx="1" fill="currentColor" />
      <circle cx="16" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}

/* ── Date grouping ── */
function dateGroup(timestamp: number): string {
  const now = new Date();
  const d = new Date(timestamp);
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "今天";
  if (isYesterday) return "昨天";
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return "最近 7 天";
  if (diff < 30) return "最近 30 天";
  return "更早";
}

function preview(conversation: Conversation): string {
  const msgs = conversation.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== "system") {
      return messageToPlainText(msgs[i]).replace(/\s+/g, " ").slice(0, 36);
    }
  }
  return "还没有消息";
}

function matchesSearch(conversation: Conversation, query: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  if (conversation.title.toLowerCase().includes(lower)) return true;
  for (const msg of conversation.messages) {
    const text = messageToPlainText(msg).toLowerCase();
    if (text.includes(lower)) return true;
  }
  return false;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onCreate,
  onSelect,
  onDelete,
  onBatchDelete,
  collapseButton,
}: ConversationSidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentOpen, setRecentOpen] = useState(true);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirmDeleteId) {
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 5000);
      return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); };
    }
  }, [confirmDeleteId]);

  // Focus search input when dialog opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [searchOpen]);

  // Keyboard shortcut: Cmd/Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((c) => matchesSearch(c, searchQuery.trim()));
  }, [conversations, searchQuery]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, Conversation[]> = {};
    for (const c of searchResults) {
      const g = dateGroup(c.updatedAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    }
    return groups;
  }, [searchResults]);

  const groupOrder = ["今天", "昨天", "最近 7 天", "最近 30 天", "更早"];

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBatchDelete([...selectedIds]);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBatchConfirm(false);
  }, [selectedIds, onBatchDelete]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBatchConfirm(false);
  }, []);

  const handleSelectFromSearch = useCallback((id: string) => {
    onSelect(id);
    setSearchOpen(false);
  }, [onSelect]);

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col border-r border-[--border] bg-[--sidebar]">

        {/* ── Brand header with logo ── */}
        <div className="shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--muted] shadow-md shadow-black/5">
              <LogoMark size={22} colorful />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold tracking-tight text-[--foreground]">Data Agent</div>
              <div className="text-[11px] text-[--muted-foreground]/50 mt-0.5">数据分析助手</div>
            </div>
            {selectionMode ? (
              <button
                onClick={exitSelectionMode}
                className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-[--muted-foreground] hover:bg-[--muted] cursor-pointer transition-colors"
              >
                取消
              </button>
            ) : collapseButton ? (
              collapseButton
            ) : null}
          </div>
        </div>

        {/* ── Action toolbar ── */}
        {!selectionMode && (
          <div className="shrink-0 px-3 pb-2 space-y-0.5">
            <button
              onClick={onCreate}
              className="group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[--muted-foreground] hover:text-[--foreground] hover:bg-[--primary]/10 active:bg-[--primary]/15 active:scale-[0.97] transition-all duration-200 cursor-pointer"
            >
              <SquarePen size={15} strokeWidth={1.8} />
              新建对话
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[--muted-foreground] hover:text-[--foreground] hover:bg-[--primary]/10 active:bg-[--primary]/15 active:scale-[0.97] transition-all duration-200 cursor-pointer"
              aria-label="搜索对话"
            >
              <Search size={15} strokeWidth={1.8} />
              搜索对话
            </button>
          </div>
        )}

        {/* ── Conversation list ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 scrollbar-thin">

          {/* Empty state */}
          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--muted]/60 text-[--muted-foreground]/20 mb-4">
                <LogoMark size={24} />
              </div>
              <p className="text-[12px] font-medium text-[--muted-foreground]/40">还没有对话</p>
              <button
                onClick={onCreate}
                className="mt-3 text-[11px] text-[--primary]/60 hover:text-[--primary] cursor-pointer transition-colors"
              >
                创建第一个对话
              </button>
            </div>
          )}

          {/* ── Collapsible "最近" section ── */}
          {conversations.length > 0 && (() => {
            const recentCutoff = (() => {
              const now = new Date();
              const yesterday = new Date(now);
              yesterday.setDate(yesterday.getDate() - 1);
              yesterday.setHours(0, 0, 0, 0);
              return yesterday.getTime();
            })();
            const recentConvs = conversations.filter((c) => c.updatedAt >= recentCutoff);
            const olderConvs = conversations.filter((c) => c.updatedAt < recentCutoff);

            const renderConversation = (conversation: Conversation) => {
              const active = conversation.id === activeId;
              const confirming = confirmDeleteId === conversation.id;
              const selected = selectedIds.has(conversation.id);

              return (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (selectionMode) toggleSelect(conversation.id);
                    else onSelect(conversation.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (selectionMode) toggleSelect(conversation.id);
                      else onSelect(conversation.id);
                    }
                  }}
                  className={`group relative mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                    active && !selectionMode
                      ? "bg-[--primary]/[0.20] text-[--foreground] ring-1 ring-[--primary]/20"
                      : selected
                        ? "bg-[--primary]/[0.06] text-[--foreground]"
                        : "text-[--muted-foreground] hover:bg-[--primary]/10 hover:text-[--foreground] hover:shadow-[0_4px_14px_-2px_rgba(37,99,235,0.25)]"
                  }`}
                >
                  {/* Active indicator — left accent + subtle glow */}
                  {active && !selectionMode && (
                    <>
                      <div className="absolute left-0 top-2 bottom-2 w-[3.5px] rounded-r-full bg-[--primary]" />
                      <div className="absolute left-0 top-2 bottom-2 w-[8px] rounded-r-full bg-[--primary]/10 blur-[2px]" />
                    </>
                  )}

                  {/* Selection checkbox */}
                  {selectionMode && (
                    <div className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-200 cursor-pointer ${
                      selected
                        ? "border-[--primary] bg-[--primary] shadow-sm shadow-[--primary]/20"
                        : "border-[--border] bg-transparent hover:border-[--primary]/40"
                    }`}>
                      {selected && <Check size={10} strokeWidth={3} className="text-[--primary-foreground]" />}
                    </div>
                  )}

                  {/* Content — title only */}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] leading-snug ${
                      active ? "text-[--foreground] font-semibold" : "font-medium"
                    }`}>{conversation.title}</span>
                  </span>

                  {/* Delete actions */}
                  {!selectionMode && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {confirming ? (
                        <div className="flex items-center gap-0.5 rounded-lg bg-[--destructive]/[0.06] border border-[--destructive]/10 animate-in fade-in">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                              onDelete(conversation.id);
                              setConfirmDeleteId(null);
                            }}
                            className="rounded-lg p-1.5 text-[--destructive] hover:bg-[--destructive]/10 cursor-pointer transition-colors"
                            aria-label="确认删除"
                          >
                            <Check size={12} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="rounded-lg p-1.5 text-[--muted-foreground] hover:bg-[--muted] cursor-pointer transition-colors"
                            aria-label="取消删除"
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(conversation.id);
                          }}
                          className="rounded-lg p-1.5 text-[--muted-foreground] opacity-0 transition-all duration-200 hover:bg-[--destructive]/[0.06] hover:text-[--destructive] group-hover:opacity-100 cursor-pointer active:scale-90"
                          aria-label="删除对话"
                        >
                          <Trash2 size={12} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {/* Recent section — collapsible */}
                {recentConvs.length > 0 && (
                  <div className="mb-2">
                    <button
                      onClick={() => setRecentOpen(!recentOpen)}
                      className="w-full flex items-center gap-1 px-2 py-1.5 rounded-lg text-[15px] font-bold text-[--muted-foreground]/70 hover:text-[--muted-foreground] hover:bg-[--primary]/8 transition-all duration-200 cursor-pointer"
                    >
                      最近
                      <ChevronDown
                        size={13}
                        strokeWidth={2.5}
                        className={`transition-transform duration-200 ${recentOpen ? "" : "-rotate-90"}`}
                      />
                    </button>
                    <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                      recentOpen ? "max-h-[2000px]" : "max-h-0"
                    }`}>
                      {recentConvs.map(renderConversation)}
                    </div>
                  </div>
                )}

                {/* Older conversations — always visible */}
                {olderConvs.length > 0 && (
                  <div>
                    {recentConvs.length > 0 && (
                      <div className="px-2 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[--muted-foreground]/35">
                          更早
                        </span>
                      </div>
                    )}
                    {olderConvs.map(renderConversation)}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* ── Batch action bar ── */}
        {selectionMode && (
          <div className="shrink-0 border-t border-[--border] bg-[--card] px-4 py-3 flex items-center gap-2">
            <span className="text-[12px] text-[--muted-foreground] flex-1">
              已选 <span className="font-semibold text-[--foreground] tabular-nums">{selectedIds.size}</span> 项
            </span>
            {batchConfirm ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[--destructive] font-medium">确认删除？</span>
                <button
                  onClick={handleBatchDelete}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium bg-[--destructive] text-white hover:opacity-90 cursor-pointer transition-all"
                >
                  删除
                </button>
                <button
                  onClick={() => setBatchConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-[--muted-foreground] hover:bg-[--muted] cursor-pointer transition-colors"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setBatchConfirm(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[--destructive] hover:bg-[--destructive]/[0.06] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Trash2 size={12} strokeWidth={1.8} />
                删除
              </button>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        {!selectionMode && conversations.length > 1 && (
          <div className="shrink-0 px-4 py-2.5 flex items-center justify-between border-t border-[--border]/40">
            <span className="text-[10px] text-[--muted-foreground]/30 tabular-nums font-medium">{conversations.length} 个对话</span>
            <button
              onClick={() => setSelectionMode(true)}
              className="rounded-lg px-2.5 py-1 text-[11px] text-[--muted-foreground]/60 hover:bg-[--muted] hover:text-[--foreground] cursor-pointer transition-colors"
            >
              选择
            </button>
          </div>
        )}
      </aside>

      {/* ── Search dialog ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={() => setSearchOpen(false)}>
          {/* Dialog */}
          <div className="relative w-full max-w-[620px] mx-4 bg-white rounded-2xl shadow-2xl shadow-black/20 border border-[--border] overflow-hidden animate-in fade-in" onClick={(e) => e.stopPropagation()}>
            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[--border]/60">
              <Search size={18} className="text-[--muted-foreground]/50 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索对话标题或内容..."
                className="flex-1 bg-transparent text-[15px] text-[--foreground] placeholder:text-[--muted-foreground]/35 outline-none"
              />
              <div className="flex items-center gap-2 shrink-0">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="rounded-md p-1 text-[--muted-foreground] hover:text-[--foreground] cursor-pointer transition-colors"
                    aria-label="清除搜索"
                  >
                    <X size={14} />
                  </button>
                )}
                <kbd className="rounded-md border border-[--border]/50 bg-[--muted]/50 px-1.5 py-0.5 text-[10px] text-[--muted-foreground]/40 font-mono">
                  ESC
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {searchResults.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <p className="text-[13px] text-[--muted-foreground]/40">没有找到匹配的对话</p>
                </div>
              )}
              {groupOrder.map((group) => {
                const items = groupedResults[group];
                if (!items || items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="px-5 pt-3 pb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[--muted-foreground]/40">
                        {group}
                      </span>
                    </div>
                    {items.map((c) => {
                      const active = c.id === activeId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => handleSelectFromSearch(c.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors duration-150 cursor-pointer ${
                            active
                              ? "bg-[--primary]/[0.06] text-[--foreground]"
                              : "hover:bg-[--muted]/50 text-[--muted-foreground] hover:text-[--foreground]"
                          }`}
                        >
                          {active && (
                            <div className="h-1.5 w-1.5 rounded-full bg-[--primary] shrink-0" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">{c.title}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
