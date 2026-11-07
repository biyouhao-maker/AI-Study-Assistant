# AI Study Assistant（智能学习助手）

基于 LLM 的个人学习辅助 Web 应用：上传学习资料（PDF / DOCX），让 AI 帮你出题练习、诊断薄弱知识点、分析错题、制定学习计划。

- **后端**：FastAPI，同时托管前端静态页面（同源，无需单独部署前端）
- **前端**：原生 HTML / CSS / JavaScript，无构建步骤
- **模式**：BYOK 多厂商——用户在网页「⚙ API 设置」里选择厂商并填自己的 API Key，服务器不配置、不存储任何密钥

当前版本：**V1.3.2**

## 功能

六大页面：

| 页面 | 说明 |
|---|---|
| 首页 | 功能快速入口 |
| AI 对话 | 基于上传资料的学习问答 |
| 学习诊断 | 知识点掌握统计与学习建议 |
| AI 学习计划 | 根据学习目标生成学习计划 |
| 我的错题本 | 录入错题，AI 诊断错误原因 |
| 个人中心 | API 设置（BYOK 密钥配置） |

对应 API 一览：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/chat` | 学习对话 |
| POST | `/api/upload` | 上传 PDF / DOCX 学习资料 |
| POST | `/api/quiz` | 根据资料生成练习题 |
| POST | `/api/diagnose` | 错题诊断 |
| POST | `/api/knowledge-stats` | 知识点掌握统计 |
| POST | `/api/recommendations` | 学习建议 |
| POST | `/api/study-plan` | 生成学习计划 |

### BYOK 多厂商

用户密钥仅通过请求头（`X-User-API-Key`）传递，不落库、不写日志。通过服务端厂商白名单与每厂商的 Key 格式校验，支持：

DeepSeek、Kimi（月之暗面）、通义千问、硅基流动、智谱 GLM、OpenRouter

### 安全设计

- 按 IP 限流：AI 接口（chat / quiz / diagnose / study-plan）默认 10 次/分钟，上传默认 20 次/分钟，均可用环境变量调整
- 请求体大小限制（12MB），防止超大请求耗尽内存
- Pydantic 严格入参校验 + AI 输出格式校验（JSON 模式，失败时回退围栏解析）
- API 文档开关：生产环境设 `ENABLE_DOCS=0` 后 `/docs` 与 `/openapi.json` 返回 404

## 环境要求

- Python 3.13（见 `.python-version`；3.10+ 一般可用）
- pip

## 快速开始（本地开发）

```bash
# 1. 创建虚拟环境并安装依赖
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # Windows
# .venv/bin/pip install -r requirements.txt        # macOS / Linux

# 2. （可选）配置环境变量，参考 .env.example
#    V1.3.2 起为 BYOK 模式，服务器无需配置任何 LLM 密钥

# 3. 启动（后端同时托管前端页面）
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

浏览器打开 http://127.0.0.1:8000 ，在「个人中心 → ⚙ API 设置」里选择厂商并填入你自己的 API Key 即可使用。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `AI_RATE_LIMIT` | `10/minute` | AI 接口（chat/quiz/diagnose/study-plan）按 IP 限流 |
| `UPLOAD_RATE_LIMIT` | `20/minute` | 上传接口限流 |
| `ENABLE_DOCS` | `1` | API 文档开关，公网部署建议设 `0` |
| `DEEPSEEK_API_KEY` | 不再需要 | V1.3.2 起 BYOK 模式下服务端密钥配置已不使用，可删除 |

## 测试

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

共 26 个用例，全部走桩（stub）实现，**不调用真实 AI 接口、不产生任何费用**。

## 部署

仓库已内置 `Procfile` 和 `.python-version`，可直接部署到 Render、Railway 等 PaaS（Render 免费档零费用，步骤见 `docs/DEPLOYMENT.md` 第五节）：

```bash
# 启动命令（Procfile 内容）
uvicorn backend.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"
```

生产部署要点（详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)）：

- 部署在反向代理后必须加 `--proxy-headers`，否则限流按代理 IP 计数，所有用户共享限额
- **worker 数量必须为 1**：限流为进程内存计数，多 worker / 多实例会导致限额 ×N，如需横向扩容须改用 Redis 共享存储
- 公网部署设置 `ENABLE_DOCS=0`
- HTTPS 由部署层负责（PaaS 自带；自管服务器用 Nginx/Caddy + Let's Encrypt）

## 项目结构

```
backend/main.py     FastAPI 应用（路由、校验、限流、LLM 调用、文档解析）
frontend/           原生前端（index.html / script.js / style.css / navigation.js）
tests/              pytest 测试套件
docs/               部署指南（DEPLOYMENT.md）与验收报告（ACCEPTANCE_REPORT.md）
uploads/            上传文件临时目录（已 gitignore）
Procfile            PaaS 启动命令
.env.example        环境变量模板
```

## 已知限制

| 项目 | 状态 |
|---|---|
| 限流存储 | 进程内存，单进程有效；重启后计数清零；多实例需 Redis |
| 数据持久化 | 前端 localStorage，仅本浏览器本机；无云端同步 |
| 文件类型校验 | 仅按扩展名（.pdf / .docx） |
| HTTPS | 取决于部署平台，本地开发为 HTTP |

## License

仅供个人学习使用。
