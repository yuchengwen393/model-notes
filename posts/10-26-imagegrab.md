## 一个真正能用的插件

10.26 的作业是电商图片下载插件。需求只有几句话：在淘宝、天猫、京东、拼多多的商品详情页放一个「获取图片」按钮，把页面图片集中展示，勾选后下载，单张 PNG、多张 ZIP。

最后做出来的东西：

- Manifest V3，权限只开 `activeTab`、`scripting`、`downloads`、`storage`；
- 内容脚本在详情页右下角注入悬浮按钮；
- 新标签页画廊，网格展示缩略图、尺寸、原图链接；
- 全选 / 反选 / 取消，单张下载 PNG，多张打包 ZIP；
- 图片只在本机处理，不上传服务器。

### 懒加载：9 张图只抓到 7 张

商品详情页的图片大多是懒加载：`src` 是 1×1 占位图，真实地址放在 `data-src`、`data-original`、`data-ks-lazyload` 或 `srcset` 里。

原来的逻辑先按 `src` 的尺寸过滤，占位图直接被判太小，`data-*` 根本没读。调整顺序后：先收集所有懒加载属性和 `srcset` 的最大候选，再对普通 `src` 按 100×100 过滤。画廊从 7 张变成 9 张。

### 过滤：别把 Logo 当商品图

只按尺寸过滤不够，店铺 Logo、图标、二维码的尺寸也不小。于是加了一组 URL 关键词：`logo|icon|avatar|sprite|qrcode|loading|placeholder|1x1|pixel|banner|advert|promo|.gif`。规则不完美，但比纯尺寸靠谱。

### 转 PNG：跨域画布会污染

直接把 JPG 改后缀并不是 PNG。用 canvas 画跨域图片会污染画布，`toBlob` 直接抛安全错误。

解决路径是：`fetch` 原图 → `blob` → `createImageBitmap` → canvas → `toBlob('image/png')`。失败时回退为原图下载，并在界面提示。

### ZIP：不引第三方库

逐张下载会被浏览器拦截，多张需要一个压缩包。MV3 扩展不适合依赖 CDN，于是自己写了一个 store 模式的 ZIP：CRC32 查表、local file header、central directory、EOCD，只存储不压缩。

### 测试：淘宝打不开，就自己造一个

`item.taobao.com` 因为 HSTS 和本机解析问题打不开，登录和反爬也不稳定。于是做了一个淘宝风格的商品页：6 张缩略图、1 张 banner、3 张详情长图，外加 Logo 和 1×1 占位图当干扰项。

用 `python -m http.server 8000` 起服务，测试版扩展额外允许 `localhost:8000`，正式版仍然只匹配电商站点。

### 上线

官网放在 `docs/`，插件打包成 `docs/assets/imagegrab.zip`，推到 GitHub，开启 Pages：

> https://yuchengwen393.github.io/imagegrab/

从「页面里的一行按钮」到「一个能下载的域名」，这是第一次把完整链路走通。
