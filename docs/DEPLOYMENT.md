# AI Study Assistant V1.3 部署指南

## 一、本地开发环境启动（Windows）

```bash
cd D:\AI-Study-Assistant\AI-Study-Assistant

# 首次：创建虚拟环境并安装依赖
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# 在 backend\.env 中配置（参考 .env.example）：
#   DEEPSEEK_API_KEY=你的密钥
#   AI_RATE_LIMIT=10/minute
#   UPLOAD_RATE_LIMIT=20/minute
#   ENABLE_DOCS=1

# 启动后端（同时托管前端静态页面）
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 运行自动化测试（不产生任何 AI 费用）
.venv\Scripts\python -m pytest tests/ -v
```

浏览器打开 http://127.0.0.1:8000 即可使用。

## 二、环境变量说明

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 不再需要 | **V1.3.2 起为 BYOK 多厂商模式**：用户在网页"⚙ API 设置"里选择厂商（DeepSeek / Kimi / 通义千问 / 硅基流动 / 智谱 GLM / OpenRouter）并填对应密钥，服务器不再配置密钥（Render 上可删除此变量） |
| `AI_RATE_LIMIT` | `10/minute` | AI 接口（chat/quiz/diagnose/study-plan）按 IP 限流 |
| `UPLOAD_RATE_LIMIT` | `20/minute` | 上传接口限流 |
| `ENABLE_DOCS` | `1` | API 文档开关，公网部署建议设 `0` |

## 三、生产部署前提（需要用户决策的事项）

以下事项需要你先确认，才能进行实际部署（涉及购买服务器/域名时须先征得你的同意）：

1. **部署平台**：本地 Windows 常驻 / 云服务器 / PaaS 平台（Render、Railway 等）？
2. **域名**：是否购买域名并配置 DNS？
3. **HTTPS 证书**：由平台自动提供（PaaS）或用 Let's Encrypt（自管服务器）？
4. **费用授权**：上述涉及的任何费用。

## 四、部署配置要点

### 1. 启动方式

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"
```

- `--proxy-headers`：部署在反向代理（Nginx/Caddy/平台网关）后必须加，否则所有用户共享同一个限流计数。
- **Worker 数量必须为 1**（默认）：当前限流用进程内存计数，多 worker 会导致限额 ×N。如需多 worker/多实例，须改用 Redis 共享存储（slowapi 支持 `storage_uri="redis://..."`，需自备 Redis 服务）。

### 2. HTTPS

本项目不做自签名/强制 HTTPS；由部署层负责：
- PaaS 平台（Render 等）默认自带 HTTPS。
- 自管服务器：Nginx/Caddy 反向代理 + Let's Encrypt 证书。参考 FastAPI 官方文档 https://fastapi.tiangolo.com/deployment/https/

### 3. 关闭 API 文档

公网部署时设置环境变量 `ENABLE_DOCS=0`，`/docs` 和 `/openapi.json` 将返回 404。

### 4. CORS

前端由同一个 FastAPI 应用托管（同源），**无需配置 CORS**。若日后前后端分离部署，再添加 `CORSMiddleware` 并限制具体域名。

### 5. 服务异常退出后的恢复

- PaaS 平台：自带进程守护与自动重启。
- 自管 Linux 服务器：`systemd` 服务单元（`Restart=always`）。
- Windows 常驻：任务计划程序开机启动，或用 NSSM 注册为系统服务。

### 6. 日志

当前日志输出到控制台（uvicorn/stderr）。生产环境由平台收集，或自管时重定向到文件并配置轮转（如 `logrotate`）。日志内容不含密钥与用户学习资料。

## 五、PaaS 平台快速部署（以 Render 免费档为例，零费用）

仓库已内置 `Procfile` 和 `.python-version`，Render/Railway 等平台可直接识别启动命令。

1. 用 GitHub 账号登录 https://render.com
2. **New → Web Service** → 授权安装 Render 的 GitHub 应用时，选择 `biyouhao-maker/AI-Study-Assistant`（**私有仓库可直接授权，无需改 Public**）
3. 配置（多数自动识别）：
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: 来自 Procfile（`uvicorn backend.main:app --host 0.0.0.0 --port $PORT ...`）
4. **环境变量**（在 Render 后台填写，绝不写进仓库）：
   - `ENABLE_DOCS` = `0`
   - （V1.3.1 起为 BYOK 模式，`DEEPSEEK_API_KEY` 不再需要；如已配置可删除）
5. **Create Web Service** → 等待构建完成 → 得到 `https://<名称>.onrender.com`
6. 以后每次 `git push`，平台自动重新部署

免费档注意：15 分钟无访问会休眠，下次访问需等待约 30 秒；单实例，与本项目内存限流兼容。

## 六、已知限制（上线前须知）

| 项目 | 状态 |
|---|---|
| 限流存储 | 进程内存，单进程有效；重启后计数清零；多实例需 Redis |
| 数据持久化 | 前端 localStorage，仅本浏览器本机；无云端同步 |
| 文件类型校验 | 仅按扩展名（用户已决策暂不加文件头校验） |
| HTTPS | 取决于部署平台，本地开发为 HTTP |
