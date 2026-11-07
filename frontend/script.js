/* =========================================
   AI Study Assistant V1.3
   完整前端主脚本
   保留原后端 API、localStorage 键名及核心业务
========================================= */

const API_BASE = "";

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

/* =========================================
   一、通用工具
========================================= */

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
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

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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

function formatDate(value) {
    if (!value) return "时间未知";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "时间未知";
    }

    return date.toLocaleString("zh-CN");
}

async function apiRequest(path, options = {}) {
    const userKey = getUserApiKey();

    if (userKey) {
        const headers = new Headers(options.headers || {});
        headers.set("X-User-API-Key", userKey);
        headers.set("X-AI-Provider", getAiProvider());
        options.headers = headers;
    }

    const response = await fetch(`${API_BASE}${path}`, options);

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = {
            detail: await response.text() || "服务器返回了无法识别的数据。"
        };
    }

    if (!response.ok) {
        if (response.status === 401) {
            openApiKeyModal();
        }

        throw new Error(
            data?.detail ||
            data?.error ||
            data?.message ||
            `请求失败，状态码：${response.status}`
        );
    }

    return data;
}

/* =========================================
   一之二、用户自带 API 密钥（BYOK）
========================================= */

// localStorage 存储标识（这只是一个键名，不是密钥本身）
const BYOK_STORAGE_ID = "ai-study-user-api-key";
const BYOK_PROVIDER_ID = "ai-study-provider";

const PROVIDER_LABELS = {
    deepseek: "DeepSeek",
    moonshot: "Kimi（月之暗面）",
    qwen: "通义千问",
    siliconflow: "硅基流动",
    zhipu: "智谱 GLM",
    openrouter: "OpenRouter"
};

function getUserApiKey() {
    return String(readStorage(BYOK_STORAGE_ID, "") || "").trim();
}

function getAiProvider() {
    const provider = String(readStorage(BYOK_PROVIDER_ID, "") || "").trim();
    return PROVIDER_LABELS[provider] ? provider : "deepseek";
}

// 按厂商校验密钥格式（与后端规则一致），通过则返回规整后的密钥
function normalizeKeyForProvider(provider, rawValue) {

    let value = String(rawValue || "").trim();

    if (provider === "zhipu") {

        const eq = value.indexOf("=");

        if (eq >= 0) {
            value = value.slice(eq + 1).trim();
        }

        return (value.length >= 16 && value.includes("."))
            ? value
            : null;
    }

    const marker = value.indexOf("sk-");

    if (marker >= 0) {
        value = value.slice(marker);
    }

    return (value.startsWith("sk-") && value.length >= 20)
        ? value
        : null;
}

function openApiKeyModal() {
    const modal = document.getElementById("apiKeyModal");

    if (!modal) return;

    const input = document.getElementById("userApiKeyInput");
    const select = document.getElementById("aiProviderSelect");
    const status = document.getElementById("apiKeyStatus");

    if (select) {
        select.value = getAiProvider();
    }

    if (input && !input.value) {
        input.value = getUserApiKey();
    }

    if (status) {
        status.textContent = getUserApiKey()
            ? `当前使用 ${PROVIDER_LABELS[getAiProvider()] || getAiProvider()} 的密钥，AI 调用将使用你自己的额度。`
            : "尚未设置密钥。选择厂商并填入对应密钥后，才能使用 AI 对话、测验和学习计划。";
    }

    modal.style.display = "flex";
}

function closeApiKeyModal() {
    const modal = document.getElementById("apiKeyModal");

    if (modal) {
        modal.style.display = "none";
    }
}

function saveUserApiKey() {
    const input = document.getElementById("userApiKeyInput");
    const select = document.getElementById("aiProviderSelect");
    const status = document.getElementById("apiKeyStatus");

    if (!input || !status) return;

    const provider = select ? select.value : "deepseek";
    const normalized = normalizeKeyForProvider(provider, input.value);

    if (!normalized) {
        status.textContent = provider === "zhipu"
            ? "智谱密钥格式不正确：应为 id.secret 形式（中间有一个点）。"
            : "密钥格式不正确：应以 sk- 开头且完整复制。";
        return;
    }

    writeStorage(BYOK_STORAGE_ID, normalized);
    writeStorage(BYOK_PROVIDER_ID, provider);

    status.textContent = `已保存。AI 调用将使用 ${PROVIDER_LABELS[provider] || provider} 你自己的额度。`;
    setTimeout(closeApiKeyModal, 900);
}

const apiKeySettingsBtn = document.getElementById("apiKeySettingsBtn");
const closeApiKeyModalBtn = document.getElementById("closeApiKeyModalBtn");
const saveUserApiKeyBtn = document.getElementById("saveUserApiKeyBtn");
const apiKeyModal = document.getElementById("apiKeyModal");

if (apiKeySettingsBtn) {
    apiKeySettingsBtn.addEventListener("click", openApiKeyModal);
}

if (closeApiKeyModalBtn) {
    closeApiKeyModalBtn.addEventListener("click", closeApiKeyModal);
}

if (saveUserApiKeyBtn) {
    saveUserApiKeyBtn.addEventListener("click", saveUserApiKey);
}

if (apiKeyModal) {
    apiKeyModal.addEventListener("click", event => {
        if (event.target === apiKeyModal) {
            closeApiKeyModal();
        }
    });
}

function setButtonLoading(button, loading, loadingText, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
}

/* =========================================
   二、应用状态
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
   三、DOM 元素
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

const practiceGenerateBtn = document.getElementById("practice-generate-btn");
const practiceQuizCount = document.getElementById("practice-quiz-count");
const practiceQuizStatus = document.getElementById("practice-status");
const practiceQuizContainer = document.getElementById("practice-quiz-container");

let activeQuizUI = {
    container: quizContainer,
    status: quizStatus,
    button: generateQuizBtn,
    countInput: quizCount,
    activityLabel: "生成学习测验"
};

const showWrongbookBtn = document.getElementById("show-wrongbook-btn");
const clearWrongbookBtn = document.getElementById("clear-wrongbook-btn");
const wrongbookStatus = document.getElementById("wrongbook-status");
const wrongbookContainer = document.getElementById("wrongbook-container");

const wrongbookFilter = document.getElementById("wrongbook-filter");
const wrongbookSort = document.getElementById("wrongbook-sort");

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
   四、前端输入范围限制
========================================= */

if (quizCount) {
    quizCount.min = "1";
    quizCount.max = "10";
    quizCount.step = "1";
}

if (planDaysInput) {
    planDaysInput.min = "1";
    planDaysInput.max = "14";
    planDaysInput.step = "1";
}

if (planDailyMinutesInput) {
    planDailyMinutesInput.min = "15";
    planDailyMinutesInput.max = "240";
    planDailyMinutesInput.step = "1";
}

/* =========================================
   五、主题切换
========================================= */

function getCurrentTheme() {
    return readStorage(STORAGE_KEYS.theme, "light") === "dark"
        ? "dark"
        : "light";
}

function applyTheme(theme) {
    const validTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = validTheme;
    document.body.dataset.theme = validTheme;

    document.documentElement.classList.toggle(
        "dark-theme",
        validTheme === "dark"
    );

    document.body.classList.toggle(
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

        button.title = validTheme === "dark"
            ? "切换到浅色主题"
            : "切换到深色主题";

        const label = button.querySelector("[data-theme-label]");

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

        if (button) {
            toggleTheme();
        }
    });
}

/* =========================================
   六、学习活动
========================================= */

function addActivity(text) {
    activity.unshift({
        text,
        time: new Date().toLocaleString("zh-CN")
    });

    activity = activity.slice(0, 30);

    writeStorage(STORAGE_KEYS.activity, activity);

    renderActivity();
}

function renderActivity() {
    const container = document.getElementById("recent-activity");

    if (!container) return;

    if (!activity.length) {
        container.innerHTML = `
            <p class="empty-state">
                暂无学习记录，开始今天的学习吧。
            </p>
        `;
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
   七、首页与个人中心统计
========================================= */

function calculateAccuracy() {
    if (!stats.totalQuestions) {
        return 0;
    }

    return Math.round(
        stats.correctQuestions / stats.totalQuestions * 100
    );
}

function updateDashboard() {
    const accuracy = `${calculateAccuracy()}%`;

    const pendingWrongCount = wrongbook.filter(
        item => item.reviewed !== true
    ).length;

    const values = {
        "stat-quiz-count": stats.quizCount,
        "stat-accuracy": accuracy,
        "stat-wrong-count": pendingWrongCount,
        "stat-document-count": stats.documentCount,

        "stat-total-questions": stats.totalQuestions,

        "stat-completed-tasks": currentStudyPlan
            ? getStudyPlanProgress(currentStudyPlan).completed
            : 0,

        "profile-quiz-count": stats.quizCount,
        "profile-total-questions": stats.totalQuestions,
        "profile-correct-questions": stats.correctQuestions,
        "profile-accuracy": accuracy,
        "profile-wrong-count": wrongbook.length,
        "profile-document-count": stats.documentCount
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    });

    renderActivity();
    renderLearningTrend();
}

/* =========================================
   八、最近七天答题趋势
========================================= */

function getLocalDateKey(date) {
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function renderLearningTrend() {
    const container = document.getElementById(
        "learning-trend-chart"
    );

    if (!container) return;

    const today = new Date();

    const days = [];

    for (let offset = 6; offset >= 0; offset--) {
        const date = new Date(today);

        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - offset);

        days.push({
            key: getLocalDateKey(date),
            label: `${date.getMonth() + 1}/${date.getDate()}`,
            count: 0
        });
    }

    const countByDate = new Map(
        days.map(day => [day.key, 0])
    );

    answerRecords.forEach(record => {
        if (!record.created_at) return;

        const date = new Date(record.created_at);

        if (Number.isNaN(date.getTime())) return;

        const key = getLocalDateKey(date);

        if (countByDate.has(key)) {
            countByDate.set(
                key,
                countByDate.get(key) + 1
            );
        }
    });

    days.forEach(day => {
        day.count = countByDate.get(day.key) || 0;
    });

    const maxCount = Math.max(
        1,
        ...days.map(day => day.count)
    );

    const total = days.reduce(
        (sum, day) => sum + day.count,
        0
    );

    if (!total) {
        container.innerHTML = `
            <div class="trend-empty">
                <p class="empty-state">
                    最近七天还没有答题记录。
                    完成一次智能练习后，这里就会出现趋势。
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="trend-summary">
            最近七天共完成
            <strong>${total}</strong>
            道题
        </div>

        <div class="trend-bars" role="img"
            aria-label="最近七天每日答题数量">

            ${days.map(day => {
                const height = day.count
                    ? Math.max(6, day.count / maxCount * 100)
                    : 0;

                return `
                    <div class="trend-day">

                        <strong class="trend-count">
                            ${day.count}
                        </strong>

                        <div class="trend-bar-track">
                            <div
                                class="trend-bar"
                                style="height:${height}%"
                            ></div>
                        </div>

                        <span>${day.label}</span>

                    </div>
                `;
            }).join("")}

        </div>
    `;
}

/* =========================================
   九、AI 对话
========================================= */

function renderConversation() {
    if (!chatBox) return;

    chatBox.innerHTML = "";

    if (!conversation.length) {
        chatBox.innerHTML = `
            <div class="message assistant-message">
                <div class="message-content">
                    你好！我是你的 AI 学习助手。
                    你可以向我提问、上传资料，
                    或者让我帮助你制定学习计划。
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

        writeStorage(
            STORAGE_KEYS.conversation,
            conversation
        );

        addActivity("AI 学习对话");

    } catch (error) {
        conversation.push({
            role: "assistant",
            content: `请求失败：${error.message}`
        });

        writeStorage(
            STORAGE_KEYS.conversation,
            conversation
        );

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
   十、学习模式
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
   十一、学习资料上传
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

    const fileName = file.name.toLowerCase();

    if (![".pdf", ".docx"].some(ext => fileName.endsWith(ext))) {
        uploadStatus.textContent =
            "目前仅支持 PDF 和 DOCX 格式。";

        return;
    }

    if (file.size > 10 * 1024 * 1024) {
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

    if (uploadStatus) {
        uploadStatus.textContent =
            "正在上传并提取资料内容...";
    }

    try {
        const data = await apiRequest(
            "/api/upload",
            {
                method: "POST",
                body: formData
            }
        );

        currentDocument = data;

        writeStorage(
            STORAGE_KEYS.document,
            currentDocument
        );

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

        if (uploadStatus) {
            uploadStatus.textContent =
                data.message || `资料上传成功：${data.filename}`;
        }

        addActivity(
            `上传学习资料：${data.filename}`
        );

        const nameEl = document.getElementById(
            "current-document-name"
        );

        if (nameEl) {
            nameEl.textContent =
                data.filename || "已上传资料";
        }

        const infoEl = document.getElementById(
            "current-document-info"
        );

        if (infoEl) {
            infoEl.textContent =
                `已提取 ${safeNumber(data.char_count)} 个字符`;
        }

        const practiceName = document.getElementById(
            "practice-document-name"
        );

        if (practiceName) {
            practiceName.textContent =
                data.filename || "已上传资料";
        }

    } catch (error) {
        if (uploadStatus) {
            uploadStatus.textContent = error.message;
        }

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
   十二、智能练习
========================================= */

async function generateQuiz() {
    if (isGeneratingQuiz) return;

    const ui = activeQuizUI;

    if (!currentDocument?.text) {
        if (ui.status) {
            ui.status.textContent = "请先上传学习资料。";
        }
        return;
    }

    const count = Number(ui.countInput?.value || 5);

    if (!Number.isInteger(count) || count < 1 || count > 10) {
        if (ui.status) {
            ui.status.textContent = "题目数量应为 1 至 10 题。";
        }
        return;
    }

    isGeneratingQuiz = true;

    setButtonLoading(
        ui.button,
        true,
        "生成中...",
        ui.activityLabel === "生成专项练习"
            ? "✧ 开始专项练习"
            : "生成测验"
    );

    if (ui.status) {
        ui.status.textContent = "AI 正在根据学习资料生成题目...";
    }

    if (ui.container) {
        ui.container.innerHTML = "";
    }

    try {
        const data = await apiRequest("/api/quiz", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                document_text: currentDocument.text,
                count,
                learning_mode: currentLearningMode
            })
        });

        currentQuiz = safeArray(data.questions);

        if (!currentQuiz.length) {
            throw new Error("AI 没有生成有效题目，请重新尝试。");
        }

        renderQuiz();

        addActivity(ui.activityLabel);

        if (ui.status) {
            ui.status.textContent =
                `成功生成 ${currentQuiz.length} 道题目。`;
        }

    } catch (error) {
        if (ui.status) {
            ui.status.textContent = error.message;
        }

    } finally {
        isGeneratingQuiz = false;

        setButtonLoading(
            ui.button,
            false,
            "生成中...",
            ui.activityLabel === "生成专项练习"
                ? "✧ 开始专项练习"
                : "生成测验"
        );
    }
}
            
function renderQuiz() {
    if (!quizContainer) return;

    quizContainer.innerHTML = currentQuiz.map(
        (question, index) => `
            <div class="quiz-question">

                <h3>
                    ${index + 1}.
                    ${escapeHTML(question.question)}
                </h3>

                ${["A", "B", "C", "D"].map(option => `
                    <label class="quiz-option">

                        <input
                            type="radio"
                            name="question-${index}"
                            value="${option}"
                        >

                        <span>
                            ${option}.
                            ${escapeHTML(
                                question.options?.[option] || ""
                            )}
                        </span>

                    </label>
                `).join("")}

            </div>
        `
    ).join("") + `
        <button
            id="submit-quiz-btn"
            class="primary-btn"
            type="button"
        >
            提交答案
        </button>

        <div id="quiz-result"></div>
    `;

    document
        .getElementById("submit-quiz-btn")
        ?.addEventListener("click", submitQuiz);
}

function submitQuiz() {
    if (!currentQuiz.length) return;

    const resultContainer = document.getElementById(
        "quiz-result"
    );

    if (!resultContainer) return;

    for (let index = 0; index < currentQuiz.length; index++) {
        const selected = document.querySelector(
            `input[name="question-${index}"]:checked`
        );

        if (!selected) {
            alert(`请先完成第 ${index + 1} 题。`);
            return;
        }
    }

    let correctCount = 0;

    const resultHTML = [];

    const newWrongAnswers = [];
    const newAnswerRecords = [];

    const submittedAt = new Date().toISOString();

    currentQuiz.forEach((question, index) => {
        const selected = document.querySelector(
            `input[name="question-${index}"]:checked`
        );

        const userAnswer = selected.value;

        const isCorrect =
            userAnswer === question.answer;

        if (isCorrect) {
            correctCount++;
        }

        if (!isCorrect) {
            newWrongAnswers.push({
                question: question.question,

                options: question.options || {},

                correct_answer: question.answer,

                user_answer: userAnswer,

                explanation: question.explanation || "",

                created_at: submittedAt,

                reviewed: false
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
                    <strong>
                        ${isCorrect ? "回答正确" : "回答错误"}
                    </strong>
                </p>

                <p>
                    你的答案：
                    ${escapeHTML(userAnswer)}
                </p>

                <p>
                    正确答案：
                    ${escapeHTML(question.answer)}
                </p>

                <p>
                    解析：
                    ${escapeHTML(
                        question.explanation || "暂无解析"
                    )}
                </p>

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

            <h3>
                本次得分：
                ${correctCount}/${currentQuiz.length}
            </h3>

            <p>
                正确率：
                ${accuracy}%
            </p>

            <p>
                本次新增错题：
                ${newWrongAnswers.length} 道
            </p>

        </div>

        ${resultHTML.join("")}
    `;

    quizContainer.querySelectorAll("input").forEach(input => {
        input.disabled = true;
    });

    const submitButton = document.getElementById(
        "submit-quiz-btn"
    );

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
   十三、错题本
========================================= */

function normalizeWrongbookItems() {
    let changed = false;

    wrongbook = wrongbook.map(item => {
        if (typeof item.reviewed !== "boolean") {
            changed = true;

            return {
                ...item,
                reviewed: false
            };
        }

        return item;
    });

    if (changed) {
        writeStorage(
            STORAGE_KEYS.wrongbook,
            wrongbook
        );
    }
}

function renderWrongbook() {
    if (!wrongbookContainer) return;

    normalizeWrongbookItems();

    const filter = wrongbookFilter?.value || "all";

    const sort = wrongbookSort?.value || "newest";

    let items = wrongbook.map((item, index) => ({
        ...item,
        _index: index
    }));

    if (filter === "reviewed") {
        items = items.filter(item => item.reviewed);
    }

    if (filter === "unreviewed") {
        items = items.filter(item => !item.reviewed);
    }

    items.sort((a, b) => {
        const timeA = new Date(
            a.created_at || 0
        ).getTime() || 0;

        const timeB = new Date(
            b.created_at || 0
        ).getTime() || 0;

        return sort === "oldest"
            ? timeA - timeB
            : timeB - timeA;
    });

    if (!items.length) {
        let message = "暂无错题。";

        if (wrongbook.length && filter === "reviewed") {
            message = "还没有已复习的错题。";
        } else if (
            wrongbook.length &&
            filter === "unreviewed"
        ) {
            message = "太棒了！当前没有待复习错题。";
        } else if (!wrongbook.length) {
            message =
                "暂无错题，完成智能练习后，答错的题目会自动保存在这里。";
        }

        wrongbookContainer.innerHTML = `
            <p class="empty-state">
                ${message}
            </p>
        `;

        updateWrongbookStatus();

        return;
    }

    wrongbookContainer.innerHTML = items.map(
        (item, displayIndex) => `
            <article class="wrongbook-item">

                <div class="wrongbook-item-header">

                    <h3>
                        ${displayIndex + 1}.
                        ${escapeHTML(item.question)}
                    </h3>

                    <span class="wrongbook-status ${
                        item.reviewed ? "reviewed" : "unreviewed"
                    }">
                        ${item.reviewed ? "已复习" : "待复习"}
                    </span>

                </div>

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
                    ${escapeHTML(
                        item.explanation || "暂无解析"
                    )}
                </p>

                <small>
                    ${escapeHTML(formatDate(item.created_at))}
                </small>

                <div class="wrongbook-item-actions">

                    <button
                        type="button"
                        class="secondary-btn wrongbook-review-toggle"
                        data-index="${item._index}"
                    >
                        ${
                            item.reviewed
                                ? "标记为待复习"
                                : "标记为已复习"
                        }
                    </button>

                </div>

            </article>
        `
    ).join("");

    updateWrongbookStatus();
}

function updateWrongbookStatus() {
    if (!wrongbookStatus) return;

    const reviewed = wrongbook.filter(
        item => item.reviewed === true
    ).length;

    const pending = wrongbook.length - reviewed;

    wrongbookStatus.textContent =
        `共 ${wrongbook.length} 道错题 · 待复习 ${pending} 道 · 已复习 ${reviewed} 道`;
}

if (wrongbookContainer) {
    wrongbookContainer.addEventListener("click", event => {
        const button = event.target.closest(
            ".wrongbook-review-toggle"
        );

        if (!button) return;

        const index = Number(button.dataset.index);

        if (
            !Number.isInteger(index) ||
            !wrongbook[index]
        ) {
            return;
        }

        wrongbook[index].reviewed =
            !wrongbook[index].reviewed;

        wrongbook[index].reviewed_at =
            wrongbook[index].reviewed
                ? new Date().toISOString()
                : null;

        writeStorage(
            STORAGE_KEYS.wrongbook,
            wrongbook
        );

        renderWrongbook();

        updateDashboard();

        addActivity(
            wrongbook[index].reviewed
                ? "复习了一道错题"
                : "将一道错题重新设为待复习"
        );
    });
}
wrongbookFilter?.addEventListener(
    "change",
    renderWrongbook
);

wrongbookSort?.addEventListener(
    "change",
    renderWrongbook
);

showWrongbookBtn?.addEventListener(
    "click",
    renderWrongbook
);

clearWrongbookBtn?.addEventListener("click", () => {
    if (!wrongbook.length) {
        if (wrongbookStatus) {
            wrongbookStatus.textContent =
                "错题本已经为空。";
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

    updateDashboard();

    if (wrongbookStatus) {
        wrongbookStatus.textContent =
            "错题本已清空。";
    }

    addActivity("清空错题本");
});

/* =========================================
   十四、AI 错题诊断
========================================= */

async function runDiagnosis() {
    if (isRunningDiagnosis) return;

    if (!wrongbook.length) {
        if (diagnosisStatus) {
            diagnosisStatus.textContent =
                "当前错题本为空，请先完成测验。";
        }

        return;
    }

    // 后端最多接收 50 道错题。
    // 只取最近 50 道，不修改或删除原错题本。
    const diagnosisBatch = wrongbook.slice(-50);

    isRunningDiagnosis = true;

    setButtonLoading(
        runDiagnosisBtn,
        true,
        "AI 正在分析...",
        "开始 AI 诊断"
    );

    if (diagnosisStatus) {
        diagnosisStatus.textContent =
            wrongbook.length > 50
                ? `错题共有 ${wrongbook.length} 道，本次先分析最近 50 道...`
                : "正在分析错题，请稍候...";
    }

    try {
        const data = await apiRequest(
            "/api/diagnose",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    wrong_answers: diagnosisBatch.map(item => ({
                        question: item.question,
                        options: item.options || {},
                        correct_answer: item.correct_answer,
                        user_answer: item.user_answer,
                        explanation: item.explanation || ""
                    }))
                })
            }
        );

        const diagnosisItems = safeArray(data.diagnoses);

        const now = new Date().toISOString();

        diagnosisItems.forEach(item => {
            const index = item.question_index;

            // question_index 是本次提交的 50 道题中的索引。
            if (
                !Number.isInteger(index) ||
                !diagnosisBatch[index]
            ) {
                return;
            }

            const source = diagnosisBatch[index];

            const record = {
                question: source.question,

                knowledge_point:
                    item.knowledge_point || "待确认",

                category:
                    item.category || "未分类",

                difficulty:
                    item.difficulty || "待确认",

                error_reason:
                    item.error_reason || "暂未分析",

                suggestion:
                    item.suggestion || "建议复习相关知识。",

                confidence:
                    safeNumber(item.confidence),

                created_at: now
            };

            const existingIndex = diagnoses.findIndex(
                d => d.question === record.question
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

        answerRecords = answerRecords.map(record => {
            const matched = diagnoses.find(
                d => d.question === record.question
            );

            return matched &&
                matched.knowledge_point !== "待确认"
                ? {
                    ...record,
                    knowledge_point: matched.knowledge_point
                }
                : record;
        });

        writeStorage(
            STORAGE_KEYS.answerRecords,
            answerRecords
        );

        if (diagnosisStatus) {
            diagnosisStatus.textContent =
                `诊断完成，共处理 ${diagnosisItems.length} 条诊断结果。`;
        }

        renderDiagnosisResults();

        await refreshDiagnosis();

        addActivity("完成 AI 错题诊断");

    } catch (error) {
        if (diagnosisStatus) {
            diagnosisStatus.textContent = error.message;
        }

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

function renderDiagnosisResults() {
    if (!diagnosisResults) return;

    if (!diagnoses.length) {
        diagnosisResults.innerHTML = `
            <p class="empty-state">
                暂无诊断结果。
            </p>
        `;

        return;
    }

    diagnosisResults.innerHTML = diagnoses.map(item => `
        <div class="diagnosis-result-item">

            <h3>
                ${escapeHTML(item.knowledge_point)}
            </h3>

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

async function refreshDiagnosis() {
    try {
        const data = await apiRequest(
            "/api/knowledge-stats",
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

    if (pointCount) {
        pointCount.textContent = items.length;
    }

    if (masteredCount) {
        masteredCount.textContent = mastered;
    }

    if (weakCount) {
        weakCount.textContent = weak;
    }

    if (!knowledgeList) return;

    if (!items.length) {
        knowledgeList.innerHTML = `
            <p class="empty-state">
                暂无知识点数据，先进行练习吧。
            </p>
        `;

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

function renderRecommendations(items) {
    if (!recommendationList) return;

    if (!items.length) {
        recommendationList.innerHTML = `
            <p class="empty-state">
                目前没有足够的薄弱知识点数据。
            </p>
        `;

        return;
    }

    recommendationList.innerHTML = items.map(item => `
        <div class="recommendation-item">

            <h3>
                ${escapeHTML(item.knowledge_point)}
            </h3>

            <p>
                掌握度：
                ${safeNumber(item.mastery)}%
            </p>
            <p>
                ${escapeHTML(item.recommendation)}
            </p>

        </div>
    `).join("");
}

/* =========================================
   十五、AI 学习计划
========================================= */

function createPlanId() {
    return "plan-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8);
}

function normalizeStudyPlan(plan) {
    if (!plan || !Array.isArray(plan.days)) {
        throw new Error("学习计划数据格式不正确。");
    }

    const normalizedDays = plan.days.map(
        (day, dayIndex) => ({
            ...day,

            day: day.day || dayIndex + 1,

            theme: day.theme || "每日学习",

            tasks: safeArray(day.tasks).map(
                (task, taskIndex) => ({
                    ...task,

                    id: String(
                        task.id ||
                        `day-${dayIndex + 1}-task-${taskIndex + 1}`
                    ),

                    title: task.title || "学习任务",

                    knowledge_point:
                        task.knowledge_point || "",

                    task_type:
                        task.task_type || "学习",

                    duration_minutes:
                        safeNumber(task.duration_minutes),

                    description:
                        task.description || "",

                    completion_criteria:
                        task.completion_criteria || ""
                })
            )
        })
    );

    return {
        ...plan,

        days: normalizedDays,

        id: plan.id || createPlanId(),

        created_at:
            plan.created_at || new Date().toISOString(),

        completed_task_ids:
            safeArray(plan.completed_task_ids)
    };
}

function saveCurrentStudyPlan() {
    if (currentStudyPlan) {
        writeStorage(
            STORAGE_KEYS.studyPlan,
            currentStudyPlan
        );
    }
}

function saveStudyPlanHistory() {
    writeStorage(
        STORAGE_KEYS.studyPlanHistory,
        studyPlanHistory
    );
}

async function generateStudyPlan() {
    if (isGeneratingPlan) return;

    const days = Number(planDaysInput?.value);

    const dailyMinutes = Number(
        planDailyMinutesInput?.value
    );

    const goal = planGoalInput?.value.trim();

    if (
        !Number.isInteger(days) ||
        days < 1 ||
        days > 14
    ) {
        if (planStatus) {
            planStatus.textContent =
                "学习计划天数应为 1 至 14 天。";
        }

        return;
    }

    if (
        !Number.isInteger(dailyMinutes) ||
        dailyMinutes < 15 ||
        dailyMinutes > 240
    ) {
        if (planStatus) {
            planStatus.textContent =
                "每日学习时间应为 15 至 240 分钟。";
        }

        return;
    }

    if (!goal) {
        if (planStatus) {
            planStatus.textContent =
                "请先填写学习目标。";
        }

        return;
    }

    isGeneratingPlan = true;

    setButtonLoading(
        generatePlanBtn,
        true,
        "AI 正在规划...",
        "✧ AI 生成学习计划"
    );

    if (planStatus) {
        planStatus.textContent =
            "正在分析你的学习记录和薄弱知识点，请稍候。";
    }

    try {
        const data = await apiRequest(
            "/api/study-plan",
            {
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
            }
        );

        if (!data.plan) {
            throw new Error(
                "服务器没有返回有效的学习计划。"
            );
        }

        if (currentStudyPlan) {
            studyPlanHistory.unshift({
                ...currentStudyPlan,
                archived_at: new Date().toISOString()
            });
        }

        currentStudyPlan = normalizeStudyPlan(
            data.plan
        );

        currentStudyPlan.settings =
            data.settings || {
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

        if (planStatus) {
            planStatus.textContent =
                "学习计划生成成功！";
        }

        addActivity(`生成 ${days} 天 AI 学习计划`);

    } catch (error) {
        if (planStatus) {
            planStatus.textContent = error.message;
        }

    } finally {
        isGeneratingPlan = false;

        setButtonLoading(
            generatePlanBtn,
            false,
            "AI 正在规划...",
            "✧ AI 生成学习计划"
        );
    }
}

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

    const completedIds = new Set(
        safeArray(plan.completed_task_ids)
    );

    const total = tasks.length;

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

    const progress = getStudyPlanProgress(
        currentStudyPlan
    );

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
        progressText.textContent =
            `${progress.percentage}%`;
    }

    if (progressFill) {
        progressFill.style.width =
            `${progress.percentage}%`;
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

function renderStudyPlan() {
    const titleElement = document.getElementById(
        "plan-title"
    );

    const summaryElement = document.getElementById(
        "plan-summary"
    );

    if (!planContainer) return;

    if (!currentStudyPlan) {
        planContainer.innerHTML = `
            <p class="empty-state">
                你还没有学习计划，
                点击上方按钮让 AI 为你生成一份。
            </p>
        `;

        if (titleElement) {
            titleElement.textContent = "我的学习计划";
        }

        if (summaryElement) {
            summaryElement.textContent =
                "生成计划后，这里会显示计划说明。";
        }

        const defaults = [
            ["plan-progress-text", "0%"],
            ["plan-completed-count", "已完成 0 项"],
            ["plan-total-count", "共 0 项任务"]
        ];

        defaults.forEach(([id, value]) => {
            const el = document.getElementById(id);

            if (el) el.textContent = value;
        });

        const fill = document.getElementById(
            "plan-progress-fill"
        );

        if (fill) fill.style.width = "0%";

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

    planContainer.innerHTML =
        currentStudyPlan.days.map(day => `
            <div class="plan-day-card">

                <div class="plan-day-heading">

                    <div>
                        <span class="plan-day-label">
                            DAY ${escapeHTML(day.day)}
                        </span>

                        <h3>
                            ${escapeHTML(day.theme)}
                        </h3>
                    </div>

                    <span class="plan-day-task-count">
                        ${safeArray(day.tasks).length} 项任务
                    </span>

                </div>

                <div class="plan-task-list">

                    ${safeArray(day.tasks).map(task => {
                        const completed =
                            completedIds.has(task.id);

                        return `
                            <div class="plan-task-item ${
                                completed ? "completed" : ""
                            }">

                                <label class="plan-task-checkbox">

                                    <input
                                        type="checkbox"
                                        class="plan-task-check"
                                        data-task-id="${escapeHTML(task.id)}"
                                        ${completed ? "checked" : ""}
                                    >

                                    <span class="plan-task-checkmark"></span>

                                </label>

                                <div class="plan-task-content">

                                    <div class="plan-task-header">

                                        <h4>
                                            ${escapeHTML(task.title)}
                                        </h4>

                                        <span class="plan-task-duration">
                                            ${safeNumber(task.duration_minutes)}
                                            分钟
                                        </span>

                                    </div>

                                    <div class="plan-task-tags">

                                        <span>
                                            ${escapeHTML(task.task_type)}
                                        </span>

                                        ${
                                            task.knowledge_point
                                                ? `<span>${escapeHTML(task.knowledge_point)}</span>`
                                                : ""
                                        }
                                    </div>

                                    <p>
                                        ${escapeHTML(task.description)}
                                    </p>

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

function handleStudyPlanTaskChange(event) {
    const checkbox = event.target.closest(
        ".plan-task-check"
    );

    if (!checkbox || !currentStudyPlan) return;

    const completedIds = new Set(
        safeArray(currentStudyPlan.completed_task_ids)
    );

    if (checkbox.checked) {
        completedIds.add(checkbox.dataset.taskId);
    } else {
        completedIds.delete(checkbox.dataset.taskId);
    }

    currentStudyPlan.completed_task_ids =
        Array.from(completedIds);

    saveCurrentStudyPlan();

    renderStudyPlan();

    renderStudyPlanHistory();

    updateDashboard();
}

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

    studyPlanHistory = studyPlanHistory
        .filter(item => item.id !== currentStudyPlan.id)
        .slice(0, 20);

    saveCurrentStudyPlan();

    saveStudyPlanHistory();

    renderStudyPlan();

    renderStudyPlanHistory();

    updateDashboard();

    if (planStatus) {
        planStatus.textContent =
            "已切换到历史学习计划。";
    }
}

function renderStudyPlanHistory() {
    if (!planHistoryContainer) return;

    if (!studyPlanHistory.length) {
        planHistoryContainer.innerHTML = `
            <p class="empty-state">
                暂无历史计划。
            </p>
        `;

        return;
    }

    planHistoryContainer.innerHTML =
        studyPlanHistory.map(plan => {
            const progress = getStudyPlanProgress(plan);

            const createdAt = plan.created_at
                ? new Date(plan.created_at).toLocaleDateString("zh-CN")
                : "日期未知";

            const isCurrent =
                currentStudyPlan &&
                currentStudyPlan.id === plan.id;

            return `
                <div class="plan-history-item">

                    <div class="plan-history-info">

                        <strong>
                            ${escapeHTML(plan.title || "学习计划")}
                        </strong>

                        <span>
                            ${escapeHTML(createdAt)}
                            · ${progress.completed}/${progress.total}
                            项完成 · ${progress.percentage}%
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
   十六、事件绑定
========================================= */

chatForm?.addEventListener(
    "submit",
    sendMessage
);

uploadForm?.addEventListener(
    "submit",
    uploadDocument
);

generateQuizBtn?.addEventListener(
    "click",
    generateQuiz
);

runDiagnosisBtn?.addEventListener(
    "click",
    runDiagnosis
);

refreshDiagnosisBtn?.addEventListener(
    "click",
    refreshDiagnosis
);

generatePlanBtn?.addEventListener(
    "click",
    generateStudyPlan
);

planContainer?.addEventListener(
    "change",
    handleStudyPlanTaskChange
);

planHistoryContainer?.addEventListener(
    "click",
    event => {
        const button = event.target.closest(
            ".plan-history-load"
        );

        if (button) {
            loadHistoricalStudyPlan(
                button.dataset.planId
            );
        }
    }
);

/* =========================================
   十七、初始化
========================================= */

function initializeApp() {
    initializeTheme();

    restoreLearningMode();

    normalizeWrongbookItems();

    renderConversation();

    renderWrongbook();

    renderDiagnosisResults();

    updateDashboard();

    renderStudyPlan();

    renderStudyPlanHistory();

    const documentName =
        currentDocument?.filename || "";

    const nameEl = document.getElementById(
        "current-document-name"
    );

    if (nameEl && documentName) {
        nameEl.textContent = documentName;
    }

    const infoEl = document.getElementById(
        "current-document-info"
    );

    if (infoEl && currentDocument?.text) {
        infoEl.textContent =
            `已提取 ${currentDocument.text.length} 个字符`;
    }

    const practiceName = document.getElementById(
        "practice-document-name"
    );

    if (practiceName) {
        practiceName.textContent =
            documentName || "尚未上传学习资料";
    }

    renderLearningTrend();

    refreshDiagnosis();
}

initializeApp();