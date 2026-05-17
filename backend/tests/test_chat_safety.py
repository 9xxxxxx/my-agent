from core.errors import safe_error_payload


def test_maps_provider_auth_error_to_safe_message():
    payload = safe_error_payload(Exception("Error code: 401 - Authentication Fails, Your api key is invalid"))
    assert payload["code"] == "MODEL_AUTH_FAILED"
    assert payload["message"] == "模型认证失败，请检查当前模型配置"
    assert "api key" not in payload["message"].lower()
