# Production Readiness Redesign Design

## Goal
Build a production-ready data analyst agent app by fixing quality gates, replacing the duplicated responsive layout with one adaptive shell, structuring assistant responses, hardening agent routing, and adding production safety boundaries.

## Current Baseline
The app already has a useful foundation:
- FastAPI backend with SSE chat, upload, export, DB testing, and profile persistence.
- OpenAI Agents SDK based multi-agent flow with Orchestrator, DataAnalyst, ReportWriter, and GeneralAssistant.
- Next.js 16, React 19, Tailwind v4, shadcn base-nova UI, Zustand stores, ECharts rendering.
- Local persistence for conversations and connection profiles, with backend SQLite sync.

The current state is not production-ready:
- `pnpm lint` fails with 24 errors.
- The page has separate `MobilePage` and `DesktopPage` trees.
- Agent routing can leak internal handoff language into visible replies.
- Responses store text, reasoning, tools, and charts on one object.
- Secrets are stored and returned as raw config.
- Upload/export paths are not constrained.
- No auth, no formal tests, and no production deployment boundary.

## Scope
This redesign covers the minimum coherent product backbone needed before feature expansion.

In scope:
- Make existing build/lint checks pass.
- Introduce a single responsive application shell.
- Refactor chat state and rendering around structured response parts.
- Improve agent routing so users never see orchestration prose.
- Add structured status events for agent, tool, chart, and error states.
- Harden file paths, CORS config, credential handling, and API error shape.
- Add targeted tests for routing, storage safety, file path safety, and key frontend transforms.
- Improve UX for desktop, tablet, and mobile.

Out of scope for this first production pass:
- Multi-user SaaS billing.
- Full OAuth implementation.
- Enterprise RBAC.
- Cloud deployment scripts for a specific provider.
- Full observability stack beyond app-level logging and structured errors.

## Design Principles
- One adaptive UI tree. Breakpoints should change layout, not duplicate product behavior.
- User-facing replies must be clean. Agent orchestration is status metadata, not answer content.
- Responses should be composable. Text, tables, charts, tools, errors, and citations should render as typed blocks.
- Secrets should not round-trip casually. Redact by default and only send sensitive values intentionally.
- Tool execution should be visible but not noisy. Users see progress and recoverable failures; developers can open details.
- Production confidence comes from executable checks, not manual inspection.

## Frontend Architecture
Replace the mobile/desktop fork with a single `AppShell`:
- `AppShell`: owns layout grid, sidebar sheet state, inspector state, and responsive slots.
- `ConversationSidebar`: conversation list, search, new chat, compact connection status.
- `ChatWorkspace`: header, message timeline, composer.
- `RunInspector`: agent status, tool calls, data source, errors, trace view for dev mode.
- `SettingsDialog`: LLM and DB profiles with redacted credentials and explicit save/test states.

Responsive behavior:
- Desktop: left sidebar, center chat, optional right inspector.
- Tablet: collapsible left sidebar and right inspector drawer.
- Mobile: top header, sidebar as sheet, inspector as bottom/details panel, same chat tree.

This removes `window.innerWidth` routing and most hydration guards. CSS breakpoints and component state should handle layout.

## Response Model
Replace the current single assistant message shape with typed blocks.

Core model:
```ts
type MessageRole = "user" | "assistant" | "system";

type ResponseBlock =
  | { id: string; type: "markdown"; content: string }
  | { id: string; type: "chart"; option: Record<string, unknown>; title?: string }
  | { id: string; type: "table"; columns: string[]; rows: unknown[][]; title?: string }
  | { id: string; type: "tool"; name: string; status: "running" | "done" | "error"; input?: unknown; outputPreview?: string }
  | { id: string; type: "agent_status"; agent: string; label: string; status: "entered" | "running" | "done" }
  | { id: string; type: "error"; code: string; message: string; recoverable: boolean };

type Message = {
  id: string;
  role: MessageRole;
  blocks: ResponseBlock[];
  createdAt: number;
  updatedAt: number;
};
```

Compatibility:
- Existing messages with `content`, `reasoning`, `toolCalls`, and `chart` should be migrated at load time into blocks.
- Persist both the new `blocks` shape and a schema version.
- Export Markdown should render blocks in a stable order.

Display structure:
- User messages remain compact bubbles.
- Assistant messages render as a stack:
  1. Direct answer or summary.
  2. Evidence: table, SQL/tool result summary, chart.
  3. Analysis details.
  4. Next actions.
- Tool and reasoning details are collapsed by default in production mode.
- Dev mode shows full trace in `RunInspector`, not inside the main answer.

## Agent Routing
The current LLM Orchestrator is brittle because correctness depends on prompt obedience. Keep specialist agents, but make routing explicit and defensible.

Routing design:
- Add a deterministic `classify_intent(message, context)` layer before running an agent.
- Intent categories:
  - `general`: daily chat, text help, knowledge question.
  - `data_analysis`: database/file exploration, SQL, statistics, visualization.
  - `reporting`: report generation, export, notification.
  - `ambiguous`: ask a short clarification or route to general with suggested actions.
- The first implementation should be rules-first. LLM fallback is excluded from this pass unless deterministic routing proves insufficient in tests.
- The backend should emit `agent_status` SSE events for the chosen agent.
- The selected specialist agent produces the answer; orchestration text is never part of visible content.

Agent responsibilities:
- GeneralAssistant answers directly without tools.
- DataAnalyst must explore available data sources before querying.
- ReportWriter can only use prior analysis or explicit user-provided content; it should not re-query unless the user asks.

Failure handling:
- Unknown route should degrade to GeneralAssistant with suggestions.
- Tool failure should emit a structured recoverable error block.
- Provider auth errors should become user-safe messages such as "模型认证失败，请检查当前模型配置", with raw provider details logged server-side only.

## Backend/API Hardening
Security and reliability changes:
- Move CORS origins into environment config.
- Add a basic auth boundary for local production. At minimum, support a required app token for non-development mode.
- Redact secrets in profile list/get responses.
- Store secrets encrypted or keep them client-only until a proper credential store exists.
- Do not return raw DB URLs in API responses.
- Normalize upload filenames and enforce resolved paths stay inside `backend/uploads`.
- Normalize export filenames and enforce resolved paths stay inside `backend/reports`.
- Reset request-scoped DB context after streaming completes.
- Replace broad exception text in SSE with structured error events:
  ```json
  { "type": "error", "code": "MODEL_AUTH_FAILED", "message": "模型认证失败，请检查当前模型配置", "recoverable": true }
  ```
- Make email notification async-safe.

## UI/UX Direction
Use a production SaaS tool aesthetic: calm, dense, and operational.

Key UI changes:
- Keep the current minimal white/neutral base, but add clearer surfaces and hierarchy.
- Sidebar: searchable conversations with date, preview, and source/status metadata.
- Header: conversation title, active model, active DB, selected agent, run mode.
- Composer: compact, reliable, supports attach file, stop, retry, and clear send affordance.
- Inspector: dev/status information separated from the answer.
- Empty state: focused data-analysis entry point, with upload/connect actions and examples.
- Mobile: full-height chat with stable header, sheet sidebar, compact composer, and accessible inspector.

Accessibility:
- Icon buttons need accessible names.
- Dialogs and sheets need visible or sr-only titles.
- Focus states must be retained.
- Text and controls must fit on 390px wide mobile screens.

## Testing Strategy
Backend tests:
- Intent classification routes general/data/reporting/ambiguous examples correctly.
- Upload path normalization rejects traversal filenames.
- Export path normalization rejects traversal filenames.
- Profile APIs redact secrets.
- SSE error mapper converts provider errors into safe structured events.
- DB context is reset after request handling.

Frontend tests:
- Legacy message migration creates typed blocks.
- Chat stream reducer appends text, tool, chart, status, and error blocks correctly.
- Responsive shell renders same core chat tree across desktop/mobile.
- Settings forms preserve typed DB/LLM configs without `any`.

Manual verification:
- `pnpm lint`
- `pnpm build`
- `uv run python -m compileall app.py api core tools`
- Browser screenshots at desktop 1440x900, tablet 834x1112, mobile 390x844.
- Smoke run with invalid model key verifies safe error message.

## Implementation Phases
1. Quality gate repair: lint errors, hook order, type cleanup, no behavior expansion.
2. State model refactor: typed response blocks, migration, stream reducer.
3. Unified responsive shell: remove `MobilePage` and `DesktopPage` duplication.
4. Message and inspector UX: structured answer rendering and separate trace panel.
5. Agent router hardening: deterministic classifier and structured status events.
6. Backend security hardening: CORS config, path safety, secret redaction, safe errors.
7. Tests and production checklist: add targeted tests and verification scripts.

## Success Criteria
- `pnpm lint` passes with no errors.
- `pnpm build` passes.
- Backend compile smoke check passes.
- Mobile, tablet, and desktop share one product behavior model.
- Users never see internal routing prose.
- Assistant replies render as clear blocks with charts/tools placed predictably.
- Credentials are not exposed in profile list/get responses.
- Upload/export endpoints reject path traversal.
- A new developer can run the app and validate core behavior using documented commands.
