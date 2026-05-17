"""User-safe error payloads for streaming chat responses."""
import logging

logger = logging.getLogger(__name__)


def safe_error_payload(error: Exception) -> dict:
    logger.error("Error in chat: %s", error)

    # Check by exception type first (more reliable than string matching)
    error_type = type(error).__name__
    error_str = str(error).lower()

    # Authentication errors
    if error_type in ("AuthenticationError", "PermissionError") or "401" in error_str:
        return {
            "type": "error",
            "code": "MODEL_AUTH_FAILED",
            "message": "模型认证失败，请检查当前模型配置",
            "recoverable": True,
        }

    # Rate limit errors
    if error_type in ("RateLimitError",) or "429" in error_str:
        return {
            "type": "error",
            "code": "RATE_LIMITED",
            "message": "请求过于频繁，请稍后重试",
            "recoverable": True,
        }

    # Database errors
    if "database" in error_str or "数据库" in error_str or "sql" in error_str:
        return {
            "type": "error",
            "code": "DATABASE_ERROR",
            "message": "数据源连接失败，请检查当前数据库配置",
            "recoverable": True,
        }

    # Connection/timeout errors
    if error_type in ("TimeoutError", "ConnectionError") or "timeout" in error_str:
        return {
            "type": "error",
            "code": "TIMEOUT",
            "message": "请求超时，请稍后重试",
            "recoverable": True,
        }

    return {
        "type": "error",
        "code": "CHAT_RUN_FAILED",
        "message": "本次生成失败，请稍后重试",
        "recoverable": True,
    }
