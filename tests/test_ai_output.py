"""AI 输出结果校验测试：用假 AI 客户端返回受控内容，验证后端校验逻辑。零费用。"""

import json


def test_quiz_invalid_json_rejected(make_client):

    c = make_client(ai_content="这不是JSON")
    r = c.post("/api/quiz", json={"document_text": "学习资料内容"})

    assert r.status_code == 502


def test_quiz_question_count_mismatch_rejected(make_client):

    questions = [
        {
            "question": "1+1=?",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "answer": "B",
            "explanation": "因为1+1=2",
            "knowledge_point": "加法",
        }
    ]

    c = make_client(ai_content=json.dumps({"questions": questions}))
    r = c.post("/api/quiz", json={"document_text": "内容", "count": 5})

    assert r.status_code == 502


def test_quiz_missing_options_rejected(make_client):

    questions = [
        {
            "question": "1+1=?",
            "answer": "B",
            "explanation": "因为1+1=2",
            "knowledge_point": "加法",
        }
    ] * 5

    c = make_client(ai_content=json.dumps({"questions": questions}))
    r = c.post("/api/quiz", json={"document_text": "内容"})

    assert r.status_code == 502


def test_quiz_invalid_answer_rejected(make_client):

    questions = [
        {
            "question": "1+1=?",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "answer": "E",
            "explanation": "因为1+1=2",
            "knowledge_point": "加法",
        }
    ] * 5

    c = make_client(ai_content=json.dumps({"questions": questions}))
    r = c.post("/api/quiz", json={"document_text": "内容"})

    assert r.status_code == 502


def test_quiz_valid_output_accepted(make_client):

    questions = [
        {
            "question": "1+1=?",
            "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
            "answer": "B",
            "explanation": "因为1+1=2",
            "knowledge_point": "加法",
        }
    ] * 5

    c = make_client(ai_content=json.dumps({"questions": questions}))
    r = c.post("/api/quiz", json={"document_text": "内容"})

    assert r.status_code == 200

    data = r.json()

    assert data["count"] == 5
    assert data["questions"][0]["id"] == 1


def test_diagnose_out_of_range_index_filtered(make_client):

    diagnoses = [
        {
            "question_index": 99,
            "knowledge_point": "越界索引",
            "category": "测试",
            "difficulty": "基础",
            "error_reason": "r",
            "suggestion": "s",
            "confidence": 0.9,
        },
        {
            "question_index": 0,
            "knowledge_point": "加法",
            "category": "算术",
            "difficulty": "基础",
            "error_reason": "粗心",
            "suggestion": "检查计算",
            "confidence": 0.8,
        },
    ]

    item = {
        "question": "1+1=?",
        "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
        "correct_answer": "A",
        "user_answer": "B",
    }

    c = make_client(ai_content=json.dumps({"diagnoses": diagnoses}))
    r = c.post("/api/diagnose", json={"wrong_answers": [item]})

    assert r.status_code == 200

    data = r.json()

    assert data["total"] == 1
    assert data["diagnoses"][0]["question_index"] == 0


def test_plan_day_count_mismatch_rejected(make_client):

    plan = {
        "title": "计划",
        "summary": "摘要",
        "days": [
            {"theme": "d1", "tasks": [{"title": "t", "duration_minutes": 30}]},
            {"theme": "d2", "tasks": [{"title": "t", "duration_minutes": 30}]},
        ],
    }

    c = make_client(ai_content=json.dumps(plan))
    r = c.post("/api/study-plan", json={"days": 1})

    assert r.status_code == 502


def test_plan_day_total_capped_to_daily_minutes(make_client):

    plan = {
        "title": "计划",
        "summary": "摘要",
        "days": [
            {
                "theme": "d1",
                "tasks": [
                    {"title": "任务A", "duration_minutes": 100},
                    {"title": "任务B", "duration_minutes": 30},
                    {"title": "任务C", "duration_minutes": 20},
                ],
            }
        ],
    }

    c = make_client(ai_content=json.dumps(plan))
    r = c.post(
        "/api/study-plan",
        json={"days": 1, "daily_minutes": 60},
    )

    assert r.status_code == 200

    tasks = r.json()["plan"]["days"][0]["tasks"]

    total = sum(t["duration_minutes"] for t in tasks)

    assert total <= 60, f"每日总时长应不超过60，实际{total}"

    assert all(
        isinstance(t["duration_minutes"], int)
        and t["duration_minutes"] >= 1
        for t in tasks
    )


def test_plan_missing_duration_defaults(make_client):

    plan = {
        "title": "计划",
        "summary": "摘要",
        "days": [
            {
                "theme": "d1",
                "tasks": [
                    {"title": "无时长任务"},
                    {"title": "任务B", "duration_minutes": 20},
                ],
            }
        ],
    }

    c = make_client(ai_content=json.dumps(plan))
    r = c.post("/api/study-plan", json={"days": 1, "daily_minutes": 60})

    assert r.status_code == 200

    tasks = r.json()["plan"]["days"][0]["tasks"]

    assert tasks[0]["duration_minutes"] == 20
