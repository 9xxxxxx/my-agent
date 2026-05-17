"""环境变量配置"""
import os
from dotenv import load_dotenv

# In production, don't override env vars set by container orchestrator
_is_production = os.getenv("APP_ENV", "development") == "production"
load_dotenv(override=not _is_production)


class Settings:
    DATABASE_URL: str = os.getenv("AGENT_DATABASE_URL", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_API_BASE: str = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "deepseek-chat")
    FEISHU_WEBHOOK_URL: str = os.getenv("FEISHU_WEBHOOK_URL", "")
    FEISHU_APP_ID: str = os.getenv("FEISHU_APP_ID", "")
    FEISHU_APP_SECRET: str = os.getenv("FEISHU_APP_SECRET", "")
    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465") or "465") if os.getenv("SMTP_PORT", "465").strip().isdigit() else 465
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_TOKEN: str = os.getenv("APP_TOKEN", "")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]


settings = Settings()
