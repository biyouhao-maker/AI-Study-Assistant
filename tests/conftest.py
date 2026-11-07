"""测试公共夹具：假 AI 客户端 + 可配置的 TestClient 工厂。

所有测试不发起任何真实 DeepSeek 请求，零 API 费用。
"""

import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402

DEFAULT_TEST_KEY = "sk-" + "a" * 32

AI_ENDPOINTS = (
    "/api/chat",
    "/api/quiz",
    "/api/diagnose",
    "/api/study-plan",
)


def make_fake_client(api_key=None, content='{"reply": "ok"}'):
    """构造假 DeepSeek 客户端：记录传入的 api_key，create() 返回固定内容，不发真实网络请求。"""

    client = type("Client", (), {})()
    client._api_key_used = api_key

    msg = type("Msg", (), {"content": content})()
    resp = type(
        "Resp",
        (),
        {"choices": [type("Choice", (), {"message": msg})()]},
    )()

    completions = type("Completions", (), {})()
    completions.create = lambda **kwargs: resp

    client.chat = type("Chat", (), {})()
    client.chat.completions = completions

    return client


class KeyedTestClient(TestClient):
    """自动为 AI 接口注入测试密钥头，模拟前端 BYOK 行为。"""

    def request(self, method, url, **kwargs):

        headers = dict(kwargs.pop("headers", None) or {})

        if (
            any(url.startswith(prefix) for prefix in AI_ENDPOINTS)
            and "X-User-API-Key" not in headers
        ):
            headers["X-User-API-Key"] = DEFAULT_TEST_KEY

        return super().request(method, url, headers=headers, **kwargs)


@pytest.fixture()
def make_client(monkeypatch):
    """工厂夹具。

    用法：
        c = make_client()                       # 默认假 AI 返回 {"reply": "ok"}
        c = make_client(ai_content="<内容>")     # 指定 AI 返回内容
        c = make_client(env={"AI_RATE_LIMIT": "3/second"})
    每次调用都重新加载 main：限流计数归零、环境变量即时生效。
    BYOK：真实 get_ai_client / normalize 逻辑参与运行，OpenAI 类被替换为假客户端。
    """

    def _make(ai_content='{"reply": "ok"}', env=None):

        if env:
            for key, value in env.items():
                monkeypatch.setenv(key, value)

        importlib.reload(main)

        monkeypatch.setattr(
            main,
            "OpenAI",
            lambda **kwargs: make_fake_client(
                api_key=kwargs.get("api_key"),
                content=ai_content,
            ),
        )

        return KeyedTestClient(main.app)

    yield _make
