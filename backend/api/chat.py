"""SSE 流式对话端点"""
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents import Runner
from core.agent import create_agent_for_name, AGENT_DISPLAY_NAMES
from core.llm import create_llm_model
from core.database import reset_current_db_url, set_current_db_url
from core.errors import safe_error_payload
from core.router import classify_intent

router = APIRouter()

# Case-insensitive lookup for agent display names
_AGENT_DISPLAY_MAP = {k.lower(): v for k, v in AGENT_DISPLAY_NAMES.items()}


class ChatMessage(BaseModel):
    role: str
    content: str
    reasoning: str | None = None
    toolCalls: list[dict] | None = None


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] | None = None
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    database_url: str | None = None
    instructions: str | None = None
    mode: str | None = "prod"  # "dev" or "prod"


@router.post("/api/chat")
async def chat(req: ChatRequest, request: Request):
    """SSE 流式对话：前端发送消息，后端流式返回 Agent 事件"""
    llm_model = create_llm_model(
        api_key=req.api_key,
        base_url=req.base_url,
        model_name=req.model,
    )
    route = classify_intent(req.message)
    agent = create_agent_for_name(route.agent_name, model=llm_model)
    if req.instructions:
        agent.instructions = req.instructions

    def build_input_items(history: list[ChatMessage], new_message: str) -> list[dict]:
        """将前端消息历史转换为 SDK Responses API input item 格式。

        关键：对于 DeepSeek/Mimo 等 reasoning 模型，必须在 assistant 消息前插入
        reasoning item，否则 API 会返回 400 "reasoning_content must be passed back"。

        使用 EasyInputMessage 格式 {"role": ..., "content": ...}（两键），
        不加 "type": "message"，避免 SDK Converter 误判为 ResponseOutputMessage。
        """
        items: list[dict] = []

        for msg in history:
            if msg.role == "user":
                items.append({"role": "user", "content": msg.content})
            elif msg.role == "assistant":
                if msg.content and msg.content.strip():
                    # 如果有 reasoning 内容，先插入 reasoning item
                    # SDK 的 Converter 会将其转为 reasoning_content 字段
                    if msg.reasoning and msg.reasoning.strip():
                        items.append({
                            "id": "__fake_id__",
                            "type": "reasoning",
                            "summary": [{"text": msg.reasoning, "type": "summary_text"}],
                            "provider_data": {},
                        })
                    items.append({"role": "assistant", "content": msg.content})
            elif msg.role == "system":
                items.append({"role": "system", "content": msg.content})

        # 当前用户消息
        items.append({"role": "user", "content": new_message})
        return items

    def sse(event_type: str, **kwargs) -> str:
        data = {"type": event_type, **kwargs}
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    is_dev = req.mode == "dev"

    async def event_stream():
        db_token = set_current_db_url(req.database_url) if req.database_url else None
        try:
            yield sse("agent_status", agent=route.agent_name, display_name=route.display_name, status="running")

            if req.history:
                input_items = build_input_items(req.history, req.message)
                result = Runner.run_streamed(agent, input_items)
            else:
                result = Runner.run_streamed(agent, req.message)

            # ── Prod 模式文本过滤 ──
            # 策略：只输出非 Orchestrator Agent 的文本，Orchestrator 的文本全部丢弃。
            current_agent_name = route.agent_name

            async for event in result.stream_events():
                # 原始响应事件
                if event.type == "raw_response_event":
                    dtype = getattr(event.data, "type", "")

                    if dtype == "response.output_text.delta":
                        delta = event.data.delta
                        if is_dev:
                            yield sse("text_delta", content=delta)
                        else:
                            # 只有 specialist agent 的文本才输出
                            yield sse("text_delta", content=delta)

                    elif dtype in ("response.reasoning_summary_text.delta", "response.reasoning_text.delta"):
                        if is_dev:
                            yield sse("reasoning_delta", content=event.data.delta)

                # Agent 切换事件
                elif event.type == "agent_updated_stream_event":
                    new_name = getattr(event.new_agent, "name", "unknown")
                    current_agent_name = new_name
                    if is_dev:
                        display_name = AGENT_DISPLAY_NAMES.get(new_name, new_name)
                        yield sse("agent_change", agent=new_name, display_name=display_name)

                # 运行项事件
                elif event.type == "run_item_stream_event":
                    if event.item.type == "handoff_call_item":
                        if is_dev:
                            raw = event.item.raw_item
                            target = getattr(raw, "name", "").replace("transfer_to_", "")
                            target_display = _AGENT_DISPLAY_MAP.get(target.lower(), target)
                            yield sse("handoff", target=target, target_display=target_display)

                    elif event.item.type == "tool_call_item":
                        if is_dev:
                            raw = event.item.raw_item
                            yield sse("tool_call",
                                      tool=getattr(raw, "name", "unknown"),
                                      arguments=getattr(raw, "arguments", ""))

                    elif event.item.type == "tool_call_output_item":
                        output = str(getattr(event.item, "output", ""))
                        call_id = getattr(event.item.raw_item, "call_id", "")
                        if "[ECHARTS_CHART]" in output:
                            chart_json = output.split("[ECHARTS_CHART]")[1].strip()
                            yield sse("chart", content=chart_json)
                        elif is_dev:
                            yield sse("tool_result", content=output[:3000], call_id=call_id)

            yield sse("done")

        except Exception as e:
            import logging, traceback
            logging.getLogger("chat").error("CHAT ERROR: %s\n%s", e, traceback.format_exc())
            yield f"data: {json.dumps(safe_error_payload(e), ensure_ascii=False)}\n\n"
        finally:
            if db_token is not None:
                reset_current_db_url(db_token)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
