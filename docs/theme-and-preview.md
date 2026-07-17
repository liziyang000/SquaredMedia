# 主题与本地预览

本文说明 `pingfangvideo` MacCMS V10 主题及两套本地预览工具的当前边界。当前代码是实现事实源；`docs/superpowers/**` 主要保存历史设计和实施计划，不能替代本说明、`docs/maccms-theme-development-spec.md` 或 [MacCMS 官方主题文档](https://www.maccms.la/theme)。

## 模块职责与边界

| 路径 | 职责 | 是否进入生产主题包 |
| --- | --- | --- |
| `template/pingfangvideo/**` | MacCMS 生产主题、共享前端资源和播放器提示页 | 是 |
| `preview/index.html` | 浏览器端路由与渲染的静态交互预览 | 否 |
| `preview/data.json` | 两套本地预览共用的样例数据 | 否 |
| `server/**` | PHP 8.4 后端渲染预览，不是 MacCMS 模板引擎 | 否 |
| `docker/**`、`docker-compose.yml` | PHP 8.4 + Apache 的预览运行环境 | 否 |

主题目录名和 MacCMS 模板标识当前仍是 `pingfangvideo`。修改这个标识会同时影响后台模板选择、资源路径、打包和部署，不能只改 `info.ini`。

## 生产主题目录

`template/pingfangvideo/` 保持 MacCMS 标准主题结构：

- `info.ini`：主题元信息，广告目录为 `ads`。
- `html/public/`：全站公共 include、头尾、分页、卡片、筛选和交互片段。
- `html/index/index.html`：首页入口，包含沉浸式热播轮播、年度热度榜、频道快捷入口和本年最新上线分类标签页。
- `html/vod/`：视频分类、筛选、搜索、详情、播放、试看、下载、版权、密码和剧情页面。
- `html/user/`、`comment/`、`gbook/`、`book/`：用户和反馈相关页面。
- `html/art/`、`topic/`、`actor/`、`role/`、`plot/`、`website/`：标准模块的页面或兜底页面。
- `html/label/`、`map/`、`rss/`：自定义入口、历史/榜单、站点地图和订阅输出。
- `css/style.css`：全站样式、语义 token、三套主题和响应式规则。
- `js/app.js`：移动导航、主题切换、登录/退出、收藏、分页跳转、首页标签页、自动下一集、动态筛选、轮播，以及 GSAP 入场、液态光斑和区块渐入动效。
- `images/`：站点和品牌图片；生产模板通过 `{$maccms.path_tpl}` 引用。
- `player/`：独立的预加载/缓冲提示页及其样式，不等同于启用自定义播放器。

## 关键入口与共享约定

### 公共骨架

- `html/public/include.html` 在 CSS 前读取 `localStorage` 中的 `pingfang_theme`，并加载主题 CSS、jQuery、MacCMS `maccms` 配置和 `home.js`。
- `html/public/head.html` 输出页面头部、搜索、用户状态、主题切换器和移动抽屉，并打开 `<main>`。
- `html/public/foot.html` 关闭页面结构、输出页脚和计时钩子，再加载共享 `app.js`。
- 普通页面通过 `{include file="public/head" /}` 与 `{include file="public/foot" /}` 复用骨架；修改公共 include 后，生产环境需要清理 MacCMS 模板缓存。

### 首页与列表

- 首页数据由 `maccms:vod` 和 `maccms:type` 在 MacCMS 运行时查询，内部字段使用 `$vo`，链接使用 `mac_url_vod_detail`、`mac_url_vod_play` 等 helper。
- `vod/type.html` 和 `vod/show.html` 复用 `public/vod_filter_common.html`、`public/vod_grid_results.html`、`public/vod_card.html` 和 `public/paging.html`。
- 排序只走 `time`、`hits`、`score` 三个固定分支，避免把原始请求参数直接放入查询形状。
- `app.js` 会向 `pingfangdevice/filters` 请求动态可用筛选项；失败时保留服务端输出的筛选，不阻断页面。

### 详情与播放

- 详情、播放和下载页当前对象使用 `$obj`，请求参数使用 `$param`。
- `vod/detail.html` 保留评分、星级、顶踩、收藏、历史和用户日志钩子。
- `vod/play.html` 与 `vod/player.html` 必须保留 `{$player_data}` 和 `{$player_js}`；后者是收费或试看场景使用的 iframe 播放页。
- 当前生产播放链仍由 MacCMS 原生播放器负责。`hls.min.js`、`pingfang-player.js` 和 `.pf-player` 样式是保留的实验原型，生产播放模板和本地预览都没有加载这两个脚本。
- `react.production.min.js`、`react-dom.production.min.js` 和 `rank-react.js` 同样保留在主题包中，但当前首页和预览没有加载它们；榜单使用服务端/静态 HTML 和 `app.js`。

## 当前视觉与动效

- 默认主题使用深夜蓝黑底色、紫蓝液态玻璃表面和高亮青色状态色；首页以全宽海报舞台和横向内容货架为主要视觉结构。
- `blue-pink-purple` 和 `poster-magazine` 通过根元素 `data-theme` 切换，选择保存在 `pingfang_theme`。
- `poster-magazine` 只在对应主题选择器下改变首页舞台、榜单和卡片布局，默认主题不共用这套重排。
- `gsap.min.js` 由生产首页、静态预览和 PHP 预览加载。当前 GSAP 负责首页入场时间线、轮播切换和指针液态光斑；区块渐入由 `IntersectionObserver` 触发 GSAP，一次播放后即取消观察。卡片 hover 保持为 CSS，并完整支持 `prefers-reduced-motion`。

## 数据与渲染流

### MacCMS 生产链

```text
HTTP 路由
  -> MacCMS 控制器准备 $maccms / $obj / $param / $user
  -> 入口模板执行 MacCMS 标签、helper 和 include
  -> 输出 HTML 与 MacCMS 交互钩子
  -> home.js + app.js 增强交互（首页额外加载 GSAP）
```

生产模板是数据语义和路由兼容性的事实源；本地预览不能证明真实 MacCMS 数据、权限、插件 hook 或播放器线路可用。

### 静态预览链

```text
HTTP GET /preview/index.html
  -> fetch /preview/data.json
  -> 浏览器根据 ?route=... 生成页面片段
  -> History API 切换路由
  -> 重新调用首页标签页、轮播和动效初始化器
```

静态预览复用生产 CSS、`app.js` 和 `gsap.min.js`，但页面标记由 `preview/index.html` 自己生成。它不会解析 MacCMS 标签，也不加载 `home.js`、用户态、插件接口或原生播放器数据。

### PHP 预览链

```text
server/index.php
  -> server/lib/data.php 读取 preview/data.json
  -> server/lib/render.php 按 ?route=... 过滤、排序并生成完整 HTML
  -> 浏览器加载生产 CSS 与 app.js
```

PHP 预览是独立渲染器，不会读取 `template/pingfangvideo/html/**`。它加载共享 GSAP 与 `app.js` 以复现主题动效，但不加载 MacCMS `home.js`、主题切换标记或实验播放器脚本。

## 开发约束

- 修改生产模板前，先读 `docs/maccms-theme-development-spec.md` 和 [对应的 MacCMS 官方页面](https://www.maccms.la/theme)。
- 生产文件只能使用 MacCMS 运行时路径、字段、标签和 URL helper；不得引用 `localhost`、`preview/**`、`server/**`、Docker 或 npm 命令。
- 不新增未在官方文档中定义的标签参数；列表标签必须闭合，分页必须保留正确 `pageurl`。
- 播放相关修改不得移除 `{$player_data}`、`{$player_js}` 或原生回退链。
- 改动共享 CSS/JS 标记时，要同时检查生产模板、静态预览和 PHP renderer，但不要把预览标记直接复制到生产模板。
- `preview/data.json` 使用远程图片和演示视频，离线或受限网络下媒体加载失败不代表生产主题故障。
- `__PINGFANG_ASSET_VERSION__` 由打包流程处理，不应在源码中手工替换为一次性版本号。

## 本地使用与验证

静态预览必须通过 HTTP 提供，不能直接用 `file://` 打开：

```bash
php -S 127.0.0.1:8099 -t .
```

然后访问：

```text
http://127.0.0.1:8099/preview/index.html?route=home
```

PHP 渲染回归使用仓库脚本：

```bash
npm run verify:preview
```

该命令通过 PHP CLI 渲染固定路由并检查 HTML，不会启动浏览器，也不会验证 Docker 挂载。

每次主题修改至少运行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

发布前再运行：

```bash
npm run package
npm run verify:release
```

## 已知限制与风险

- 静态预览、PHP 预览和生产模板分别维护标记与路由，存在人工同步漂移风险；视觉验收要覆盖生产模板相关页面，不能只看 `preview/index.html`。
- `preview/index.html` 通过绝对路径 `/preview/data.json` 取数，直接双击文件会解析到错误的文件系统根路径，并可能受浏览器模块/CORS 限制。
- Docker 通过 `PINGFANG_PREVIEW_DATA` 指向 `/var/www/html/preview/data.json`；宿主机 PHP CLI 未设置该变量时，`load_data()` 默认读取仓库根目录的 `preview/data.json`。
- `npm run verify:preview` 验证宿主机 PHP CLI 渲染链；修改 Compose 或容器路径时仍应额外执行 `docker compose config` 并访问容器入口。
- 自定义播放器和 React 榜单资产仍被打包但未加载；启用它们属于单独功能变更，需要同步模板、预览和测试，不能仅添加 `<script>`。

## 历史文档状态

- `docs/superpowers/specs/2026-06-27-cinematic-premium-theme-design.md`：早期视觉基线，部分首页结构已被后续迭代替代。
- `docs/superpowers/specs/2026-06-27-gsap-motion-optimization-design.md` 与对应 plan：其中的全站卡片 hover 方案未启用；当前只保留首页入场、一次性区块渐入、轮播和液态光斑，仍应以 `app.js` 为准。
- `docs/superpowers/specs/2026-06-29-home-mobile-polish-design.md` 与对应 plan：依赖的 `.hero-stats`、`.quick-types` 等首页结构已不存在。
- `docs/superpowers/specs/2026-07-01-pingfang-player-design.md`、对应 plan 和 handoff：已更新为“原型保留但禁用”，与当前代码一致。
- `docs/superpowers/specs/2026-07-07-poster-magazine-theme-design.md` 与对应 plan：核心主题切换和 scoped 布局已实现；仍应以当前 CSS、模板和测试为准。
