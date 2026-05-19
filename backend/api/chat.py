"""SSE 流式对话端点"""
import asyncio
import json
import logging
import traceback
import uuid
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from agents import Runner
from core.agent import create_agent_for_name, AGENT_DISPLAY_NAMES
from core.llm import create_llm_model
from core.database import reset_current_db_url, set_current_db_url, get_current_db_url
from core.errors import safe_error_payload
from core.router import classify_intent

logger = logging.getLogger("chat")

router = APIRouter()

# Case-insensitive lookup for agent display names
_AGENT_DISPLAY_MAP = {k.lower(): v for k, v in AGENT_DISPLAY_NAMES.items()}


class ChatMessage(BaseModel):
    role: str
    content: str
    reasoning: str | None = None
    toolCalls: list[dict] | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=100_000)
    history: list[ChatMessage] | None = Field(None, max_length=200)
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    database_url: str | None = None
    instructions: str | None = None
    mode: str | None = "dev"  # deprecated, always emits all events
    thinking_mode: str | None = "thinking"  # "thinking" | "fast"


@router.post("/api/chat")
async def chat(req: ChatRequest, request: Request):
    """SSE 流式对话：前端发送消息，后端流式返回 Agent 事件"""
    llm_model = create_llm_model(
        api_key=req.api_key,
        base_url=req.base_url,
        model_name=req.model,
        thinking_mode=req.thinking_mode or "thinking",
    )
    # Run classify_intent in executor to avoid blocking the event loop
    route = await asyncio.get_event_loop().run_in_executor(None, classify_intent, req.message)
    agent = create_agent_for_name(route.agent_name, model=llm_model)
    if req.instructions:
        agent.instructions = req.instructions

    def build_input_items(history: list[ChatMessage], new_message: str) -> list[dict]:
        """将前端消息历史转换为 SDK Responses API input item 格式。

        对于 DeepSeek/Mimo 等 reasoning 模型，assistant 消息必须带 reasoning_content，
        否则 API 返回 400。有 reasoning 时使用 ResponseOutputMessage 格式，
        确保 SDK Converter 通过 ensure_assistant_message() 注入 reasoning_content。
        无 reasoning 时使用 EasyInputMessage 格式，避免不必要的格式转换。
        """
        items: list[dict] = []

        for msg in history:
            if msg.role == "user":
                items.append({"role": "user", "content": msg.content})
            elif msg.role == "assistant":
                if msg.content and msg.content.strip():
                    # 始终使用 ResponseOutputMessage 格式，确保 SDK 注入 reasoning_content
                    # Mimo/DeepSeek 等 reasoning 模型在 thinking 模式下要求必须有 reasoning_content
                    reasoning_text = (msg.reasoning or "").strip()
                    items.append({
                        "id": f"reasoning_{uuid.uuid4().hex[:12]}",
                        "type": "reasoning",
                        "summary": [{"text": reasoning_text, "type": "summary_text"}],
                        "provider_data": {},
                    })
                    items.append({
                        "id": f"msg_{uuid.uuid4().hex[:12]}",
                        "type": "message",
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": msg.content, "annotations": []}],
                        "status": "completed",
                    })
            elif msg.role == "system":
                items.append({"role": "system", "content": msg.content})

        # 当前用户消息
        items.append({"role": "user", "content": new_message})
        return items

    def sse(event_type: str, **kwargs) -> str:
        data = {"type": event_type, **kwargs}
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def event_stream():
        db_token = set_current_db_url(req.database_url) if req.database_url else None
        try:
            yield sse("agent_status", agent=route.agent_name, display_name=route.display_name, status="running")

            if req.history:
                input_items = build_input_items(req.history, req.message)
                result = Runner.run_streamed(agent, input_items)
            else:
                result = Runner.run_streamed(agent, req.message)

            current_agent_name = route.agent_name

            async for event in result.stream_events():
                # Check for client disconnect
                if await request.is_disconnected():
                    logger.info("Client disconnected, stopping stream")
                    break

                if event.type == "raw_response_event":
                    dtype = getattr(event.data, "type", "")

                    if dtype == "response.output_text.delta":
                        yield sse("text_delta", content=event.data.delta)
                        await asyncio.sleep(0)  # flush chunk to client immediately

                    elif dtype in ("response.reasoning_summary_text.delta", "response.reasoning_text.delta"):
                        if req.thinking_mode != "fast":
                            yield sse("reasoning_delta", content=event.data.delta)
                            await asyncio.sleep(0)  # flush chunk to client immediately

                elif event.type == "agent_updated_stream_event":
                    new_name = getattr(event.new_agent, "name", "unknown")
                    current_agent_name = new_name
                    display_name = AGENT_DISPLAY_NAMES.get(new_name, new_name)
                    yield sse("agent_change", agent=new_name, display_name=display_name)

                elif event.type == "run_item_stream_event":
                    if event.item.type == "handoff_call_item":
                        raw = event.item.raw_item
                        target = getattr(raw, "name", "").replace("transfer_to_", "")
                        target_display = _AGENT_DISPLAY_MAP.get(target.lower(), target)
                        yield sse("handoff", target=target, target_display=target_display)

                    elif event.item.type == "tool_call_item":
                        raw = event.item.raw_item
                        args_str = getattr(raw, "arguments", "")
                        # Inject actual database_url if tool exposes it but LLM left it empty
                        try:
                            args = json.loads(args_str) if args_str else {}
                            if "database_url" in args and not args["database_url"]:
                                actual_url = get_current_db_url()
                                if actual_url:
                                    args["database_url"] = actual_url
                            args_str = json.dumps(args, ensure_ascii=False)
                        except (json.JSONDecodeError, TypeError):
                            pass
                        yield sse("tool_call",
                                  tool=getattr(raw, "name", "unknown"),
                                  arguments=args_str)

                    elif event.item.type == "tool_call_output_item":
                        output = str(getattr(event.item, "output", ""))
                        call_id = getattr(event.item.raw_item, "call_id", "")
                        if "[ECHARTS_CHART]" in output:
                            chart_json = output.split("[ECHARTS_CHART]")[1].strip()
                            yield sse("chart", content=chart_json)
                        else:
                            yield sse("tool_result", content=output[:3000], call_id=call_id)

            yield sse("done")

        except asyncio.TimeoutError:
            logger.warning("Chat stream timed out")
            yield sse("error", code="TIMEOUT", message="请求超时，请稍后重试")
        except Exception as e:
            logger.error("CHAT ERROR: %s\n%s", e, traceback.format_exc())
            yield sse("error", **safe_error_payload(e))
        finally:
            if db_token is not None:
                reset_current_db_url(db_token)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
