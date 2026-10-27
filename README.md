# 模型手记 · Model Notes

一个从零训练语言模型、再做插件与部署的个人博客。静态页面发布在 GitHub Pages，对话页调用本机的 Flask 推理服务，加载课程中训练出的 MiniMind-768 SFT 权重。

- 站点：https://yuchengwen393.github.io/model-notes/
- 模型：8 层、768 维、6391 万参数，预训练 19,848 步 + SFT 14,152 步
- 推理：CPU，约 30 tokens/s

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：最新文章、训练轨迹、项目与对话入口 |
| `posts.html` | 归档：搜索与标签筛选 |
| `post.html` | 文章详情，Markdown 在浏览器端渲染 |
| `projects.html` | 五个课程项目 |
| `about.html` | 个人介绍与技能 |
| `chat.html` | 与本地模型对话 |

文章正文在 `posts/*.md`，索引在 `data/posts.json`。

## 设计文档

- `PRD.md`：目标、用户、功能范围、验收标准；
- `TECH_DESIGN.md`：静态站 + Flask 推理服务的架构与接口；
- `AGENTS.md`：开发约定、运行命令与测试清单。

## 本地运行

```powershell
cd 10.27\blog
python -m http.server 8002 --bind 127.0.0.1
```

访问 http://127.0.0.1:8002/ 。

## 模型服务

```powershell
cd 10.27\chat-service
.\.venv\Scripts\python.exe app.py
```

默认监听 `127.0.0.1:5050`，加载 `10.21/out_large/full_sft_large_768.pth`。接口：

- `GET /api/health`
- `POST /api/chat`，请求体 `{"messages": [...], "max_new_tokens": 180}`

## 部署

博客是纯静态站点，推送到 GitHub 后在仓库 Settings → Pages 选择 `main` 分支、根目录即可。对话接口需要另外启动本机服务与公网隧道，并把地址写入 `data/config.json` 的 `chatApi`。localhost.run 的免费隧道有效期有限，到期后重新启动并更新该地址即可。

## 边界

GitHub Pages 不能运行 Python，所以对话依赖本机推理进程与隧道；博客文章不受影响。模型只有 6391 万参数，回答可能不准确，页面已注明。
