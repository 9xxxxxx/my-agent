from api.storage import redact_config


def test_redacts_llm_api_key():
    assert redact_config({"apiKey": "sk-secret", "model": "deepseek-chat"}) == {
        "apiKey": "",
        "model": "deepseek-chat",
        "hasApiKey": True,
    }


def test_redacts_database_password():
    assert redact_config({"type": "postgresql", "password": "secret", "host": "localhost"}) == {
        "type": "postgresql",
        "password": "",
        "host": "localhost",
        "hasPassword": True,
    }
