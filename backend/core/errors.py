"""User-safe error payloads for streaming chat responses."""


def safe_error_payload(error: Exception) -> dict:
    raw = str(error).lower()
    if "401" in raw or "authentication" in raw or "api key" in raw:
        return {
            "type": "error",
            "code": "MODEL_AUTH_FAILED",
            "message": "模型认证失败，请检查当前模型配置",
            "recoverable": True,
        }
    if "database" in raw or "数据库" in raw:
        return {
            "type": "error",
            "code": "DATABASE_ERROR",
            "message": "数据源连接失败，请检查当前数据库配置",
            "recoverable": True,
        }
    return {
        "type": "error",
        "code": "CHAT_RUN_FAILED",
        "message": "本次生成失败，请稍后重试",
        "recoverable": True,
    }
