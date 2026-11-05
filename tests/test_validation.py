"""请求参数校验边界测试。校验失败发生在限流器和 AI 调用之前，零费用。"""


def test_chat_message_too_long(make_client):

    c = make_client()
    r = c.post("/api/chat", json={"message": "a" * 4001})

    assert r.status_code == 400
    assert r.json()["detail"] == "请求参数不合法，请检查后重试。"


def test_chat_empty_message_rejected(make_client):

    c = make_client()
    r = c.post("/api/chat", json={"message": ""})

    assert r.status_code == 400


def test_chat_history_too_many(make_client):

    c = make_client()
    history = [{"role": "user", "content": "hi"}] * 51
    r = c.post("/api/chat", json={"message": "hi", "history": history})

    assert r.status_code == 400


def test_chat_history_item_content_too_long(make_client):

    c = make_client()
    history = [{"role": "user", "content": "x" * 4001}]
    r = c.post("/api/chat", json={"message": "hi", "history": history})

    assert r.status_code == 400


def test_chat_document_text_too_long(make_client):

    c = make_client()
    r = c.post(
        "/api/chat",
        json={"message": "hi", "document_text": "字" * 30001},
    )

    assert r.status_code == 400


def test_chat_valid_at_boundaries(make_client):

    c = make_client()
    history = [{"role": "user", "content": "x" * 4000}] * 50

    r = c.post(
        "/api/chat",
        json={
            "message": "a" * 4000,
            "history": history,
            "document_text": "字" * 30000,
        },
    )

    assert r.status_code == 200


def test_quiz_count_out_of_range(make_client):

    c = make_client()
    r = c.post("/api/quiz", json={"document_text": "内容", "count": 11})

    assert r.status_code == 400


def test_quiz_document_too_long(make_client):

    c = make_client()
    r = c.post("/api/quiz", json={"document_text": "字" * 30001})

    assert r.status_code == 400


def test_diagnose_too_many_items(make_client):

    c = make_client()

    item = {
        "question": "1+1=?",
        "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
        "correct_answer": "A",
        "user_answer": "B",
    }

    r = c.post(
        "/api/diagnose",
        json={"wrong_answers": [item] * 51},
    )

    assert r.status_code == 400


def test_diagnose_options_too_large(make_client):

    c = make_client()

    item = {
        "question": "q",
        "options": {"A": "x" * 3000},
        "correct_answer": "A",
        "user_answer": "B",
    }

    r = c.post("/api/diagnose", json={"wrong_answers": [item]})

    assert r.status_code == 400


def test_study_plan_goal_too_long(make_client):

    c = make_client()
    r = c.post("/api/study-plan", json={"goal": "g" * 201})

    assert r.status_code == 400


def test_study_plan_records_too_many(make_client):

    c = make_client()
    records = [{"knowledge_point": "p", "is_correct": True}] * 1001
    r = c.post(
        "/api/study-plan",
        json={"records": records, "wrongbook": [{"a": 1}] * 501},
    )

    assert r.status_code == 400


def test_stats_records_too_many(make_client):

    c = make_client()
    records = [{"knowledge_point": "p", "is_correct": True}] * 1001
    r = c.post("/api/knowledge-stats", json={"records": records})

    assert r.status_code == 400


def test_stats_valid(make_client):

    c = make_client()
    records = [
        {
            "knowledge_point": "变量",
            "is_correct": True,
        }
    ] * 3

    r = c.post("/api/knowledge-stats", json={"records": records})

    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["knowledge_points"][0]["mastery"] == 100


def test_request_body_too_large(make_client):

    c = make_client()
    r = c.post(
        "/api/knowledge-stats",
        json={"records": [{"a": "x" * (13 * 1024 * 1024)}]},
    )

    assert r.status_code == 413
