# Data Analyst Agent

AI 驱动的数据分析助手。用自然语言提问，自动完成数据库查询、文件分析、可视化图表生成、报告撰写及飞书推送。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Next.js 15 + Shadcn/ui + ECharts |
| 后端 | Python 3.13 + FastAPI + OpenAI Agents SDK |
| 数据库 | SQLAlchemy (PostgreSQL / MySQL / SQLite / DuckDB) |
| 文件 | Pandas + DuckDB 内存引擎 |
| 推送 | 飞书 Webhook 卡片 + 邮件 SMTP |

## 快速开始

### 后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 和 AGENT_DATABASE_URL

uv sync
uv run uvicorn app:app --reload
```

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

访问 http://localhost:3000

## 核心功能

- **自然语言查询** — 对话式数据分析，Agent 自动探索数据库结构并生成 SQL
- **文件分析** — 上传 CSV/Excel/JSON/Parquet，自动注册为可 SQL 查询的虚拟表
- **可视化图表** — 支持柱状图、折线图、饼图、散点图、热力图、雷达图等 11+ 种图表
- **报告生成** — 自动生成 Markdown 分析报告并导出
- **飞书推送** — 交互式卡片推送，内嵌 VChart 图表
- **前端配置** — 在 UI 中切换 LLM Provider、Model、API Key

## 项目结构

```
backend/
  app.py                 # FastAPI 入口
  core/agent.py          # OpenAI Agents SDK + 系统提示词
  core/config.py         # 环境变量
  core/llm.py            # LLM 客户端工厂
  core/database.py       # SQLAlchemy 引擎
  core/db_adapter.py     # 多数据库适配层
  core/file_loader.py    # 文件加载 + DuckDB
  tools/                 # Agent 工具集
  api/                   # SSE 对话 + 文件上传 + 导出

frontend/
  src/app/               # Next.js 页面
  src/components/chat/   # 对话组件
  src/components/chart/  # ECharts 图表
  src/components/settings/ # 模型配置
  src/stores/chat.ts     # Zustand 状态管理
  src/lib/api.ts         # SSE 客户端
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `OPENAI_API_KEY` | LLM API Key (兼容 DeepSeek/GPT/Qwen) |
| `OPENAI_API_BASE` | API Base URL |
| `OPENAI_MODEL` | 默认模型 |
| `AGENT_DATABASE_URL` | 数据库连接串 |
| `FEISHU_WEBHOOK_URL` | 飞书群 Webhook |
| `SMTP_SERVER` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | 邮件配置 |
