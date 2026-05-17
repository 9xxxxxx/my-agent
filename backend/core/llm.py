"""LLM 客户端工厂：支持前端动态配置 provider"""
from openai import AsyncOpenAI
from agents import Model, OpenAIChatCompletionsModel
from core.config import settings


def create_llm_model(
    api_key: str | None = None,
    base_url: str | None = None,
    model_name: str | None = None,
) -> Model:
    """创建 LLM 模型实例，支持前端传入覆盖默认配置"""
    key = api_key or settings.OPENAI_API_KEY
    url = base_url or settings.OPENAI_API_BASE
    name = model_name or settings.OPENAI_MODEL

    client = AsyncOpenAI(api_key=key, base_url=url)

    # 始终回传 reasoning_content，兼容 DeepSeek 等 reasoning 模型
    return OpenAIChatCompletionsModel(
        model=name,
        openai_client=client,
        should_replay_reasoning_content=lambda ctx: True,
    )
