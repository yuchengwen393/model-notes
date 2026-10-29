# 模型手记 · Model Notes

一个从零训练语言模型、再做插件与部署的个人博客。静态页面发布在 GitHub Pages，内容由本机的 Node.js + SQLite 内容后端托管并提供管理后台，对话页调用本机的 Flask 推理服务，加载课程中训练出的 MiniMind-768 SFT 权重。

- 站点：https://yuchengwen393.github.io/model-notes/
- 模型：8 层、768 维、6391 万参数，预训练 19,848 步 + SFT 14,152 步
- 推理：CPU，约 30 tokens/s

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：最新文章、训练轨迹、项目与对话入口 |
| `posts.html` | 归档：搜索与标签筛选 |
| `post.html` | 文章详情，Markdown 在浏览器端渲染 |
| `projects.html` | 五个课程项目（读取内容 API） |
| `about.html` | 项目定位、技能与个人信息（读取内容 API） |
| `chat.html` | 与本地模型对话 |
| `admin.html` | 内容管理：站点、个人信息、项目、文章（需管理口令） |

文章正文在 `posts/*.md`，静态索引在 `data/posts.json`；内容后端运行时，前台优先读取 `/api/*`，数据库为 `backend/blog.db`。

## 设计文档

- `PRD.md`：目标、用户、功能范围、验收标准；
- `TECH_DESIGN.md`：静态站 + 内容后端 + 模型后端的架构与接口；
- `AGENTS.md`：开发约定、运行命令与测试清单。

## 本地运行

### 内容后端（推荐，同时托管页面）

要求 Node.js 24+，无需安装第三方依赖：

```powershell
cd 10.27\blog\backend
node server.js
```

访问 http://127.0.0.1:8100/ ，管理页 http://127.0.0.1:8100/admin.html 。首次启动会创建数据库、播种内容并生成 `admin_token.txt`。

### 纯静态调试

```powershell
cd 10.27\blog
python -m http.server 8002 --bind 127.0.0.1
```

访问 http://127.0.0.1:8002/ 。此方式下没有内容 API，页面自动回退静态 JSON / Markdown。

## 模型服务

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe app.py
```

默认监听 `127.0.0.1:5050`，加载 `10.21/out_large/full_sft_large_768.pth`。接口：

- `GET /api/health`
- `POST /api/chat`，请求体 `{"messages": [...], "max_new_tokens": 180}`

## 内容接口

- `GET /api/health`
- `GET /api/site`（含 `profile` 个人信息）
- `GET /api/projects`
- `GET /api/posts`
- `GET /api/posts/<id>`

管理接口统一要求请求头 `X-Admin-Token`：

- `GET /api/admin/session`
- `PUT /api/admin/site`（合并保存，不会清空个人信息）
- `PUT /api/admin/profile`（单独保存个人信息）
- `POST / PUT / DELETE /api/admin/projects`
- `POST / PUT / DELETE /api/admin/posts`

## 部署

博客静态文件推送到 GitHub 后，在仓库 Settings → Pages 选择 `main` 分支、根目录即可。内容与对话接口需要分别启动本机服务与公网隧道：

```powershell
cd 10.27\chat-service
.\cloudflared.exe tunnel --url http://127.0.0.1:8100
# 另开窗口
.\cloudflared.exe tunnel --url http://127.0.0.1:5050
```

把内容隧道地址写入 `data/config.json` 的 `contentApi`，模型隧道地址写入 `chatApi`。隧道关闭或重启后地址会变化，更新该文件即可；页面每次加载都会重新读取配置。

## 边界

GitHub Pages 不能运行 Python 或 Node，所以内容管理与模型对话依赖本机进程与隧道；隧道不可用时，博客自动回退静态数据，文章阅读不受影响。模型只有 6391 万参数，回答可能不准确，页面已注明。
