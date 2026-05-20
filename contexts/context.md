# 项目核心上下文 (contexts/context.md)

## 1. 项目概述
本项是一个 AI 驱动的智能数据分析助手 (Data Analyst Agent)。用户可以使用自然语言进行提问，系统会自动完成数据库查询、文件分析、可视化图表生成、分析报告撰写以及飞书/邮件推送。

## 2. 技术栈架构
- **前端**：React 19 + Next.js (使用 App Router) + Tailwind CSS + ECharts 6 + Zustand 5
- **后端**：Python 3.13 + FastAPI + Uvicorn + OpenAI Agents SDK (openai-agents >= 0.1.0)
- **数据库/分析引擎**：SQLite (应用内部存储) + DuckDB (用于对上传文件进行虚拟表查询与分析)
- **包管理工具**：前端使用 `pnpm`，后端使用 `uv`

## 3. 核心功能与模块
- **多 Agent 架构**：
  - `Orchestrator` (智能路由)：通过关键词路由用户意图至具体的专业 Agent
  - `GeneralAssistant` (通用助手)：日常对话、知识问答与 Web 搜索
  - `DataAnalyst` (数据分析助手)：执行数据库查询、对上传的 CSV/Excel 等文件进行 DuckDB 分析并生成 ECharts 可视化图表
  - `ReportWriter` (报告撰写助手)：将分析结果整理并保存为 Markdown 报告，支持通过飞书 Webhook 或邮件 SMTP 推送
- **流式响应 (SSE)**：后端基于 FastAPI `StreamingResponse` 返回 SSE 事件流，包含 `agent_status`、`agent_change`、`text_delta`、`reasoning_delta`、`tool_call`、`tool_result`、`chart`、`done` 等事件。

## 4. 关键决策历史与设计
- **消息结构迁移**：由于引入了 `reasoning` (思考过程) 与 `toolCalls` (工具调用)，消息结构由扁平的 Legacy 格式迁移为了基于 `blocks` 的结构化 BlockMessage 格式 (支持 `markdown`, `chart`, `table`, `tool`, `thinking`, `agent_status` 等不同类型的区块渲染)。
- **错误脱敏机制**：后端对敏感异常进行了过滤，以中文友好错误形式返回前端，并在持久化中对 API Key / 数据库密码进行脱敏。

## 5. 当前开发/优化任务 (2026-05-20)
- **优化重构 Agent 流式回复设计**：
  - **问题分析**：当前前端使用基于 `requestAnimationFrame` 的打字机队列播放机制，强行限制每帧只能消费 `MAX_CHARS_PER_FRAME = 8` 个字符。在 reasoning 模型 (如 DeepSeek-R1, mimo) 输出大量 `reasoning_content` (思考过程) 时，打字机在前端被严重阻塞。思考过程和最终回复串行在一个队列里慢速播放，导致回复一开始严重卡顿、思考中状态迟钝，且在模型完全生成完毕后前端仍在慢慢打字输出，极大地破坏了流式体验。
  - **优化方案 (自适应弹性打字机与三通道解耦)**：为了实现无死角、零延迟的极致流交互，做出了以下两项核心重构与 Bug 修复：
    - **修复空 Assistant 消息过滤 Bug**：原前端 `messages.map` 在正文为空 (`!msg.content`) 且 loading 时会直接跳过渲染该消息。这导致在大模型流式输出 Reasoning 思考段落、但尚未输出正文时，助手气泡和思考面板被彻底隐藏（在用户视角看起来“没有任何反应”），直到输出正文时才在一瞬间突然弹出积压的内容。已修复该条件，仅在正文、Reasoning、Blocks 均为空时才隐藏消息。
    - **三通道渲染解耦 (Reasoning / Text / Events)**：将流式处理重构为三个解耦管道。
      - **状态通道 (即时)**：对于 `agent_status`、`agent_change`、`handoff` 等状态控制事件，收到后立刻刷入 UI store，使用户在点击发送后页面能够瞬间感知到路由 Agent 上线。
      - **推理通道 (即时 Reasoning)**：每一帧无条件从缓冲区中取出累积的所有 Reasoning 文本，直接刷入 store 渲染。一旦大模型产生思考，前端便以极限速度秒级流式展现，绝不被正文打字机队列卡死。
      - **正文自适应打字通道 (弹性 Text)**：将正文 delta 填入 `playTextBuffer`，在每一帧中动态根据当前剩余的未播放字数弹性计算打字流速。当网络平顺、字数较少时维持极佳的“逐字吐字感”，当发生网络积压攒批或大段数据到达时自适应极速出字，既平滑又无播放滞后。
    - 如此设计完美消除了流式交互中的一切死寂，实现了思考过程、状态、正文在各自通道上的高响应渲染。
