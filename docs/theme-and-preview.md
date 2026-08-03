# 主题与本地预览

本文说明 `pingfangvideo` MacCMS V10 主题及两套本地预览工具的当前边界。当前代码是实现事实源；`docs/superpowers/**` 主要保存历史设计和实施计划，不能替代本说明、`docs/maccms-theme-development-spec.md` 或 [MacCMS 官方主题文档](https://www.maccms.la/theme)。

## 模块职责与边界

| 路径 | 职责 | 是否进入生产主题包 |
| --- | --- | --- |
| `template/pingfangvideo/**` | MacCMS 生产主题、共享前端资源和播放器提示页 | 是 |
| `maccms-player/**` | 独立的 HLS 性能版播放器源码 | 否；单独生成播放器归档 |
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
- `html/label/`、`map/`、`rss/`：自定义入口、历史/榜单、会员游戏大厅、站点地图和订阅输出。
- `css/style.css`：全站样式、语义 token、六套主题和响应式规则；像素主题标题和控件使用本地 Fusion Pixel Font 12px 比例简体中文字形，字体及其 OFL-1.1 许可证位于 `css/fonts/`。
- `js/app.js`：移动导航、主题切换、登录/退出、收藏、分页跳转、首页标签页、自动下一集、动态筛选、详情页线路检测与健康线路桥接、轮播，以及 GSAP 入场和区块渐入动效；像素主题切换时复用本地 `canvas-confetti` 1.9.4 浏览器构建生成一次性方形边缘粒子，ISC 许可证随文件保留；`js/multiplayer-games.js` 负责联机房间、棋盘和画布交互，并用标签页身份区分同账号多开、通过 `?room=` 邀请链接自动加入房间。
- `games/`：2048 与 Blockrain.js 的本地游戏运行时及原始许可证，以及一方实现的竹知了三阶段节奏玩法；竹知了包含指针/键盘操作、动态共鸣区、竹风与反向事件、分项评级和 Web Audio 合成声音，不提供可匿名打开的独立 `index.html`。五子棋和你画我猜也是一方实现，浏览器协议位于 `js/multiplayer-games.js`。所有游玩页都由 `html/label/game-*.html` 按 `$user.user_id` 服务端分支加载脚本。
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
- 当前生产播放链仍由 MacCMS 的 `{$player_data}`、`{$player_js}` 选择播放器。主题中曾保留但未加载、未发布的实验播放器脚本与样式已经移除。
- `maccms-player/` 是独立的 HLS 性能版播放器源码，由单独归档交付，不属于主题，也不会被现有部署脚本自动安装；其功能边界、发布顺序和回滚要求见 `docs/development-and-operations.md`。
- 主题 `app.js` 为独立播放器提供同集换线桥接：优先按短期健康排序选择同一集的其他播放组，没有健康记录时回退到原有页面顺序；自动换线会记录本轮已尝试线路，避免在线路之间循环，并临时传递播放进度。独立播放器在启动 12 秒仍未就绪、连续缓冲 8 秒、致命 HLS 错误或原生视频错误时触发换线；没有候选线路时保留手动重试/选线提示。播放器与主题需要按同一版本组合验收。
- 榜单使用服务端/静态 HTML 和 `app.js`；未加载、未发布的 React 榜单实验脚本已经移除。

## 当前视觉与动效

- 默认主题使用深夜蓝黑星空底色、紫蓝液态玻璃表面和高亮青色状态色；首页以全宽海报舞台和横向内容货架为主要视觉结构。
- `blue-pink-purple`、`poster-magazine`、`dunhuang-caisson`、`digital-particles` 和 `pixel-frog` 通过根元素 `data-theme` 切换，选择保存在 `pingfang_theme`。
- `poster-magazine` 只在对应主题选择器下改变首页舞台、榜单和卡片布局，登录页使用左对齐的杂志排版、硬边色块和偏移阴影；默认主题不共用这套重排。
- 六套主题共用登录表单结构和交互，但视觉按主题适配：默认主题保留紫蓝液态玻璃，`blue-pink-purple` 使用青粉双辉光玻璃，`poster-magazine` 使用编辑设计，敦煌和像素青蛙延续各自既有样式，`digital-particles` 使用蓝色网格终端面板。
- `pixel-frog` 使用深森林绿、亮青蛙绿、奶油白和少量珊瑚红，复用原创像素 SVG；标题、导航、按钮和标签使用本地中文像素字体，播放/搜索/关闭等功能符号使用独立像素 SVG。徽章跳动和四边向内的方形粒子只在用户主动切换时触发，并遵循 `prefers-reduced-motion`。
- `digital-particles` 使用近黑蓝画布、4–10px 微圆角和冷蓝辉光表面；方块粒子按远、中、近三组使用不同尺寸与漂移距离，移动端减少粒子密度，粒子层不接收指针事件，并在 `prefers-reduced-motion` 下停止漂浮。
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

静态预览复用生产 CSS、`app.js` 和 `gsap.min.js`，但页面标记由 `preview/index.html` 自己生成。它不会解析 MacCMS 标签，也不加载 `home.js`、真实用户态、线路检测插件接口或原生播放器数据。游戏路由默认展示未登录拦截；追加 `member=1` 只模拟会员视觉。2048、俄罗斯方块和竹知了可本地操作，联机页面因没有真实 MacCMS 登录票据会显示未连接，不能把该参数当作联机鉴权。

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
http://127.0.0.1:8099/preview/index.html?route=game-bamboo-cicada&member=1
http://127.0.0.1:8099/preview/index.html?route=game-gomoku&member=1
http://127.0.0.1:8099/preview/index.html?route=game-drawguess&member=1
```

第一条验证未登录拦截，其余地址只用于检查会员分支视觉。生产环境仍以 MacCMS 注入的 `$user.user_id` 为准，游戏大厅和具体游玩页在未登录分支都不会输出游戏脚本。联机行为需同时运行 `services/game-server`、配置同源代理，并由已登录 MacCMS 页面取得短票据。

PHP 渲染回归使用仓库脚本：

```bash
npm run verify:preview
```

该命令通过 PHP CLI 渲染固定路由并检查 HTML，不会启动浏览器、验证 Docker 挂载或发起真实线路检测。线路检测的本地行为回归由 `php tests/vod-source-quality.test.php` 覆盖；完整端到端结果仍需在装有 `pingfangdevice` 的 MacCMS 环境中验证。

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
- 主题内未加载、未发布的实验播放器和 React 榜单脚本已移除；独立的 `maccms-player/` 只进入自己的播放器归档，仍需明确发布授权和线上播放验收才能启用。

## 历史文档状态

- `docs/superpowers/specs/2026-06-27-cinematic-premium-theme-design.md`：早期视觉基线，部分首页结构已被后续迭代替代。
- `docs/superpowers/specs/2026-06-27-gsap-motion-optimization-design.md` 与对应 plan：其中的全站卡片 hover 方案未启用，指针液态光斑也已移除；当前只保留首页入场、一次性区块渐入和轮播，仍应以 `app.js` 为准。
- `docs/superpowers/specs/2026-06-29-home-mobile-polish-design.md` 与对应 plan：依赖的 `.hero-stats`、`.quick-types` 等首页结构已不存在。
- `docs/superpowers/specs/2026-07-01-pingfang-player-design.md`、对应 plan 和 handoff：记录的是已移除实验原型的历史决策，不代表当前源码仍保留该原型。
- `docs/superpowers/specs/2026-07-07-poster-magazine-theme-design.md` 与对应 plan：核心主题切换和 scoped 布局已实现；仍应以当前 CSS、模板和测试为准。
