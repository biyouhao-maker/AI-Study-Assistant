
/* =========================================
   AI Study Assistant V1.2
   Frontend Main Script

   保留原有后端 API、数据键名和核心业务逻辑
========================================= */

const API_BASE = "";

/* =========================================
   1. Local Storage
========================================= */

const STORAGE_KEYS = {
    wrongbook: "ai-study-wrongbook",
    stats: "ai-study-stats",
    activity: "ai-study-activity",
    document: "ai-study-current-document",
    conversation: "ai-study-conversation",
    learningMode: "ai-study-learning-mode",
    diagnoses: "ai-study-diagnoses",
    answerRecords: "ai-study-answer-records",
    studyPlan: "ai-study-plan",
    studyPlanHistory: "ai-study-plan-history",
    theme: "ai-study-theme"
};

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? JSON.parse(value) : fallback;
    } catch (error) {
        console.warn(`读取本地数据失败：${key}`, error);
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`保存本地数据失败：${key}`, error);
        return false;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/* =========================================
   2. API Request Helper
========================================= */

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { detail: text || "服务器返回了无法识别的数据。" };
    }

    if (!response.ok) {
        throw new Error(
            data?.detail ||
            data?.message ||
            `请求失败，状态码：${response.status}`
        );
    }

    return data;
}

function setButtonLoading(button, loading, loadingText, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
}

/* =========================================
   3. State
========================================= */

let wrongbook = safeArray(
    readStorage(STORAGE_KEYS.wrongbook, [])
);

let stats = readStorage(STORAGE_KEYS.stats, {
    quizCount: 0,
    totalQuestions: 0,
    correctQuestions: 0,
    documentCount: 0
});

stats = {
    quizCount: safeNumber(stats?.quizCount),
    totalQuestions: safeNumber(stats?.totalQuestions),
    correctQuestions: safeNumber(stats?.correctQuestions),
    documentCount: safeNumber(stats?.documentCount)
};

let activity = safeArray(
    readStorage(STORAGE_KEYS.activity, [])
);

let currentDocument = readStorage(
    STORAGE_KEYS.document,
    null
);

let conversation = safeArray(
    readStorage(STORAGE_KEYS.conversation, [])
);

let diagnoses = safeArray(
    readStorage(STORAGE_KEYS.diagnoses, [])
);

let answerRecords = safeArray(
    readStorage(STORAGE_KEYS.answerRecords, [])
);

let currentStudyPlan = readStorage(
    STORAGE_KEYS.studyPlan,
    null
);

let studyPlanHistory = safeArray(
    readStorage(STORAGE_KEYS.studyPlanHistory, [])
);

const LEARNING_MODES = {
    basic: "基础讲解",
    advanced: "深入学习",
    exam: "考前复习"
};

let currentLearningMode = readStorage(
    STORAGE_KEYS.learningMode,
    "basic"
);

if (!LEARNING_MODES[currentLearningMode]) {
    currentLearningMode = "basic";
}

let currentQuiz = [];
let isChatSending = false;
let isUploading = false;
let isGeneratingQuiz = false;
let isRunningDiagnosis = false;
let isGeneratingPlan = false;

/* =========================================
   4. DOM Elements
========================================= */

const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message");
const chatBox = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const uploadStatus = document.getElementById("upload-status");

const generateQuizBtn = document.getElementById("generate-quiz-btn");
const quizCount = document.getElementById("quiz-count");
const quizStatus = document.getElementById("quiz-status");
const quizContainer = document.getElementById("quiz-container");

const showWrongbookBtn = document.getElementById("show-wrongbook-btn");
const clearWrongbookBtn = document.getElementById("clear-wrongbook-btn");
const wrongbookStatus = document.getElementById("wrongbook-status");
const wrongbookContainer = document.getElementById("wrongbook-container");

const learningModeInputs = document.querySelectorAll(
    'input[name="learning-mode"]'
);

const runDiagnosisBtn = document.getElementById("run-diagnosis-btn");
const refreshDiagnosisBtn = document.getElementById("refresh-diagnosis-btn");

const diagnosisStatus = document.getElementById("diagnosis-status");
const diagnosisResults = document.getElementById("diagnosis-results");
const knowledgeList = document.getElementById("knowledge-list");
const recommendationList = document.getElementById("recommendation-list");

const generatePlanBtn = document.getElementById("generate-plan-btn");
const planStatus = document.getElementById("plan-status");
const planContainer = document.getElementById("plan-container");
const planHistoryContainer = document.getElementById("plan-history-container");

const planDaysInput = document.getElementById("plan-days");
const planDailyMinutesInput = document.getElementById("plan-daily-minutes");
const planGoalInput = document.getElementById("plan-goal");

/* =========================================
   5. Theme
========================================= */

function getCurrentTheme() {
    return readStorage(STORAGE_KEYS.theme, "light") === "dark"
        ? "dark"
        : "light";
}

function applyTheme(theme) {
    const validTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute(
        "data-theme",
        validTheme
    );

    document.body?.setAttribute(
        "data-theme",
        validTheme
    );

    document.documentElement.classList.toggle(
        "dark-theme",
        validTheme === "dark"
    );

    document.body?.classList.toggle(
        "dark-theme",
        validTheme === "dark"
    );

    document.querySelectorAll(
        "[data-theme-toggle], #theme-toggle"
    ).forEach(button => {
        button.setAttribute(
            "aria-pressed",
            String(validTheme === "dark")
        );

        const label = button.querySelector(
            "[data-theme-label]"
        );

        if (label) {
            label.textContent = validTheme === "dark"
                ? "深色模式"
                : "浅色模式";
        }
    });

    writeStorage(STORAGE_KEYS.theme, validTheme);
}

function toggleTheme() {
    const nextTheme = getCurrentTheme() === "dark"
        ? "light"
        : "dark";

    applyTheme(nextTheme);
}

function initializeTheme() {
    applyTheme(getCurrentTheme());

    document.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-theme-toggle], #theme-toggle"
        );

        if (!button) return;

        toggleTheme();
    });
}

/* =========================================
   6. Activity
========================================= */

function addActivity(text) {
    activity.unshift({
        text,
        time: new Date().toLocaleString()
    });

    activity = activity.slice(0, 30);

    writeStorage(STORAGE_KEYS.activity, activity);

    renderActivity();
}

function renderActivity() {
    const container = document.getElementById("recent-activity");

    if (!container) return;

    if (!activity.length) {
        container.innerHTML =
            '<p class="empty-state">暂无学习记录，开始今天的学习吧。</p>';
        return;
    }

    container.innerHTML = activity.map(item => `
        <div class="activity-item">
            <strong>${escapeHTML(item.text)}</strong>
            <small>${escapeHTML(item.time)}</small>
        </div>
    `).join("");
}

/* =========================================
   7. Dashboard
========================================= */

function updateDashboard() {
    const quizCountEl = document.getElementById("stat-quiz-count");
    const accuracyEl = document.getElementById("stat-accuracy");
    const wrongCountEl = document.getElementById("stat-wrong-count");
    const documentCountEl = document.getElementById("stat-document-count");

    if (quizCountEl) {
        quizCountEl.textContent = stats.quizCount;
    }

    if (accuracyEl) {
        const accuracy = stats.totalQuestions
            ? Math.round(
                stats.correctQuestions /
                stats.totalQuestions * 100
            )
            : 0;

        accuracyEl.textContent = `${accuracy}%`;
    }

    if (wrongCountEl) {
        wrongCountEl.textContent = wrongbook.length;
    }

    if (documentCountEl) {
        documentCountEl.textContent = stats.documentCount;
    }

    // 兼容新版首页可能使用的统计元素
    const totalQuestionsEl = document.getElementById(
        "stat-total-questions"
    );

    if (totalQuestionsEl) {
        totalQuestionsEl.textContent = stats.totalQuestions;
    }

    const completedTasksEl = document.getElementById(
        "stat-completed-tasks"
    );

    if (completedTasksEl) {
        completedTasksEl.textContent = currentStudyPlan
            ? getStudyPlanProgress(currentStudyPlan).completed
            : 0;
    }

    renderActivity();
}

/* =========================================
   8. Chat
========================================= */

function renderConversation() {
    if (!chatBox) return;

    chatBox.innerHTML = "";

    if (!conversation.length) {
        chatBox.innerHTML = `
            <div class="message assistant-message">
                <div class="message-content">
                    你好！我是你的 AI 学习助手。
                    你可以向我提问、上传资料，或者让我帮助你制定学习计划。
                </div>
            </div>
        `;
        return;
    }

    conversation.forEach(item => {
        const div = document.createElement("div");

        div.className = item.role === "user"
            ? "message user-message"
            : "message assistant-message";

        const content = document.createElement("div");
        content.className = "message-content";
        content.textContent = item.content || "";

        div.appendChild(content);
        chatBox.appendChild(div);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage(event) {
    event.preventDefault();

    if (isChatSending) return;

    const message = messageInput?.value.trim();

    if (!message) return;

    const selectedMode = currentLearningMode;

    isChatSending = true;

    conversation.push({
        role: "user",
        content: message
    });

    conversation = conversation.slice(-20);

    writeStorage(STORAGE_KEYS.conversation, conversation);

    messageInput.value = "";
    renderConversation();

    setButtonLoading(
        sendBtn,
        true,
        "思考中...",
        "发送"
    );

    const loading = document.createElement("div");
    loading.className = "message assistant-message";
    loading.textContent =
        `${LEARNING_MODES[selectedMode]}模式：AI 正在思考...`;

    chatBox?.appendChild(loading);

    try {
        const data = await apiRequest("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                history: conversation.slice(0, -1),
                document_text: currentDocument?.text || "",
                document_name: currentDocument?.filename || "",
                learning_mode: selectedMode
            })
        });

        conversation.push({
            role: "assistant",
            content: data.answer || "AI 暂时没有返回内容。"
        });

        conversation = conversation.slice(-20);

        writeStorage(STORAGE_KEYS.conversation, conversation);

        addActivity("AI 学习对话");

    } catch (error) {
        conversation.push({
            role: "assistant",
            content: `请求失败：${error.message}`
        });

        writeStorage(STORAGE_KEYS.conversation, conversation);

    } finally {
        isChatSending = false;

        setButtonLoading(
            sendBtn,
            false,
            "思考中...",
            "发送"
        );

        renderConversation();
    }
}

/* =========================================
   9. Learning Mode
========================================= */

function restoreLearningMode() {
    learningModeInputs.forEach(input => {
        input.checked = input.value === currentLearningMode;
    });
}

learningModeInputs.forEach(input => {
    input.addEventListener("change", () => {
        if (!LEARNING_MODES[input.value]) return;

        currentLearningMode = input.value;

        writeStorage(
            STORAGE_KEYS.learningMode,
            currentLearningMode
        );
    });
});

/* =========================================
   10. Document Upload
========================================= */

async function uploadDocument(event) {
    event.preventDefault();

    if (isUploading) return;

    const file = fileInput?.files?.[0];

    if (!file) {
        if (uploadStatus) {
            uploadStatus.textContent = "请先选择文件。";
        }
        return;
    }

    const allowedExtensions = [".pdf", ".docx"];
    const fileName = file.name.toLowerCase();

    if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
        uploadStatus.textContent =
            "目前仅支持 PDF 和 DOCX 格式。";
        return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
        uploadStatus.textContent =
            "文件大小不能超过 10MB。";
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    isUploading = true;

    setButtonLoading(
        uploadBtn,
        true,
        "上传中...",
        "上传资料"
    );

    uploadStatus.textContent = "正在上传并提取资料内容...";

    try {
        const data = await apiRequest("/api/upload", {
            method: "POST",
            body: formData
        });

        currentDocument = data;

        writeStorage(
            STORAGE_KEYS.document,
            currentDocument
        );

        // 新资料上传后开启新的对话，但保留之前的记录数据
        conversation = [];

        writeStorage(
            STORAGE_KEYS.conversation,
            conversation
        );

        renderConversation();

        stats.documentCount += 1;

        writeStorage(
            STORAGE_KEYS.stats,
            stats
        );

        updateDashboard();

        uploadStatus.textContent =
            data.message || `资料上传成功：${data.filename}`;

        addActivity(`上传学习资料：${data.filename}`);

        const documentNameEl = document.getElementById(
            "current-document-name"
        );

        if (documentNameEl) {
            documentNameEl.textContent = data.filename;
        }

        const documentInfoEl = document.getElementById(
            "current-document-info"
        );

        if (documentInfoEl) {
            documentInfoEl.textContent =
                `已提取 ${safeNumber(data.char_count)} 个字符`;
        }

    } catch (error) {
        uploadStatus.textContent = error.message;

    } finally {
        isUploading = false;

        setButtonLoading(
            uploadBtn,
            false,
            "上传中...",
            "上传资料"
        );
    }
}

/* =========================================
   11. Quiz Generation
========================================= */

async function generateQuiz() {
    if (isGeneratingQuiz) return;

    if (!currentDocument?.text) {
        quizStatus.textContent = "请先上传学习资料。";
        return;
    }

    const count = Number(quizCount?.value || 5);

    if (!Number.isInteger(count) || count < 1 || count > 20) {
        quizStatus.textContent = "题目数量应为 1 至 20 题。";
        return;
    }

    isGeneratingQuiz = true;

    setButtonLoading(
        generateQuizBtn,
        true,
        "生成中...",
        "生成测验"
    );

    quizStatus.textContent = "AI 正在根据资料生成题目...";

    try {
        const data = await apiRequest("/api/quiz", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                document_text: currentDocument.text,
                document_name: currentDocument.filename,
                count
            })
        });

        currentQuiz = safeArray(data.questions);

        if (!currentQuiz.length) {
            throw new Error("AI 没有生成有效题目，请重试。");
        }

        renderQuiz();

        quizStatus.textContent =
            `测验生成成功，共 ${currentQuiz.length} 道题目。`;

        addActivity("生成学习测验");

    } catch (error) {
        quizStatus.textContent = error.message;

    } finally {
        isGeneratingQuiz = false;

        setButtonLoading(
            generateQuizBtn,
            false,
            "生成中...",
            "生成测验"
        );
    }
}

function renderQuiz() {
    if (!quizContainer) return;

    quizContainer.innerHTML = currentQuiz.map((question, index) => `
        <div class="quiz-question">
            <h3>${index + 1}. ${escapeHTML(question.question)}</h3>

            ${["A", "B", "C", "D"].map(option => `
                <label class="quiz-option">
                    <input
                        type="radio"
                        name="question-${index}"
                        value="${option}"
                    >
                    <span>
                        ${option}. ${escapeHTML(question.options?.[option] || "")}
                    </span>
                </label>
            `).join("")}
        </div>
    `).join("") + `
        <button
            id="submit-quiz-btn"
            class="primary-btn"
            type="button"
        >
            提交答案
        </button>
        <div id="quiz-result"></div>
    `;

    document.getElementById("submit-quiz-btn")
        ?.addEventListener("click", submitQuiz);
}

function submitQuiz() {
    if (!currentQuiz.length) return;

    const resultContainer = document.getElementById("quiz-result");

    if (!resultContainer) return;

    let correctCount = 0;

    const resultHTML = [];
    const newWrongAnswers = [];
    const newAnswerRecords = [];

    // 检查所有题目是否完成
    for (let index = 0; index < currentQuiz.length; index++) {
        const selected = document.querySelector(
            `input[name="question-${index}"]:checked`
        );

        if (!selected) {
            alert(`请先完成第 ${index + 1} 题。`);
            return;
        }
    }

    const submittedAt = new Date().toISOString();

    currentQuiz.forEach((question, index) => {
        const selected = document.querySelector(
            `input[name="question-${index}"]:checked`
        );

        const userAnswer = selected.value;
        const isCorrect = userAnswer === question.answer;

        if (isCorrect) {
            correctCount++;
        } else {
            newWrongAnswers.push({
                question: question.question,
                options: question.options || {},
                correct_answer: question.answer,
                user_answer: userAnswer,
                explanation: question.explanation || "",
                created_at: submittedAt
            });
        }

        newAnswerRecords.push({
            knowledge_point: question.knowledge_point || "",
            is_correct: isCorrect,
            question: question.question,
            created_at: submittedAt
        });

        resultHTML.push(`
            <div class="quiz-review-item">
                <p>
                    第 ${index + 1} 题：
                    <strong>${isCorrect ? "回答正确" : "回答错误"}</strong>
                </p>
                <p>你的答案：${escapeHTML(userAnswer)}</p>
                <p>正确答案：${escapeHTML(question.answer)}</p>
                <p>解析：${escapeHTML(question.explanation || "暂无解析")}</p>
            </div>
        `);
    });

    wrongbook.push(...newWrongAnswers);

    writeStorage(
        STORAGE_KEYS.wrongbook,
        wrongbook
    );

    answerRecords.push(...newAnswerRecords);
    answerRecords = answerRecords.slice(-1000);

    writeStorage(
        STORAGE_KEYS.answerRecords,
        answerRecords
    );

    stats.quizCount += 1;
    stats.totalQuestions += currentQuiz.length;
    stats.correctQuestions += correctCount;

    writeStorage(
        STORAGE_KEYS.stats,
        stats
    );

    const accuracy = Math.round(
        correctCount / currentQuiz.length * 100
    );

    resultContainer.innerHTML = `
        <div class="quiz-result-summary">
            <h3>本次得分：${correctCount}/${currentQuiz.length}</h3>
            <p>正确率：${accuracy}%</p>
            <p>本次新增错题：${newWrongAnswers.length} 道</p>
        </div>
        ${resultHTML.join("")}
    `;

    // 锁定已提交的题目，避免重复计分
    quizContainer.querySelectorAll("input").forEach(input => {
        input.disabled = true;
    });

    const submitButton = document.getElementById("submit-quiz-btn");

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "已提交";
    }

    currentQuiz = [];

    updateDashboard();
    renderWrongbook();

    refreshDiagnosis();

    addActivity("完成一次学习测验");
}

/* =========================================
   12. Wrongbook
========================================= */

function renderWrongbook() {
    if (!wrongbookContainer) return;

    if (!wrongbook.length) {
        wrongbookContainer.innerHTML =
            '<p class="empty-state">暂无错题，继续保持！</p>';

        updateDashboard();
        return;
    }

    wrongbookContainer.innerHTML = wrongbook.map((item, index) => `
        <div class="wrongbook-item">
            <h3>${index + 1}. ${escapeHTML(item.question)}</h3>

            <p>
                <strong>你的答案：</strong>
                ${escapeHTML(item.user_answer)}
            </p>

            <p>
                <strong>正确答案：</strong>
                ${escapeHTML(item.correct_answer)}
            </p>

            <p>
                <strong>解析：</strong>
                ${escapeHTML(item.explanation || "暂无解析")}
            </p>

            <small>
                ${escapeHTML(
                    item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "记录时间未知"
                )}
            </small>
        </div>
    `).join("");

    updateDashboard();
}

if (showWrongbookBtn) {
    showWrongbookBtn.addEventListener("click", renderWrongbook);
}

if (clearWrongbookBtn) {
    clearWrongbookBtn.addEventListener("click", () => {
        if (!wrongbook.length) {
            if (wrongbookStatus) {
                wrongbookStatus.textContent = "错题本已经为空。";
            }
            return;
        }

        if (!confirm("确定清空全部错题吗？此操作无法撤销。")) {
            return;
        }

        wrongbook = [];

        writeStorage(
            STORAGE_KEYS.wrongbook,
            wrongbook
        );

        renderWrongbook();

        if (wrongbookStatus) {
            wrongbookStatus.textContent = "错题本已清空。";
        }

        addActivity("清空错题本");
    });
}

/* =========================================
   13. AI Wrong Answer Diagnosis
========================================= */

async function runDiagnosis() {
    if (isRunningDiagnosis) return;

    if (!wrongbook.length) {
        diagnosisStatus.textContent =
            "当前错题本为空，请先完成测验。";
        return;
    }

    isRunningDiagnosis = true;

    setButtonLoading(
        runDiagnosisBtn,
        true,
        "AI 正在分析...",
        "开始 AI 诊断"
    );

    diagnosisStatus.textContent =
        "正在分析错题，请稍候...";

    try {
        const data = await apiRequest("/api/diagnose", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                wrong_answers: wrongbook.map(item => ({
                    question: item.question,
                    options: item.options || {},
                    correct_answer: item.correct_answer,
                    user_answer: item.user_answer,
                    explanation: item.explanation || ""
                }))
            })
        });

        const diagnosisItems = safeArray(data.diagnoses);
        const now = new Date().toISOString();

        diagnosisItems.forEach(item => {
            const index = item.question_index;

            if (
                !Number.isInteger(index) ||
                !wrongbook[index]
            ) {
                return;
            }

            const source = wrongbook[index];

            const record = {
                question: source.question,
                knowledge_point: item.knowledge_point || "待确认",
                category: item.category || "未分类",
                difficulty: item.difficulty || "待确认",
                error_reason: item.error_reason || "暂未分析",
                suggestion: item.suggestion || "建议复习相关知识。",
                confidence: safeNumber(item.confidence),
                created_at: now
            };

            const existingIndex = diagnoses.findIndex(
                diagnosis => diagnosis.question === record.question
            );

            if (existingIndex >= 0) {
                diagnoses[existingIndex] = record;
            } else {
                diagnoses.push(record);
            }
        });

        diagnoses = diagnoses.slice(-500);

        writeStorage(
            STORAGE_KEYS.diagnoses,
            diagnoses
        );

        // 将诊断得到的知识点关联到原有答题记录
        answerRecords = answerRecords.map(record => {
            const matched = diagnoses.find(
                diagnosis => diagnosis.question === record.question
            );

            if (
                matched &&
                matched.knowledge_point !== "待确认"
            ) {
                return {
                    ...record,
                    knowledge_point: matched.knowledge_point
                };
            }

            return record;
        });

        writeStorage(
            STORAGE_KEYS.answerRecords,
            answerRecords
        );

        diagnosisStatus.textContent =
            `诊断完成，共处理 ${diagnosisItems.length} 条诊断结果。`;

        renderDiagnosisResults();

        await refreshDiagnosis();

        addActivity("完成 AI 错题诊断");

    } catch (error) {
        diagnosisStatus.textContent = error.message;

    } finally {
        isRunningDiagnosis = false;

        setButtonLoading(
            runDiagnosisBtn,
            false,
            "AI 正在分析...",
            "开始 AI 诊断"
        );
    }
}

/* =========================================
   14. Render Diagnosis Results
========================================= */

function renderDiagnosisResults() {
    if (!diagnosisResults) return;

    if (!diagnoses.length) {
        diagnosisResults.innerHTML =
            '<p class="empty-state">暂无诊断结果。</p>';
        return;
    }

    diagnosisResults.innerHTML = diagnoses.map(item => `
        <div class="diagnosis-result-item">
            <h3>${escapeHTML(item.knowledge_point)}</h3>

            <div class="diagnosis-result-meta">
                <span class="diagnosis-tag">
                    ${escapeHTML(item.category)}
                </span>

                <span class="diagnosis-tag">
                    ${escapeHTML(item.difficulty)}
                </span>
            </div>

            <p>
                <strong>错误原因：</strong>
                ${escapeHTML(item.error_reason)}
            </p>

            <p>
                <strong>复习建议：</strong>
                ${escapeHTML(item.suggestion)}
            </p>
        </div>
    `).join("");
}

/* =========================================
   15. Refresh Knowledge Stats
========================================= */

async function refreshDiagnosis() {
    try {
        const data = await apiRequest("/api/knowledge-stats", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                records: answerRecords
            })
        });

        renderKnowledgeStats(
            safeArray(data.knowledge_points)
        );

        const recommendationData = await apiRequest(
            "/api/recommendations",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    records: answerRecords
                })
            }
        );

        renderRecommendations(
            safeArray(recommendationData.recommendations)
        );

    } catch (error) {
        if (diagnosisStatus) {
            diagnosisStatus.textContent =
                `数据更新失败：${error.message}`;
        }
    }
}

/* =========================================
   16. Render Knowledge Stats
========================================= */

function renderKnowledgeStats(items) {
    const pointCount = document.getElementById(
        "diagnosis-point-count"
    );

    const masteredCount = document.getElementById(
        "diagnosis-mastered-count"
    );

    const weakCount = document.getElementById(
        "diagnosis-weak-count"
    );

    const mastered = items.filter(
        item => item.level === "已掌握"
    ).length;

    const weak = items.filter(
        item => item.level === "薄弱知识点"
    ).length;

    if (pointCount) pointCount.textContent = items.length;
    if (masteredCount) masteredCount.textContent = mastered;
    if (weakCount) weakCount.textContent = weak;

    if (!knowledgeList) return;

    if (!items.length) {
        knowledgeList.innerHTML =
            '<p class="empty-state">暂无知识点数据，先进行练习吧。</p>';
        return;
    }

    knowledgeList.innerHTML = items.map(item => {
        const mastery = Math.max(
            0,
            Math.min(100, safeNumber(item.mastery))
        );

        return `
            <div class="knowledge-item">
                <div class="knowledge-item-header">
                    <strong>
                        ${escapeHTML(item.knowledge_point)}
                    </strong>

                    <span>${mastery}%</span>
                </div>

                <div class="knowledge-progress">
                    <div
                        class="knowledge-progress-fill"
                        style="width:${mastery}%"
                    ></div>
                </div>

                <span class="knowledge-level">
                    ${escapeHTML(item.level)}
                    · 共 ${safeNumber(item.total)} 次练习
                </span>
            </div>
        `;
    }).join("");
}

/* =========================================
   17. Render Recommendations
========================================= */

function renderRecommendations(items) {
    if (!recommendationList) return;

    if (!items.length) {
        recommendationList.innerHTML =
            '<p class="empty-state">目前没有足够的薄弱知识点数据。</p>';
        return;
    }

    recommendationList.innerHTML = items.map(item => `
        <div class="recommendation-item">
            <h3>${escapeHTML(item.knowledge_point)}</h3>

            <p>掌握度：${safeNumber(item.mastery)}%</p>

            <p>${escapeHTML(item.recommendation)}</p>
        </div>
    `).join("");
}

/* =========================================
   18. Study Plan
========================================= */

function createPlanId() {
    return "plan-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 8);
}

function normalizeStudyPlan(plan) {
    if (!plan || !Array.isArray(plan.days)) {
        throw new Error("学习计划数据格式不正确。");
    }

    const normalizedDays = plan.days.map((day, dayIndex) => {
        const tasks = safeArray(day.tasks);

        return {
            ...day,
            day: day.day || dayIndex + 1,
            theme: day.theme || "每日学习",

            tasks: tasks.map((task, taskIndex) => ({
                ...task,
                id: String(
                    task.id ||
                    `day-${dayIndex + 1}-task-${taskIndex + 1}`
                ),
                title: task.title || "学习任务",
                knowledge_point: task.knowledge_point || "",
                task_type: task.task_type || "学习",
                duration_minutes: safeNumber(task.duration_minutes),
                description: task.description || "",
                completion_criteria: task.completion_criteria || ""
            }))
        };
    });

    return {
        ...plan,
        days: normalizedDays,
        id: plan.id || createPlanId(),
        created_at: plan.created_at || new Date().toISOString(),
        completed_task_ids: safeArray(plan.completed_task_ids)
    };
}

function saveCurrentStudyPlan() {
    if (!currentStudyPlan) return;

    writeStorage(
        STORAGE_KEYS.studyPlan,
        currentStudyPlan
    );
}

function saveStudyPlanHistory() {
    writeStorage(
        STORAGE_KEYS.studyPlanHistory,
        studyPlanHistory
    );
}

/* =========================================
   19. Generate Study Plan
========================================= */

async function generateStudyPlan() {
    if (isGeneratingPlan) return;

    const days = Number(planDaysInput?.value);
    const dailyMinutes = Number(planDailyMinutesInput?.value);
    const goal = planGoalInput?.value.trim();

    if (!Number.isInteger(days) || days < 1 || days > 30) {
        planStatus.textContent = "学习计划天数应为 1 至 30 天。";
        return;
    }

    if (
        !Number.isInteger(dailyMinutes) ||
        dailyMinutes < 5 ||
        dailyMinutes > 600
    ) {
        planStatus.textContent = "每日学习时间应为 5 至 600 分钟。";
        return;
    }

    if (!goal) {
        planStatus.textContent = "请先填写学习目标。";
        return;
    }

    isGeneratingPlan = true;

    setButtonLoading(
        generatePlanBtn,
        true,
        "AI 正在规划...",
        "AI 生成学习计划"
    );

    planStatus.textContent =
        "正在分析你的学习记录和薄弱知识点，请稍候。";

    try {
        const data = await apiRequest("/api/study-plan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                records: answerRecords,
                diagnoses,
                wrongbook,
                days,
                daily_minutes: dailyMinutes,
                goal
            })
        });

        if (!data.plan) {
            throw new Error("服务器没有返回有效的学习计划。");
        }

        // 将旧计划保存到历史记录
        if (currentStudyPlan) {
            studyPlanHistory.unshift({
                ...currentStudyPlan,
                archived_at: new Date().toISOString()
            });
        }

        currentStudyPlan = normalizeStudyPlan(data.plan);

        currentStudyPlan.settings = data.settings || {
            days,
            daily_minutes: dailyMinutes,
            goal
        };

        studyPlanHistory = studyPlanHistory
            .filter(plan => plan.id !== currentStudyPlan.id)
            .slice(0, 20);

        saveCurrentStudyPlan();
        saveStudyPlanHistory();

        renderStudyPlan();
        renderStudyPlanHistory();
        updateDashboard();

        planStatus.textContent = "学习计划生成成功！";

        addActivity(`生成 ${days} 天 AI 学习计划`);

    } catch (error) {
        planStatus.textContent = error.message;

    } finally {
        isGeneratingPlan = false;

        setButtonLoading(
            generatePlanBtn,
            false,
            "AI 正在规划...",
            "AI 生成学习计划"
        );
    }
}

/* =========================================
   20. Study Plan Progress
========================================= */

function getStudyPlanProgress(plan) {
    if (!plan || !Array.isArray(plan.days)) {
        return {
            total: 0,
            completed: 0,
            percentage: 0
        };
    }

    const tasks = plan.days.flatMap(
        day => safeArray(day.tasks)
    );

    const total = tasks.length;

    const completedIds = new Set(
        safeArray(plan.completed_task_ids)
    );

    const completed = tasks.filter(
        task => completedIds.has(task.id)
    ).length;

    return {
        total,
        completed,
        percentage: total
            ? Math.round(completed / total * 100)
            : 0
    };
}

function renderStudyPlanProgress() {
    if (!currentStudyPlan) return;

    const progress = getStudyPlanProgress(currentStudyPlan);

    const progressText = document.getElementById(
        "plan-progress-text"
    );

    const progressFill = document.getElementById(
        "plan-progress-fill"
    );

    const completedCount = document.getElementById(
        "plan-completed-count"
    );

    const totalCount = document.getElementById(
        "plan-total-count"
    );

    if (progressText) {
        progressText.textContent = `${progress.percentage}%`;
    }

    if (progressFill) {
        progressFill.style.width = `${progress.percentage}%`;
    }

    if (completedCount) {
        completedCount.textContent =
            `已完成 ${progress.completed} 项`;
    }

    if (totalCount) {
        totalCount.textContent =
            `共 ${progress.total} 项任务`;
    }
}

/* =========================================
   21. Render Study Plan
========================================= */

function renderStudyPlan() {
    const titleElement = document.getElementById("plan-title");
    const summaryElement = document.getElementById("plan-summary");

    if (!planContainer) return;

    if (!currentStudyPlan) {
        planContainer.innerHTML = `
            <p class="empty-state">
                你还没有学习计划，点击上方按钮让 AI 为你生成一份。
            </p>
        `;

        if (titleElement) {
            titleElement.textContent = "我的学习计划";
        }

        if (summaryElement) {
            summaryElement.textContent =
                "生成计划后，这里会显示计划说明。";
        }

        const progressText = document.getElementById(
            "plan-progress-text"
        );

        const progressFill = document.getElementById(
            "plan-progress-fill"
        );

        const completedCount = document.getElementById(
            "plan-completed-count"
        );

        const totalCount = document.getElementById(
            "plan-total-count"
        );

        if (progressText) progressText.textContent = "0%";
        if (progressFill) progressFill.style.width = "0%";
        if (completedCount) completedCount.textContent = "已完成 0 项";
        if (totalCount) totalCount.textContent = "共 0 项任务";

        return;
    }

    if (titleElement) {
        titleElement.textContent =
            currentStudyPlan.title || "我的学习计划";
    }

    if (summaryElement) {
        summaryElement.textContent =
            currentStudyPlan.summary ||
            "根据你的学习情况制定的个性化计划。";
    }

    const completedIds = new Set(
        safeArray(currentStudyPlan.completed_task_ids)
    );

    planContainer.innerHTML = currentStudyPlan.days.map(day => `
        <div class="plan-day-card">
            <div class="plan-day-heading">
                <div>
                    <span class="plan-day-label">
                        DAY ${escapeHTML(day.day)}
                    </span>

                    <h3>${escapeHTML(day.theme)}</h3>
                </div>

                <span class="plan-day-task-count">
                    ${safeArray(day.tasks).length} 项任务
                </span>
            </div>

            <div class="plan-task-list">
                ${safeArray(day.tasks).map(task => {
                    const isCompleted = completedIds.has(task.id);

                    return `
                        <div class="plan-task-item ${isCompleted ? "completed" : ""}">
                            <label class="plan-task-checkbox">
                                <input
                                    type="checkbox"
                                    class="plan-task-check"
                                    data-task-id="${escapeHTML(task.id)}"
                                    ${isCompleted ? "checked" : ""}
                                >

                                <span class="plan-task-checkmark"></span>
                            </label>

                            <div class="plan-task-content">
                                <div class="plan-task-header">
                                    <h4>${escapeHTML(task.title)}</h4>

                                    <span class="plan-task-duration">
                                        ${safeNumber(task.duration_minutes)} 分钟
                                    </span>
                                </div>

                                <div class="plan-task-tags">
                                    <span>${escapeHTML(task.task_type)}</span>

                                    ${task.knowledge_point ? `
                                        <span>
                                            ${escapeHTML(task.knowledge_point)}
                                        </span>
                                    ` : ""}
                                </div>

                                <p>${escapeHTML(task.description)}</p>

                                <div class="plan-task-criteria">
                                    <strong>完成标准：</strong>
                                    ${escapeHTML(task.completion_criteria)}
                                </div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `).join("");

    renderStudyPlanProgress();
}

/* =========================================
   22. Study Plan Task Events
========================================= */

function handleStudyPlanTaskChange(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const checkbox = target.closest(".plan-task-check");

    if (!checkbox || !currentStudyPlan) return;

    const taskId = checkbox.dataset.taskId;

    const completedIds = new Set(
        safeArray(currentStudyPlan.completed_task_ids)
    );

    if (checkbox.checked) {
        completedIds.add(taskId);
    } else {
        completedIds.delete(taskId);
    }

    currentStudyPlan.completed_task_ids =
        Array.from(completedIds);

    saveCurrentStudyPlan();

    renderStudyPlan();
    renderStudyPlanHistory();
    updateDashboard();
}

/* =========================================
   23. Historical Study Plans
========================================= */

function loadHistoricalStudyPlan(planId) {
    const selectedPlan = studyPlanHistory.find(
        item => item.id === planId
    );

    if (!selectedPlan) return;

    if (
        currentStudyPlan &&
        currentStudyPlan.id !== selectedPlan.id
    ) {
        studyPlanHistory = studyPlanHistory.filter(
            item => item.id !== currentStudyPlan.id
        );

        studyPlanHistory.unshift({
            ...currentStudyPlan,
            archived_at: new Date().toISOString()
        });
    }

    currentStudyPlan = normalizeStudyPlan({
        ...selectedPlan
    });

    studyPlanHistory = studyPlanHistory.filter(
        item => item.id !== currentStudyPlan.id
    );

    studyPlanHistory = studyPlanHistory.slice(0, 20);

    saveCurrentStudyPlan();
    saveStudyPlanHistory();

    renderStudyPlan();
    renderStudyPlanHistory();
    updateDashboard();

    if (planStatus) {
        planStatus.textContent = "已切换到历史学习计划。";
    }
}

function renderStudyPlanHistory() {
    if (!planHistoryContainer) return;

    if (!studyPlanHistory.length) {
        planHistoryContainer.innerHTML =
            '<p class="empty-state">暂无历史计划。</p>';
        return;
    }

    planHistoryContainer.innerHTML = studyPlanHistory.map(plan => {
        const progress = getStudyPlanProgress(plan);

        const createdAt = plan.created_at
            ? new Date(plan.created_at).toLocaleDateString()
            : "日期未知";

        const isCurrent = currentStudyPlan &&
            currentStudyPlan.id === plan.id;

        return `
            <div class="plan-history-item">
                <div class="plan-history-info">
                    <strong>
                        ${escapeHTML(plan.title || "学习计划")}
                    </strong>

                    <span>
                        ${escapeHTML(createdAt)}
                        · ${progress.completed}/${progress.total} 项完成
                        · ${progress.percentage}%
                    </span>
                </div>

                <button
                    class="plan-history-load"
                    data-plan-id="${escapeHTML(plan.id)}"
                    ${isCurrent ? "disabled" : ""}
                >
                    ${isCurrent ? "当前计划" : "查看计划"}
                </button>
            </div>
        `;
    }).join("");
}

/* =========================================
   24. Study Plan Event Bindings
========================================= */

if (generatePlanBtn) {
    generatePlanBtn.addEventListener(
        "click",
        generateStudyPlan
    );
}

if (planContainer) {
    planContainer.addEventListener(
        "change",
        handleStudyPlanTaskChange
    );
}

if (planHistoryContainer) {
    planHistoryContainer.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const button = target.closest(".plan-history-load");

        if (!button) return;

        loadHistoricalStudyPlan(button.dataset.planId);
    });
}

/* =========================================
   25. Main Event Bindings
========================================= */

if (chatForm) {
    chatForm.addEventListener("submit", sendMessage);
}

if (uploadForm) {
    uploadForm.addEventListener("submit", uploadDocument);
}

if (generateQuizBtn) {
    generateQuizBtn.addEventListener(
        "click",
        generateQuiz
    );
}

if (runDiagnosisBtn) {
    runDiagnosisBtn.addEventListener(
        "click",
        runDiagnosis
    );
}

if (refreshDiagnosisBtn) {
    refreshDiagnosisBtn.addEventListener(
        "click",
        refreshDiagnosis
    );
}

/* =========================================
   26. Initialize
========================================= */

function initializeApp() {
    initializeTheme();

    restoreLearningMode();

    renderConversation();
    renderWrongbook();
    renderDiagnosisResults();

    updateDashboard();

    renderStudyPlan();
    renderStudyPlanHistory();

    // 让新版首页能够显示当前资料名称
    const documentNameEl = document.getElementById(
        "current-document-name"
    );

    if (documentNameEl && currentDocument?.filename) {
        documentNameEl.textContent = currentDocument.filename;
    }

    const documentInfoEl = document.getElementById(
        "current-document-info"
    );

    if (documentInfoEl && currentDocument?.text) {
        documentInfoEl.textContent =
            `已提取 ${currentDocument.text.length} 个字符`;
    }

    // 刷新知识点统计和学习建议
    refreshDiagnosis();
}

initializeApp();
