# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chinese-language AI data analysis assistant. Users ask questions in natural language; the system auto-routes to specialized agents for database queries, file analysis, chart generation, report writing, and notification delivery (Feishu/Email).

## Repository Structure

Monorepo with two independent projects — no root package.json.

- `backend/` — Python 3.13+, FastAPI, OpenAI Agents SDK, SQLAlchemy, DuckDB. Managed by **uv**.
- `frontend/` — React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Zustand 5, ECharts 6, TipTap. Managed by **pnpm**.
- `docs/superpowers/` — Design specs and implementation plans.

## Common Commands

### Backend (run from `backend/`)

```bash
uv sync                                          # Install dependencies
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000  # Dev server
uv run pytest tests -v                           # Run all tests
uv run python -m compileall app.py api core tools  # Syntax check (exclude .venv)
```

### Frontend (run from `frontend/`)

```bash
pnpm install    # Install dependencies
pnpm dev        # Dev server (port 3000)
pnpm build      # Production build
pnpm lint       # ESLint
pnpm test       # Vitest
```

### Full verification

```bash
# Frontend
cd frontend && pnpm lint && pnpm test && pnpm build

# Backend
cd backend && uv run pytest tests -q && uv run python -m compileall app.py api core tools
```

## Architecture

### Multi-Agent System (backend/core/)

Orchestrator with deterministic keyword routing (`core/router.py`) dispatches to three agents — no LLM call for routing:
- **GeneralAssistant** — general conversation, Q&A
- **DataAnalyst** — SQL queries, file analysis, chart generation
- **ReportWriter** — report generation, PDF export, Feishu/email notifications

Agents use OpenAI Agents SDK with `@function_tool` decorators in `backend/tools/`. Agent definitions and handoff logic in `core/agent.py`.

### SSE Streaming Protocol

`POST /api/chat` streams typed JSON events: `agent_status`, `agent_change`, `handoff`, `text_delta`, `reasoning_delta`, `tool_call`, `tool_result`, `chart`, `error`, `done`. Frontend consumes these via an async generator in `src/lib/api.ts` and applies them to message state via `applyChatEvent()` in `src/lib/messages.ts`.

### Block-Based Message Model (frontend)

Messages use `ResponseBlock[]` with typed blocks: markdown, chart, table, tool, thinking, agent_status, error. Legacy flat-format messages are migrated on load via `migrateMessage()`.

### Dual Persistence

Conversations and profiles stored in both localStorage (immediate) and backend SQLite (synced). Frontend syncs from backend on init. Zustand stores: `src/stores/chat.ts`, `src/stores/connection.ts`.

### Request-Scoped DB Context

Backend uses a context variable (`set_current_db_url` / `reset_current_db_url` in `core/database.py`) for per-request database URLs, reset after streaming completes.

## Key Conventions

- **Language**: UI text, comments, agent prompts, README are all in Chinese. Code identifiers and filenames are in English.
- **Backend layered architecture**: `api/` (route handlers) -> `core/` (business logic, models, config) -> `tools/` (agent function tools).
- **Frontend is client-side rendered**: All components use `"use client"`. `AppShell` is the root layout with a three-column responsive grid.
- **shadcn/ui**: base-nova style, CSS variables, lucide icons. Config in `frontend/components.json`.
- **Environment config**: Backend reads `backend/.env` (skipped when `APP_ENV=production`). Frontend reads `frontend/.env.local` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_TOKEN`.

## Security Patterns

When modifying security-sensitive code, preserve these invariants:
- SQL safety: whitelist SELECT/WITH/EXPLAIN/DESCRIBE only (`core/sql_safety.py`)
- Path safety: filename sanitization + path containment checks (`core/path_safety.py`)
- Secret redaction: API keys and passwords masked in storage API responses (`api/storage.py`)
- Error safety: internal exception details never leaked to users (`core/errors.py`)

## Next.js 16 Note

This project uses Next.js 16 which has breaking changes from earlier versions. Before writing Next.js code, check `node_modules/next/dist/docs/` for the relevant guide. Heed deprecation notices.
