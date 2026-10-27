## 为什么要把模型放进博客

课程里训练出的模型一直躺在 `10.21` 的文件夹里：`full_sft_large_768.pth`，131MB，6391 万参数。它能对话，但只能在终端里 `python llm1.py`。

这个博客想回答一个问题：一个从零训练的小模型，能不能成为个人网站的一部分？

答案是能，但要接受它的边界。

## 站点：静态页面，放在 GitHub Pages

博客本身是纯 HTML / CSS / JS：

- 首页、文章列表、文章详情、项目、关于、对话六个页面；
- 文章以 Markdown 放在 `posts/`，浏览器端渲染；
- 没有构建工具，没有前端框架，推送到 GitHub 就能发布；
- 视觉上是纸张、墨色与朱红的编辑风格，刻意避开常见的深色星空模板。

域名：

> https://yuchengwen393.github.io/blog/

## 对话：本地推理 API

模型的推理仍然在本地。`chat-service/app.py` 用 Flask 起一个服务，启动时加载 SFT 权重：

~~~python
model = GPTForCausalLM(TransformerConfig(hidden_size=768, num_hidden_layers=8))
model.load_state_dict(torch.load("full_sft_large_768.pth", map_location="cpu"))
model.eval()
~~~

接口有两个：

- `GET /api/health`：返回模型是否就绪、参数量、检查点；
- `POST /api/chat`：接收最近 8 条消息，返回回复、token 数、耗时和生成速度。

前端用 `fetch` 调用，带上对话历史。CORS 允许任意来源，因为页面在 GitHub Pages，接口在另一台机器上。

本地 CPU 推理大约是 30 tokens/s，一次回答两三秒。它不是云端大模型，但确实是这台机器上训练出来的权重。

## 架构的边界

GitHub Pages 只能托管静态文件，不能跑 Python。所以对话服务必须另外找一台机器：

- 本地电脑 + 公网隧道：现在采用的方式，免费，但电脑关机或隧道关闭后对话就不可用；
- 云服务器 + Docker：更稳定，需要服务器和备案 / 域名；
- 容器托管平台：介于两者之间，按服务计费。

所以这个网站有两种状态：

- 博客永远可访问；
- 对话取决于模型服务是否在线，页面会显示「模型在线 / 离线」。

## 下一步

- 把推理服务搬到云服务器，用 Docker 固定环境；
- 给模型加流式输出，首字更快；
- 用更好的 SFT 数据重新训练，至少让它把 LoRA、Transformer 这些概念答对；
- 给文章加 RSS 和站点地图。

> 这个博客的价值不在于模型多聪明，而在于「训练 → 保存 → 加载 → 接口 → 页面」这条链路第一次完整闭合。
