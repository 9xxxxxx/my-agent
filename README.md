# Data Analyst Agent

AI 驱动的智能数据分析助手。用自然语言提问，自动完成数据库查询、文件分析、可视化图表、报告撰写及飞书/邮件推送。

## 功能特性

### 智能对话
- 自然语言提问，自动路由到专业 Agent 处理
- SSE 实时流式响应，打字机效果
- 多轮对话记忆，上下文连贯
- 停止生成、重试、编辑重发

### 数据分析
- 连接 PostgreSQL / MySQL / SQLite 数据库
- 上传 CSV / Excel / JSON / Parquet 文件
- 自动探索表结构，生成并执行 SQL
- 跨轮记忆，不重复查询

### 可视化
- 14 种图表类型：柱状图、折线图、饼图、散点图、热力图、雷达图等
- 5 种配色方案，悬停切换
- ECharts 渲染，交互式体验

### 报告与推送
- 自动生成 Markdown 分析报告
- 飞书群机器人推送（交互式卡片 + 图表）
- 邮件 SMTP 发送（HTML 格式）

### 多 Agent 架构
- **通用助手** — 日常对话、知识问答、文本处理
- **数据分析助手** — SQL 查询、文件分析、图表生成
- **报告撰写助手** — 报告生成、导出、通知分发
- 确定性关键词路由，用户无感知切换

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Next.js 16 + Tailwind CSS v4 + shadcn/ui |
| 图表 | ECharts + echarts-for-react |
| 状态管理 | Zustand |
| 后端 | Python 3.13 + FastAPI + Uvicorn |
| AI 引擎 | OpenAI Agents SDK + OpenAI 兼容 API |
| 数据库 | SQLAlchemy (PostgreSQL / MySQL / SQLite) |
| 文件引擎 | DuckDB 内存数据库 |
| 推送 | 飞书 Webhook + SMTP 邮件 |

## 快速开始

### 环境要求

- Node.js >= 18
- Python >= 3.13
- pnpm (前端包管理)
- uv (后端包管理)

### 1. 克隆项目

```bash
git clone https://github.com/your-username/my-agent.git
cd my-agent
```

### 2. 启动后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 LLM API Key

uv sync
uv run uvicorn app:app --reload
```

后端运行在 http://localhost:8000

### 3. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

前端运行在 http://localhost:3000

### 4. 开始使用

打开浏览器访问 http://localhost:3000，输入问题即可开始对话。

## 环境变量

### 后端 (`backend/.env`)

| 变量 | 说明 | 默认值 |
|---|---|---|
| `OPENAI_API_KEY` | LLM API Key (兼容 DeepSeek/GPT/Qwen/MiMo) | 必填 |
| `OPENAI_API_BASE` | API Base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 默认模型名称 | `deepseek-chat` |
| `AGENT_DATABASE_URL` | 数据库连接串 | 空 |
| `FEISHU_WEBHOOK_URL` | 飞书群 Webhook URL | 空 |
| `FEISHU_APP_ID` | 飞书应用 ID（可选，用于上传图片） | 空 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | 空 |
| `SMTP_SERVER` | SMTP 服务器 | 空 |
| `SMTP_PORT` | SMTP 端口 | `465` |
| `SMTP_USERNAME` | SMTP 用户名 | 空 |
| `SMTP_PASSWORD` | SMTP 密码 | 空 |
| `APP_TOKEN` | API 认证 Token（空=无认证） | 空 |
| `CORS_ORIGINS` | 允许的前端源，逗号分隔 | `http://localhost:3000` |

### 前端 (`frontend/.env.local`)

| 变量 | 说明 | 默认值 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:8000` |
| `NEXT_PUBLIC_APP_TOKEN` | API 认证 Token | 空 |

## 项目结构

```
my-agent/
├── backend/
│   ├── app.py                    # FastAPI 入口
│   ├── api/
│   │   ├── chat.py               # SSE 流式对话端点
│   │   ├── upload.py             # 文件上传
│   │   ├── export.py             # 报告导出
│   │   ├── db.py                 # 数据库连接测试
│   │   └── storage.py            # 对话记录持久化
│   ├── core/
│   │   ├── agent.py              # 多 Agent 系统
│   │   ├── router.py             # 确定性意图路由
│   │   ├── llm.py                # LLM 客户端工厂
│   │   ├── database.py           # SQLAlchemy 引擎
│   │   ├── db_adapter.py         # 多数据库适配层
│   │   ├── file_loader.py        # 文件加载 + DuckDB
│   │   ├── config.py             # 环境变量配置
│   │   ├── errors.py             # 错误处理
│   │   ├── models.py             # ORM 模型
│   │   └── path_safety.py        # 路径安全
│   ├── tools/
│   │   ├── db_tools.py           # SQL 查询工具
│   │   ├── file_tools.py         # 文件查询工具
│   │   ├── chart_tools.py        # 图表生成工具
│   │   ├── report_tools.py       # 报告生成工具
│   │   └── notification_tools.py # 飞书/邮件推送
│   ├── tests/                    # 单元测试
│   ├── pyproject.toml
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css       # 设计系统
│   │   │   ├── layout.tsx        # 根布局
│   │   │   └── page.tsx          # 入口页面
│   │   ├── components/
│   │   │   ├── app/              # 应用外壳
│   │   │   ├── chat/             # 对话组件
│   │   │   ├── chart/            # ECharts 图表
│   │   │   ├── settings/         # 设置面板
│   │   │   └── ui/               # shadcn/ui 组件
│   │   ├── stores/
│   │   │   ├── chat.ts           # 对话状态
│   │   │   └── connection.ts     # 连接配置状态
│   │   └── lib/
│   │       ├── api.ts            # API 客户端
│   │       └── messages.ts       # 消息模型
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

## API 接口

### 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat` | SSE 流式对话 |

### 文件

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/upload` | 上传数据文件 |
| GET | `/api/upload/tables` | 获取已上传文件列表 |

### 报告

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/export/report/{filename}` | 下载报告 |

### 数据库

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/db/test` | 测试数据库连接 |

### 对话记录

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/conversations` | 获取对话列表 |
| GET | `/api/conversations/{id}` | 获取对话详情 |
| POST | `/api/conversations` | 创建对话 |
| PUT | `/api/conversations/{id}` | 更新对话 |
| DELETE | `/api/conversations/{id}` | 删除对话 |

### 连接配置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/api/connections/llm` | LLM 配置 CRUD |
| PUT | `/api/connections/llm/{id}/activate` | 激活 LLM 配置 |
| GET/POST | `/api/connections/db` | 数据库配置 CRUD |
| PUT | `/api/connections/db/{id}/activate` | 激活数据库配置 |

### SSE 事件类型

| 事件 | 字段 | 说明 |
|---|---|---|
| `agent_status` | agent, display_name | Agent 路由通知 |
| `text_delta` | content | 流式文本 |
| `reasoning_delta` | content | 推理过程（仅 dev 模式） |
| `tool_call` | tool, arguments | 工具调用（仅 dev 模式） |
| `tool_result` | content, call_id | 工具结果（仅 dev 模式） |
| `chart` | content | ECharts 图表 JSON |
| `error` | code, message | 错误信息 |
| `done` | - | 流结束 |

## 安全特性

- Bearer Token 认证中间件
- CORS 源配置
- 路径遍历防护（文件名清洗 + 路径校验）
- API Key / 密码脱敏
- SQL 注入防护（白名单验证：仅允许 SELECT/WITH/EXPLAIN/DESCRIBE，阻止注释绕过、多语句、DuckDB 危险命令）
- 报告生成路径穿越防护（标题清洗 + 路径二次校验）
- 上传文件大小限制（500MB）
- 线程安全的数据库引擎缓存和 DuckDB 连接
- SSE 流式客户端断连检测
- LLM 连接超时与重试
- 飞书/SMTP 请求超时（15s）
- 邮箱格式校验 + 主题注入防护
- 错误消息脱敏（不泄露内部异常详情）
- 用户友好的错误信息

## 测试

```bash
# 后端测试（28 个用例）
cd backend
uv run pytest tests -q

# 前端测试
cd frontend
pnpm test

# 前端构建检查
cd frontend
pnpm lint
pnpm build
```

## 部署

### 生产环境检查清单

1. 配置 `CORS_ORIGINS` 为真实前端域名
2. 设置 `APP_TOKEN` 启用 API 认证
3. 不要公开 LLM API Key 和数据库密码
4. 上传和报告下载仅允许访问指定目录
5. 配置飞书 Webhook 和 SMTP（如需推送功能）

### Docker (可选)

```dockerfile
# 后端
FROM python:3.13-slim
WORKDIR /app
COPY backend/ .
RUN pip install uv && uv sync --no-dev
CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

# 前端
FROM node:18-alpine
WORKDIR /app
COPY frontend/ .
RUN pnpm install && pnpm build
CMD ["pnpm", "start"]
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
