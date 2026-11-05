"""限流测试：正常请求、超限 429、时间窗口后恢复。全程 mock AI，零费用。"""

import time


def test_ai_normal_then_over_limit_then_recovery(make_client):

    c = make_client(env={"AI_RATE_LIMIT": "3/second"})

    body = {"message": "hi"}

    codes = [
        c.post("/api/chat", json=body).status_code
        for _ in range(4)
    ]

    assert codes == [200, 200, 200, 429], f"实际状态码序列: {codes}"

    # 等待限流时间窗口过去，验证限制自动恢复
    time.sleep(1.2)

    assert c.post("/api/chat", json=body).status_code == 200


def test_upload_rate_limit(make_client):

    c = make_client()

    files = {"file": ("a.txt", b"x", "text/plain")}

    codes = [
        c.post("/api/upload", files=files).status_code
        for _ in range(21)
    ]

    assert codes[:20] == [400] * 20, f"前20次应被格式拦截(400): {codes}"
    assert codes[20] == 429, "第21次应触发上传限流(429)"
