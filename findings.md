# Findings

## Baseline
- Initial baseline commit created: `e4a88bc feat: add persisted multi-agent data analysis UI`.
- Follow-up cleanup commit created: `3a8b705 chore: remove debug message bubble styling`.
- Project is on `main`, ahead of `origin/main`.

## Open Audit Areas
- Build/type/lint failures.
- Backend import/runtime failures.
- Agent routing behavior and handoff correctness.
- Tool safety and data-source handling.
- Response event model and frontend rendering structure.
- Responsive layout across mobile, tablet, desktop.
- Missing production features: auth/security, secrets handling, deployment config, observability, error recovery, tests.

## Automated Health Check Findings
- `frontend pnpm build` succeeds with Next.js 16.2.6.
- `frontend pnpm lint` fails with 24 errors and 6 warnings.
- Lint root causes:
  - React 19 lint flags synchronous `setState` inside effects used for `mounted`/hydration guards.
  - `ChatPanel.handleRetry` references `handleSend` before declaration and misses it in dependencies.
  - `SettingsPanel` and `connection.ts` contain broad `any` usage.
  - Several unused values remain after UI restructuring.
- Backend smoke imports pass:
  - `uv run python -c "import app"` succeeds.
  - `create_agent`, `create_llm_model`, and `init_app_db` import/execute successfully.
- `uv run python -m compileall .` exited successfully, but it also scanned `.venv`, making it too noisy for routine verification. Future backend syntax checks should target `api core tools app.py`.
- `uv run python -m compileall app.py api core tools` succeeds and is the better backend syntax check.
- Broad recursive test discovery timed out because it scanned `.venv` and `node_modules`. The project needs explicit test locations and scripts.
- shadcn project info:
  - Next.js App Router, Next.js 16.2.6, React Server Components enabled.
  - Tailwind v4, CSS file `src/app/globals.css`.
  - shadcn style `base-nova`, base primitive `base`, icon library `lucide`.
  - Installed UI components: badge, button, card, dialog, input, label, scroll-area, separator, sheet, slider, tabs, textarea.

## Frontend Architecture Findings
- Responsive layout is currently split into separate `MobilePage` and `DesktopPage` trees selected by `window.innerWidth`.
- Multiple hydration guards (`mounted`, `hasMounted`) are used to avoid mismatch. This explains lint failures and indicates the layout is not CSS-first.
- The duplicated page trees make feature parity fragile: desktop has search/model dropdown/context menu; mobile has separate menu behavior and settings entry.
- Chat send/retry logic is coupled inside `ChatPanel`; `handleRetry` depends on `handleSend` before declaration, which lint correctly flags.
- Secrets are currently stored in browser localStorage and persisted through backend profile APIs without encryption or redaction. This is not production-ready for API keys or database passwords.
- Visual desktop findings:
  - Sidebar, header, message canvas, and composer are visually disconnected.
  - Message content spans too wide on a 1440px viewport; reading rhythm is poor.
  - Conversation list contains repeated indistinguishable titles, with no useful metadata or preview.
  - Composer floats as a large card at the bottom, while the message scroll area has too much empty whitespace.
  - Settings entry is visually weak and can be obscured by dev overlay at the lower-left.
- Visual mobile findings:
  - Mobile renders a completely separate experience with limited navigation/status affordances.
  - Header has menu/title/export only; active model, DB, tool state, and agent state are not visible.
  - Messages occupy a narrow stream but response sections are not clearly grouped.
  - Bottom composer consumes significant vertical space and creates a cramped safe-area feeling.
- Response display findings:
  - Existing saved responses show repeated assistant text.
  - Existing saved responses include routing/internal handoff wording in a user-facing answer.
  - Markdown emphasis is visible in plain text in at least one paragraph (`**通用助手...**`), indicating message segmentation/rendering can be improved.
- Message model currently stores assistant `content`, `reasoning`, `toolCalls`, and `chart` on one object. This makes partial streaming, retries, chart placement, and structured analysis sections harder to reason about.
- `MessageBubble` owns too many responsibilities: copy controls, reasoning, tool calls, markdown rendering, section copy, chart rendering, action buttons, and role layout.

## Backend/API Findings
- CORS is hard-coded to `http://localhost:3000`.
- No authentication or authorization layer protects chat, saved profiles, DB URLs, uploaded files, or reports.
- Database URL is passed from frontend to backend per chat request. This improves flexibility but increases exposure of credentials and makes audit logging/redaction important.
- Current context variable use for database URL needs careful reset handling per request; otherwise long-lived async streams can be risky under concurrency.
- Current architecture relies on an LLM Orchestrator to obey "only tool_call" routing instructions. This is brittle: if it emits text, frontend/back-end filtering must hide it perfectly.
- Production UX should not depend on users seeing raw agent handoff messages. Agent transitions should be structured status events, not assistant content.
- `/api/export/report/{filename}` joins user input into `reports / filename` without path normalization or containment checks.
- `/api/upload` writes `UploadFile.filename` directly under `uploads`, also without sanitizing or containment checks.
- Storage APIs expose full LLM and DB profile configs, including API keys and DB passwords.
- `send_email_notification` calls `asyncio.get_event_loop().run_until_complete(...)` inside a synchronous tool. Under an already-running event loop this can fail; it should be async-aware or use a sync SMTP implementation.
- Frontend API helper silently swallows many persistence failures (`catch(() => {})`), so production users can lose state without clear recovery.

## Implementation Findings
- Structured message blocks are now the canonical frontend response representation; legacy content/tool/chart fields are retained during migration for compatibility.
- The responsive app shell is now a single tree using sidebar sheet behavior on narrow viewports and an inspector column on wide viewports.
- Full frontend lint now passes after removing hydration-only `mounted` effects and broad `any` usage in settings/profile migration.
- Backend deterministic routing now bypasses prompt-only orchestration for initial agent selection and emits `agent_status` SSE events.
- Upload/export filename containment and profile redaction are covered by backend tests.
- The app no longer depends on `next/font/google` during build; this avoids CI/build failures when fonts.gstatic.com is unavailable.
