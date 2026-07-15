# 海报杂志主题与切换动效设计

日期：2026-07-07

## 目标

为 `squaredmedia` MacCMS 主题新增第三个可选主题：`poster-magazine`，用户界面显示为“海报杂志”。

这个主题要打破当前较规整的卡片站布局，在首页首屏呈现更强的海报杂志感：大幅影片画面、错位叠层、玻璃浮层、蓝粉紫高光和更有冲击力的标题排版。同时保留默认主题和当前“蓝粉紫”主题，用户可以随时切回。

主题切换需要有一次可感知但不干扰操作的过渡动效：点击主题后出现短暂的蓝粉紫光幕，主题生效后光幕淡出。用户开启减少动态效果时，降级为短淡入淡出或直接切换。

## 非目标

- 不替换 MacCMS 模板数据结构、标签语法、URL 帮助函数或分页模式。
- 不把默认主题或当前“蓝粉紫”主题重排成海报杂志布局。
- 不引入远程字体、远程图片、外部 CDN 或生产环境开发资源。
- 不增加自动播放视频背景、WebGL、Three.js 或沉重的持续动画。
- 不在主题目录内实现主题后台配置。
- 不为了视觉效果遮挡搜索、登录、导航、播放、详情等核心操作。

## 来源与约束

所有实现必须遵守 `docs/maccms-theme-development-spec.md`。

实现阶段修改模板前，需要继续参考 MacCMS 官方主题文档：

- 主题入口：https://www.maccms.la/theme
- 主题结构：https://www.maccms.la/theme/structure
- 视频模板与标签：https://www.maccms.la/theme/theme-vod
- 分类标签：https://www.maccms.la/theme/theme-type
- 全局标签：https://www.maccms.la/theme/tags-global

生产主题文件必须继续使用 MacCMS 运行时路径和帮助函数，例如 `{$maccms.path}`、`{$maccms.path_tpl}`、`mac_url`、`mac_url_type`、`mac_url_vod_detail`、`mac_url_vod_play`、`mac_url_img`。

## 主题选项

主题切换器保留现有入口，新增第三个选项：

- 默认：不设置 `data-theme`
- 蓝粉紫：设置 `data-theme="blue-pink-purple"`
- 海报杂志：设置 `data-theme="poster-magazine"`

`localStorage` 继续使用现有 `squared_media_theme` key。早期 head 脚本必须在 CSS 加载前识别 `poster-magazine`，避免刷新时先显示默认主题再跳变。

桌面端和移动端抽屉都必须显示“海报杂志”选项，并同步 active/pressed 状态。

## 视觉系统

### 调性

“海报杂志”主题的关键词是：全屏封面、叠层排版、玻璃浮榜、霓虹扫光、内容优先。

设计需要更炫，但不能变成装饰压过内容。主要视觉冲击来自影片图和版式变化，蓝粉紫炫光作为辅助层，不做全页面大面积同色渐变。

### 色彩

使用主题分支覆盖 CSS token：

- `--pm-ink`: `#050613`，深夜背景
- `--pm-paper`: `#f8f3ff`，高亮文字
- `--pm-cyan`: `#38bdf8`，冷色光边
- `--pm-pink`: `#ff4fd8`，主霓虹高光
- `--pm-violet`: `#8b5cf6`，阴影和边框光晕
- `--pm-lime`: `#b6ff6a`，少量评分或状态点缀

主题仍映射到已有语义 token，例如 `--bg`、`--panel`、`--text`、`--muted`、`--line`、`--accent`、`--accent-2`、`--gold`、`--shadow`。

### 排版

不引入远程字体，继续使用系统中文字体。海报杂志感通过字号、字重、宽度和布局获得：

- 首页 hero 标题在桌面端使用更大的 clamp 尺寸。
- 标题保持零或正常字距，不使用负字距。
- 元信息采用较小字号和玻璃标签，保持可扫读。
- 移动端限制标题和简介行数，避免首屏被文案撑破。

## 首页布局

### 首屏 Hero

只在 `html[data-theme="poster-magazine"]` 下改变首页首屏布局。

桌面端：

- `.hero` 变成接近首屏高度的沉浸区，顶部仍让出 header 空间。
- `.hero-grid` 从左右两栏变为叠层舞台。
- `.hero-carousel` 扩展为主视觉封面，占据主要宽度和高度。
- `.banner-bg` 更接近全幅海报背景，增加深色遮罩和边缘渐隐。
- `.banner-content` 以海报文字方式压在画面上，主标题更大，CTA 和元信息贴近标题组织。
- `.hero-rank` 变成右侧悬浮玻璃榜单，覆盖在主视觉边缘，而不是独立卡片并排。
- `.banner-controls` 放在海报底部，控件保留足够点击区域。

移动端：

- 首屏改成纵向结构：大封面在上，榜单在下。
- 不使用绝对定位压住正文或榜单。
- CTA、标题、简介和轮播控件不得互相重叠。
- 页面不能产生横向溢出。

### 最新上线

只在该主题下让 `.home-shelf-rail` 更像杂志版面：

- 桌面端第一张卡片可以作为视觉主卡，跨更多网格空间。
- 后续卡片保持可扫读，避免全部卡片都做大尺寸导致内容密度过低。
- 卡片 hover 增加短暂光泽扫过和轻微抬升。
- 图片仍保留显式尺寸、懒加载策略和 `mac_url_img` 输出。

移动端保持稳定两列或横向滚动策略，优先不牺牲可用性。

## 共享页面效果

海报杂志主题应覆盖共享视觉语言，但不强行重排所有页面：

- 头部和移动抽屉使用更强毛玻璃和细光边。
- 搜索框、用户菜单、筛选面板、详情面板、播放控件沿用同一组玻璃 token。
- 分类、详情、播放、用户中心和反馈页主要做色彩、边框、阴影、焦点态增强。
- 播放页仍以播放器优先，不用装饰层覆盖播放器。

## 切换动效

主题切换时增加一次全屏光幕：

1. 用户点击主题选项。
2. JS 给 `document.documentElement` 添加 `theme-transitioning`。
3. 短延迟或下一帧后设置新的 `data-theme` 和 `localStorage`。
4. CSS 使用 `::before` 或轻量 DOM overlay 展示蓝粉紫玻璃光幕。
5. 过渡结束后移除 `theme-transitioning`。

动效要求：

- 不引入新依赖。
- 优先使用 opacity、transform、filter，避免布局抖动。
- 光幕层必须 `pointer-events: none`，不能阻塞用户操作过久。
- 多次快速点击主题时，前一个过渡要能被新过渡覆盖，不留下 class。
- `prefers-reduced-motion: reduce` 下不做扫光和放大，只保留极短淡变或直接切换。

## 实现边界

预期修改文件：

- `template/squaredmedia/html/public/include.html`
- `template/squaredmedia/html/public/head.html`
- `template/squaredmedia/js/app.js`
- `template/squaredmedia/css/style.css`
- `tests/template.test.mjs`

如本地预览需要与生产主题选项或首页结构保持一致，可同步修改：

- `preview/index.html`
- `server/lib/render.php`
- 相关验证脚本

不应修改 MacCMS 视频标签参数、分类标签参数、播放器变量或用户钩子。

## 测试策略

新增或更新测试覆盖：

- `include.html` 早期主题脚本接受 `poster-magazine`。
- 桌面和移动主题切换器都包含“海报杂志”选项。
- `app.js` 的有效主题集合包含 `poster-magazine`。
- `app.js` 存在主题切换过渡 class 或等价状态。
- `style.css` 存在 `html[data-theme="poster-magazine"]` 主题 token 和首页 hero 布局规则。
- `.theme-switcher-menu[hidden]` 继续保持隐藏规则，避免回归。
- 生产主题文件不出现 localhost、preview、Docker、npm 等开发专用引用。

实现后运行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

部署前还需要运行：

```bash
npm run package
npm run verify:release
```

## 视觉验收

至少检查：

- 桌面 1440px：首页首屏应明显区别于默认主题，呈现大海报封面和悬浮热搜榜。
- 移动 375px：首页标题、CTA、简介、轮播控件和榜单不得重叠。
- 桌面和移动端主题菜单能打开、关闭、切换，并正确高亮当前主题。
- 切换到默认、蓝粉紫、海报杂志后刷新页面，主题保持或重置行为正确。
- 开启减少动态效果时，主题切换不出现明显扫光或大幅缩放。
- 分类页、详情页、播放页不出现文字不可读、按钮错位或横向溢出。

## 成功标准

- 用户可以手动选择“海报杂志”主题。
- 首页在该主题下不再局限于当前左右规整布局，而是呈现全屏海报杂志式视觉。
- 切换主题时有可感知的高级过渡动效，并且不破坏无障碍和性能。
- 默认主题和“蓝粉紫”主题行为保持稳定。
- MacCMS 模板兼容性不变，相关验证命令通过。
