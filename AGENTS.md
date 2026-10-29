# AGENTS.md · 模型手记

本文件面向在本仓库中工作的 AI 代理与开发者，说明项目结构、硬性约定、常见任务流程与验收标准。

---

## 一、项目是什么

「模型手记」是一个无框架静态博客 + 内容后端 + 本地模型推理服务：

- 前端：6 个前台 HTML 页面 + 1 个管理页，原生 CSS、原生 JavaScript；
- 内容：8 篇 Markdown 文章，静态索引在 `data/posts.json`，在线数据在 `backend/blog.db`；
- 内容后端：本机 Node.js + `node:sqlite`，托管静态页面，提供 `/api/site`、`/api/projects`、`/api/posts` 与 `/api/admin/*`；
- 模型后端：本机 Flask 加载 MiniMind-768 SFT 权重，提供 `/api/health` 与 `/api/chat`；
- 公网：Cloudflare Quick Tunnel 分别暴露 `127.0.0.1:8100` 与 `127.0.0.1:5050`；
- 配置：`chatApi` / `contentApi` 在 `data/config.json`，页面每次加载以 `no-store` 读取。

线上地址：https://yuchengwen393.github.io/model-notes/
仓库：https://github.com/yuchengwen393/model-notes

## 二、目录地图

```text
blog/                          # 仓库根目录（Pages 根目录）
├── index.html                 # 首页：Hero、统计、最新文章、时间轴、项目、对话入口
├── posts.html                 # 文章归档：搜索、标签、计数
├── post.html                  # 文章详情：按 ?id= 加载
├── projects.html              # 项目清单
├── about.html                 # 关于项目
├── chat.html                  # 模型对话
├── admin.html                 # 内容管理（noindex，页脚有入口）
├── css/style.css              # 全部样式与设计令牌
├── js/site.js                 # 导航、汉堡菜单、滚动淡入、年份
├── js/blog-api.js             # 内容 API 客户端：API 优先、静态兜底
├── js/home.js                 # 首页最新 3 篇
├── js/posts.js                # 归档筛选
├── js/post.js                 # 详情、进度条、相关阅读、上下篇
├── js/projects.js             # 项目卡片动态渲染
├── js/about.js                # 关于页站点信息与个人信息卡片
├── js/admin.js                # 管理页：口令、站点、个人信息、项目、文章
├── js/markdown.js             # 轻量 Markdown 渲染
├── js/chat.js                 # 对话状态机（当前引用为 chat.js?v=2）
├── backend/server.js          # Node.js 内容后端：静态托管 + 公开 API + 管理 API
├── backend/package.json       # npm start，无第三方依赖
├── backend/blog.db            # SQLite（不提交）
├── backend/admin_token.txt    # 管理口令（不提交）
├── data/site.json             # 站点信息与 profile 种子 / 静态兜底
├── data/projects.json         # 项目种子 / 静态兜底
├── data/posts.json            # 文章索引种子 / 静态兜底
├── data/config.json           # chatApi / contentApi / modelName / repo / author
├── posts/<id>.md              # 文章正文（种子 / 静态兜底）
├── favicon.svg
├── .nojekyll                  # 关闭 Jekyll
├── PRD.md
├── TECH_DESIGN.md
├── AGENTS.md
└── README.md
```

推理服务在仓库之外：

```text
10.27/chat-service/
├── app.py                     # Flask 推理服务
├── test_model.py              # 权重加载与单轮生成自测
├── requirements.txt
├── README.md
├── cloudflared.exe            # 本地工具，不提交
└── .venv/                     # 本地虚拟环境，不提交
```

## 三、怎么跑

### 1. 内容后端（推荐，同时托管页面）

要求 Node.js 24+，无需安装第三方依赖：

```powershell
cd 10.27\blog\backend
node server.js
```

访问 http://127.0.0.1:8100/ ，管理页 http://127.0.0.1:8100/admin.html 。首次启动会创建 `blog.db` 并从 `data/`、`posts/` 播种，同时生成 `admin_token.txt`。

### 2. 纯静态方式（无后端调试）

```powershell
cd 10.27\blog
python -m http.server 8002 --bind 127.0.0.1
```

访问 http://127.0.0.1:8002/ 。不要直接双击 HTML，`fetch` 在 `file://` 下会被浏览器拦截。此方式下前台自动回退静态 JSON / Markdown，管理页不可用。

### 3. 模型服务

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe app.py
```

监听 `127.0.0.1:5050`，启动时加载 `10.21/out_large/full_sft_large_768.pth`。

### 4. 公网隧道

```powershell
cd 10.27\chat-service
.\cloudflared.exe tunnel --url http://127.0.0.1:8100 --no-autoupdate
# 另开窗口
.\cloudflared.exe tunnel --url http://127.0.0.1:5050 --no-autoupdate
```

内容隧道写入 `blog/data/config.json` 的 `contentApi`，模型隧道写入 `chatApi`，提交并推送。

### 5. 自测

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe test_model.py

curl http://127.0.0.1:8100/api/health
curl http://127.0.0.1:8100/api/posts
```

## 四、硬性约定

1. **不引入前端框架、构建工具、CDN、在线字体或第三方 JS 库**；
2. **所有页面路径使用相对路径**，保证 Pages 子路径可用；
3. **文章正文不写进 HTML**：在线维护走管理页 / SQLite，静态维护走 `data/posts.json` + `posts/<id>.md`；
4. **样式变量集中在 `css/style.css` 的 `:root`**，禁止在页面里散落硬编码颜色；
5. **`chatApi` 与 `contentApi` 只放在 `data/config.json`**，禁止在 JS/HTML 中写死隧道地址；
6. **管理口令只存在后端 `admin_token.txt` 或环境变量**，禁止写入前端、文档、提交记录；
7. **`admin.html` 不加入主导航，保持 `noindex,nofollow`**，入口只放在页脚；
8. **管理接口必须携带 `X-Admin-Token`**，新增写接口必须复用 `requireAdmin()`；
9. **默认不出现真实姓名、学校、学号等身份标识**；个人信息卡片由维护者在管理页自行决定是否填写；
10. **不提交模型权重（`.pth`）、虚拟环境（`.venv`）、`cloudflared.exe`、`blog.db`、`admin_token.txt`、日志与缓存**；
11. **不修改 `10.21` 的训练代码与权重**，推理服务只读引用；
12. **修改 `js/chat.js` 后必须提升 `chat.html` 中的版本号**（如 `?v=2` → `?v=3`），避免 Pages 缓存旧脚本；
13. **每次改动后必须手动验证**首页、文章详情、管理页、对话四条链路。

## 五、代码约定

### HTML

- 每页保留 `body[data-page]`，`site.js` 据此高亮导航；
- 头部、页脚在六个前台页面中重复，改导航必须同步六处；
- 交互元素使用语义标签与 `aria-label`；
- 新页面需同时加入导航与页脚链接（管理页除外）。

### CSS

- 新颜色先加变量，再引用；
- 区块使用 `.section`（纸色）、`.section--tint`（浅底纹）、深色卡片（对话入口）三种层次；
- 断点为 980px 与 720px；
- 按钮保持深色底，悬停使用 `--accent-dark`；
- 动效克制，新增动画需兼容 `prefers-reduced-motion`。

### JavaScript

- 使用 IIFE 或 async IIFE，不污染全局；
- 网络请求必须有失败分支与用户可读文案；
- 渲染用户/模型文本使用 `textContent`，不要拼接 `innerHTML`；
- 内容数据统一走 `window.BlogAPI`，不要在页面脚本里重复写 API 地址；
- 新增脚本需在对应 HTML 底部按顺序引入，`blog-api.js` 必须在业务脚本之前。

### 后端

- `backend/server.js` 单文件，只使用 Node.js 内置模块，不新增 npm 依赖；
- 新增接口必须区分公开与管理两类，管理写接口复用 `requireAdmin()`；
- SQLite 使用 `node:sqlite` 的 `prepare` 参数化查询，不拼接 SQL；
- 静态文件路径必须经过 `path.resolve` 校验，并屏蔽 `backend/`、`node_modules/` 与点开头路径；
- 站点信息保存采用合并策略，不能因为保存站点表单而清空 `profile`；
- 种子只在表为空时执行；已有数据库只补齐缺失字段，不覆盖管理页修改。

### 内容

- 文章 id 使用 `MM-DD-slug`，必须与 Markdown 文件名一致；
- 日期使用 `YYYY-MM-DD`，索引按最新在前排序；
- 支持的 Markdown 语法：二至四级标题、列表、引用、代码块（``` 或 ~~~）、行内代码、粗体、链接、分隔线；
- 不支持表格、图片、脚注，不要使用。

## 六、常见任务 SOP

### 新增一篇文章

**方式 A：管理页（内容后端在线）**

1. 打开 `/admin.html`，输入 `admin_token.txt` 中的口令；
2. 在「文章」区填写 id、标题、日期、标签、摘要与正文；
3. 保存后刷新首页与文章列表，确认出现在最前并可打开详情。

**方式 B：静态文件（无后端 / 需要进入仓库）**

1. 新建 `posts/<id>.md`，按既有文章结构写标题与小节；
2. 在 `data/posts.json` 的 `posts` 数组**最前面**加入元数据：`id / title / subtitle / date / tags / summary / readingTime`；
3. 启动静态站，验证：
   - 首页出现该文章（若为最新）；
   - 列表可搜索到；
   - 详情能渲染代码块与链接；
4. 提交：`feat: 新增 <标题> 文章`。

### 修改个人信息

1. 打开 `/admin.html`，输入 `admin_token.txt` 中的口令；
2. 在「个人信息」卡片填写昵称、身份、简介、所在地、技能、邮箱与头像地址；
3. 点击「保存个人信息」，接口为 `PUT /api/admin/profile`；
4. 刷新 `about.html`，确认卡片文字、头像与技能显示正确；
5. 清空昵称、身份与简介后，卡片会自动隐藏。

### 修改配色或排版

1. 只改 `css/style.css` 的 `:root` 与对应组件；
2. 检查 1440px、980px、500px 三个宽度；
3. 检查首页、文章、项目、关于、对话五个页面；
4. 浏览器强制刷新（Ctrl+F5）后再验收。

### 更换模型服务地址

1. 启动 `app.py`；
2. 启动 cloudflared，拿到新的 `trycloudflare.com` 地址；
3. 只修改 `data/config.json` 的 `chatApi`；
4. 推送后打开对话页，确认状态「模型在线」并完成一轮问答；
5. 不需要改 `chat.js` 或任何 HTML。

### 更换内容服务地址

1. 启动 `blog/backend/server.js`；
2. 为 `127.0.0.1:8100` 启动 cloudflared；
3. 只修改 `data/config.json` 的 `contentApi`；
4. 刷新首页与项目页，确认数据来自内容 API；关闭后端再刷新，确认回退静态数据；
5. 不需要改 `blog-api.js` 或任何 HTML。

### 重置管理口令

1. 停止内容后端；
2. 删除 `backend/admin_token.txt`，或设置新的 `BLOG_ADMIN_TOKEN` 环境变量；
3. 重新启动，口令会重新生成并写入文件；
4. 用新口令登录管理页复验。

### 修改对话逻辑

1. 改 `js/chat.js`；
2. 把 `chat.html` 中的 `js/chat.js?v=2` 版本号加一；
3. 本地验证在线、离线、超时、清空四种状态；
4. 推送并在公网复验。

### 部署

```powershell
cd 10.27\blog
git status
git add <本次涉及的文件>
git commit -m "feat: ..."
git push origin main
```

等待 1–2 分钟，访问线上地址确认更新。若仍是旧内容，强制刷新或等待 Pages 缓存过期。

## 七、验收清单

每次提交前至少完成：

1. 首页「最新记录」显示 3 篇，点击可进入详情；
2. 文章列表搜索「部署」有结果，标签「SFT」可筛选；
3. 随机打开 2 篇文章，标题、列表、代码块、链接正常；
4. 项目页 5 张卡片、关于页站点信息与个人信息卡片来自 `/api/*`；
5. 管理页错误口令提示失败，正确口令可修改站点、个人信息、项目与文章；
6. 保存站点信息后，个人信息仍然保留；
7. 关闭内容后端后刷新，前台自动回退静态数据；
8. 对话页显示「模型在线」，发送「你好」能在 40 秒内收到回复；
9. 关闭模型后端后刷新对话页，显示「模型服务离线」，文章仍可读；
10. 500px 宽度下无横向滚动，汉堡菜单可展开；
11. 浏览器控制台无报错；
12. 默认页面中无真实姓名、学校、学号等身份信息。

## 八、提交规范

- 一个功能或一个修复一个提交；
- 前缀：`feat:` 新增、`fix:` 修复、`style:` 视觉、`docs:` 文档、`chore:` 配置；
- 提交信息说明「为什么改」，不只写「改了什么」；
- 推送前用 `git status` 确认没有误加权重、虚拟环境、日志、`blog.db`、`admin_token.txt` 或临时截图；
- 不执行 `git reset --hard`、`push --force` 等破坏性操作，除非用户明确要求。

## 九、故障排查

| 现象 | 检查顺序 |
| --- | --- |
| 对话页离线 | `http://127.0.0.1:5050/api/health` → cloudflared 进程 → `data/config.json` → 浏览器是否缓存旧配置 |
| 对话请求 CORS 失败 | 响应头是否有 `Access-Control-Allow-Origin: *` |
| 首页文章空白 | `http://127.0.0.1:8100/api/posts` → `data/config.json` 的 `contentApi` → `data/posts.json` 是否可访问 |
| 管理页一直提示口令错误 | `backend/admin_token.txt` 内容 → `BLOG_ADMIN_TOKEN` 是否覆盖 → 请求头是否带 `X-Admin-Token` |
| 内容后端启动失败 | `node -v` 是否 ≥ 24 → `node --check backend/server.js` → 端口 8100 是否被占用 |
| 管理页数据为空 | 内容后端是否启动 → `blog.db` 是否已播种 → 浏览器网络面板看 `/api/*` 状态码 |
| 个人信息卡片不显示 | `/api/site` 的 `profile` 是否有昵称/身份/简介 → 刷新 `/about.html` → 控制台 |
| 静态文件 404 | `/backend/` 下文件被有意屏蔽；业务文件应放在 `blog/` 根目录 |
| 内容接口 404 | 路径是否以 `/api/` 开头 → 文章 id 是否正确 → 后端是否重启加载新代码 |
| 文章 404 | `id` 与文件名是否一致、大小写是否正确 |
| 代码块显示错乱 | Markdown 围栏是否成对、语言标记后是否换行 |
| 页面仍是旧样式 | Ctrl+F5；确认 Pages 构建完成；必要时给 CSS 加版本参数 |
| 推送到 GitHub 失败 | 网络是否可达 github.com:443；重试；确认凭据 |

## 十、不要做

- 不要把模型权重、虚拟环境、`cloudflared.exe`、`blog.db` 或 `admin_token.txt` 提交到仓库；
- 不要把隧道地址、管理口令写死在 JS/HTML 或文档中；
- 不要引入 React/Vue/Next 或打包工具「顺手重构」；
- 不要把文章正文塞进 `posts.json` 或 HTML；
- 不要让管理页出现在导航、站点地图或搜索引擎索引中；
- 不要使用外部图片、字体或统计脚本；
- 不要在页面与文档中加入个人身份信息；
- 不要为了视觉效果牺牲移动端可读性与对比度。
