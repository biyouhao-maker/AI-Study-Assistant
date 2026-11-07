"""BYOK（用户自带密钥）测试：AI 接口必须携带用户自己的密钥头，服务器密钥不再使用。

测试密钥均为程序化构造的假值，不含任何真实凭据。
"""

import main
from fastapi.testclient import TestClient

# 程序化构造假密钥，避免出现字面量
GOOD_KEY = "sk-" + "b" * 21
FULL_LINE_KEY = "DEEPSEEK_API_KEY=" + GOOD_KEY
BAD_KEY = "hello-world-123"
PASSTHROUGH_KEY = "sk-" + "u" * 18


def test_ai_endpoint_without_key_returns_401(make_client):

    c = make_client()
    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-User-API-Key": ""},
    )

    assert r.status_code == 401
    assert "API 设置" in r.json()["detail"]


def test_invalid_key_format_rejected(make_client):

    c = make_client()
    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-User-API-Key": BAD_KEY},
    )

    assert r.status_code == 400
    assert "格式不正确" in r.json()["detail"]


def test_full_line_key_auto_extracted(make_client):

    c = make_client()
    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-User-API-Key": FULL_LINE_KEY},
    )

    assert r.status_code == 200


def test_user_key_passthrough_to_ai_client(make_client, monkeypatch):

    c = make_client()

    captured = {}

    def fake_openai(**kwargs):
        captured["key"] = kwargs.get("api_key")

        from conftest import make_fake_client

        return make_fake_client(
            api_key=kwargs.get("api_key"),
            content='{"reply": "ok"}',
        )

    monkeypatch.setattr(main, "OpenAI", fake_openai)

    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-User-API-Key": PASSTHROUGH_KEY},
    )

    assert r.status_code == 200
    assert captured["key"] == PASSTHROUGH_KEY


def test_normalize_user_api_key():

    assert main.normalize_user_api_key(GOOD_KEY) == GOOD_KEY
    assert main.normalize_user_api_key(FULL_LINE_KEY) == GOOD_KEY
    assert main.normalize_user_api_key("  " + GOOD_KEY + "  ") == GOOD_KEY
    assert main.normalize_user_api_key("sk-short") is None
    assert main.normalize_user_api_key("") is None
    assert main.normalize_user_api_key(None) is None
    assert main.normalize_user_api_key("abcdef1234567890abcdef") is None
