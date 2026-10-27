# TECH_DESIGN · 模型手记

## 一、总体架构

```text
浏览器（GitHub Pages 静态站）
  ├── HTML / CSS / 无框架 JavaScript
  ├── data/posts.json        文章索引
  ├── posts/*.md             文章正文
  └── fetch
        ↓
公网隧道（localhost.run，HTTPS）
        ↓
Flask 推理服务（本机 127.0.0.1:5050）
        ↓
PyTorch + MiniMind-768 SFT 权重（10.21/out_large/full_sft_large_768.pth）
```

静态站与推理服务分离：文章永远可访问，对话取决于本机服务与隧道是否在线。

## 二、前端

- 不使用框架与构建工具，直接由 GitHub Pages 托管；
- `js/markdown.js` 实现轻量 Markdown 渲染：标题、列表、引用、代码块、粗体、行内代码与链接；
- `js/home.js / posts.js / post.js` 分别负责首页、归档、详情；
- 文章索引 `data/posts.json` 只放元数据，正文按 `posts/<id>.md` 懒加载；
- `js/chat.js` 负责对话：健康检查、历史消息、超时与错误提示；
- 视觉变量集中在 `css/style.css` 的 `:root`，便于整体换色。

## 三、后端

- 运行时：Python 3.14 + torch 2.14.1+cpu + transformers 5.21 + Flask；
- 启动时加载分词器与权重，`strict=False` 校验缺失 / 多余键，任一非空即拒绝启动；
- CPU 推理，`torch.set_num_threads(8)`，SFT 模型约 30 tokens/s；
- 生成参数：`temperature=0.7`、`top_p=0.9`、`top_k=50`、`repetition_penalty=1.05`，默认上限 320，新对话最多带 8 条历史；
- `threading.Lock` 串行化生成，避免并发请求争抢模型；
- 输出清洗：去掉 `<|im_end|>`，若包含 `</think>` 则拆出思考过程与最终回答。

### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 返回是否就绪、参数量、检查点、运行时长 |
| POST | `/api/chat` | 入参 `messages`、`max_new_tokens`、`temperature`、`top_p`；返回 `reply`、`reasoning`、`tokens`、`seconds`、`tokens_per_second` |

- 允许跨域：`Access-Control-Allow-Origin: *`；
- 监听 `127.0.0.1`，由隧道暴露到公网，不直接开放端口。

## 四、目录

```text
10.27/
├── blog/                 # 静态站点（GitHub Pages 根目录）
│   ├── index.html / posts.html / post.html / projects.html / about.html / chat.html
│   ├── css/style.css
│   ├── js/*.js
│   ├── data/posts.json
│   ├── posts/*.md
│   └── README.md
└── chat-service/
    ├── app.py            # Flask 推理服务
    ├── test_model.py     # 权重加载与生成自测
    ├── requirements.txt
    └── README.md
```

## 五、部署

1. `blog/` 推送到 `yuchengwen393/model-notes`，Pages 选择 `main` 根目录；
2. 本机运行 `chat-service/app.py`；
3. `ssh -R 80:127.0.0.1:5050 nokey@localhost.run` 获取 HTTPS 地址；
4. 把地址写入 `blog/js/config.js` 的 `chatApi`，提交后 Pages 自动重建。

## 六、风险与取舍

- 隧道地址每次重启会变化：需更新配置；如需长期稳定，改用云服务器 + Docker；
- GitHub Pages 不能运行 Python：模型服务只能放在本机或容器平台；
- 模型能力有限：页面注明「可能不准确」，不把它包装成通用助手；
- 静态站缓存：更新后若未生效，等待 Pages 构建完成或加版本参数。
