# Data Analyst Agent

AI 驱动的智能数据分析助手。用自然语言提问，自动完成数据库查询、文件分析、可视化图表、报告撰写及飞书/邮件推送。

## 功能特性

### 智能对话
- 自然语言提问，自动路由到专业 Agent 处理
- SSE 实时流式响应，逐字打字机效果（字符队列 + requestAnimationFrame）
- 多轮对话记忆，上下文连贯
- 停止生成、重试、编辑重发
- 对话记录本地 + 后端双持久化

### 联网搜索
- DuckDuckGo 互联网搜索，无需额外 API Key
- 自动识别搜索意图（"搜一下"、"最新消息"等关键词触发）
- 搜索结果智能摘要，自然语言回复
- 适用于实时资讯、天气、新闻、超出模型知识范围的问题

### 数据分析
- 连接 PostgreSQL / MySQL / SQLite / DuckDB 数据库
- 上传 CSV / Excel / JSON / Parquet 文件（最大 500MB）
- 自动探索表结构，生成并执行 SQL
- 跨轮记忆，不重复查询
- 查询结果导出为 Excel / CSV

### 可视化
- 14 种图表类型：柱状图、折线图、饼图、散点图、热力图、雷达图、箱线图、K线图、漏斗图、桑基图、水平柱状图、矩形树图、瀑布图、面积图
- 5 种配色方案（经典、暖色、冷色、柔和、单色），悬停切换
- ECharts 渲染，交互式体验，自动响应式适配

### 报告管理
- 自动生成 Markdown 分析报告
- TipTap 富文本编辑器，支持表格、图片、代码块、链接
- 报告列表管理，搜索、分页、标签筛选
- 导出为 PDF / Excel / CSV
- 报告 CRUD API，支持创建、编辑、删除

### 通知推送
- 飞书群机器人推送（交互式卡片 + 图表 + 表格）
- 邮件 SMTP 发送（HTML 格式）
- 邮箱格式校验 + 主题注入防护

### 多 Agent 架构
- **Orchestrator（智能路由）** — 分析用户意图，转交专业 Agent
- **GeneralAssistant（通用助手）** — 日常对话、知识问答、联网搜索、文本处理
- **DataAnalyst（数据分析助手）** — SQL 查询、文件分析、图表生成
- **ReportWriter（报告撰写助手）** — 报告生成、导出、通知分发
- 确定性关键词路由，用户无感知切换

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + Next.js 16 |
| UI 组件 | shadcn/ui + Tailwind CSS v4 |
| 图表 | ECharts 6 + echarts-for-react |
| 状态管理 | Zustand 5 |
| 富文本 | TipTap (StarterKit + Table + CodeBlock + Image + Link) |
| Markdown | ReactMarkdown + remark-gfm |
| 后端框架 | Python 3.13+ + FastAPI + Uvicorn |
| AI 引擎 | OpenAI Agents SDK + OpenAI 兼容 API (DeepSeek / GPT / Qwen / MiMo) |
| 联网搜索 | DuckDuckGo Search (duckduckgo-search) |
| ORM | SQLAlchemy 2.0 |
| 内部数据库 | SQLite (对话记录、配置、报告元数据) |
| 用户数据库 | PostgreSQL / MySQL / SQLite / DuckDB |
| 文件引擎 | DuckDB 内存数据库 (CSV/Excel/JSON/Parquet 查询) |
| PDF 生成 | xhtml2pdf + markdown2 |
| Excel 导出 | openpyxl |
| 推送 | 飞书 Webhook + SMTP 邮件 |
| 包管理 | pnpm (前端) / uv (后端) |
| 测试 | pytest (后端 48 用例) / vitest (前端) |

---

## 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.13
- pnpm（前端包管理）
- uv（后端包管理）

### 1. 克隆项目

```bash
git clone https://github.com/your-username/my-agent.git
cd my-agent
```

### 2. 配置后端

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，至少配置 LLM API Key：

```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_API_BASE=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

### 3. 启动后端

```bash
# 安装 uv (如果尚未安装)
pip install uv

# 安装依赖并启动
uv sync
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

> **国内镜像加速**：如果下载依赖缓慢，可配置镜像源：
> ```bash
> # pnpm 镜像
> pnpm config set registry https://registry.npmmirror.com
> # uv 镜像（写入 ~/.config/uv/uv.toml）
> echo 'index-url = "https://mirrors.aliyun.com/pypi/simple/"' > ~/.config/uv/uv.toml
> ```

后端运行在 http://localhost:8000，API 文档在 http://localhost:8000/docs

### 4. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

前端运行在 http://localhost:3000

### 5. 开始使用

打开浏览器访问 http://localhost:3000，在设置中配置 LLM 和数据库连接，然后输入问题即可开始对话。

---

## 环境变量

### 后端 (`backend/.env`)

| 变量 | 说明 | 默认值 |
|---|---|---|
| `OPENAI_API_KEY` | LLM API Key（兼容 DeepSeek/GPT/Qwen/MiMo） | 必填 |
| `OPENAI_API_BASE` | API Base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 默认模型名称 | `deepseek-chat` |
| `AGENT_DATABASE_URL` | 数据库连接串（可选，可通过前端配置） | 空 |
| `FEISHU_WEBHOOK_URL` | 飞书群 Webhook URL | 空 |
| `FEISHU_APP_ID` | 飞书应用 ID（可选） | 空 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | 空 |
| `SMTP_SERVER` | SMTP 服务器地址 | 空 |
| `SMTP_PORT` | SMTP 端口 | `465` |
| `SMTP_USERNAME` | SMTP 用户名 | 空 |
| `SMTP_PASSWORD` | SMTP 密码 | 空 |
| `APP_TOKEN` | API 认证 Token（空 = 无认证） | 空 |
| `APP_ENV` | 运行环境 (`development` / `production`) | `development` |
| `CORS_ORIGINS` | 允许的前端源，逗号分隔 | `http://localhost:3000` |

### 前端 (`frontend/.env.local`)

| 变量 | 说明 | 默认值 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:8000` |
| `NEXT_PUBLIC_APP_TOKEN` | API 认证 Token | 空 |

---

## 项目结构

```
my-agent/
├── backend/
│   ├── app.py                        # FastAPI 入口（CORS + 认证 + 路由挂载）
│   ├── pyproject.toml                # Python 项目配置 + 依赖
│   ├── .env.example                  # 环境变量模板
│   │
│   ├── api/                          # API 路由层
│   │   ├── chat.py                   # POST /api/chat（SSE 流式对话）
│   │   ├── upload.py                 # POST /api/upload（文件上传）
│   │   ├── export.py                 # 报告/数据导出端点
│   │   ├── db.py                     # POST /api/db/test（连接测试）
│   │   ├── storage.py                # 对话记录 & 连接配置 CRUD
│   │   └── reports.py                # 报告管理 CRUD + 导出
│   │
│   ├── core/                         # 核心业务逻辑
│   │   ├── agent.py                  # 多 Agent 系统（Orchestrator + 3 个专业 Agent）
│   │   ├── router.py                 # 确定性意图路由（关键词匹配 + 搜索意图识别）
│   │   ├── llm.py                    # LLM 客户端工厂（OpenAI 兼容）
│   │   ├── config.py                 # 环境变量配置类
│   │   ├── database.py               # SQLAlchemy 引擎管理 + 连接池
│   │   ├── db_adapter.py             # 多数据库适配层（PG/MySQL/SQLite/DuckDB）
│   │   ├── file_loader.py            # 文件加载 → DuckDB 虚拟表注册
│   │   ├── models.py                 # ORM 模型（Conversation/LLMProfile/DBProfile/Report）
│   │   ├── errors.py                 # 用户友好的错误消息映射
│   │   ├── path_safety.py            # 路径遍历防护
│   │   ├── sql_safety.py             # SQL 注入防护（白名单验证）
│   │   ├── pdf_generator.py          # Markdown → PDF 生成
│   │   ├── report_service.py         # 报告 CRUD 业务逻辑
│   │   └── data_exporter.py          # Excel/CSV 导出器
│   │
│   ├── tools/                        # Agent 工具（function_tool 装饰器）
│   │   ├── db_tools.py               # list_schemas / list_tables / describe_table / run_sql_query
│   │   ├── file_tools.py             # list_uploaded_files / query_uploaded_file
│   │   ├── chart_tools.py            # create_chart（14 种图表类型）
│   │   ├── report_tools.py           # generate_report（Markdown 报告）
│   │   ├── notification_tools.py     # send_feishu_notification / send_email_notification
│   │   └── web_tools.py              # web_search（DuckDuckGo 联网搜索）
│   │
│   ├── tests/                        # 后端单元测试（48 个用例）
│   │   ├── conftest.py               # 测试配置
│   │   ├── test_router.py            # 意图路由测试
│   │   ├── test_chat_safety.py       # 错误消息安全测试
│   │   ├── test_sql_safety.py        # SQL 注入防护测试（16 个用例）
│   │   ├── test_path_safety.py       # 路径遍历防护测试
│   │   ├── test_storage_redaction.py # API Key/密码脱敏测试
│   │   ├── test_report_model.py      # 报告模型测试
│   │   ├── test_report_service.py    # 报告服务 CRUD 测试
│   │   ├── test_reports_api.py       # 报告 API 端点测试
│   │   ├── test_pdf_export.py        # PDF 生成测试
│   │   └── test_data_export.py       # Excel/CSV 导出测试
│   │
│   ├── data/                         # 内部 SQLite 数据库（app.db）
│   ├── uploads/                      # 上传的数据文件
│   └── reports/                      # 生成的报告文件（.md）
│
├── frontend/
│   ├── package.json                  # Node.js 依赖
│   ├── tsconfig.json                 # TypeScript 配置
│   ├── next.config.ts                # Next.js 配置
│   ├── components.json               # shadcn/ui 配置
│   │
│   └── src/
│       ├── app/
│       │   ├── globals.css           # 设计系统（CSS 变量 + 全局样式）
│       │   ├── layout.tsx            # 根布局（Sonner Toast）
│       │   └── page.tsx              # 入口页面（渲染 AppShell）
│       │
│       ├── components/
│       │   ├── app/
│       │   │   ├── AppShell.tsx      # 主应用布局（三栏：侧边栏 + 对话 + 检查器）
│       │   │   ├── ConversationSidebar.tsx  # 对话列表（搜索、批量删除、日期分组）
│       │   │   └── RunInspector.tsx  # 右侧运行状态面板
│       │   │
│       │   ├── chat/
│       │   │   ├── ChatPanel.tsx     # 对话 UI（SSE 流式、空状态、快捷操作）
│       │   │   ├── InputBar.tsx      # 消息输入框（文件上传、自动高度）
│       │   │   ├── MessageBubble.tsx # 消息气泡（用户/助手/系统、思考过程、工具调用）
│       │   │   └── MessageBlocks.tsx # 块渲染器（Markdown/图表/表格/工具/错误）
│       │   │
│       │   ├── chart/
│       │   │   └── EChart.tsx        # ECharts 封装（5 种配色、悬停切换、自动响应式）
│       │   │
│       │   ├── report/
│       │   │   ├── ReportCard.tsx    # 报告卡片组件
│       │   │   ├── ReportList.tsx    # 报告列表页（搜索、分页）
│       │   │   ├── ReportEditor.tsx  # TipTap 富文本编辑器
│       │   │   ├── ChartEditor.tsx   # 图表编辑器
│       │   │   ├── ChartTypeSelector.tsx  # 图表类型选择器
│       │   │   ├── ColorSchemePicker.tsx  # 配色方案选择器
│       │   │   └── ExportButton.tsx  # 导出下拉菜单（PDF/Excel/CSV）
│       │   │
│       │   ├── settings/
│       │   │   └── SettingsPanel.tsx # 设置面板（通用/LLM/数据库三个 Tab）
│       │   │
│       │   └── ui/                   # shadcn/ui 基础组件
│       │       ├── badge.tsx, button.tsx, card.tsx, dialog.tsx
│       │       ├── dropdown-menu.tsx, input.tsx, label.tsx
│       │       ├── scroll-area.tsx, separator.tsx, sheet.tsx
│       │       ├── slider.tsx, tabs.tsx, textarea.tsx
│       │
│       ├── lib/
│       │   ├── api.ts                # API 客户端（SSE 流式、CRUD、文件上传）
│       │   ├── messages.ts           # 消息模型（块类型、迁移、事件 reducer）
│       │   ├── messages.test.ts      # 消息逻辑单元测试
│       │   └── utils.ts              # cn() 工具函数
│       │
│       └── stores/
│           ├── chat.ts               # 对话状态（Zustand，双持久化）
│           └── connection.ts         # 连接配置状态（LLM/DB 配置管理）
│
└── README.md
```

---

## 架构设计

### 多 Agent 系统

```
用户消息
    │
    ▼
┌─────────────┐
│ Orchestrator │  ← 确定性关键词路由（不消耗 LLM 调用）
│  (智能路由)   │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ GeneralAssistant │  │  DataAnalyst  │  │ ReportWriter  │
│   (通用助手)    │  │ (数据分析助手) │  │ (报告撰写助手) │
│                │  │              │  │              │
│ · 知识问答     │  │ · SQL 查询    │  │ · 报告生成    │
│ · 联网搜索     │  │ · 文件分析    │  │ · 导出 PDF    │
│ · 文本创作     │  │ · 图表生成    │  │ · 飞书推送    │
│ · 翻译总结     │  │ · 表结构探索  │  │ · 邮件发送    │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 意图路由规则

| 用户意图 | 关键词示例 | 路由目标 |
|---|---|---|
| 联网搜索 | 搜索、搜一下、搜搜、查一下最新、最新消息、最新新闻、search、网上搜 | GeneralAssistant |
| 数据分析 | 数据、表、sql、查询、统计、趋势、图表、可视化、分析 | DataAnalyst |
| 报告生成 | 报告、导出、通知、发送、飞书、邮件、markdown | ReportWriter |
| 日常对话 | 其他所有消息 | GeneralAssistant |
| 短消息歧义 | ≤4 字符的"数据"、"表"、"分析" | GeneralAssistant |

### 前端流式渲染

前端采用 **字符队列 + `requestAnimationFrame` 动画循环** 实现逐字打字效果：

1. SSE 事件到达后，`text_delta` / `reasoning_delta` 被拆成单字符放入队列
2. `requestAnimationFrame` 循环每帧从队列取 4 个字符渲染（约 240 字/秒）
3. 非文本事件（工具调用、图表等）立即处理
4. 流结束后等待队列清空再结束 loading 状态

### SSE 事件流

```
POST /api/chat
    │
    ▼
data: {"type":"agent_status","agent":"Orchestrator","display_name":"智能路由","status":"running"}
data: {"type":"agent_change","agent":"DataAnalyst","display_name":"数据分析助手"}
data: {"type":"reasoning_delta","content":"让我先查看..."}
data: {"type":"tool_call","tool":"list_schemas","arguments":"{}"}
data: {"type":"tool_result","content":"数据库类型: postgresql..."}
data: {"type":"text_delta","content":"根据查询结果..."}
data: {"type":"chart","content":"{\"series\":[...]}"}
data: {"type":"done"}
```

| 事件 | 字段 | 说明 |
|---|---|---|
| `agent_status` | agent, display_name, status | Agent 路由通知 |
| `agent_change` | agent, display_name | Agent 切换通知 |
| `handoff` | target, target_display | Agent 转交通知 |
| `text_delta` | content | 流式文本增量 |
| `reasoning_delta` | content | 推理过程增量 |
| `tool_call` | tool, arguments | 工具调用开始 |
| `tool_result` | content, call_id | 工具执行结果 |
| `chart` | content | ECharts 图表配置 JSON |
| `error` | code, message, recoverable | 错误信息 |
| `done` | - | 流式传输结束 |

---

## API 接口

### 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat` | SSE 流式对话（支持 history 多轮上下文） |

### 文件管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/upload` | 上传数据文件（CSV/Excel/JSON/Parquet） |
| GET | `/api/upload/tables` | 获取已上传文件表列表 |

### 报告管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/reports` | 创建报告 |
| GET | `/api/reports` | 获取报告列表（支持分页、搜索、标签筛选） |
| GET | `/api/reports/{id}` | 获取报告详情 |
| PUT | `/api/reports/{id}` | 更新报告 |
| DELETE | `/api/reports/{id}` | 删除报告 |
| GET | `/api/reports/{id}/export/pdf` | 导出报告为 PDF |

### 数据导出

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/export/report/{filename}` | 下载报告 Markdown 文件 |
| POST | `/api/export/query/excel` | 将 SQL 查询结果导出为 Excel |
| POST | `/api/export/query/csv` | 将 SQL 查询结果导出为 CSV |

### 数据库

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/db/test` | 测试数据库连接 |

### 对话记录

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/conversations` | 获取对话列表 |
| GET | `/api/conversations/{id}` | 获取对话详情（含消息） |
| POST | `/api/conversations` | 创建对话 |
| PUT | `/api/conversations/{id}` | 更新对话 |
| DELETE | `/api/conversations/{id}` | 删除对话 |

### 连接配置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/connections/llm` | 获取 LLM 配置列表 |
| POST | `/api/connections/llm` | 创建 LLM 配置 |
| PUT | `/api/connections/llm/{id}` | 更新 LLM 配置 |
| DELETE | `/api/connections/llm/{id}` | 删除 LLM 配置 |
| PUT | `/api/connections/llm/{id}/activate` | 激活 LLM 配置 |
| GET | `/api/connections/db` | 获取数据库配置列表 |
| POST | `/api/connections/db` | 创建数据库配置 |
| PUT | `/api/connections/db/{id}` | 更新数据库配置 |
| DELETE | `/api/connections/db/{id}` | 删除数据库配置 |
| PUT | `/api/connections/db/{id}/activate` | 激活数据库配置 |

### 健康检查

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（免认证） |

---

## 安全特性

- **认证中间件** — Bearer Token 认证（可选，通过 `APP_TOKEN` 启用）
- **CORS 配置** — 可配置允许的前端源
- **路径遍历防护** — 文件名清洗 + 路径二次校验，防止目录穿越
- **敏感信息脱敏** — API Key 和密码在存储响应中自动脱敏
- **SQL 注入防护** — 白名单验证：仅允许 SELECT/WITH/EXPLAIN/DESCRIBE，阻止注释绕过、多语句执行、DuckDB 危险命令（ATTACH/COPY/INSTALL/LOAD/EXPORT/CALL）
- **报告路径安全** — 标题清洗 + 路径二次校验
- **文件上传限制** — 最大 500MB，格式白名单
- **线程安全** — 数据库引擎缓存和 DuckDB 连接使用线程锁
- **SSE 断连检测** — 自动检测客户端断开，停止处理
- **超时控制** — LLM 连接 120s 超时 + 2 次重试，飞书/SMTP 15s 超时
- **邮箱校验** — 正则验证邮箱格式 + 主题注入防护（阻止换行符）
- **错误脱敏** — 内部异常详情不泄露给用户，返回友好的中文错误信息

---

## 测试

### 后端测试（48 个用例）

```bash
cd backend
uv run pytest tests -v
```

测试覆盖：
- 意图路由分类（4 个用例）
- SQL 注入防护（16 个用例）— SELECT 白名单、注释绕过、多语句、DuckDB 命令
- 路径遍历防护（2 个用例）
- 错误消息安全（1 个用例）— API Key 不泄露
- 存储脱敏（2 个用例）— API Key / 密码脱敏
- 报告模型（2 个用例）
- 报告服务 CRUD（6 个用例）
- 报告 API 端点（6 个用例）
- PDF 生成（3 个用例）
- 数据导出（3 个用例）— Excel / CSV / 格式化

### 前端测试

```bash
cd frontend
pnpm test
```

测试覆盖：
- 消息迁移（Legacy → Block 格式）
- SSE 事件 reducer（text_delta / chart / error / agent_status）

### 构建检查

```bash
cd frontend
pnpm lint
pnpm build
```

---

## 部署

### 生产环境检查清单

1. 设置 `APP_ENV=production`（禁用 .env 覆盖）
2. 配置 `CORS_ORIGINS` 为真实前端域名
3. 设置 `APP_TOKEN` 启用 API 认证
4. 不要公开 LLM API Key 和数据库密码
5. 上传和报告下载仅允许访问指定目录
6. 配置飞书 Webhook 和 SMTP（如需推送功能）

### Docker 部署

**后端 Dockerfile**

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY backend/ .
RUN pip install uv && uv sync --no-dev
CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**前端 Dockerfile**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY frontend/ .
RUN pnpm install && pnpm build
CMD ["pnpm", "start"]
```

**Docker Compose**

```yaml
version: "3.8"
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - backend/.env
    volumes:
      - backend-data:/app/data
      - backend-uploads:/app/uploads
      - backend-reports:/app/reports

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000

volumes:
  backend-data:
  backend-uploads:
  backend-reports:
```

### 环境变量生产配置示例

```env
APP_ENV=production
APP_TOKEN=your-secure-token-here
OPENAI_API_KEY=sk-your-key
OPENAI_API_BASE=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
CORS_ORIGINS=https://your-domain.com
```

---

## 使用示例

### 联网搜索

```
用户: 搜一下今天的科技新闻
AI: [调用 web_search] → [汇总搜索结果] → [自然语言回复]
```

### 数据分析

```
用户: 帮我分析一下销售数据的趋势
AI: [自动探索数据库] → [执行 SQL 查询] → [生成趋势图表] → [文字分析结论]
```

### 文件分析

```
用户: [上传 sales.csv] 分析这个文件的数据
AI: [注册为 DuckDB 表] → [探索数据结构] → [执行分析查询] → [生成可视化]
```

### 报告生成

```
用户: 把刚才的分析整理成报告
AI: [复用已有分析结果] → [生成 Markdown 报告] → [保存为文件]
```

### 通知推送

```
用户: 把报告发到飞书群
AI: [读取报告内容] → [构建飞书卡片] → [通过 Webhook 推送]
```

---

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request
