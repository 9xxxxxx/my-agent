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
  - **优化方案 (自适应弹性打字机)**：由于直接追加在网络打包传输或后端缓存一并返回时会导致文字“突然吐出一大堆”，我们最终引入了“自适应弹性打字机 (Adaptive Elastic Typewriter)”方案。
    - **Reasoning 直出**：对 `reasoning_delta` (思考过程) 设定为无延迟一帧全部合并消费渲染，不进打字队列。
    - **Text 弹性打字机**：对 `text_delta` (正文内容) 建立自适应打字缓冲区。根据当前积压的字符字数，自适应计算当前帧的打字流速（`charsThisFrame = Math.max(1, Math.min(len, Math.ceil(len / 6)))`）。
    - **时序与顺序一致**：严格阻断被文字队列夹在中间的非文本事件（例如 `tool_call`, `handoff` 等），确保前置文本全部以打字机播完后才触发事件渲染，保证流式对话时序的一致性。
    - 如此设计完美平衡了在低生成速率或顺畅网络下的“逐字吐字感”，以及在网络卡顿或后端高频攒批输出时的“大包无延迟跟进”，极具健壮性。
