# Production Readiness Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the data analyst agent app production-ready enough for a first deploy by fixing quality gates, unifying the responsive UI, structuring assistant responses, hardening agent routing, and closing critical API safety gaps.

**Architecture:** Add small typed contracts before rewriting UI and backend behavior. The frontend keeps Zustand but migrates messages to typed response blocks, while the backend moves from prompt-only orchestration to a deterministic intent router that selects specialist agents directly and emits structured SSE status/error events.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind v4, shadcn/base-ui components, Zustand, FastAPI, OpenAI Agents SDK, SQLAlchemy, pytest, Vitest.

---

## File Structure

- Create `frontend/src/lib/messages.ts`: owns `ResponseBlock`, `Message`, migration helpers, history/export serialization, and stream-event reducer.
- Create `frontend/src/lib/messages.test.ts`: Vitest coverage for legacy migration and stream reducer behavior.
- Modify `frontend/package.json`: add `test` script and Vitest dev dependency.
- Modify `frontend/src/stores/chat.ts`: store schema versioned typed messages; keep compatibility methods as thin wrappers over block operations.
- Modify `frontend/src/lib/api.ts`: add typed SSE event shapes for `agent_status` and structured `error`; avoid raw untyped profile config usage.
- Modify `frontend/src/components/chat/ChatPanel.tsx`: call stream reducer helpers, fix retry callback ordering, remove hydration-only mounted state, and keep trace updates out of visible content.
- Create `frontend/src/components/chat/MessageBlocks.tsx`: render markdown, chart, table, tool, status, and error blocks.
- Modify `frontend/src/components/chat/MessageBubble.tsx`: delegate assistant rendering to block components while keeping user bubble actions.
- Create `frontend/src/components/app/AppShell.tsx`: one responsive layout tree.
- Create `frontend/src/components/app/ConversationSidebar.tsx`: conversation list/search/new/delete/export/profile status.
- Create `frontend/src/components/app/RunInspector.tsx`: agent/tool/error trace panel.
- Modify `frontend/src/app/page.tsx`: replace `MobilePage`/`DesktopPage` split with `AppShell`.
- Modify `frontend/src/components/settings/SettingsPanel.tsx`: remove `any`, use discriminated DB config helpers, keep credential fields explicit.
- Modify `frontend/src/stores/connection.ts`: typed profile migration and redacted-profile merge behavior.
- Create `backend/core/router.py`: deterministic intent classification and selected-agent metadata.
- Create `backend/core/errors.py`: provider-error sanitizer and SSE error payload helpers.
- Modify `backend/core/agent.py`: expose specialist-agent factory by intent while keeping existing prompts.
- Modify `backend/core/database.py`: return/reset `ContextVar` tokens for request-scoped DB URL.
- Modify `backend/api/chat.py`: select deterministic agent, emit `agent_status`, reset DB context, map errors safely.
- Create `backend/core/path_safety.py`: resolve safe upload/report filenames inside configured roots.
- Modify `backend/api/upload.py`: safe filename handling and HTTP error responses.
- Modify `backend/api/export.py`: safe report path handling and HTTP error responses.
- Modify `backend/api/storage.py`: redact secret fields in profile responses.
- Modify `backend/core/config.py` and `backend/app.py`: environment-driven CORS origins and optional app token boundary for non-development mode.
- Create `backend/tests/test_router.py`: classifier examples.
- Create `backend/tests/test_path_safety.py`: traversal rejection examples.
- Create `backend/tests/test_storage_redaction.py`: secret redaction examples.
- Create `backend/tests/test_chat_safety.py`: safe error mapping and DB context reset examples.
- Modify `backend/pyproject.toml`: add pytest dev dependency.
- Modify `task_plan.md`, `findings.md`, `progress.md`: track implementation status and verification results.

---

### Task 1: Test Harness And Quality Gate Baseline

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/messages.test.ts`
- Modify: `backend/pyproject.toml`
- Create: `backend/tests/test_router.py`
- Modify: `progress.md`

- [ ] **Step 1: Add frontend test script and Vitest dependency metadata**

Update `frontend/package.json` scripts and dev dependencies:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Install frontend dependency**

Run:

```powershell
pnpm install
```

Expected: lockfile updates and exit code `0`.

- [ ] **Step 3: Add backend pytest dependency**

Update `backend/pyproject.toml`:

```toml
[dependency-groups]
dev = [
    "pytest>=8.3.0",
]
```

- [ ] **Step 4: Sync backend dependencies**

Run:

```powershell
uv sync --dev
```

Expected: `uv.lock` updates and exit code `0`.

- [ ] **Step 5: Write first failing backend router test**

Create `backend/tests/test_router.py`:

```python
from core.router import Intent, classify_intent


def test_classifies_daily_greeting_as_general():
    assert classify_intent("你好，今天怎么样？").intent is Intent.GENERAL


def test_classifies_sql_and_chart_request_as_data_analysis():
    result = classify_intent("帮我查询订单表并画出销售趋势图")
    assert result.intent is Intent.DATA_ANALYSIS
    assert result.agent_name == "DataAnalyst"
```

- [ ] **Step 6: Verify backend router test fails for missing module**

Run:

```powershell
uv run pytest backend/tests/test_router.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'core.router'`.

- [ ] **Step 7: Write first failing frontend message reducer test**

Create `frontend/src/lib/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyChatEvent, createAssistantMessage, migrateMessage } from "./messages";

describe("message migration", () => {
  it("migrates legacy assistant content, tool calls, and chart into typed blocks", () => {
    const migrated = migrateMessage({
      id: "m1",
      role: "assistant",
      content: "结论",
      reasoning: "推理",
      toolCalls: [{ name: "run_sql_query", arguments: "{}", output: "2 rows" }],
      chart: { xAxis: { type: "category" } },
      timestamp: 100,
    });

    expect(migrated.blocks.map((block) => block.type)).toEqual([
      "tool",
      "markdown",
      "chart",
    ]);
    expect(migrated.createdAt).toBe(100);
  });
});

describe("stream reducer", () => {
  it("appends status, markdown, chart, and safe error blocks", () => {
    let message = createAssistantMessage("a1", 100);
    message = applyChatEvent(message, { type: "agent_status", agent: "DataAnalyst", display_name: "数据分析助手", status: "running" });
    message = applyChatEvent(message, { type: "text_delta", content: "你好" });
    message = applyChatEvent(message, { type: "chart", content: "{\"series\":[]}" });
    message = applyChatEvent(message, { type: "error", code: "MODEL_AUTH_FAILED", message: "模型认证失败，请检查当前模型配置", recoverable: true });

    expect(message.blocks.map((block) => block.type)).toEqual([
      "agent_status",
      "markdown",
      "chart",
      "error",
    ]);
  });
});
```

- [ ] **Step 8: Verify frontend message test fails for missing module**

Run:

```powershell
pnpm test -- src/lib/messages.test.ts
```

Expected: FAIL with unresolved `./messages`.

- [ ] **Step 9: Commit test harness**

Run:

```powershell
git add frontend/package.json frontend/pnpm-lock.yaml backend/pyproject.toml backend/uv.lock frontend/src/lib/messages.test.ts backend/tests/test_router.py progress.md
git commit -m "test: add production readiness harness"
```

---

### Task 2: Typed Message Blocks And Stream Reducer

**Files:**
- Create: `frontend/src/lib/messages.ts`
- Modify: `frontend/src/stores/chat.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/chat/ChatPanel.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `progress.md`

- [ ] **Step 1: Implement minimal message contracts**

Create `frontend/src/lib/messages.ts`:

```ts
import type { ChatEvent } from "@/lib/api";
import type { ToolCall } from "@/stores/chat";

export type MessageRole = "user" | "assistant" | "system";

export type ResponseBlock =
  | { id: string; type: "markdown"; content: string }
  | { id: string; type: "chart"; option: Record<string, unknown>; title?: string }
  | { id: string; type: "table"; columns: string[]; rows: unknown[][]; title?: string }
  | { id: string; type: "tool"; name: string; status: "running" | "done" | "error"; input?: unknown; outputPreview?: string }
  | { id: string; type: "agent_status"; agent: string; label: string; status: "entered" | "running" | "done" }
  | { id: string; type: "error"; code: string; message: string; recoverable: boolean };

export interface BlockMessage {
  id: string;
  role: MessageRole;
  blocks: ResponseBlock[];
  createdAt: number;
  updatedAt: number;
}

export interface LegacyMessage {
  id: string;
  role: MessageRole;
  content?: string;
  reasoning?: string;
  chart?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  timestamp?: number;
}

export function createAssistantMessage(id: string, now = Date.now()): BlockMessage {
  return { id, role: "assistant", blocks: [], createdAt: now, updatedAt: now };
}
```

- [ ] **Step 2: Add migration and serialization helpers**

Append to `frontend/src/lib/messages.ts`:

```ts
function blockId(messageId: string, suffix: string): string {
  return `${messageId}-${suffix}`;
}

export function migrateMessage(message: LegacyMessage | BlockMessage): BlockMessage {
  if ("blocks" in message && Array.isArray(message.blocks)) return message;

  const createdAt = message.timestamp ?? Date.now();
  const blocks: ResponseBlock[] = [];

  if (message.toolCalls?.length) {
    message.toolCalls.forEach((tool, index) => {
      blocks.push({
        id: blockId(message.id, `tool-${index}`),
        type: "tool",
        name: tool.name,
        status: tool.output ? "done" : "running",
        input: tool.arguments,
        outputPreview: tool.output,
      });
    });
  }

  if (message.content?.trim()) {
    blocks.push({ id: blockId(message.id, "markdown-0"), type: "markdown", content: message.content });
  }

  if (message.chart) {
    blocks.push({ id: blockId(message.id, "chart-0"), type: "chart", option: message.chart });
  }

  return { id: message.id, role: message.role, blocks, createdAt, updatedAt: createdAt };
}

export function messageToPlainText(message: BlockMessage): string {
  return message.blocks
    .map((block) => {
      if (block.type === "markdown") return block.content;
      if (block.type === "error") return `错误: ${block.message}`;
      if (block.type === "tool") return `[工具] ${block.name}${block.outputPreview ? `\n${block.outputPreview}` : ""}`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}
```

- [ ] **Step 3: Add stream reducer helpers**

Append to `frontend/src/lib/messages.ts`:

```ts
function appendMarkdown(blocks: ResponseBlock[], content: string, messageId: string): ResponseBlock[] {
  const last = blocks[blocks.length - 1];
  if (last?.type === "markdown") {
    return [...blocks.slice(0, -1), { ...last, content: last.content + content }];
  }
  return [...blocks, { id: blockId(messageId, `markdown-${blocks.length}`), type: "markdown", content }];
}

export function applyChatEvent(message: BlockMessage, event: ChatEvent): BlockMessage {
  const now = Date.now();
  switch (event.type) {
    case "text_delta":
      return { ...message, blocks: appendMarkdown(message.blocks, event.content ?? "", message.id), updatedAt: now };
    case "tool_call":
      return { ...message, blocks: [...message.blocks, { id: blockId(message.id, `tool-${message.blocks.length}`), type: "tool", name: event.tool ?? "unknown", status: "running", input: event.arguments }], updatedAt: now };
    case "tool_result":
      return { ...message, blocks: message.blocks.map((block) => block.type === "tool" && block.status === "running" ? { ...block, status: "done", outputPreview: event.content } : block), updatedAt: now };
    case "chart":
      return { ...message, blocks: [...message.blocks, { id: blockId(message.id, `chart-${message.blocks.length}`), type: "chart", option: JSON.parse(event.content ?? "{}") as Record<string, unknown> }], updatedAt: now };
    case "agent_status":
      return { ...message, blocks: [...message.blocks, { id: blockId(message.id, `agent-${message.blocks.length}`), type: "agent_status", agent: event.agent ?? "unknown", label: event.display_name ?? event.agent ?? "Agent", status: event.status ?? "running" }], updatedAt: now };
    case "error":
      return { ...message, blocks: [...message.blocks, { id: blockId(message.id, `error-${message.blocks.length}`), type: "error", code: event.code ?? "UNKNOWN_ERROR", message: event.message ?? event.content ?? "发生错误", recoverable: event.recoverable ?? true }], updatedAt: now };
    default:
      return message;
  }
}
```

- [ ] **Step 4: Run focused frontend tests**

Run:

```powershell
pnpm test -- src/lib/messages.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update chat store to migrate loaded and backend messages**

In `frontend/src/stores/chat.ts`, import helpers and use typed messages:

```ts
import { createAssistantMessage, messageToPlainText, migrateMessage, type BlockMessage, type LegacyMessage } from "@/lib/messages";
```

Change message interfaces:

```ts
export type Message = BlockMessage;
export type StoredMessage = BlockMessage | LegacyMessage;
```

Use `migrateMessage` in `loadConversations()` and backend sync:

```ts
const conversations: Conversation[] = raw ? JSON.parse(raw).map((conv: Conversation & { messages: StoredMessage[] }) => ({
  ...conv,
  messages: conv.messages.map(migrateMessage),
})) : [];
```

- [ ] **Step 6: Preserve compatibility write methods**

Keep existing store method names but implement them with blocks:

```ts
appendToLastAssistant: (delta) => get().updateLastAssistant((message) => applyChatEvent(message, { type: "text_delta", content: delta })),
```

If a helper method is needed, add `updateLastAssistant` inside the store closure only; do not expose it publicly unless used by components.

- [ ] **Step 7: Fix ChatPanel retry and history**

Move `handleSend` above `handleRetry`, then set retry dependency:

```ts
const handleRetry = useCallback(() => {
  const state = useChatStore.getState();
  const lastUser = [...state.getMessages()].reverse().find((m) => m.role === "user");
  if (!lastUser) return;
  removeLastAssistant();
  void handleSend(messageToPlainText(lastUser));
}, [handleSend, removeLastAssistant]);
```

- [ ] **Step 8: Remove hydration-only mounted state from ChatPanel**

Delete:

```ts
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
```

Replace `!mounted || messages.length === 0` with:

```tsx
messages.length === 0
```

- [ ] **Step 9: Run lint and build after message migration**

Run:

```powershell
pnpm lint
pnpm build
```

Expected: no lint errors from `ChatPanel`; build succeeds.

- [ ] **Step 10: Commit message model refactor**

Run:

```powershell
git add frontend/src/lib/messages.ts frontend/src/lib/messages.test.ts frontend/src/stores/chat.ts frontend/src/lib/api.ts frontend/src/components/chat/ChatPanel.tsx frontend/src/app/page.tsx progress.md
git commit -m "refactor: add structured chat message blocks"
```

---

### Task 3: Unified Responsive Shell And Message Rendering

**Files:**
- Create: `frontend/src/components/app/AppShell.tsx`
- Create: `frontend/src/components/app/ConversationSidebar.tsx`
- Create: `frontend/src/components/app/RunInspector.tsx`
- Create: `frontend/src/components/chat/MessageBlocks.tsx`
- Modify: `frontend/src/components/chat/MessageBubble.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/globals.css`
- Modify: `progress.md`

- [ ] **Step 1: Create MessageBlocks renderer**

Create `frontend/src/components/chat/MessageBlocks.tsx`:

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import EChart from "@/components/chart/EChart";
import type { EChartsOption } from "echarts";
import type { ResponseBlock } from "@/lib/messages";

export function MessageBlocks({ blocks }: { blocks: ResponseBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.filter((block) => block.type !== "agent_status").map((block) => {
        if (block.type === "markdown") return <ReactMarkdown key={block.id} className="prose-chat">{block.content}</ReactMarkdown>;
        if (block.type === "chart") return <EChart key={block.id} option={block.option as EChartsOption} />;
        if (block.type === "tool") return <div key={block.id} className="rounded-md border border-[--border] bg-[--muted]/60 px-3 py-2 text-[12px] text-[--muted-foreground]">{block.name} · {block.status}</div>;
        if (block.type === "error") return <div key={block.id} role="alert" className="rounded-md border border-[--destructive]/30 bg-[--destructive]/5 px-3 py-2 text-[13px] text-[--destructive]">{block.message}</div>;
        if (block.type === "table") return <div key={block.id} className="overflow-x-auto rounded-md border border-[--border]"><table className="w-full text-sm"><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-[--border] px-2 py-1">{String(cell)}</td>)}</tr>)}</tbody></table></div>;
        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update MessageBubble to render blocks**

In `frontend/src/components/chat/MessageBubble.tsx`, replace assistant `content` rendering with:

```tsx
<MessageBlocks blocks={message.blocks} />
```

Use `messageToPlainText(message)` for copy and edit actions.

- [ ] **Step 3: Create ConversationSidebar**

Create `frontend/src/components/app/ConversationSidebar.tsx` with props:

```ts
interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}
```

It must show title, updated date, message count, and settings button using lucide icons.

- [ ] **Step 4: Create RunInspector**

Create `frontend/src/components/app/RunInspector.tsx`:

```tsx
"use client";

import type { Message } from "@/stores/chat";

export function RunInspector({ messages, currentAgent, currentTool }: { messages: Message[]; currentAgent: string | null; currentTool: string | null }) {
  const statusBlocks = messages.flatMap((message) => message.blocks.filter((block) => block.type === "agent_status" || block.type === "tool" || block.type === "error"));
  return (
    <aside className="hidden xl:flex w-[300px] shrink-0 flex-col border-l border-[--border] bg-[--card]">
      <div className="border-b border-[--border] px-4 py-3 text-[13px] font-semibold">运行状态</div>
      <div className="space-y-2 overflow-y-auto p-3 text-[12px] text-[--muted-foreground]">
        <div>Agent: {currentAgent || "待命"}</div>
        <div>Tool: {currentTool || "无"}</div>
        {statusBlocks.map((block) => <div key={block.id} className="rounded-md border border-[--border] bg-[--muted]/50 p-2">{block.type}</div>)}
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Create AppShell**

Create `frontend/src/components/app/AppShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Menu, Settings } from "lucide-react";
import ChatPanel from "@/components/chat/ChatPanel";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useChatStore } from "@/stores/chat";
import { useConnectionStore } from "@/stores/connection";
import { ConversationSidebar } from "./ConversationSidebar";
import { RunInspector } from "./RunInspector";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const createConversation = useChatStore((s) => s.createConversation);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const messages = useChatStore((s) => s.getMessages());
  const currentAgent = useChatStore((s) => s.currentAgent);
  const currentTool = useChatStore((s) => s.currentTool);
  const activeLLM = useConnectionStore((s) => s.getActiveLLM());
  const activeDB = useConnectionStore((s) => s.getActiveDB());

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden bg-[--background] lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
      <div className="hidden lg:block"><ConversationSidebar conversations={conversations} activeId={activeId} onCreate={createConversation} onSelect={switchConversation} onDelete={deleteConversation} onOpenSettings={() => setSettingsOpen(true)} /></div>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}><SheetContent side="left" className="w-[320px] p-0"><SheetTitle className="sr-only">对话列表</SheetTitle><ConversationSidebar conversations={conversations} activeId={activeId} onCreate={createConversation} onSelect={(id) => { switchConversation(id); setSidebarOpen(false); }} onDelete={deleteConversation} onOpenSettings={() => setSettingsOpen(true)} /></SheetContent></Sheet>
      <main className="flex min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[--border] px-3 sm:px-4">
          <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted] lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="打开对话列表"><Menu size={18} /></button>
          <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">数据分析助手</div><div className="truncate text-[11px] text-[--muted-foreground]">{activeLLM?.config.model || "未配置模型"} · {activeDB?.name || "未连接数据源"}</div></div>
          <button className="rounded-md p-2 text-[--muted-foreground] hover:bg-[--muted]" onClick={() => setSettingsOpen(true)} aria-label="设置"><Settings size={18} /></button>
        </header>
        <ChatPanel />
      </main>
      <RunInspector messages={messages} currentAgent={currentAgent} currentTool={currentTool} />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent showCloseButton={false} className="!max-w-[1280px] w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] p-0 gap-0 rounded-xl overflow-hidden border border-[--border] shadow-lg max-h-[90vh]"><DialogTitle className="sr-only">连接配置</DialogTitle><SettingsPanel onClose={() => setSettingsOpen(false)} /></DialogContent></Dialog>
    </div>
  );
}
```

- [ ] **Step 6: Replace page split with AppShell**

Replace `frontend/src/app/page.tsx` with:

```tsx
import AppShell from "@/components/app/AppShell";

export default function Home() {
  return <AppShell />;
}
```

- [ ] **Step 7: Run frontend quality checks**

Run:

```powershell
pnpm lint
pnpm build
```

Expected: no React hydration guard lint errors; build succeeds.

- [ ] **Step 8: Browser verify responsive shell**

Open `http://localhost:3000` in the in-app browser and check:

```text
1440x900: sidebar, chat, and inspector visible with no overlapping text.
834x1112: sidebar hidden behind sheet; chat remains same tree.
390x844: header, chat, composer fit; settings and sidebar usable.
```

- [ ] **Step 9: Commit responsive shell**

Run:

```powershell
git add frontend/src/components/app frontend/src/components/chat/MessageBlocks.tsx frontend/src/components/chat/MessageBubble.tsx frontend/src/app/page.tsx frontend/src/app/globals.css progress.md
git commit -m "refactor: unify responsive chat shell"
```

---

### Task 4: Typed Settings And Lint Cleanup

**Files:**
- Modify: `frontend/src/stores/connection.ts`
- Modify: `frontend/src/components/settings/SettingsPanel.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `progress.md`

- [ ] **Step 1: Add type guards for profile migration**

In `frontend/src/stores/connection.ts`, replace `any[]` migration with:

```ts
interface LegacyConnectionProfile {
  id?: string;
  name?: string;
  llm?: Partial<LLMConfig>;
  db?: Partial<DBConfig>;
  createdAt?: number;
}

function isLegacyConnectionProfile(value: unknown): value is LegacyConnectionProfile {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 2: Add discriminated DB update helpers**

In `frontend/src/components/settings/SettingsPanel.tsx`, add:

```ts
type LLMProfilePatch = Partial<Omit<LLMProfile, "id" | "createdAt">>;
type DBProfilePatch = Partial<Omit<DBProfile, "id" | "createdAt">>;

function isServerDBConfig(config: DBProfile["config"]): config is Extract<DBProfile["config"], { type: "postgresql" | "mysql" }> {
  return config.type === "postgresql" || config.type === "mysql";
}
```

Replace `onUpdate: (patch: any) => void` with typed patch callbacks.

- [ ] **Step 3: Remove unused imports and variables**

Delete unused imports like `TabsContent` and unused local variables like `llm`/`isServerDB` when they are not referenced by render logic.

- [ ] **Step 4: Run lint**

Run:

```powershell
pnpm lint
```

Expected: no `@typescript-eslint/no-explicit-any`, unused variable, or hook ordering errors.

- [ ] **Step 5: Commit lint cleanup**

Run:

```powershell
git add frontend/src/stores/connection.ts frontend/src/components/settings/SettingsPanel.tsx frontend/src/lib/api.ts progress.md
git commit -m "fix: clean up frontend types and lint errors"
```

---

### Task 5: Deterministic Agent Routing And Safe SSE Errors

**Files:**
- Create: `backend/core/router.py`
- Create: `backend/core/errors.py`
- Modify: `backend/core/agent.py`
- Modify: `backend/api/chat.py`
- Modify: `backend/core/database.py`
- Modify: `backend/tests/test_router.py`
- Create: `backend/tests/test_chat_safety.py`
- Modify: `progress.md`

- [ ] **Step 1: Extend failing router tests**

Append to `backend/tests/test_router.py`:

```python
def test_classifies_report_export_as_reporting():
    result = classify_intent("把刚才的分析生成报告并导出")
    assert result.intent is Intent.REPORTING
    assert result.agent_name == "ReportWriter"


def test_classifies_short_ambiguous_data_word_as_ambiguous():
    result = classify_intent("数据")
    assert result.intent is Intent.AMBIGUOUS
    assert result.agent_name == "GeneralAssistant"
```

- [ ] **Step 2: Implement router**

Create `backend/core/router.py`:

```python
from dataclasses import dataclass
from enum import Enum

from core.agent import DATA_ANALYST_NAME, GENERAL_ASSISTANT_NAME, REPORT_WRITER_NAME


class Intent(Enum):
    GENERAL = "general"
    DATA_ANALYSIS = "data_analysis"
    REPORTING = "reporting"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True)
class RouteDecision:
    intent: Intent
    agent_name: str
    display_name: str


DATA_WORDS = ("数据", "表", "sql", "查询", "统计", "趋势", "图表", "可视化", "分析", "字段", "schema", "database")
REPORT_WORDS = ("报告", "导出", "通知", "发送", "飞书", "邮件", "markdown")
GENERAL_WORDS = ("你好", "您好", "hello", "hi", "翻译", "总结", "写一段", "解释")


def classify_intent(message: str, context: dict | None = None) -> RouteDecision:
    text = message.strip().lower()
    if not text:
        return RouteDecision(Intent.AMBIGUOUS, GENERAL_ASSISTANT_NAME, "通用助手")
    if len(text) <= 4 and any(word in text for word in ("数据", "表", "分析")):
        return RouteDecision(Intent.AMBIGUOUS, GENERAL_ASSISTANT_NAME, "通用助手")
    if any(word in text for word in REPORT_WORDS):
        return RouteDecision(Intent.REPORTING, REPORT_WRITER_NAME, "报告撰写助手")
    if any(word in text for word in DATA_WORDS):
        return RouteDecision(Intent.DATA_ANALYSIS, DATA_ANALYST_NAME, "数据分析助手")
    return RouteDecision(Intent.GENERAL, GENERAL_ASSISTANT_NAME, "通用助手")
```

- [ ] **Step 3: Add safe error tests**

Create `backend/tests/test_chat_safety.py`:

```python
from core.errors import safe_error_payload


def test_maps_provider_auth_error_to_safe_message():
    payload = safe_error_payload(Exception("Error code: 401 - Authentication Fails, Your api key is invalid"))
    assert payload["code"] == "MODEL_AUTH_FAILED"
    assert payload["message"] == "模型认证失败，请检查当前模型配置"
    assert "api key" not in payload["message"].lower()
```

- [ ] **Step 4: Implement safe errors**

Create `backend/core/errors.py`:

```python
def safe_error_payload(error: Exception) -> dict:
    raw = str(error).lower()
    if "401" in raw or "authentication" in raw or "api key" in raw:
        return {"type": "error", "code": "MODEL_AUTH_FAILED", "message": "模型认证失败，请检查当前模型配置", "recoverable": True}
    if "database" in raw or "数据库" in raw:
        return {"type": "error", "code": "DATABASE_ERROR", "message": "数据源连接失败，请检查当前数据库配置", "recoverable": True}
    return {"type": "error", "code": "CHAT_RUN_FAILED", "message": "本次生成失败，请稍后重试", "recoverable": True}
```

- [ ] **Step 5: Add DB context reset token**

Modify `backend/core/database.py`:

```python
from contextvars import ContextVar, Token

def set_current_db_url(url: str | None) -> Token[str | None]:
    return _current_db_url.set(url)

def reset_current_db_url(token: Token[str | None]) -> None:
    _current_db_url.reset(token)
```

- [ ] **Step 6: Expose selected specialist agent**

In `backend/core/agent.py`, add:

```python
def create_agent_for_name(name: str, model=None) -> Agent:
    if name == DATA_ANALYST_NAME:
        return create_data_analyst(model)
    if name == REPORT_WRITER_NAME:
        return create_report_writer(model)
    return create_general_assistant(model)
```

- [ ] **Step 7: Route chat directly**

In `backend/api/chat.py`, use:

```python
from core.agent import create_agent_for_name
from core.errors import safe_error_payload
from core.router import classify_intent
from core.database import set_current_db_url, reset_current_db_url

route = classify_intent(req.message)
agent = create_agent_for_name(route.agent_name, model=llm_model)
```

At stream start:

```python
yield sse("agent_status", agent=route.agent_name, display_name=route.display_name, status="running")
```

In exception handling:

```python
payload = safe_error_payload(e)
yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
```

Reset DB token in `finally`:

```python
if db_token is not None:
    reset_current_db_url(db_token)
```

- [ ] **Step 8: Run backend tests and compile**

Run:

```powershell
uv run pytest backend/tests/test_router.py backend/tests/test_chat_safety.py -q
uv run python -m compileall app.py api core tools
```

Expected: tests pass and compile succeeds.

- [ ] **Step 9: Commit agent routing**

Run:

```powershell
git add backend/core/router.py backend/core/errors.py backend/core/agent.py backend/api/chat.py backend/core/database.py backend/tests/test_router.py backend/tests/test_chat_safety.py progress.md
git commit -m "fix: route chats through deterministic agents"
```

---

### Task 6: API Path Safety, Secret Redaction, And CORS Config

**Files:**
- Create: `backend/core/path_safety.py`
- Modify: `backend/api/upload.py`
- Modify: `backend/api/export.py`
- Modify: `backend/api/storage.py`
- Modify: `backend/core/config.py`
- Modify: `backend/app.py`
- Create: `backend/tests/test_path_safety.py`
- Create: `backend/tests/test_storage_redaction.py`
- Modify: `progress.md`

- [ ] **Step 1: Write path safety tests**

Create `backend/tests/test_path_safety.py`:

```python
from pathlib import Path

import pytest

from core.path_safety import safe_child_path


def test_rejects_parent_traversal():
    with pytest.raises(ValueError):
        safe_child_path(Path("uploads"), "../secret.csv")


def test_keeps_valid_filename_inside_root(tmp_path):
    target = safe_child_path(tmp_path, "sales.csv")
    assert target == (tmp_path / "sales.csv").resolve()
```

- [ ] **Step 2: Implement safe child path**

Create `backend/core/path_safety.py`:

```python
from pathlib import Path


def safe_child_path(root: Path, filename: str) -> Path:
    name = Path(filename).name
    if not name or name != filename:
        raise ValueError("非法文件名")
    root_resolved = root.resolve()
    target = (root_resolved / name).resolve()
    if root_resolved != target.parent:
        raise ValueError("非法文件路径")
    return target
```

- [ ] **Step 3: Use safe paths in upload and export APIs**

In `backend/api/upload.py`:

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from core.path_safety import safe_child_path

try:
    dest = safe_child_path(UPLOAD_DIR, file.filename or "")
except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
```

In `backend/api/export.py`:

```python
from fastapi import APIRouter, HTTPException
from core.path_safety import safe_child_path

try:
    filepath = safe_child_path(Path("reports"), filename)
except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [ ] **Step 4: Write redaction tests**

Create `backend/tests/test_storage_redaction.py`:

```python
from api.storage import redact_config


def test_redacts_llm_api_key():
    assert redact_config({"apiKey": "sk-secret", "model": "deepseek-chat"}) == {"apiKey": "", "model": "deepseek-chat", "hasApiKey": True}


def test_redacts_database_password():
    assert redact_config({"type": "postgresql", "password": "secret", "host": "localhost"}) == {"type": "postgresql", "password": "", "host": "localhost", "hasPassword": True}
```

- [ ] **Step 5: Implement redaction**

In `backend/api/storage.py`, add:

```python
def redact_config(config: dict) -> dict:
    redacted = dict(config or {})
    if redacted.get("apiKey"):
        redacted["apiKey"] = ""
        redacted["hasApiKey"] = True
    if redacted.get("password"):
        redacted["password"] = ""
        redacted["hasPassword"] = True
    return redacted
```

Use `redact_config(r.config)` in `list_llm_profiles()` and `list_db_profiles()`.

- [ ] **Step 6: Add environment-driven CORS**

In `backend/core/config.py`, add:

```python
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_TOKEN: str = os.getenv("APP_TOKEN", "")
    CORS_ORIGINS: list[str] = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
```

In `backend/app.py`, change `allow_origins`:

```python
allow_origins=settings.CORS_ORIGINS,
```

- [ ] **Step 7: Run backend safety tests**

Run:

```powershell
uv run pytest backend/tests/test_path_safety.py backend/tests/test_storage_redaction.py -q
uv run python -m compileall app.py api core tools
```

Expected: tests pass and compile succeeds.

- [ ] **Step 8: Commit API safety**

Run:

```powershell
git add backend/core/path_safety.py backend/api/upload.py backend/api/export.py backend/api/storage.py backend/core/config.py backend/app.py backend/tests/test_path_safety.py backend/tests/test_storage_redaction.py progress.md
git commit -m "fix: harden api paths and profile secrets"
```

---

### Task 7: Production Verification And Visual QA

**Files:**
- Modify: `README.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

- [ ] **Step 1: Run full automated checks**

Run:

```powershell
pnpm lint
pnpm test
pnpm build
uv run pytest backend/tests -q
uv run python -m compileall app.py api core tools
```

Expected: all commands exit code `0`.

- [ ] **Step 2: Smoke invalid model key**

Send a chat request with an invalid key:

```powershell
$body = @{ message = "你好"; model = "deepseek-chat"; api_key = "invalid"; base_url = "https://api.deepseek.com/v1"; mode = "prod" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:8000/api/chat -Method POST -ContentType "application/json" -Body $body | Select-Object -ExpandProperty Content
```

Expected: SSE contains `MODEL_AUTH_FAILED` and does not include raw provider exception text.

- [ ] **Step 3: Browser QA desktop/tablet/mobile**

Use the in-app browser on `http://localhost:3000`:

```text
1440x900: no text overlap; sidebar, chat timeline, composer, and inspector fit.
834x1112: sidebar sheet opens/closes; header status remains visible.
390x844: composer fits within viewport; message actions do not overflow.
```

- [ ] **Step 4: Update README production checklist**

Add:

```markdown
## Production Readiness Checks

- `cd frontend && pnpm lint && pnpm test && pnpm build`
- `cd backend && uv run pytest backend/tests -q`
- `cd backend && uv run python -m compileall app.py api core tools`
- Configure `CORS_ORIGINS` before deployment.
- Set `APP_ENV=production` and provide a deployment authentication boundary before exposing the API publicly.
```

- [ ] **Step 5: Update planning files**

Set `task_plan.md`:

```markdown
- Phase 6: Implementation plan - complete
- Phase 7: Implementation and verification - complete
```

Append final verification results to `progress.md`.

- [ ] **Step 6: Commit final checklist**

Run:

```powershell
git add README.md task_plan.md findings.md progress.md
git commit -m "docs: add production verification checklist"
```

---

## Self-Review

- Spec coverage: quality gates map to Tasks 1, 4, 7; structured responses map to Tasks 2-3; unified responsive shell maps to Task 3; deterministic routing maps to Task 5; backend hardening maps to Task 6; tests and production checklist map to Tasks 1, 5, 6, 7.
- Placeholder scan: this plan avoids placeholder markers, deferred-placeholder phrasing, and generic catch-all handling instructions.
- Type consistency: frontend uses `ResponseBlock`, `BlockMessage`, and `ChatEvent`; backend uses `Intent`, `RouteDecision`, and `safe_error_payload` consistently across tasks.
