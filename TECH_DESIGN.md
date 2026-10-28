# 技术设计文档（TECH_DESIGN）· 模型手记

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.1 |
| 编写日期 | 2026-10-28 |
| 对应版本 | 线上 v1.0（2026-10-28） |
| 线上地址 | https://yuchengwen393.github.io/model-notes/ |
| 代码仓库 | https://github.com/yuchengwen393/model-notes |

---

## 一、设计目标

1. 用最少的运行依赖交付一个可长期访问的静态博客；
2. 让课程中训练出的 MiniMind-768 SFT 权重真实参与页面交互；
3. 静态站与推理服务解耦：模型离线不影响文章阅读；
4. 不引入前端框架与构建工具，降低维护成本；
5. 隧道地址、文章内容、页面样式都能独立替换。

## 二、总体架构

```text
┌─────────────────────────────────────────────────────┐
│ 浏览器                                               │
│  HTML / CSS / 原生 JavaScript                       │
│  ├── data/posts.json        文章索引（fetch）        │
│  ├── posts/<id>.md          文章正文（按需 fetch）   │
│  └── data/config.json       接口地址（no-store）     │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────┐
│ GitHub Pages                                        │
│  repo: yuchengwen393/model-notes                    │
│  branch: main / root / .nojekyll                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 浏览器 ── fetch ──► Cloudflare Quick Tunnel          │
│                    https://xxx.trycloudflare.com    │
│                              │                      │
│                              ▼                      │
│                    Flask 127.0.0.1:5050             │
│                              │                      │
│                              ▼                      │
│                    PyTorch CPU + MiniMind-768 SFT   │
└─────────────────────────────────────────────────────┘
```

**关键取舍**：GitHub Pages 只托管静态文件，无法运行 Python。因此对话能力放在本机 Flask 服务中，通过 Cloudflare 隧道暴露 HTTPS 地址。博客与模型服务是两条独立链路，任何一条故障都不会拖垮另一条。

## 三、技术选型

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 页面 | HTML5 + CSS3 + 原生 JavaScript | 无构建、无依赖，Pages 直接托管 |
| 样式 | 原生 CSS + CSS 变量 | 设计令牌集中，换色只改 `:root` |
| 文章 | Markdown + 自写渲染器 | 内容与页面分离，不引入 marked 等库 |
| 数据 | JSON | 静态可缓存，结构简单 |
| 推理服务 | Python 3.14 + Flask 3.1 | 轻量、易调试，适合本机单模型 |
| 模型运行时 | PyTorch 2.14.1+cpu + Transformers 5.21 | 与 10.21 训练代码一致，CPU 可跑 |
| 模型 | MiniMind-768 SFT | 8 层 / 768 维 / 6391 万参数，课程自有权重 |
| 隧道 | cloudflared Quick Tunnel | 无需账号、HTTPS、比 localhost.run 稳定 |
| 版本管理 | Git + GitHub | 每次改动可回退，Pages 自动构建 |

## 四、目录结构

```text
10.27/
├── blog/                          # 静态站，Pages 根目录
│   ├── index.html                 # 首页
│   ├── posts.html                 # 文章列表
│   ├── post.html                  # 文章详情
│   ├── projects.html              # 项目
│   ├── about.html                 # 关于
│   ├── chat.html                  # 模型对话
│   ├── css/style.css              # 全部样式与设计令牌
│   ├── js/
│   │   ├── site.js                # 导航、菜单、滚动淡入、年份
│   │   ├── home.js                # 首页最新文章
│   │   ├── posts.js               # 归档搜索与标签筛选
│   │   ├── post.js                # 详情加载、进度、相关阅读
│   │   ├── markdown.js            # 轻量 Markdown 渲染
│   │   └── chat.js                # 对话状态机与请求
│   ├── data/
│   │   ├── posts.json             # 文章索引
│   │   └── config.json            # 对话接口地址（no-store）
│   ├── posts/                     # 8 篇 Markdown 正文
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
- 共享页脚：文章、项目、对话、GitHub、版权；
- `body[data-page]` 标记当前页面，`site.js` 据此设置 `aria-current`；
- 文章详情通过 `post.html?id=<id>` 读取；
- 文章筛选通过 `posts.html?tag=<tag>` 带入。

没有模板引擎，头部与页脚在六个 HTML 中重复。这是刻意取舍：避免引入构建步骤，代价是改导航时需要同步六处。

### 5.2 数据加载

- 首页 / 列表 / 详情均先请求 `data/posts.json`；
- 详情页再按 `posts/<id>.md` 拉取正文；
- 请求失败时展示可读的错误文案，不抛出未捕获异常；
- 文章索引只含元数据（标题、摘要、标签、阅读时长），正文懒加载；
- 对话配置单独放在 `data/config.json`，用 `fetch(..., { cache: "no-store" })` 加时间戳读取，确保隧道地址更新后立即生效。

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

### 6.1 运行环境

- Python 3.14，独立虚拟环境 `chat-service/.venv`；
- `torch 2.14.1+cpu`、`transformers 5.21`、`Flask 3.1`；
- 权重：`10.21/out_large/full_sft_large_768.pth`（131MB，fp16 保存，CPU 以 fp32 加载）；
- 分词器：`10.21/modelT`，词表 6400；
- 模型：8 层、768 维、12 头，参数量 **63,912,192**。

### 6.2 启动与加载

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

### 6.4 接口契约

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

### 6.6 错误处理

| 场景 | 前端表现 | 后端行为 |
| --- | --- | --- |
| 模型加载中 | 状态「检查中 / 离线」 | 503 + error |
| 隧道未启动 | 「模型服务离线」 | 请求无法到达 |
| 生成超时 | 180 秒后提示缩短问题 | 继续生成直至结束 |
| 参数错误 | 显示服务返回的错误 | 400 |
| 生成异常 | 显示「生成失败」 | 500 |
| 并发请求 | 后到的请求排队 | `Lock` 串行 |

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

### 7.2 `data/config.json`

```json
{
  "chatApi": "https://xxx.trycloudflare.com",
  "modelName": "MiniMind-768 SFT",
  "repo": "https://github.com/yuchengwen393/model-notes",
  "author": "模型手记"
}
```

`chatApi` 为空时，本地开发自动回退到 `http://127.0.0.1:5050`。

### 7.3 消息结构

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

### 8.2 推理服务

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe app.py
```

### 8.3 公网隧道

```powershell
cd 10.27\chat-service
.\cloudflared.exe tunnel --url http://127.0.0.1:5050 --no-autoupdate
```

拿到 `https://xxx.trycloudflare.com` 后写入 `blog/data/config.json`，提交并推送。页面下次加载会以 `no-store` 读取新地址，无需改代码。

### 8.4 回滚

- 页面与文章：`git revert <commit>` 后推送，Pages 自动重建；
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
| 并发 | 串行，第二请求等待第一请求结束 |

优化手段：限制生成长度、只带 8 条历史、文章懒加载、静态资源无构建、无第三方库。

## 十、测试

### 10.1 后端自测

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe test_model.py
```

覆盖：分词器加载、权重键匹配、Chat Template、单轮生成。

### 10.2 接口测试

```powershell
curl http://127.0.0.1:5050/api/health
curl -X POST http://127.0.0.1:5050/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"max_new_tokens\":80}"
```

### 10.3 页面验收

1. 首页 3 篇最新文章；
2. 列表搜索「部署」、标签「SFT」；
3. 随机打开 3 篇文章，检查代码块与链接；
4. 对话页在线状态、一轮问答、清空对话；
5. 关闭 Flask 后对话页显示离线，文章仍可读；
6. 375px 宽度无横向滚动；
7. 控制台无报错。

## 十一、已知限制与演进

- 模型只有 6391 万参数，事实性回答不可靠；
- 无流式输出，长回答需等待；
- 无鉴权与限流，隧道地址公开后可被调用；
- 隧道重启后地址变化，需要更新配置；
- 对话历史不持久化。

演进顺序：流式输出 → 云服务器 + Docker 固定域名 → 限流与鉴权 → RSS / 后台管理。
