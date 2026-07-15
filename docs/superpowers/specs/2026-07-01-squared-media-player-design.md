# Squared Media 自用播放器设计

日期：2026-07-01

## 目标

为 `squaredmedia` 主题增加一套自用前端播放器，在 MacCMS 播放页中优先接管可直连播放的 `.m3u8` 和 `.mp4` 资源，提供统一控制栏、倍速、音量、全屏、错误回退和播放进度记忆。

播放器必须保持 MacCMS 原有播放器链路可用：当播放地址不是可识别直链、浏览器不支持、跨域失败、防盗链失败或第三方解析线路需要 iframe 时，页面继续使用 MacCMS 原本输出的播放器。

当前状态：播放器脚本和样式作为后续开发内容保留在仓库中，但 `html/vod/play.html`、`html/vod/player.html` 和本地预览播放页暂不加载该播放器。

## 非目标

- 不做后端解析、转码、切片、签名、防盗链绕过或 DRM 解密。
- 不承诺接管所有外站 `.m3u8`，只接管浏览器当前页面能合法访问的标准 HLS/MP4。
- 不移除 `{$player_data}` 和 `{$player_js}`。
- 不改变 MacCMS 播放组、选集 URL、试看/收费 iframe 的基础流程。
- 不在生产模板中引用 localhost、preview、Docker、npm 或开发环境资源。

## 来源与约束

实现遵守 `docs/maccms-theme-development-spec.md`。

已核对 MacCMS 官方主题文档：

- 视频模板文档说明 `html/vod/play.html` 为视频播放页，并提供 `{$param.sid}`、`{$param.nid}`、当前播放组和当前集数等播放页独有字段。
- 同一文档说明 `html/vod/player.html` 是收费或试看模式的 iframe 播放器页面，并且同样需要 `{$player_data}` 和 `{$player_js}` 输出播放器。
- 模板结构文档定义主题静态资源目录包含 `js`、`css`、`images`、`html`，播放器脚本应放在 `template/squaredmedia/js/` 并通过 `{$maccms.path_tpl}` 加载。

## 方案选择

选择“混合接管播放器”方案。

播放器脚本在 MacCMS 原播放器输出之后运行，读取 `window.player_data.url` 或本地预览页面中的 `<video>` 直链。只有在地址明确是 `.m3u8` 或 `.mp4` 时才创建 Squared Media 播放器 UI；否则不改动页面。

对 `.mp4` 使用原生 `<video>` 播放。对 `.m3u8`，Safari 等支持原生 HLS 的浏览器直接播放；其他支持 Media Source Extensions 的浏览器通过本地 vendored `hls.js` 播放。加载失败或 HLS 报错时恢复原 MacCMS 播放器内容。

## 用户体验

播放器视觉延续现有影院级深色主题，界面重点放在实用控制：

- 播放/暂停按钮。
- 当前时间、总时长和可拖动进度条。
- 静音、音量滑块。
- 倍速选择。
- 全屏按钮。
- 播放状态与错误提示。
- 键盘支持：空格播放暂停，左右方向键快退/快进，`m` 静音，`f` 全屏。

UI 不增加营销式说明文案，不改变页面信息架构。移动端控制栏允许换行，触控目标保持稳定，不遮挡播放器主体。

## 技术边界

新增文件：

- `template/squaredmedia/js/squared-media-player.js`：播放器接管、UI、事件、进度记忆和回退逻辑。
- `template/squaredmedia/js/hls.min.js`：本地 HLS 播放依赖。

修改文件：

- `template/squaredmedia/html/vod/play.html`：当前保留 MacCMS 原播放器输出，不加载本地 HLS 和自用播放器脚本。
- `template/squaredmedia/html/vod/player.html`：当前保留 MacCMS 原试看/收费播放器输出，不加载本地 HLS 和自用播放器脚本。
- `template/squaredmedia/css/style.css`：新增 `.sm-player` 样式和响应式控制栏。
- `server/lib/render.php`：本地预览播放页输出可被脚本接管的标记。
- `tests/template.test.mjs`：增加模板脚本加载、播放器源码和样式回归断言。

## 错误处理

- 地址不是 `.m3u8` 或 `.mp4`：不接管，保留 MacCMS 原播放器。
- `hls.js` 不存在或当前浏览器不支持 HLS：恢复原播放器。
- HLS 网络错误、媒体错误或初始化失败：恢复原播放器。
- 本地存储不可用：跳过进度记忆，不阻塞播放。

## 验证

实现按 TDD 推进，先添加失败断言，再实现代码。

完成后运行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

成功标准：

- `vod/play.html` 和 `vod/player.html` 保留 `{$player_data}`、`{$player_js}`，当前不加载本地播放器增强脚本。
- 直链 `.m3u8`/`.mp4` 有自用播放器 UI。
- 复杂线路可回退到 MacCMS 原播放器。
- 生产模板不包含开发环境引用。
- 所有必需验证命令通过，或记录具体阻塞原因。
