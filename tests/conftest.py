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


def make_fake_client(content):
    """构造假 DeepSeek 客户端：create() 返回固定 content，不发真实网络请求。"""

    msg = type("Msg", (), {"content": content})()
    resp = type(
        "Resp",
        (),
        {"choices": [type("Choice", (), {"message": msg})()]},
    )()

    completions = type("Completions", (), {})()
    completions.create = lambda **kwargs: resp

    client = type("Client", (), {})()
    client.chat = type("Chat", (), {})()
    client.chat.completions = completions

    return client


@pytest.fixture()
def make_client(monkeypatch):
    """工厂夹具。

    用法：
        c = make_client()                       # 默认假 AI 返回 {"reply": "ok"}
        c = make_client(ai_content="<内容>")     # 指定 AI 返回内容
        c = make_client(env={"AI_RATE_LIMIT": "3/second"})
    每次调用都重新加载 main：限流计数归零、环境变量即时生效。
    """

    def _make(ai_content='{"reply": "ok"}', env=None):

        if env:
            for key, value in env.items():
                monkeypatch.setenv(key, value)

        importlib.reload(main)
        monkeypatch.setattr(
            main, "get_ai_client", lambda: make_fake_client(ai_content)
        )

        return TestClient(main.app)

    yield _make
