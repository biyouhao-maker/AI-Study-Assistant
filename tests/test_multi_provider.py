"""多厂商 BYOK 测试：厂商映射、密钥格式适配、JSON 模式降级、围栏解析。

测试密钥均为程序化构造的假值，不含任何真实凭据。
"""

import main

# 程序化构造假密钥（避免字面量触发安全扫描误报）
KEYS = {
    "deepseek": "sk-" + "a" * 32,
    "moonshot": "sk-" + "m" * 32,
    "qwen": "sk-" + "q" * 32,
    "siliconflow": "sk-" + "s" * 32,
    "openrouter": "sk-or-" + "o" * 28,
}

ZHIPU_KEY = "abcd1234efgh5678.ijkl9012mnop"
ZHIPU_FULL_LINE = "ZHIPUAI_API_KEY=" + ZHIPU_KEY

DIAGNOSE_BODY = {
    "wrong_answers": [
        {
            "question": "1+1=?",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "correct_answer": "A",
            "user_answer": "B",
        }
    ]
}

DIAGNOSE_OK = (
    '{"diagnoses": [{"question_index": 0, "knowledge_point": "算术",'
    ' "category": "基础", "difficulty": "易", "error_reason": "粗心",'
    ' "suggestion": "检查计算", "confidence": 0.9}]}'
)


def install_fake(monkeypatch, content, fail_json_mode=False):
    """替换 main.OpenAI：记录 base_url/api_key，create 记录 model 与是否带 JSON 模式。"""

    capture = {}

    def fake_openai(**kwargs):

        capture["base_url"] = kwargs.get("base_url")
        capture["api_key"] = kwargs.get("api_key")

        def create(**create_kwargs):

            capture["model"] = create_kwargs.get("model")
            capture["had_json_mode"] = "response_format" in create_kwargs

            if fail_json_mode and "response_format" in create_kwargs:
                error = Exception("response_format unsupported")
                error.status_code = 400
                raise error

            msg = type("Msg", (), {"content": content})()

            return type(
                "Resp",
                (),
                {"choices": [type("Choice", (), {"message": msg})()]},
            )()

        client = type("Client", (), {})()
        client.chat = type("Chat", (), {})()
        completions = type("Completions", (), {})()
        completions.create = create
        client.chat.completions = completions

        return client

    monkeypatch.setattr(main, "OpenAI", fake_openai)

    return capture


def test_all_six_providers_mapped(make_client, monkeypatch):

    c = make_client()
    capture = install_fake(monkeypatch, '{"reply": "ok"}')

    for provider, config in main.PROVIDER_REGISTRY.items():

        capture.clear()

        key = ZHIPU_KEY if provider == "zhipu" else KEYS[provider]

        r = c.post(
            "/api/chat",
            json={"message": "hi"},
            headers={"X-AI-Provider": provider, "X-User-API-Key": key},
        )

        assert r.status_code == 200, f"{provider}: {r.status_code} {r.text[:80]}"
        assert capture["base_url"] == config["base_url"], provider
        assert capture["model"] == config["model"], provider


def test_unknown_provider_rejected(make_client):

    c = make_client()
    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={
            "X-AI-Provider": "not-a-provider",
            "X-User-API-Key": KEYS["deepseek"],
        },
    )

    assert r.status_code == 400
    assert "暂不支持" in r.json()["detail"]


def test_provider_header_case_insensitive(make_client, monkeypatch):

    c = make_client()
    capture = install_fake(monkeypatch, '{"reply": "ok"}')

    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-AI-Provider": "ZhiPu", "X-User-API-Key": ZHIPU_KEY},
    )

    assert r.status_code == 200
    assert capture["base_url"] == main.PROVIDER_REGISTRY["zhipu"]["base_url"]


def test_zhipu_invalid_key_rejected(make_client):

    c = make_client()
    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-AI-Provider": "zhipu", "X-User-API-Key": "nodotkey123"},
    )

    assert r.status_code == 400


def test_zhipu_full_line_key_extracted(make_client, monkeypatch):

    c = make_client()
    capture = install_fake(monkeypatch, '{"reply": "ok"}')

    r = c.post(
        "/api/chat",
        json={"message": "hi"},
        headers={"X-AI-Provider": "zhipu", "X-User-API-Key": ZHIPU_FULL_LINE},
    )

    assert r.status_code == 200
    assert capture["api_key"] == ZHIPU_KEY


def test_json_mode_fallback_on_400(make_client, monkeypatch):

    c = make_client()
    capture = install_fake(monkeypatch, DIAGNOSE_OK, fail_json_mode=True)

    r = c.post(
        "/api/diagnose",
        json=DIAGNOSE_BODY,
        headers={"X-AI-Provider": "qwen", "X-User-API-Key": KEYS["qwen"]},
    )

    assert r.status_code == 200
    assert capture["had_json_mode"] is False  # 第二次调用已降级
    assert r.json()["total"] == 1


def test_markdown_fence_json_parsed(make_client, monkeypatch):

    c = make_client()
    fenced = "```json\n" + DIAGNOSE_OK + "\n```"
    install_fake(monkeypatch, fenced)

    r = c.post(
        "/api/diagnose",
        json=DIAGNOSE_BODY,
        headers={"X-AI-Provider": "moonshot", "X-User-API-Key": KEYS["moonshot"]},
    )

    assert r.status_code == 200
    assert r.json()["total"] == 1


def test_normalize_zhipu_rules():

    assert main.normalize_user_api_key(ZHIPU_KEY, "zhipu") == ZHIPU_KEY
    assert (
        main.normalize_user_api_key(ZHIPU_FULL_LINE, "zhipu") == ZHIPU_KEY
    )
    assert main.normalize_user_api_key("nodotkey123", "zhipu") is None
    assert main.normalize_user_api_key("short.key", "zhipu") is None
    # 智谱格式不能通过 deepseek 校验（无 sk- 前缀）
    assert main.normalize_user_api_key(ZHIPU_KEY, "deepseek") is None
