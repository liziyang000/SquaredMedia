# 首页移动端样式精修设计

日期：2026-06-29

## 目标

在不改动 MacCMS 模板标签结构的前提下，优化 `squaredmedia` 首页在手机屏幕上的首屏体验。

本次优化延续现有“影院级深色主题”，但重点从桌面视觉冲击转向移动端可用性：首屏 hero 不拥挤，文案、统计卡片和轮播控件不互相压叠，分类入口更顺手，影片卡片在小屏下更稳定。

## 非目标

- 不重写首页信息架构。
- 不新增 JavaScript。
- 不引入远程字体、远程图片或生产环境外部资源。
- 不修改 `maccms:vod`、`maccms:type` 标签参数。
- 不修改 URL helper、图片 helper、分页或 MacCMS 运行时路径。
- 不在 `template/squaredmedia/**` 中加入 localhost、preview、Docker、npm 或其他开发专用引用。

## 来源与约束

所有实现必须遵守 `docs/maccms-theme-development-spec.md`。

本方案预计只修改 `template/squaredmedia/css/style.css`。如果实现阶段发现必须调整 `template/squaredmedia/html/index/index.html`，需要先阅读 MacCMS 官方主题文档中首页、视频标签、分类标签和全局标签相关页面，并保持所有标签、字段和 URL helper 与官方文档一致。

## 设计方向

选择“移动沉浸 / CSS 移动端精修”方案。

核心判断：当前首页桌面布局已经具备影院感，移动端的问题主要来自响应式空间分配，而不是模板结构缺失。因此优先用 CSS 修正 760px 和 520px 断点下的布局密度与稳定性。

## 范围

### Hero 轮播

优化 `.hero-carousel`、`.hero-slide`、`.banner-copy`、`.hero-carousel .hero-stats`、`.banner-controls` 在移动断点下的空间关系：

- 让 hero 文案、统计卡片和轮播控制区各自拥有稳定区域。
- 移动端标题限制为两行，简介限制为较短的两行，避免把统计区挤出可视范围。
- 控制 hero 最小高度，让首屏仍有沉浸感，但能更早露出下方分类或榜单。
- 保持首张图片 eager/high priority 的现有模板策略，不通过 CSS 或模板改动破坏加载策略。
- 保持轮播箭头和圆点触控目标接近或达到 44px，不牺牲可点击性。

### 统计卡片

优化 `.hero-stats` 和 `.stat-card`：

- 继续保持三列统计，但在 520px 以下减小间距和内边距。
- 数字和标签必须单行截断，不撑破卡片。
- 背景和边框保持暗色玻璃感，但避免比 hero 文案更抢眼。

### 快捷分类

优化 `.quick-types` 和 `.quick-types a` 的移动样式：

- 小屏改为横向滚动入口，避免多行分类把首屏推得过长。
- 保持胶囊式触控目标，最小高度不低于 44px。
- 使用 `scroll-snap` 和隐藏式滚动条增强移动端手感，但不影响桌面 flex 换行。
- 不改变 `maccms:type` 标签和分类 URL helper。

### 影片卡片

优化 `.vod-grid`、`.vod-card`、`.poster`、`.quality-badge`、`.score-badge`、`.card-meta` 的移动密度：

- 维持两列小屏网格。
- 减少卡片内边距和徽章尺寸，让海报比例稳定。
- 标题保持两行高度，主演单行截断，避免长中文或混合语言标题造成卡片高度跳动。
- 分类和年份元信息保持可扫读，但不扩大卡片高度。

### 分区节奏

优化 `.content-section`、`.section-head` 和移动端首页区块间距：

- 缩小移动端上方空白，让首屏之后的内容更快进入视野。
- 标题字号和右侧链接保持清晰，但不使用桌面级标题尺度。
- 不新增营销式说明文案。

## 实现边界

预期只修改：

- `template/squaredmedia/css/style.css`

不修改：

- `template/squaredmedia/html/index/index.html`
- `template/squaredmedia/html/public/head.html`
- `template/squaredmedia/js/app.js`
- `preview/**`
- `server/**`

只有当纯 CSS 无法解决实际重叠问题时，才重新评估是否需要轻量模板结构调整。

## 可访问性与交互

- 所有移动端可点击控件应保持实用触控面积。
- 保留现有 `:focus-visible` 样式，不移除键盘焦点反馈。
- 不依赖 hover 才能读到关键信息。
- 不增加自动播放、额外动画或阻塞交互的视觉效果。
- 保持 `prefers-reduced-motion` 现有逻辑有效。

## 验证

实现后运行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

同时做移动端视觉检查：

- 375px 宽首页首屏，hero 文案、统计卡片和轮播控制区不得重叠。
- 375px 宽首页，页面不得产生横向溢出。
- 520px 宽首页，快捷分类应可横向滚动且触控目标足够。
- 桌面首页不应出现明显视觉回退。

## 成功标准

- 手机首屏更从容，hero 不再显得拥挤。
- 统计卡片和轮播控制区位置稳定，不遮挡标题、简介或 CTA。
- 快捷分类在小屏更易横滑浏览。
- 影片卡片在两列布局下高度更稳定，长标题不会破坏网格。
- MacCMS 模板兼容性保持不变，相关验证命令通过。
