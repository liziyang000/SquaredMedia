# 主题与本地预览

本文说明 `pingfangvideo` MacCMS V10 主题、两套本地预览工具、独立 Next.js 前台与 Figma 产品基准的当前边界。当前代码是实现事实源；`docs/superpowers/**` 主要保存历史设计和实施计划，不能替代本说明、`docs/maccms-theme-development-spec.md` 或 [MacCMS 官方主题文档](https://www.maccms.la/theme)。

## 模块职责与边界

| 路径 | 职责 | 是否进入生产主题包 |
| --- | --- | --- |
| `template/pingfangvideo/**` | MacCMS 生产主题、共享前端资源和播放器提示页 | 是 |
| `apps/web/**` | Next.js 前台、App Router、本地同源 rewrite、API 客户端与前端测试 | 独立发布到 staging，不进入 MacCMS 主题包 |
| `maccms-player/**` | 独立的 HLS 性能版播放器源码 | 否；单独生成播放器归档 |
| `preview/index.html` | 浏览器端路由与渲染的静态交互预览 | 否 |
| `preview/data.json` | 两套本地预览共用的样例数据 | 否 |
| `server/**` | PHP 8.4 后端渲染预览，不是 MacCMS 模板引擎 | 否 |
| `docker/**`、`docker-compose.yml` | PHP 8.4 + Apache 的预览运行环境 | 否 |
| `scripts/figma-product-baseline/**` | 代码对齐的 Figma 产品基准生成、校验和本地插件 | 否；不进入任何运行时发布包 |

主题目录名和 MacCMS 模板标识当前仍是 `pingfangvideo`。修改这个标识会同时影响后台模板选择、资源路径、打包和部署，不能只改 `info.ini`。

## 生产主题目录

`template/pingfangvideo/` 保持 MacCMS 标准主题结构：

- `info.ini`：主题元信息，广告目录为 `ads`。
- `html/public/`：全站公共 include、头尾、分页、卡片、筛选和交互片段。
- `html/index/index.html`：首页入口，包含沉浸式热播轮播、年度热度榜、频道快捷入口和本年最新上线分类标签页。
- `html/vod/`：视频分类、筛选、搜索、详情、播放、试看、下载、版权、密码和剧情页面。
- `html/user/`、`comment/`、`gbook/`、`book/`：用户和反馈相关页面。
- `html/art/`、`topic/`、`actor/`、`role/`、`plot/`、`website/`：标准模块的页面或兜底页面。
- `html/label/`、`map/`、`rss/`：自定义入口、历史/榜单、会员游戏大厅、站点地图和订阅输出。
- `css/style.css`：全站样式、语义 token、五套主题和响应式规则；像素主题标题和控件使用本地 Fusion Pixel Font 12px 比例简体中文字形，字体及其 OFL-1.1 许可证位于 `css/fonts/`。
- `js/app.js`：移动导航、主题切换、登录/退出、收藏、分页跳转、首页标签页、自动下一集、动态筛选、详情页线路检测与健康线路桥接、轮播，以及 GSAP 入场和区块渐入动效；像素主题切换时复用本地 `canvas-confetti` 1.9.4 浏览器构建生成一次性方形边缘粒子，ISC 许可证随文件保留；`js/multiplayer-games.js` 负责联机房间、棋盘和画布交互，并用标签页身份区分同账号多开、通过 `?room=` 邀请链接自动加入房间。
- `games/`：2048 与 Blockrain.js 的本地游戏运行时及原始许可证；不提供可匿名打开的独立 `index.html`。五子棋和你画我猜是一方实现，浏览器协议位于 `js/multiplayer-games.js`。所有游玩页都由 `html/label/game-*.html` 按 `$user.user_id` 服务端分支加载脚本。
- `images/`：站点、品牌及敦煌/像素主题 SVG；生产模板通过 `{$maccms.path_tpl}` 或主题 CSS 相对路径引用。
- `player/`：独立的预加载/缓冲提示页及其样式，不等同于启用自定义播放器。

## 关键入口与共享约定

### 公共骨架

- `html/public/include.html` 在 CSS 前读取 `localStorage` 中的 `pingfang_theme`，并加载主题 CSS、jQuery、MacCMS `maccms` 配置和 `home.js`。
- `html/public/head.html` 输出页面头部、搜索、用户状态、主题切换器和移动抽屉，并打开 `<main>`。
- `html/public/foot.html` 关闭页面结构、保留隐藏计时钩子并加载共享 `app.js`；前台不再输出可见页脚。
- 普通页面通过 `{include file="public/head" /}` 与 `{include file="public/foot" /}` 复用骨架；修改公共 include 后，生产环境需要清理 MacCMS 模板缓存。

### 首页与列表

- 首页数据由 `maccms:vod` 和 `maccms:type` 在 MacCMS 运行时查询，内部字段使用 `$vo`，链接使用 `mac_url_vod_detail`、`mac_url_vod_play` 等 helper。
- `vod/type.html` 和 `vod/show.html` 复用 `public/vod_filter_common.html`、`public/vod_grid_results.html`、`public/vod_card.html` 和 `public/paging.html`。
- 排序只走 `time`、`hits`、`score` 三个固定分支，避免把原始请求参数直接放入查询形状。
- `app.js` 会向 `pingfangdevice/filters` 请求动态可用筛选项；失败时保留服务端输出的筛选，不阻断页面。

### 详情与播放

- 详情、播放和下载页当前对象使用 `$obj`，请求参数使用 `$param`。
- `vod/detail.html` 保留评分、星级、顶踩、收藏、历史和用户日志钩子。
- 详情页打开后会自动通过 `pingfangdevice/sourceQuality` 检测默认集数；用户切换测速集数时立即重新检测，按钮保留手动重测能力。前台按服务端健康排序标记唯一推荐线路，并把“立即播放”指向该集推荐线路；用户明确点击其他线路时仍尊重其选择。HLS 主清单存在有效 `RESOLUTION` 时，前台同时显示最高声明分辨率和本次实际抽样的 Variant；发生清晰度回退时会明确标注。直链、媒体清单或异常声明显示“分辨率未知”，不会按线路名称猜测。结果只在当前标签页短期保存，不包含原始播放地址。
- `vod/play.html` 与 `vod/player.html` 必须保留 `{$player_data}` 和 `{$player_js}`；后者是收费或试看场景使用的 iframe 播放页。
- 当前生产播放链仍由 MacCMS 的 `{$player_data}`、`{$player_js}` 选择播放器。主题内的 `hls.min.js`、`pingfang-player.js` 和 `.pf-player` 样式是保留的实验原型，生产播放模板和本地预览都没有加载它们，且它们不进入主题发布包。
- `maccms-player/` 是独立的 HLS 性能版播放器源码，由单独归档交付，不属于主题，也不会被现有部署脚本自动安装；其功能边界、发布顺序和回滚要求见 `docs/development-and-operations.md`。
- 主题 `app.js` 为独立播放器提供同集换线桥接：优先按短期健康排序选择同一集的其他播放组，没有健康记录时回退到原有页面顺序；自动换线会记录本轮已尝试线路，避免在线路之间循环，并临时传递播放进度。独立播放器在启动 12 秒仍未就绪、连续缓冲 8 秒、致命 HLS 错误或原生视频错误时触发换线；没有候选线路时保留手动重试/选线提示。播放器与主题需要按同一版本组合验收。
- `react.production.min.js`、`react-dom.production.min.js` 和 `rank-react.js` 同样只保留在源码中，不进入生产发布包；榜单使用服务端/静态 HTML 和 `app.js`。

## 当前视觉与动效

- 默认主题使用深夜蓝黑星空底色、紫蓝液态玻璃表面和高亮青色状态色；首页以全宽海报舞台和横向内容货架为主要视觉结构。
- `blue-pink-purple`、`poster-magazine`、`dunhuang-caisson` 和 `pixel-frog` 通过根元素 `data-theme` 切换，选择保存在 `pingfang_theme`。
- `poster-magazine` 只在对应主题选择器下改变首页舞台、榜单和卡片布局，默认主题不共用这套重排。
- `pixel-frog` 使用深森林绿、亮青蛙绿、奶油白和少量珊瑚红，复用原创像素 SVG；标题、导航、按钮和标签使用本地中文像素字体，播放/搜索/关闭等功能符号使用独立像素 SVG。徽章跳动和四边向内的方形粒子只在用户主动切换时触发，并遵循 `prefers-reduced-motion`。
- `gsap.min.js` 仅在首页、桌面精细指针且未启用 `prefers-reduced-motion` 时由 `app.js` 按需加载。GSAP 负责首页入场时间线和轮播切换；其他设备使用 CSS 轮播回退，卡片 hover 保持为 CSS。
- 轮播背景只在图片预加载成功后写入 CSS；海报或背景请求失败时切换到主题内置玻璃渐变，避免破图图标和动态层重复请求。

## 数据与渲染流

### MacCMS 生产链

```text
HTTP 路由
  -> MacCMS 控制器准备 $maccms / $obj / $param / $user
  -> 入口模板执行 MacCMS 标签、helper 和 include
  -> 输出 HTML 与 MacCMS 交互钩子
  -> home.js + app.js 增强交互（符合动效条件的首页按需加载 GSAP）
```

生产模板是数据语义和路由兼容性的事实源；本地预览不能证明真实 MacCMS 数据、权限、插件 hook、线路检测端点或播放器线路可用。

### 静态预览链

```text
HTTP GET /preview/index.html
  -> fetch /preview/data.json
  -> 浏览器根据 ?route=... 生成页面片段
  -> History API 切换路由
  -> 重新调用首页标签页、轮播和动效初始化器
```

静态预览复用生产 CSS、`app.js` 和 `gsap.min.js`，但页面标记由 `preview/index.html` 自己生成。它不会解析 MacCMS 标签，也不加载 `home.js`、真实用户态、线路检测插件接口或原生播放器数据。游戏路由默认展示未登录拦截；追加 `member=1` 只模拟会员视觉。2048 与俄罗斯方块可本地操作，联机页面因没有真实 MacCMS 登录票据会显示未连接，不能把该参数当作联机鉴权。

### PHP 预览链

```text
server/index.php
  -> server/lib/data.php 读取 preview/data.json
  -> server/lib/render.php 按 ?route=... 过滤、排序并生成完整 HTML
  -> 浏览器加载生产 CSS 与 app.js
```

PHP 预览是独立渲染器，不会读取 `template/pingfangvideo/html/**`。它加载共享 GSAP、`app.js` 和与生产头部一致的主题切换标记以复现主题动效，但不加载 MacCMS `home.js`、真实用户态或实验播放器脚本。游戏预览同样使用 `member=1` 模拟登录分支。

## 开发约束

- 修改生产模板前，先读 `docs/maccms-theme-development-spec.md` 和 [对应的 MacCMS 官方页面](https://www.maccms.la/theme)。
- 生产文件只能使用 MacCMS 运行时路径、字段、标签和 URL helper；不得引用 `localhost`、`preview/**`、`server/**`、Docker 或 npm 命令。
- 不新增未在官方文档中定义的标签参数；列表标签必须闭合，分页必须保留正确 `pageurl`。
- 播放相关修改不得移除 `{$player_data}`、`{$player_js}` 或原生回退链。
- 改动共享 CSS/JS 标记时，要同时检查生产模板、静态预览和 PHP renderer，但不要把预览标记直接复制到生产模板。
- `preview/data.json` 使用远程图片和演示视频，离线或受限网络下媒体加载失败不代表生产主题故障。
- `__PINGFANG_STYLE_VERSION__`、`__PINGFANG_APP_VERSION__`、`__PINGFANG_PROMPT_VERSION__`、`__PINGFANG_GAME_VERSION__` 和 `__PINGFANG_MULTIPLAYER_VERSION__` 由打包流程按文件内容处理，不应在源码中手工替换为一次性版本号。

## 本地使用与验证

当前首选的本地前台入口是 Next.js：

```bash
npm run dev:local
```

访问 `http://127.0.0.1:5173/`。该命令同时在 `8084` 启动 PHP 预览后端；Next.js development rewrites 将 `/react-api.php` 指向本地 `server/react-api.php`，并代理保留的 PHP、模板和静态资源路径，所以 App Router 深层 URL 可直接刷新，`/index.php?route=home` 仍可用于核对旧 PHP 渲染链。退出命令会停止两个进程。此切换仅用于本地开发，生产主题选择和部署脚本保持不变。

Next.js 本地前台已覆盖首页、目录、分类、搜索、榜单、详情、剧情、下载授权入口、播放/试看外壳、既有会员登录、用户中心、收藏、记录、设备、评论、留言、报错、挑战、状态与 `404` 页面。新会员注册和账号找回明确退场，新旧页面地址返回 HTTP `410`。页面导入 `template/pingfangvideo/css/style.css` 与品牌资源，但不加载 `template/pingfangvideo/js/app.js`；交互状态由 React 管理。MacCMS 主题共有五套视觉，当前 React `SiteHeader` 只注册液态影院、极光夜幕和海报画廊三套，敦煌流光与像素蛙尚不能视为 React 已支持。`src/proxy.ts` 对已知旧公开 URL 返回单跳 `301`，对明确退场的模块返回真实 HTTP `410`，未知页面由 Next.js 返回真实 `404`。79 个旧模板逐项归属见 [React 模板迁移矩阵](react-template-migration-matrix.md)。

`server/react-api.php` 是本地验收适配器，不是生产 MacCMS 接口。它从 `preview/data.json` 生成首页和内容白名单 DTO；列表、搜索和详情不返回 `episodes[].src`，只有 `playback` action 返回当前单集媒体描述。写操作只接受 JSON，使用真实 PHP session、HttpOnly/Lax Cookie 和 CSRF Token，并在 session 内保存收藏、记录、设备撤销、反馈、评论与评分。公开首页响应不携带用户历史：匿名记录来自经过 URL 与结构校验的浏览器存储，登录账号记录通过私有接口获取；收藏和账号历史支持选择、删除和清空。公开响应使用短 TTL，用户和播放响应为 `private, no-store`。本地账号为 `demo` / `demo123`。

production build 必须通过 `NEXT_PUBLIC_API_BASE_URL` 指向经过真实 MacCMS 版本、权限、Cookie、播放器线路与字段验证的同源端点；也可用 `NEXT_PUBLIC_HOME_API_URL` 单独覆盖首页端点。`deploy-next-web.sh` 在构建时固定注入 `/index.php/pingfangapi/index`，浏览器 Cookie 不离开 `react.ping2.my`。staging 已具备 systemd、健康检查、Nginx 反向代理和版本回滚链；普通/VIP/付费/试看/密码/版权等真实授权矩阵仍需单独完成，不能仅以首页 200 表述为业务验收完成。

`npm run build:web` 生成 standalone `.next` 产物，而不是可直接交给静态服务器的 `dist/`。任意 `/vod/*`、`/watch/*` 路由、Cookie 会话和 Proxy 都要求 Next.js runtime。`ops/nginx/react.ping2.my.conf` 保留 MacCMS PHP、播放器、上传和主题资源的优先级，其余路径反代 `127.0.0.1:3100`；`/react-api.php` 与 `/preview` 不进入 staging。该配置只供 `react.ping2.my` 使用，不修改主站。

静态预览必须通过 HTTP 提供，不能直接用 `file://` 打开：

```bash
php -S 127.0.0.1:8099 -t .
```

然后访问：

```text
http://127.0.0.1:8099/preview/index.html?route=home
```

游戏权限与玩法可分别访问：

```text
http://127.0.0.1:8099/preview/index.html?route=games
http://127.0.0.1:8099/preview/index.html?route=games&member=1
http://127.0.0.1:8099/preview/index.html?route=game-gomoku&member=1
http://127.0.0.1:8099/preview/index.html?route=game-drawguess&member=1
```

第一条验证未登录拦截，其余地址只用于检查会员分支视觉。生产环境仍以 MacCMS 注入的 `$user.user_id` 为准，游戏大厅和具体游玩页在未登录分支都不会输出游戏脚本。联机行为需同时运行 `services/game-server`、配置同源代理，并由已登录 MacCMS 页面取得短票据。

PHP 渲染回归使用仓库脚本：

```bash
npm run verify:preview
```

该命令通过 PHP CLI 渲染固定路由并检查 HTML，不会启动浏览器、验证 Docker 挂载或发起真实线路检测。线路检测的本地行为回归由 `php tests/vod-source-quality.test.php` 覆盖；完整端到端结果仍需在装有 `pingfangdevice` 的 MacCMS 环境中验证。

Next.js 本地浏览器验收使用：

```bash
npm run typecheck:web
npx playwright install chromium
npm run test:e2e
npm run build:web
```

E2E 会启动或复用本地 Next.js/PHP 服务，检查状态码、直达刷新、筛选、播放、历史与账号交互、响应式边界和控制台错误；报告与失败截图写入被忽略的 `output/playwright/`。

Figma 基准工具位于 `scripts/figma-product-baseline/`，其 Raw Evidence 与正式 MacCMS 原型继续保持受保护和可追溯。当前计划文件仍以 MacCMS 四个 source roots 为事实源，并把 `apps/web` 记为历史 archive；合入本轮 React 前台后，应先更新该映射和验证器，再用它同步 Figma，不能把旧 Final QA 当作当前 React 覆盖证明。

每次主题修改至少运行：

```bash
npm test
npm run lint
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
- 主题内的实验播放器和 React 榜单脚本仅保留在源码、不进入主题发布包；独立的 `maccms-player/` 只进入自己的播放器归档，仍需明确发布授权和线上播放验收才能启用。

## 历史文档状态

- `docs/superpowers/specs/2026-06-27-cinematic-premium-theme-design.md`：早期视觉基线，部分首页结构已被后续迭代替代。
- `docs/superpowers/specs/2026-06-27-gsap-motion-optimization-design.md` 与对应 plan：其中的全站卡片 hover 方案未启用，指针液态光斑也已移除；当前只保留首页入场、一次性区块渐入和轮播，仍应以 `app.js` 为准。
- `docs/superpowers/specs/2026-06-29-home-mobile-polish-design.md` 与对应 plan：依赖的 `.hero-stats`、`.quick-types` 等首页结构已不存在。
- `docs/superpowers/specs/2026-07-01-pingfang-player-design.md`、对应 plan 和 handoff：已更新为“原型保留但禁用”，与当前代码一致。
- `docs/superpowers/specs/2026-07-07-poster-magazine-theme-design.md` 与对应 plan：核心主题切换和 scoped 布局已实现；仍应以当前 CSS、模板和测试为准。
