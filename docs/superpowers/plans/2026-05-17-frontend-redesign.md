# Frontend UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend to a Linear-style minimalist aesthetic with layered depth, modern feel, and visual hierarchy through spacing and subtle backgrounds rather than borders.

**Architecture:** Pure frontend CSS/Tailwind changes. No backend modifications. No new files — all changes are edits to existing components. The design system flows from `globals.css` (tokens) → layout (`page.tsx`) → components (`ChatPanel`, `MessageBubble`, `InputBar`, `SettingsPanel`).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, CSS custom properties, shadcn/ui primitives

**Spec:** `docs/superpowers/specs/2026-05-17-frontend-redesign-design.md`

---

### Task 1: Update Color System & Base Styles

**Files:**
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Replace the `:root` color variables**

Replace the entire `:root` block (lines 64-116) with:

```css
:root {
  /* Surfaces — layered depth */
  --background: #ffffff;
  --foreground: #1a1a1a;

  /* Cards — same as background, elevated via shadow */
  --card: #ffffff;
  --card-foreground: #1a1a1a;
  --popover: #ffffff;
  --popover-foreground: #1a1a1a;

  /* Brand — blue only for primary actions */
  --primary: #2563eb;
  --primary-foreground: #ffffff;

  /* Secondary & Muted — gray hierarchy */
  --secondary: #f5f5f5;
  --secondary-foreground: #555555;
  --muted: #f5f5f5;
  --muted-foreground: #888888;

  /* Accent */
  --accent: #f5f5f5;
  --accent-foreground: #1a1a1a;

  /* Feedback */
  --destructive: #ef4444;
  --success: #22c55e;

  /* Structure — minimal borders */
  --border: #eaeaea;
  --input: #eaeaea;
  --ring: #2563eb;

  /* Chart — distinguishable */
  --chart-1: #2563eb;
  --chart-2: #059669;
  --chart-3: #f59e0b;
  --chart-4: #ef4444;
  --chart-5: #8b5cf6;

  --radius: 0.5rem;

  /* Sidebar — subtle background shift */
  --sidebar: #fafafa;
  --sidebar-foreground: #1a1a1a;
  --sidebar-primary: #2563eb;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f5f5f5;
  --sidebar-accent-foreground: #1a1a1a;
  --sidebar-border: transparent;
  --sidebar-ring: #2563eb;
}
```

- [ ] **Step 2: Update the `@theme inline` shadow tokens**

Replace the shadow tokens block (lines 50-53) with:

```css
  /* Depth shadow tokens — subtle elevation */
  --shadow-depth-1: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-depth-2: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-depth-3: 0 4px 16px rgba(0, 0, 0, 0.08);
```

- [ ] **Step 3: Update the scrollbar styles**

Replace the scrollbar block (lines 131-144) with:

```css
/* Custom scrollbar — minimal */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #d4d4d4;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #a3a3a3;
}
```

- [ ] **Step 4: Update the message-enter animation**

Replace the `message-enter` animation (lines 313-325) with:

```css
@keyframes message-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.message-enter {
  animation: message-enter 0.3s ease forwards;
}
```

- [ ] **Step 5: Update the glass effect and add new utility**

Replace the glass block (lines 338-342) with:

```css
/* Subtle depth for elevated elements */
.elevated {
  background: var(--card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 6: Verify the dev server starts**

Run: `cd frontend && npm run dev`
Expected: Server starts without errors on `http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/app/globals.css && git commit -m "style: update color system to Linear-style minimalist palette"
```

---

### Task 2: Redesign Sidebar

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Update the sidebar `<aside>` className**

Find the `<aside>` element (around line 139-147). Replace its className with:

```tsx
      <aside
        className={`
          w-[240px] lg:w-[240px] shrink-0 flex flex-col bg-[--sidebar] overflow-hidden
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:shadow-2xl
          max-lg:transition-transform max-lg:duration-200 max-lg:ease-out
          ${sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"}
          lg:transition-all lg:duration-200 lg:ease-out
          ${sidebarOpen ? "" : "lg:w-0"}
        `}
        role="navigation"
        aria-label="对话历史"
      >
```

- [ ] **Step 2: Update the logo area**

Replace the logo div (around line 152-172) with:

```tsx
        {/* Logo */}
        <div className="h-12 flex items-center justify-between px-4 shrink-0">
          <span className="text-[13px] font-semibold tracking-tight text-[--foreground]">Data Analyst</span>
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
```

- [ ] **Step 3: Update the action bar (new conversation + search)**

Replace the action bar div (around line 174-195) with:

```tsx
        {/* New conversation + Search */}
        <div className="px-2 pb-1 flex items-center gap-0.5">
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
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="搜索对话"
            className="p-2 rounded-md text-[--muted-foreground] hover:bg-[--sidebar-accent] hover:text-[--foreground] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
```

- [ ] **Step 4: Update the search bar**

Replace the search bar block (around line 197-208) with:

```tsx
        {/* Search bar */}
        {searchOpen && (
          <div className="px-2 pb-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索对话..."
              autoFocus
              className="w-full px-2.5 py-1.5 rounded-md border border-[--border] bg-white text-[13px] text-[--foreground] placeholder:text-[--muted-foreground]/50 focus:outline-none focus:border-[--ring]"
            />
          </div>
        )}
```

- [ ] **Step 5: Remove the sidebar divider**

Delete the line `<div className="mx-3 h-px bg-[--sidebar-border]" />` (around line 210).

- [ ] **Step 6: Update the conversation list container**

Replace the conversation list div (around line 212-253) with:

```tsx
        {/* Conversation list */}
        <div className="flex-1 px-2 py-1 overflow-y-auto">
          {mounted && filteredGroups.map((group) => (
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
                  className={`group/item relative flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] cursor-pointer transition-all mb-0.5 ${
                    conv.id === activeId
                      ? "text-[--foreground] font-medium bg-[--sidebar-accent]"
                      : "text-[--muted-foreground] hover:bg-[--sidebar-accent] hover:text-[--foreground]"
                  }`}
                  style={conv.id === activeId ? { boxShadow: 'inset 2px 0 0 0 var(--primary)' } : undefined}
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
          {mounted && filteredConversations.length === 0 && searchQuery && (
            <div className="px-2.5 py-4 text-[12px] text-[--muted-foreground] text-center">
              未找到匹配的对话
            </div>
          )}
        </div>
```

- [ ] **Step 7: Update the settings entry**

Replace the settings section (around line 256-273) with:

```tsx
        {/* Settings trigger */}
        <div className="p-2 shrink-0">
          <button
            onClick={() => setConfigOpen(true)}
            aria-label="连接设置"
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-[--muted-foreground] hover:bg-[--sidebar-accent] hover:text-[--foreground] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            连接设置
            <span suppressHydrationWarning className="ml-auto text-[11px] text-[--muted-foreground] truncate max-w-[70px]">
              {activeLLM?.name || ""}
            </span>
          </button>
        </div>
```

- [ ] **Step 8: Remove the second sidebar divider**

Delete the line `<div className="mx-3 h-px bg-[--sidebar-border]" />` (around line 255).

- [ ] **Step 9: Verify in browser**

Open `http://localhost:3000`. Check:
- Sidebar is 240px wide with `#fafafa` background
- No visible right border
- Conversation items are compact with left-bar selection indicator
- Logo area shows only text

- [ ] **Step 10: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/app/page.tsx && git commit -m "style: redesign sidebar with Linear-style minimalism"
```

---

### Task 3: Redesign Header

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Update the header element**

Replace the `<header>` element (around line 335-383) with:

```tsx
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
              <span suppressHydrationWarning className="text-[14px] font-medium text-[--foreground] truncate">{activeConv?.title || "与 AI 分析师对话"}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Status indicators */}
              <div className="hidden sm:flex items-center gap-2">
                <span suppressHydrationWarning className="text-[12px] text-[--muted-foreground]">
                  {activeLLM?.config.model || "未配置"}
                </span>
                {mounted && activeDB && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-[--muted-foreground]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[--success]" />
                    {activeDB.config.type}
                  </span>
                )}
              </div>

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
```

- [ ] **Step 2: Update the main area wrapper**

Replace the main area div (around line 333-334) with:

```tsx
      {/* Main area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
```

And update the closing `</div></main>` at the end of the main area (around line 386-387).

- [ ] **Step 3: Update the context menu styles**

Replace the context menu div (around line 280-281) with:

```tsx
          <div
            className="fixed z-50 w-36 rounded-lg bg-[--card] border border-[--border] shadow-md py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
```

- [ ] **Step 4: Update the delete confirmation dialog**

Replace the delete dialog wrapper (around line 310) with:

```tsx
          <div className="bg-[--card] rounded-xl border border-[--border] shadow-lg p-5 max-w-sm w-full mx-3" onClick={(e) => e.stopPropagation()}>
```

- [ ] **Step 5: Update the settings dialog styles**

Replace the DialogContent className (around line 324-326) with:

```tsx
        <DialogContent
          showCloseButton={false}
          className="!max-w-[1280px] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] p-0 gap-0 rounded-xl overflow-hidden border border-[--border] shadow-lg max-h-[90vh] lg:max-h-[85vh]"
        >
```

- [ ] **Step 6: Verify in browser**

Open `http://localhost:3000`. Check:
- Header has no border, blends into content
- Status indicators are plain text with small dots
- Export button is icon-only with no border

- [ ] **Step 7: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/app/page.tsx && git commit -m "style: redesign header with borderless minimal design"
```

---

### Task 4: Redesign Welcome State & Loading Indicators

**Files:**
- Modify: `frontend/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Replace the welcome state block**

Find the welcome state block (lines 138-196, the `{!mounted || messages.length === 0 ? (...)` ternary's first branch). Replace it with:

```tsx
          /* Empty state — centered welcome */
          <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6 pb-24 sm:pb-32">
            <div className="max-w-md w-full text-center">
              {/* Logo */}
              <div className="w-10 h-10 rounded-xl bg-[--muted] mx-auto mb-6 flex items-center justify-center">
                <svg className="w-5 h-5 text-[--muted-foreground]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>

              {/* Title */}
              <h1 className="text-[22px] font-bold text-[--foreground] mb-2 tracking-tight">数据分析助手</h1>
              <p className="text-[14px] text-[--muted-foreground] leading-relaxed mb-8">
                上传数据文件或连接数据库，用自然语言提问
              </p>

              {/* Quick actions — list style */}
              <div className="space-y-1" role="list" aria-label="快捷操作">
                {[
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
                    title: "数据趋势分析",
                    desc: "分析销售数据的变化趋势",
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
                    title: "探索数据结构",
                    desc: "查看表结构和字段信息",
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
                    title: "生成分析报告",
                    desc: "自动生成月度数据报告",
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
                    title: "对比分析",
                    desc: "对比不同时间段的数据",
                  },
                ].map((q) => (
                  <button
                    key={q.title}
                    onClick={() => handleSend(q.desc)}
                    className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-[--muted] transition-colors cursor-pointer"
                    role="listitem"
                  >
                    <span className="text-[--muted-foreground] group-hover:text-[--foreground] transition-colors">
                      {q.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-[--foreground]">{q.title}</span>
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[--muted-foreground] opacity-0 group-hover:opacity-100 transition-opacity">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
```

- [ ] **Step 2: Update the message list container**

Find the message list div (around line 199). Replace with:

```tsx
          /* Message list */
          <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
```

- [ ] **Step 3: Update the tool call indicator**

Replace the tool call indicator (around line 214-226) with:

```tsx
            {/* Tool call indicator */}
            {isLoading && currentTool && (
              <div className="flex items-center gap-3 py-2 message-enter" role="status" aria-live="polite">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--muted]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[--muted] text-[13px] text-[--muted-foreground]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground] animate-pulse" />
                  <span>正在调用 <span className="font-mono font-medium text-[--foreground]">{currentTool}</span></span>
                </div>
              </div>
            )}
```

- [ ] **Step 4: Update the thinking indicator**

Replace the thinking indicator (around line 229-244) with:

```tsx
            {/* Thinking indicator */}
            {isLoading && !currentTool && (
              <div className="flex items-center gap-3 py-2 message-enter" role="status" aria-live="polite">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--muted]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[--muted]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
```

- [ ] **Step 5: Update the input bar section**

Replace the input bar section (around line 249-266) with:

```tsx
      {/* Input bar with stop button */}
      <div className="shrink-0 border-t border-[--border] safe-area-bottom">
        <div className="max-w-[900px] mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {isLoading ? (
            <button
              onClick={handleStop}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[--border] hover:bg-[--muted] text-[13px] text-[--muted-foreground] hover:text-[--foreground] transition-colors cursor-pointer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              停止生成
            </button>
          ) : (
            <InputBar onSend={handleSend} disabled={false} />
          )}
        </div>
      </div>
```

- [ ] **Step 6: Verify in browser**

Open `http://localhost:3000`. Check:
- Welcome state shows simplified icon, title, description
- Quick actions are list-style with hover effects
- Loading indicators use gray theme

- [ ] **Step 7: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/components/chat/ChatPanel.tsx && git commit -m "style: redesign welcome state and loading indicators"
```

---

### Task 5: Redesign Message Bubbles

**Files:**
- Modify: `frontend/src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Update the AI avatar**

Find the AI avatar div (around line 297-303). Replace with:

```tsx
      {/* AI avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--muted]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}
```

- [ ] **Step 2: Update user message bubble**

Find the user message div (around line 308). Replace with:

```tsx
          <div className="px-4 py-3 text-[15px] leading-[1.7] rounded-xl rounded-tr-sm bg-[--muted] text-[--foreground]">
            <p className="whitespace-pre-wrap leading-[1.7]">{message.content}</p>
          </div>
```

- [ ] **Step 3: Update AI message container**

Find the AI message container div (around line 313). Replace with:

```tsx
          <div className="text-[--foreground]">
```

- [ ] **Step 4: Update the AI message content wrapper**

Find the inner content div (around line 314). Replace with:

```tsx
            <div className="px-1 py-1">
```

- [ ] **Step 5: Update the ReasoningSection styles**

Find the ReasoningSection component (around line 63-84). Replace the button className with:

```tsx
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[--muted-foreground] bg-[--muted] hover:bg-[--border] transition-colors cursor-pointer"
```

Replace the reasoning content div className with:

```tsx
        <div className="mt-2 ml-1 pl-3 border-l-2 border-[--border] text-[13px] text-[--muted-foreground] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto bg-[--muted]/50 rounded-r-md py-2.5 pr-3">
```

- [ ] **Step 6: Update the ToolCallsSection styles**

Find the ToolCallsSection button (around line 96-98). Replace className with:

```tsx
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-[--muted-foreground] bg-[--muted] hover:bg-[--border] transition-colors cursor-pointer"
```

- [ ] **Step 7: Update the ToolCallCard styles**

Find the ToolCallCard container div (around line 141). Replace with:

```tsx
    <div className="rounded-lg border border-[--border] bg-[--muted]/50 overflow-hidden">
```

Find the tool name header div (around line 143). Replace with:

```tsx
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="flex items-center justify-center w-4 h-4 rounded bg-[--muted] text-[--muted-foreground]">
          <span className="text-[9px] font-bold">{index + 1}</span>
        </span>
        <span className="text-[12px] font-mono font-medium text-[--foreground]">{tool.name}</span>
```

Find the arguments toggle button (around line 156-158). Replace className with:

```tsx
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] text-[--muted-foreground] hover:bg-[--muted] transition-colors cursor-pointer border-t border-[--border]/50"
```

Find the output toggle button (around line 177-179). Replace className with:

```tsx
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[11px] text-[--muted-foreground] hover:bg-[--muted] transition-colors cursor-pointer border-t border-[--border]/50"
```

- [ ] **Step 8: Update the code block styles**

Find the code block header div (around line 227). Replace with:

```tsx
                  <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-white/5">
```

Find the code block content (around line 233). Replace with:

```tsx
                  <code className="block px-4 py-3 bg-[#111] text-[13px] text-slate-200 rounded-b-lg overflow-x-auto font-mono leading-relaxed" {...props}>
```

Find the inline code (around line 240). Replace with:

```tsx
              <code className="px-1.5 py-0.5 rounded bg-[--muted] text-[--foreground] text-[13px] font-mono" {...props}>
```

- [ ] **Step 9: Update blockquote styles**

Find the blockquote component (around line 253-256). Replace with:

```tsx
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3 border-l-2 border-[--border] text-[--muted-foreground] italic">
              {children}
            </blockquote>
          ),
```

- [ ] **Step 10: Verify in browser**

Start a conversation to see message bubbles. Check:
- User messages have gray background, right-aligned
- AI messages have no border/background, left-aligned with small avatar
- Reasoning/tool sections use gray theme
- Code blocks have dark background without gradient header

- [ ] **Step 11: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/components/chat/MessageBubble.tsx && git commit -m "style: redesign message bubbles with minimal gray theme"
```

---

### Task 6: Redesign Input Bar

**Files:**
- Modify: `frontend/src/components/chat/InputBar.tsx`

- [ ] **Step 1: Replace the entire input bar JSX**

Find the `return` block (starting at line 69). Replace the entire return content with:

```tsx
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
```

- [ ] **Step 2: Verify in browser**

Check:
- Input bar has no card wrapper or shadow
- Text input has no border
- Send button is circular with blue background
- Helper text is subtle gray

- [ ] **Step 3: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/components/chat/InputBar.tsx && git commit -m "style: simplify input bar with borderless design"
```

---

### Task 7: Redesign Settings Panel

**Files:**
- Modify: `frontend/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Update the field and label class constants**

Replace the `fieldCls` and `labelCls` constants (lines 9-12) with:

```tsx
const fieldCls =
  "w-full px-3 py-2.5 rounded-md border border-[--border] bg-white text-[14px] text-[--foreground] placeholder:text-[--muted-foreground]/40 focus:outline-none focus:border-[--ring] transition-all duration-150";

const labelCls = "text-[11px] font-semibold text-[--muted-foreground] uppercase tracking-[0.05em]";
```

- [ ] **Step 2: Update the header section**

Replace the header div (lines 120-135) with:

```tsx
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-[--border]">
        <div>
          <h2 className="text-[16px] font-semibold text-[--foreground]">连接配置</h2>
          <p className="text-[12px] text-[--muted-foreground] mt-0.5">LLM 模型和数据库连接独立管理</p>
        </div>
        <button onClick={onClose} aria-label="关闭" className="p-1.5 rounded-md hover:bg-[--muted] text-[--muted-foreground] hover:text-[--foreground] cursor-pointer transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
```

- [ ] **Step 3: Update the tab styles**

Find the TabsList (around line 140). Replace with:

```tsx
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="llm" className="flex-1 text-[13px] py-2 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 opacity-50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              LLM 模型
            </TabsTrigger>
            <TabsTrigger value="db" className="flex-1 text-[13px] py-2 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 opacity-50"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              数据库
            </TabsTrigger>
          </TabsList>
```

- [ ] **Step 4: Update the footer**

Replace the footer div (lines 189-193) with:

```tsx
      {/* Footer */}
      <div className="px-4 sm:px-8 py-3 border-t border-[--border] flex items-center justify-between gap-3">
        <span className="hidden sm:inline text-[11px] text-[--muted-foreground]">配置自动保存</span>
        <span className="sm:hidden" />
        <button onClick={onClose} className="px-5 py-2 rounded-md text-[13px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 cursor-pointer transition-opacity">完成</button>
      </div>
```

- [ ] **Step 5: Update provider selection cards**

Find the provider selection grid in LLMPanel (around line 252-264). Replace with:

```tsx
            <div className="grid grid-cols-3 gap-2 mt-3" role="radiogroup">
              {PROVIDERS.map((p) => {
                const sel = llm.provider === p.key;
                return (
                  <button key={p.key} onClick={() => onUpdate({ config: { ...llm, provider: p.key as any, ...PROVIDER_DEFAULTS[p.key] } })}
                    role="radio" aria-checked={sel}
                    className={`flex flex-col items-center gap-2 py-3 rounded-lg border transition-all duration-150 cursor-pointer ${sel ? "border-[--primary] bg-[--primary]/[0.03]" : "border-transparent bg-[--muted] hover:bg-[--border]"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold text-white transition-transform duration-150 ${sel ? "scale-105" : ""}`}
                      style={{ background: p.color }}>{p.label[0]}</div>
                    <span className={`text-[13px] font-medium ${sel ? "text-[--foreground]" : "text-[--muted-foreground]"}`}>{p.label}</span>
                  </button>
                );
              })}
            </div>
```

- [ ] **Step 6: Update the name input and active badge**

Find the name input section in LLMPanel (around line 239-245). Replace with:

```tsx
      <div className="flex items-center gap-3">
        <input value={profile.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="方案名称"
          className="flex-1 px-3 py-2 rounded-md border border-[--border] bg-white text-[14px] font-medium text-[--foreground] placeholder:text-[--muted-foreground]/30 focus:outline-none focus:border-[--ring] transition-all duration-150" />
        {isActive && <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[--success]/[0.08] text-[--success] text-[11px] font-semibold border border-[--success]/20 shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>使用中
        </span>}
      </div>
```

- [ ] **Step 7: Update the temperature slider section**

Find the temperature section (around line 287-299). Replace with:

```tsx
          <section>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="llm-temp" className={labelCls}>Temperature</label>
              <span className="text-[14px] font-mono font-semibold text-[--foreground] tabular-nums">{llm.temperature}</span>
            </div>
            <input id="llm-temp" type="range" min={0} max={2} step={0.1} value={llm.temperature}
              onChange={(e) => onUpdate({ config: { ...llm, temperature: parseFloat(e.target.value) } })}
              className="w-full h-1.5 bg-[--muted] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[--primary] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white" />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[--muted-foreground]">精确 0</span>
              <span className="text-[10px] text-[--muted-foreground]">创意 2</span>
            </div>
          </section>
```

- [ ] **Step 8: Update the info/tip sections**

Find the tip section in LLMPanel (around line 300-310). Replace with:

```tsx
          <section className="bg-[--muted] rounded-lg p-4">
            <div className="flex items-start gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <div>
                <p className="text-[12px] font-medium text-[--foreground]">提示</p>
                <p className="text-[11px] text-[--muted-foreground] mt-0.5 leading-relaxed">LLM 配置独立于数据库配置，可自由组合使用。</p>
              </div>
            </div>
          </section>
```

- [ ] **Step 9: Update the DB type selection cards**

Find the DB type selection grid in DBPanel (around line 372-388). Replace with:

```tsx
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3" role="radiogroup">
          {DB_TYPES.map((t) => {
            const sel = db.type === t.value;
            return (
              <button key={t.value} onClick={() => {
                if (t.value === "sqlite" || t.value === "duckdb") onUpdate({ config: { ...db, type: t.value, filePath: "" } as any });
                else onUpdate({ config: { ...db, type: t.value, host: "localhost", port: t.value === "mysql" ? "3306" : "5432", user: "", password: "", database: "" } as any });
                onResetTest();
              }} role="radio" aria-checked={sel}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all duration-150 cursor-pointer ${sel ? "border-[--primary] bg-[--primary]/[0.03]" : "border-transparent bg-[--muted] hover:bg-[--border]"}`}>
                <div className={`w-8 h-8 rounded-full bg-[#374151] flex items-center justify-center text-[13px] font-bold text-white transition-transform duration-150 ${sel ? "scale-105" : ""}`}>{t.label[0]}</div>
                <span className={`text-[12px] font-medium ${sel ? "text-[--foreground]" : "text-[--muted-foreground]"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
```

- [ ] **Step 10: Update the connection test section**

Find the connection test section in DBPanel (around line 412-427). Replace with:

```tsx
        <section className="bg-[--muted] rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-[13px] font-semibold text-[--foreground]">连接测试</h3>
            <p className="text-[11px] text-[--muted-foreground] mt-0.5 leading-relaxed">验证数据库是否可正常连接。</p>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {testResult === "ok" && <span className="flex items-center gap-1.5 text-[12px] text-[--success] font-semibold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>成功</span>}
            {testResult === "fail" && <span className="flex items-center gap-1.5 text-[12px] text-[--destructive] font-semibold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>失败</span>}
            <button onClick={onTest} disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-all duration-150">
              {testing ? <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              {testing ? "测试中..." : "测试连接"}
            </button>
          </div>
        </section>
```

- [ ] **Step 11: Update the chip row component**

Find the ChipRow button (around line 51-58). Replace className with:

```tsx
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
              editing
                ? "bg-[--muted] text-[--foreground]"
                : "text-[--muted-foreground] hover:bg-[--muted] hover:text-[--foreground]"
            }`}
```

And remove the border-related classes and the active dot indicator. Replace the active indicator (around line 60) with:

```tsx
            {active && <span className="w-1.5 h-1.5 rounded-full bg-[--success] shrink-0" />}
```

- [ ] **Step 12: Update the activate/delete buttons in LLMPanel**

Find the activate button in LLMPanel (around line 231). Replace with:

```tsx
            <button onClick={() => { onActivate(profile.id); toast.success(`已切换到「${profile.name}」`); }} className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[--primary] text-[--primary-foreground] hover:opacity-90 transition-colors cursor-pointer">启用</button>
```

Find the delete button in LLMPanel (around line 233). Replace with:

```tsx
          <button onClick={() => onDelete(profile.id)} aria-label="删除" className="p-1.5 rounded-md text-[--muted-foreground] hover:text-[--destructive] hover:bg-[--destructive]/[0.06] cursor-pointer transition-colors">
```

- [ ] **Step 13: Update the activate/delete buttons in DBPanel**

Apply the same button style updates to the DBPanel's activate and delete buttons (around lines 352-357).

- [ ] **Step 14: Verify in browser**

Open settings dialog. Check:
- Clean white card with no gradient icons
- Tab switch uses underline style
- Form fields have tighter radius
- Provider cards use monochrome circles
- Connection test area has gray background

- [ ] **Step 15: Commit**

```bash
cd C:/Dev/my-agent && git add frontend/src/components/settings/SettingsPanel.tsx && git commit -m "style: redesign settings panel with minimal form styles"
```

---

### Task 8: Final Polish & Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Start the dev server and do a full visual walkthrough**

Run: `cd frontend && npm run dev`

Check every screen state:
1. Empty welcome state — icon, title, quick actions list
2. Send a message — user bubble (gray bg), AI response (no border)
3. Reasoning/tool call sections — gray theme, collapsible
4. Code blocks — dark background, no gradient header
5. Sidebar — 240px, no border, selected item has left blue bar
6. Header — borderless, plain text status indicators
7. Input bar — no card wrapper, circular send button
8. Settings dialog — clean forms, monochrome provider cards
9. Context menu — minimal styling
10. Delete confirmation — minimal styling
11. Mobile responsive — sidebar overlay, full-width input

- [ ] **Step 2: Fix any visual inconsistencies found**

Address any issues discovered during the walkthrough.

- [ ] **Step 3: Run the build to check for errors**

Run: `cd frontend && npm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
cd C:/Dev/my-agent && git add -A && git commit -m "style: final polish for Linear-style UI redesign"
```
