# 技术设计文档（TECH_DESIGN）· 模型手记

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.3 |
| 编写日期 | 2026-10-29 |
| 对应版本 | 线上 v1.3（2026-10-29） |
| 线上地址 | https://yuchengwen393.github.io/model-notes/ |
| 代码仓库 | https://github.com/yuchengwen393/model-notes |

---

## 一、设计目标

1. 用最少的运行依赖交付一个可长期访问的静态博客；
2. 让课程中训练出的 MiniMind-768 SFT 权重真实参与页面交互；
3. 静态站与推理服务解耦：模型离线不影响文章阅读；
4. 不引入前端框架与构建工具，降低维护成本；
5. 隧道地址、文章内容、页面样式都能独立替换；
6. 增加内容后端，让站点信息、项目与文章可以在管理页在线维护，同时保留静态兜底。

## 二、总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│ 浏览器                                                       │
│  HTML / CSS / 原生 JavaScript                               │
│  ├── data/config.json        chatApi / contentApi（no-store）│
│  ├── js/blog-api.js          API 优先、静态兜底              │
│  ├── js/chat.js              模型对话状态机                  │
│  └── js/admin.js             内容管理（X-Admin-Token）        │
└───────────┬──────────────────────────────┬──────────────────┘
            │ HTTPS                        │ HTTPS
            ▼                              ▼
┌───────────────────────────┐   ┌───────────────────────────────┐
│ 内容链路                   │   │ 模型链路                       │
│ Cloudflare Tunnel         │   │ Cloudflare Tunnel             │
│ 127.0.0.1:8100            │   │ 127.0.0.1:5050                │
│ Node.js + node:sqlite     │   │ Flask + PyTorch CPU           │
│ 静态页面 + /api/*         │   │ MiniMind-768 SFT              │
└───────────┬───────────────┘   └───────────────────────────────┘
            │ 首次启动播种
            ▼
┌───────────────────────────┐
│ data/site.json            │
│ data/projects.json        │
│ data/posts.json + posts/  │
└───────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GitHub Pages（静态兜底）                                     │
│ repo: yuchengwen393/model-notes / main / .nojekyll           │
│ 内容 API 不可用时，页面回退 data/*.json 与 posts/*.md         │
└─────────────────────────────────────────────────────────────┘
```

**关键取舍**：GitHub Pages 只托管静态文件，无法运行 Python 或 Node。v1.3 把内容维护与模型推理分别放在两个本机服务中：内容服务用 Node.js，模型服务用 Flask，通过 Cloudflare 隧道暴露 HTTPS 地址。三条链路互相独立：

1. **页面链路**：GitHub Pages 永久可访问；
2. **内容链路**：内容 API 在线时页面数据来自 SQLite，管理页可读写；离线时自动回退静态 JSON / Markdown；
3. **模型链路**：推理服务在线时对话可用，离线只影响对话页。

## 三、技术选型

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 页面 | HTML5 + CSS3 + 原生 JavaScript | 无构建、无依赖，Pages 直接托管 |
| 样式 | 原生 CSS + CSS 变量 | 设计令牌集中，换色只改 `:root` |
| 文章 | Markdown + 自写渲染器 | 内容与页面分离，不引入 marked 等库 |
| 数据 | JSON（静态兜底）+ SQLite（内容后端） | 静态可缓存；后端可在线维护 |
| 内容服务 | Node.js 24+ + 内置 `node:sqlite` | 零第三方依赖，单文件可运行，与静态页面同源 |
| 内容管理 | 原生 JS + 管理口令 | 不引入账号体系，满足课程后台要求 |
| 推理服务 | Python 3.14 + Flask 3.1 | 轻量、易调试，适合本机单模型 |
| 模型运行时 | PyTorch 2.14.1+cpu + Transformers 5.21 | 与 10.21 训练代码一致，CPU 可跑 |
| 模型 | MiniMind-768 SFT | 8 层 / 768 维 / 6391 万参数，课程自有权重 |
| 隧道 | cloudflared Quick Tunnel | 无需账号、HTTPS、比 localhost.run 稳定 |
| 版本管理 | Git + GitHub | 每次改动可回退，Pages 自动构建 |

## 四、目录结构

```text
10.27/
├── blog/                          # 静态站 + 内容后端，Pages 根目录
│   ├── index.html                 # 首页
│   ├── posts.html                 # 文章列表
│   ├── post.html                  # 文章详情
│   ├── projects.html              # 项目
│   ├── about.html                 # 关于
│   ├── chat.html                  # 模型对话
│   ├── admin.html                 # 内容管理（noindex）
│   ├── css/style.css              # 全部样式与设计令牌
│   ├── js/
│   │   ├── site.js                # 导航、菜单、滚动淡入、年份
│   │   ├── blog-api.js            # 内容 API 客户端（API 优先、静态兜底）
│   │   ├── home.js                # 首页最新文章
│   │   ├── posts.js               # 归档搜索与标签筛选
│   │   ├── post.js                # 详情加载、进度、相关阅读
│   │   ├── projects.js            # 项目卡片动态渲染
│   │   ├── about.js               # 关于页站点信息与个人信息卡片
│   │   ├── admin.js               # 管理页：口令、站点、个人信息、项目、文章
│   │   ├── markdown.js            # 轻量 Markdown 渲染
│   │   └── chat.js                # 对话状态机与请求
│   ├── backend/
│   │   ├── server.js              # Node.js 内容后端：静态托管 + 公开 API + 管理 API
│   │   ├── package.json           # npm start 脚本，无第三方依赖
│   │   ├── blog.db                # SQLite（不提交）
│   │   └── admin_token.txt        # 管理口令（不提交）
│   ├── data/
│   │   ├── site.json              # 站点信息种子
│   │   ├── projects.json          # 项目种子
│   │   ├── posts.json             # 文章索引种子 / 静态兜底
│   │   └── config.json            # chatApi / contentApi（no-store）
│   ├── posts/                     # 8 篇 Markdown 正文（种子 / 静态兜底）
│   ├── PRD.md
│   ├── TECH_DESIGN.md
│   ├── AGENTS.md
│   ├── README.md
│   ├── favicon.svg
│   └── .nojekyll
└── chat-service/                  # 本地推理服务（不进入 Pages 仓库）
    ├── app.py
    ├── test_model.py
    ├── requirements.txt
    ├── README.md
    ├── cloudflared.exe            # 本地工具，52.8MB，不提交
    └── .venv/                     # 本地虚拟环境，不提交
```

## 五、前端设计

### 5.1 页面组织

采用静态多页结构，而不是单页路由：

- 共享头部：品牌、五项导航、移动端菜单；
- 共享页脚：文章、项目、对话、内容管理、GitHub、版权；
- `body[data-page]` 标记当前页面，`site.js` 据此设置 `aria-current`；
- 文章详情通过 `post.html?id=<id>` 读取；
- 文章筛选通过 `posts.html?tag=<tag>` 带入；
- 管理页 `admin.html` 独立于主导航，前台页脚提供「内容管理」入口，口令登录后维护内容。

没有模板引擎，头部与页脚在六个前台 HTML 中重复。这是刻意取舍：避免引入构建步骤，代价是改导航时需要同步六处。

### 5.2 数据加载

- 首页 / 列表 / 项目 / 关于 / 详情统一通过 `js/blog-api.js` 读取内容；
- `BlogAPI` 先读 `data/config.json` 的 `contentApi`，再请求 `/api/site`、`/api/projects`、`/api/posts`、`/api/posts/<id>`；
- 本地通过 `127.0.0.1` / `localhost` 访问时直接使用同源 API，避免隧道离线导致后台不可用；
- 内容 API 请求失败（断网、后端未启动、隧道失效）时自动回退 `data/site.json`、`data/projects.json`、`data/posts.json` 与 `posts/<id>.md`；
- 请求失败时展示可读的错误文案，不抛出未捕获异常；
- 文章索引只含元数据（标题、摘要、标签、阅读时长），正文按需加载；
- 对话与内容配置单独放在 `data/config.json`，用 `fetch(..., { cache: "no-store" })` 加时间戳读取，确保隧道地址更新后立即生效；
- `site.js` 读取 `/api/site`，把站点 `title` 同步到所有 `[data-site-title]` 元素与浏览器标题，避免页头品牌名写死。

### 5.3 Markdown 渲染

`js/markdown.js` 是约 100 行的轻量渲染器，处理顺序：

1. 先用正则抽出 ``` 或 ~~~ 代码块，替换为占位符；
2. 对其余文本做 HTML 转义，防止标签注入；
3. 按行解析标题、无序 / 有序列表、引用、分隔线、段落；
4. 行内处理行内代码、粗体与 `[文字](https://...)` 链接；
5. 最后回填代码块，输出 `<pre><code>`。

不支持表格、图片、脚注等复杂语法；当前 8 篇文章未使用这些语法。

### 5.4 对话模块

`js/chat.js` 是一个显式状态机：

```text
初始化
  └── fetch config.json（no-store）
        └── GET /api/health（6s 超时）
              ├── ok      → 状态「模型在线」
              └── 失败    → 状态「模型服务离线」

发送
  ├── 空内容 / busy → 忽略
  ├── push 用户消息 → 渲染
  ├── 显示打字动画 + 计时器
  ├── POST /api/chat（AbortController 180s）
  │     ├── 成功 → 渲染回复、tokens、耗时、tokens/s
  │     └── 失败 → 移除动画，显示原因
  └── 解锁输入
```

- 历史只保存在内存，刷新即清空；
- 每次最多发送最近 8 条消息；
- 页面最多请求 180 个新 token，避免 CPU 等待过久；
- 回复若包含 `</think>`，将思考部分放入可折叠区域；
- 不持久化对话，不收集用户信息。

### 5.5 样式系统

- 设计令牌全部位于 `css/style.css` 的 `:root`：纸张色、墨色、强调色、深色块、字体栈、最大宽度；
- 页面区块使用 `.section`、`.section--tint`、`.chat-teaser` 形成三种底色层次；
- 按钮统一深色：墨色主按钮、深朱红强调按钮、悬停使用 `--accent-dark`；
- 标题使用衬线字体栈，正文使用无衬线字体栈，数据与标签使用等宽字体；
- 断点：980px（两栏收为单栏）、720px（导航折叠、列表单列）；
- 使用 `text-wrap: balance/pretty`、`prefers-reduced-motion`、`IntersectionObserver` 做轻量体验优化；
- 不加载外部字体、图片或 CDN。

## 六、后端设计

### 6.1 模型服务运行环境

- Python 3.14，独立虚拟环境 `chat-service/.venv`；
- `torch 2.14.1+cpu`、`transformers 5.21`、`Flask 3.1`；
- 权重：`10.21/out_large/full_sft_large_768.pth`（131MB，fp16 保存，CPU 以 fp32 加载）；
- 分词器：`10.21/modelT`，词表 6400；
- 模型：8 层、768 维、12 头，参数量 **63,912,192**。

### 6.2 模型启动与加载

```text
读取环境变量（模型目录 / 权重 / 分词器 / 端口）
  → 加载 tokenizer
  → 构建 GPTForCausalLM(768, 8)
  → torch.load(checkpoint, map_location="cpu")
  → load_state_dict(strict=False)，missing / unexpected 非空即报错
  → model.eval()
  → 记录参数量与加载时间
  → Flask 监听 127.0.0.1:5050
```

模型加载失败时服务仍会启动，但 `/api/health` 返回 `status=loading` 且带 `error`，前端据此显示离线。

### 6.3 生成流程

1. 校验 `messages`：仅接受 `user` / `assistant`，最后一条必须是 `user`；
2. 截取最近 8 条，每条内容最多 2000 字；
3. 使用分词器的 Chat Template 拼接 `<|im_start|>user ... <|im_end|>`；
4. 在 `threading.Lock` 内串行生成，避免并发争抢模型；
5. 生成参数：`temperature=0.7`、`top_p=0.9`、`top_k=50`、`repetition_penalty=1.05`；
6. 解码后去掉 `<|im_start|>` / `<|im_end|>`，若含 `</think>` 则拆出思考过程；
7. 返回正文、思考过程、token 数、耗时与速度。

CPU 推理实测约 **27–32 tokens/s**；60–180 tokens 的回答通常 2–7 秒。

### 6.4 模型接口契约

#### GET `/api/health`

响应 200：

```json
{
  "status": "ok",
  "model": "MiniMind-768 SFT",
  "params": 63912192,
  "device": "cpu",
  "checkpoint": "full_sft_large_768.pth",
  "uptime_seconds": 3305.2,
  "error": null
}
```

#### POST `/api/chat`

请求：

```json
{
  "messages": [
    { "role": "user", "content": "你好，请用一句话介绍你自己。" }
  ],
  "max_new_tokens": 180,
  "temperature": 0.7,
  "top_p": 0.9
}
```

响应 200：

```json
{
  "reply": "我是由中国的个人开发者开发的智能助手 minimind……",
  "reasoning": "",
  "tokens": 58,
  "seconds": 1.51,
  "tokens_per_second": 38.4,
  "model": "MiniMind-768 SFT"
}
```

约束：

- `max_new_tokens` 上限 512，服务默认 320；
- `temperature` 限制在 0.1–1.5；
- `top_p` 限制在 0.1–1.0；
- `messages` 为空或最后一条不是 `user` 时返回 400；
- 模型未就绪返回 503；
- 生成异常返回 500，并带 `error` 文本。

### 6.5 跨域与网络

- 响应头：`Access-Control-Allow-Origin: *`，允许 GET / POST / OPTIONS；
- 服务只监听 `127.0.0.1`，不直接暴露 5050；
- 公网入口为 Cloudflare Quick Tunnel 的 HTTPS 域名；
- 前端在 HTTPS 页面请求 HTTPS 隧道，避免混合内容拦截。

### 6.6 模型错误处理

| 场景 | 前端表现 | 后端行为 |
| --- | --- | --- |
| 模型加载中 | 状态「检查中 / 离线」 | 503 + error |
| 隧道未启动 | 「模型服务离线」 | 请求无法到达 |
| 生成超时 | 180 秒后提示缩短问题 | 继续生成直至结束 |
| 参数错误 | 显示服务返回的错误 | 400 |
| 生成异常 | 显示「生成失败」 | 500 |
| 并发请求 | 后到的请求排队 | `Lock` 串行 |

### 6.7 内容后端设计（Node.js）

内容后端位于 `blog/backend/server.js`，单文件实现，仅使用 Node.js 内置模块：

- `node:http` 提供 HTTP 服务；
- `node:sqlite` 读写 SQLite；
- `node:fs` / `node:path` 托管静态文件；
- `node:crypto` 生成并校验管理口令。

职责有三件：

1. 托管 `blog/` 下的静态页面；
2. 提供站点、个人信息、项目、文章的公开读取 API；
3. 提供带管理口令的内容管理 API。

#### 启动与播种

```text
读取环境变量 HOST（默认 127.0.0.1）、PORT（默认 8100）与 BLOG_ADMIN_TOKEN
  → 打开 blog/backend/blog.db，启用 WAL
  → 建表 site / projects / posts（IF NOT EXISTS）
  → 若表为空，读取 data/site.json、data/projects.json、data/posts.json 与 posts/*.md 播种
  → 若数据库已有 site，则只补齐缺失字段（如 profile），不覆盖管理页修改
  → 读取或生成管理口令（admin_token.txt）
  → 监听 127.0.0.1:8100
```

播种只在表为空时执行；删除 `blog.db` 可恢复为文件版本。

#### 静态托管

- 静态根目录为 `blog/`，`/` 映射到 `index.html`；
- 路径经 `decodeURIComponent` 与 `path.resolve` 后必须仍位于 `blog/` 内，防止路径穿越；
- 显式屏蔽 `backend/`、`node_modules/` 与所有点开头路径，避免 `admin_token.txt`、`blog.db` 被下载；
- 按扩展名返回 Content-Type，HTML 使用 `no-cache`，其余静态资源缓存 60 秒；
- 未知 `/api/*` 返回 JSON 404，其余未知路径返回 404 页面。

#### 管理认证

- 口令来源优先级：环境变量 `BLOG_ADMIN_TOKEN` > `backend/admin_token.txt` > 首次启动随机生成；
- 请求头 `X-Admin-Token` 与口令使用 `crypto.timingSafeEqual` 做定长比较；
- 缺失或不匹配返回 `401 {"error": "管理口令不正确。"}`；
- 口令文件与数据库已加入 `.gitignore`，不进入仓库。

#### 公开接口

| 方法 | 路径 | 返回 |
| --- | --- | --- |
| GET | `/api/health` | `{status, service, runtime, database}` |
| GET | `/api/site` | 站点信息对象，含 `profile` 个人信息 |
| GET | `/api/projects` | `{projects: [...]}`，按 `sort_order` 升序 |
| GET | `/api/posts` | `{site, posts: [...]}`，按 `sort_order` 升序 |
| GET | `/api/posts/<id>` | `{post, content}`；不存在 404 |

#### 管理接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/session` | 验证口令，返回 `{ok: true}` |
| PUT | `/api/admin/site` | 合并保存站点信息，未提交字段与 `profile` 保持不变 |
| PUT | `/api/admin/profile` | 只合并保存个人信息，不影响站点其他字段 |
| POST | `/api/admin/projects` | 新增项目，`id` 与 `title` 必填，`id` 冲突 409 |
| PUT | `/api/admin/projects/<id>` | 更新项目，不存在 404 |
| DELETE | `/api/admin/projects/<id>` | 删除项目，幂等 |
| POST | `/api/admin/posts` | 新增文章，`id` 与 `title` 必填，正文放 `content` |
| PUT | `/api/admin/posts/<id>` | 更新文章，未传 `content` 时保留原正文 |
| DELETE | `/api/admin/posts/<id>` | 删除文章，幂等 |

新增文章时 `sort_order` 取当前最小值减一，因此默认排在最前；新增项目取最大值加一，默认排在最后。资源 `id` 只允许字母、数字、点、下划线与短横线，避免路径注入。

#### 跨域与错误处理

- 响应头允许 `GET / POST / PUT / DELETE / OPTIONS`，允许 `Content-Type` 与 `X-Admin-Token`；
- `OPTIONS` 统一返回 204；
- 请求体不是 JSON 对象返回 400，超过 2MB 返回 413；
- 管理口令错误返回 401，资源不存在返回 404，`id` 冲突返回 409；
- 前端管理页对 401 / 404 / 409 / 网络错误分别给出可读提示。

## 七、数据设计

### 7.1 `data/posts.json`

```json
{
  "site": { "title": "模型手记", "author": "模型手记", "description": "…", "since": "2026" },
  "posts": [
    {
      "id": "10-27-this-blog",
      "title": "这个博客，和它背后的 64M 小模型",
      "subtitle": "把训练好的权重放进网页：静态站点 + 本地推理 API",
      "date": "2026-10-27",
      "tags": ["部署", "模型", "工程"],
      "summary": "…",
      "readingTime": "6 min"
    }
  ]
}
```

约束：

- `id` 必须与 `posts/<id>.md` 文件名一致；
- `date` 使用 `YYYY-MM-DD`；
- 数组顺序即展示顺序，最新在前；
- 标签用于筛选，首个标签显示在列表卡片上。

### 7.2 `data/site.json` 与 `data/projects.json`

`site.json` 保存站点字段与个人信息，管理页通过站点表单与个人信息表单分别读写：

```json
{
  "title": "模型手记",
  "tagline": "把训练、部署与踩坑写在一起。",
  "intro": ["第一段", "第二段"],
  "type": "个人项目 / 课程实践",
  "theme": "模型训练与部署记录",
  "time": "2026.10",
  "tech": "HTML / CSS / JavaScript · Node.js · PyTorch",
  "model": "MiniMind-768 SFT",
  "domain": "yuchengwen393.github.io/model-notes",
  "repo": "https://github.com/yuchengwen393/model-notes",
  "profile": {
    "nickname": "模型手记",
    "role": "独立开发者 · 课程实践",
    "email": "",
    "location": "",
    "avatar": "favicon.svg",
    "skills": "PyTorch / Transformers / JavaScript / Node.js",
    "bio": "把训练过的模型，放到能用的地方。"
  }
}
```

`profile` 字段说明：

| 字段 | 用途 |
| --- | --- |
| `nickname` | 关于页个人信息卡片的昵称 |
| `role` | 身份 / 研究方向 |
| `email` | 可选邮箱，填写后渲染为 `mailto:` 链接 |
| `location` | 可选所在地 |
| `avatar` | 头像地址，默认 `favicon.svg` |
| `skills` | 技能概览文本 |
| `bio` | 一句话个人简介 |

`projects.json` 的结构：

```json
{
  "projects": [
    {
      "id": "imagegrab",
      "no": "01",
      "category": "浏览器插件",
      "status": "已上线",
      "title": "ImageGrab",
      "summary": "……",
      "tags": ["Chrome", "JavaScript"],
      "link": "https://yuchengwen393.github.io/imagegrab/",
      "linkLabel": "打开插件页"
    }
  ]
}
```

两个文件既可作为后端首次启动的种子，也可作为内容 API 不可用时的静态兜底。

### 7.3 SQLite 表结构

数据库文件：`blog/backend/blog.db`。

```sql
CREATE TABLE site (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL              -- 站点信息 JSON
);

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL              -- 项目 JSON（含 id）
);

CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,             -- 文章元数据 JSON（不含正文）
    content TEXT NOT NULL           -- Markdown 正文
);
```

设计说明：

- 用 JSON 列保存可变字段，避免每加一个展示字段就改表结构；
- `id` 独立成列，便于按 id 查询与唯一约束；
- `sort_order` 控制展示顺序，文章新增默认置顶，项目新增默认置底；
- 正文与元数据分列存储，列表接口不返回正文，详情接口才返回 `content`。

### 7.4 `data/config.json`

```json
{
  "chatApi": "https://xxx.trycloudflare.com",
  "contentApi": "https://yyy.trycloudflare.com",
  "modelName": "MiniMind-768 SFT",
  "repo": "https://github.com/yuchengwen393/model-notes",
  "author": "模型手记"
}
```

- `chatApi` 为空时，本地开发自动回退到 `http://127.0.0.1:5050`；
- `contentApi` 为空时，直接使用静态 JSON / Markdown；
- 两个地址都通过 `no-store` 读取，隧道变化后无需改页面代码。

### 7.5 消息结构

```ts
type Message = { role: "user" | "assistant"; content: string };
```

前端内存数组，最多保留最近 8 条发送；不做 localStorage 持久化。

## 八、部署与运维

### 8.1 静态站

1. `blog/` 作为仓库根目录；
2. GitHub Pages 选择 `main` 分支、`/` 目录；
3. `.nojekyll` 关闭 Jekyll，保证 `data/` 与 `posts/` 正常访问；
4. 推送后 1–2 分钟自动构建；
5. 更新后若浏览器仍显示旧内容，等待 Pages 缓存过期或强制刷新。

### 8.2 内容后端（Node.js）

```powershell
cd 10.27\blog\backend
node server.js
# 或
npm start
```

- 要求 Node.js 24+，无第三方依赖，不需要 `npm install`；
- 默认监听 `127.0.0.1:8100`，同时托管页面与 `/api/*`；
- 首次启动生成 `admin_token.txt`，管理页需要输入该口令；
- 数据库文件 `blog.db` 首次启动自动建表并从 `data/` 与 `posts/` 播种；
- 本地可直接访问 `http://127.0.0.1:8100/` 与 `http://127.0.0.1:8100/admin.html`。

### 8.3 模型推理服务

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe app.py
```

### 8.4 公网隧道

内容链路与模型链路各开一条：

```powershell
cd 10.27\chat-service
.\cloudflared.exe tunnel --url http://127.0.0.1:8100 --no-autoupdate

# 另开窗口
.\cloudflared.exe tunnel --url http://127.0.0.1:5050 --no-autoupdate
```

把内容隧道写入 `contentApi`、模型隧道写入 `chatApi`，提交并推送。页面下次加载会以 `no-store` 读取新地址，无需改代码。

github.io 永久站没有后端，`contentApi` 指向隧道时，Pages 上的页面会优先读取隧道内容；隧道关闭后自动回退到仓库内的静态数据。

### 8.5 回滚

- 页面与文章：`git revert <commit>` 后推送，Pages 自动重建；
- 内容数据：恢复 `blog.db` 备份，或删除数据库让后端重新播种；
- 模型：切换 `MINIMIND_CHECKPOINT` 环境变量到其他权重即可；
- 接口地址：改回上一个可用隧道地址。

## 九、性能

| 指标 | 实测 / 目标 |
| --- | --- |
| 静态首页资源 | CSS + JS + 索引 < 100KB |
| 模型加载 | 约 2–5 秒（131MB，本地磁盘） |
| 生成速度 | 27–32 tokens/s（CPU，8 线程） |
| 一轮回答 | 约 2–7 秒（60–180 tokens） |
| 文章正文 | 按需加载，单篇 < 5KB |
| 内容 API | 本机查询 < 20ms；隧道首包通常 < 500ms |
| 并发 | 模型串行；内容服务按线程并发 |

优化手段：限制生成长度、只带 8 条历史、文章懒加载、静态资源无构建、无第三方库。

## 十、测试

### 10.1 模型自测

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe test_model.py
```

覆盖：分词器加载、权重键匹配、Chat Template、单轮生成。

### 10.2 模型接口测试

```powershell
curl http://127.0.0.1:5050/api/health
curl -X POST http://127.0.0.1:5050/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"max_new_tokens\":80}"
```

### 10.3 内容接口测试

```powershell
curl http://127.0.0.1:8100/api/health
curl http://127.0.0.1:8100/api/site
curl http://127.0.0.1:8100/api/projects
curl http://127.0.0.1:8100/api/posts
curl http://127.0.0.1:8100/api/posts/10-27-this-blog

# 管理接口：先读取口令
$token = Get-Content .\admin_token.txt -Raw
curl -H "X-Admin-Token: $token" http://127.0.0.1:8100/api/admin/session

# 个人信息保存后重新读取 /api/site
curl -X PUT http://127.0.0.1:8100/api/admin/profile `
  -H "Content-Type: application/json" `
  -H "X-Admin-Token: $token" `
  -d "{\"nickname\":\"模型手记\"}"

# 敏感文件必须返回 404
curl -o NUL -w "%{http_code}" http://127.0.0.1:8100/backend/admin_token.txt
```

覆盖：公开接口 200、未知文章 404、错误口令 401、正确口令可读写、个人信息保存、静态目录不可下载。

### 10.4 页面验收

1. 首页 3 篇最新文章；
2. 列表搜索「部署」、标签「SFT」；
3. 随机打开 3 篇文章，检查代码块与链接；
4. 项目页 5 张卡片、关于页站点信息与个人信息卡片来自 API；
5. 关闭内容后端后刷新页面，文章与项目仍能从静态数据加载；
6. 管理页登录后修改并保存站点、个人信息、项目与文章；
7. 对话页在线状态、一轮问答、清空对话；
8. 关闭模型服务后对话页显示离线，文章仍可读；
9. 375px 宽度无横向滚动；
10. 控制台无报错。

## 十一、已知限制与演进

- 模型只有 6391 万参数，事实性回答不可靠；
- 无流式输出，长回答需等待；
- 内容管理只有单口令，没有多用户与操作审计；
- 内容与模型隧道均为临时地址，重启后需更新配置；
- 对话历史不持久化；
- 无图片上传与富文本编辑器。

演进顺序：流式输出 → 内容后端上云 + 固定域名 → 多用户与审计 → RSS / 图片上传。
