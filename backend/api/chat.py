"""SSE 流式对话端点"""
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents import Runner
from core.agent import create_agent
from core.llm import create_llm_model

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    instructions: str | None = None


@router.post("/api/chat")
async def chat(req: ChatRequest, request: Request):
    """SSE 流式对话：前端发送消息，后端流式返回 Agent 事件"""
    llm_model = create_llm_model(
        api_key=req.api_key,
        base_url=req.base_url,
        model_name=req.model,
    )
    agent = create_agent(model=llm_model, instructions=req.instructions)

    async def event_stream():
        try:
            result = Runner.run_streamed(agent, req.message)
            async for event in result.stream_events():
                # 文本增量
                if event.type == "raw_response_event" and hasattr(event.data, "delta"):
                    yield f"data: {json.dumps({'type': 'text_delta', 'content': event.data.delta}, ensure_ascii=False)}\n\n"

                # 工具调用开始
                elif event.type == "run_item_streamed" and hasattr(event.item, "type"):
                    if event.item.type == "tool_call_item":
                        tool_name = getattr(event.item, "raw_item", {})
                        name = getattr(tool_name, "name", "unknown") if hasattr(tool_name, "name") else "unknown"
                        yield f"data: {json.dumps({'type': 'tool_call', 'tool': name}, ensure_ascii=False)}\n\n"

                    # 工具返回结果
                    elif event.item.type == "tool_call_output_item":
                        output = str(getattr(event.item, "output", ""))
                        # 检测图表标记
                        if "[ECHARTS_CHART]" in output:
                            chart_json = output.split("[ECHARTS_CHART]")[1].strip()
                            yield f"data: {json.dumps({'type': 'chart', 'content': chart_json}, ensure_ascii=False)}\n\n"
                        else:
                            yield f"data: {json.dumps({'type': 'tool_result', 'content': output[:2000]}, ensure_ascii=False)}\n\n"

            # 最终完成
            final_output = result.final_output if hasattr(result, "final_output") else ""
            if final_output:
                yield f"data: {json.dumps({'type': 'text_delta', 'content': final_output}, ensure_ascii=False)}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
