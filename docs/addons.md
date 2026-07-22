# MacCMS 插件模块

本文说明当前仓库 `addons/**` 下实际存在的插件。代码、`info.ini` 与
`install.sql` 是事实源；带日期的方案文档只用于追溯设计背景，不能代替当前实现。

## 模块概览

| 插件             | 当前职责                                                         | 持久化表                                                                    | 钩子        | 仓库发布链路                    |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------- | ------------------------------- |
| `pingfangdevice` | 管理会员设备会话；为主题提供地区、年份、语言动态筛选项           | `__PREFIX__pingfang_device_session`                                         | `app_begin` | 已纳入打包、发布校验和 SSH 部署 |
| `pingfangapi`    | 为 React 提供 MacCMS 内容、播放、会话、收藏、历史和设备 JSON API | 复用 `vod`、`user`、`ulog` 与设备会话表                                     | 无          | 已纳入打包、发布校验和 SSH 部署 |
| `videolint`      | 扫描视频库质量，记录、筛选、导出并人工标记问题                   | `__PREFIX__pingfang_video_lint_scan`、`__PREFIX__pingfang_video_lint_issue` | 无          | 当前未纳入自动打包或部署        |

三个插件的主类 `install()`、`uninstall()` 都只返回成功，不负责建表或删表。
有 `install.sql` 的插件必须由部署环境另行执行；卸载代码不会自动删除历史数据。

## `pingfangdevice`

### 职责与请求流程

插件把 MacCMS 原生登录与一条服务端设备会话绑定：

1. 登录入口先调用原生 `User::login()`，成功后以返回的用户元数据创建设备会话。
2. 数据库只保存随机设备 Token 的 SHA-256 摘要，原始 Token 写入 HttpOnly Cookie。
3. `app_begin` 钩子在请求开始时核对用户 Cookie、设备 Token、撤销状态和有效期，并同步原生用户 Cookie。
4. 超出设备上限时撤销最早登录的活动会话；用户也可在设备页手动踢下线其他设备。
5. 原生注册或 OAuth 登录没有设备 Token 时，会在原生登录仍有效的前提下被纳入设备管理；已撤销的托管登录不能靠删除 Token 恢复。

`VodFilterOptions` 是同一插件内的附加能力。它按已启用视频、栏目范围及当前筛选条件，返回地区、年份、语言选项和数量，并缓存 120 秒。该能力不管理设备，但当前主题的分类页复用了同一个前台兼容控制器入口。

### 结构与入口

- `Pingfangdevice.php`：插件主类，只实现 `appBegin()` 钩子。
- `application/index/controller/Pingfangdevice.php`：MacCMS 标准插件应用载荷中的前台兼容控制器，供主题使用 `url('pingfangdevice/...')` 访问。
- `controller/Index.php`：MacCMS 原生插件路由控制器，使用 `addon_url(...)` 和插件自带视图。
- `controller/DeviceActions.php`：两个控制器共用的登录、退出、撤销和筛选动作。
- `service/DeviceSession.php`：会话注册、校验、续用、撤销、过期、设备上限和展示数据清洗。
- `service/VodFilterOptions.php`：视频筛选项查询、栏目继承、输入归一化与缓存。
- `view/index/index.html`：插件路由下的设备管理页；主题桥接入口渲染的是主题内同名模板。
- `config.php`、`install.sql`：设备上限、Cookie 名、有效期配置及表结构/升级 SQL。

兼容控制器与插件控制器只分别维护页面渲染入口，请求动作集中在 `DeviceActions`，避免两套路由产生行为漂移。`application/` 目录遵循 [MacCMS 官方插件目录规范](https://www.maccms.la/plugin/plugin-dir)，便于标准插件安装器识别需要复制到 CMS 应用目录的文件。

### 数据与配置

设备会话表记录用户、Token 摘要、原生登录校验摘要、设备标签、User-Agent、IP、登录/活动/撤销时间和撤销原因。Token 摘要唯一；用户活动会话和登录时间均有索引。`install.sql` 还会为旧安装补加 `login_check_hash`。

配置在服务层做二次约束：设备数为 1～20，生命周期为 1～365 天，Cookie 名只接受长度不超过 64 的字母、数字、点、下划线和连字符。默认值分别为 3 台、30 天和 `pfv_device_token`。修改 Cookie 名会使旧 Cookie 不再被识别。

会话记录没有自动清理任务；过期或撤销记录会保留，并在设备列表中最多展示 20 条。表中包含 IP 和 User-Agent，部署方应按实际隐私与留存要求处理。

### 安全边界

- 登录、退出和踢下线要求 POST；桥接/插件控制器还要求 Ajax 请求。设备撤销同时校验当前用户与目标会话归属，且不能通过“踢下线”撤销当前设备。
- Token 使用 32 字节随机数；Cookie 设置 HttpOnly、全站路径，并仅在 HTTPS 请求下设置 Secure。数据库不保存原始 Token。
- 会话创建使用事务和用户行锁；Cookie 写入失败会撤销刚创建的记录。同步过程异常时按失效登录处理。
- 展示给模板的设备标签、IP 和 User-Agent 会转义，Token 摘要和登录校验摘要不会传给视图。
- 当前动作未实现独立 CSRF Token；Ajax 请求头是请求形态约束，不应代替站点的同源、Cookie 和反跨站请求策略。
- `filters` 只要求 Ajax，不要求登录；它只查询 `vod_status = 1` 的视频，并对输入长度、栏目和返回数量做限制。

### 安装与主题关联

当前 `npm run package` 会生成 `dist/pingfangdevice.tar.gz`；`npm run deploy` 会备份并替换远端插件目录、把插件 `application/` 载荷中的兼容控制器复制到对应 CMS 路径、执行 `install.sql`、把 `pingfangdevice` 注册到 `application/extra/addons.php` 的 `app_begin` 钩子，并校验 PHP 语法与 `login_check_hash` 列。

手工安装至少需要保证以下条件：

- `addons/pingfangdevice` 可被 MacCMS 加载，且 `install.sql` 已用实际表前缀执行；
- `app_begin` 钩子已启用，否则设备撤销和过期不会在普通请求中持续生效；
- 若主题使用 `url('pingfangdevice/...')`，`application/index/controller/Pingfangdevice.php` 已复制到前台控制器目录；只启用原生插件路由时则走 `controller/Index.php`；
- 当前主题中的登录表单、用户菜单、设备页和视频筛选端点与这些兼容路由保持一致。

### 测试定位

- `tests/device-session.test.php`：用内存数据库/模型替身覆盖原生登录接管、Token 重绑、撤销与过期、Cookie 名、设备上限、事务回滚和展示数据脱敏。
- `tests/device-controller.test.php`：通过共享 `DeviceActions` 覆盖兼容入口的登录参数归一化、POST/Ajax 约束、设备注册失败时回滚原生登录，以及退出时清理设备 Token。
- 仓库的 `npm test` 会执行以上两份 PHP 测试。当前没有 `VodFilterOptions` 的专门行为测试。

## `pingfangapi`

### 路由与职责

生产入口是 `/index.php/pingfangapi/index?action=<action>`。`application/index/controller/Pingfangapi.php` 继承无页面渲染副作用的 MacCMS `All` 控制器，使用 JSON 表达站点关闭、地区限制和未知 action；它负责读取 ThinkPHP Request、解析严格 JSON 和生成 JSON Response。动作分发、安全校验和 DTO 组装分别在 `ApiRequest`、`AccountService`、`ContentService` 中完成。

逐 action 的请求字段、响应 DTO、安全、缓存、React 调用和部署说明见
[PingFang API 详细说明](pingfangapi.md)。

当前开放的动作如下：

| Method | Action                            | 登录要求             | 数据来源或行为                                                                   |
| ------ | --------------------------------- | -------------------- | -------------------------------------------------------------------------------- |
| GET    | `home`                            | 否                   | 旧 React 发布包的兼容首页池，保留用于回滚                                        |
| GET    | `home_v2`                         | 否                   | 按轮播、年度榜、最新及分类区块返回有界精简 DTO；复用 MacCMS `Vod::listCacheData` |
| GET    | `navigation`                      | 否                   | 从 MacCMS 分类缓存返回站点名和当前用户组可见的首页频道，不扫描影片表             |
| GET    | `content`                         | 否                   | 服务端筛选、搜索、排序和分页；compact 模式按需返回分类总数与筛选元数据           |
| GET    | `detail`                          | 否                   | 按 `vod_id` 返回单个影片、剧集标识和最多 6 条同类推荐                            |
| GET    | `playback`                        | 否                   | 校验影片、线路和集数，只返回同源受控 `pingfangapi/player` iframe URL             |
| GET    | `session`                         | 否                   | 当前 MacCMS 用户、白名单资料、会话 CSRF Token 和公开表单要求                     |
| GET    | `comments`                        | 否                   | 只返回已审核评论的纯文本白名单 DTO                                               |
| GET    | `favorites`、`history`、`devices` | 是                   | 当前用户的 Ulog 和活动设备会话                                                   |
| POST   | `login`、`logout`                 | 登录不要求；退出要求 | 原生 `User` 登录/退出并同步 `DeviceSession`                                      |
| POST   | `favorite`、`favorites.delete`    | 是                   | 当前用户、`mid=1`、`type=2` 的收藏记录                                           |
| POST   | `history.save`、`history.delete`  | 是                   | 当前用户、`mid=1`、`type=4` 的播放进度；按原生 Ulog 记录精确更新或删除           |
| POST   | `device.revoke`                   | 是                   | 仅撤销当前用户拥有的非当前设备会话                                               |
| POST   | `feedback`、`report`、`comment`   | 是                   | 复用原生验证码、审核、内容过滤、评论黑名单、Cookie 限频和回复通知规则            |
| POST   | `reaction`、`rating`              | 是                   | 校验目标内容权限后原子更新原生顶踩与评分计数                                     |

所有写操作都使用当前会话用户；API 有意比原生公开表单更严格，留言、报错、评论、顶踩和评分均要求登录。`session.requirements` 只公开 `loginCaptcha`、`feedbackEnabled`、`feedbackCaptcha`、`feedbackAudit`、`commentEnabled`、`commentCaptcha`、`commentAudit` 和同源 `captchaUrl`，React 据此显示可用表单、验证码和审核状态。新会员注册、注册验证码与账号找回不在公开 action 白名单中，请求均返回 404；前端只保留既有会员登录和账号管理。

### 内容与播放边界

当前 React 为 `home_v2`、`content` 和 `detail` 显式传 `compact=1`；旧形状继续保留给缓存中的旧静态资源。compact 目录和相关推荐只查询并返回 7 字段卡片，搜索额外增加 `typeName/actor/summary`，都不解析播放列表；完整剧集仅由详情读取。`home_v2` 按区块调用 MacCMS `Vod::listCacheData`，Hero 与普通卡片分别传精确字段白名单和独立原生缓存命名空间：轮播和年度榜各最多 5 条，本年最新及每个可见频道各最多 6 条。首页、目录、收藏、历史和评论响应均不返回原始播放地址。playback 响应也不返回源站媒体地址，而是返回 `url('pingfangapi/player', id/sid/nid)` 生成的同源 iframe。该受控入口重新执行站点/地区策略和 `check_user_popedom`，允许时复用 `label_vod_play` 与原生播放器模板；付费或无权限时渲染原生受限播放页，不把可复制的直接 `vod/player` 地址交给 React。

`content` 不返回完整目录。除筛选、排序和分页白名单外，compact 模式还接受 `include_category_totals` 与 `include_facets`。普通目录分类名直接来自 MacCMS 类型缓存；只有分类索引显式请求时才执行并返回分类总数，只有需要剧情筛选的页面才读取剧情选项。响应中的 `videos` 是当前页，`total`、`page`、`totalPages` 来自服务端查询；组合筛选与搜索的精确计数按条件缓存。详情页通过独立 `detail&compact=1` 动作读取，不依赖当前目录页。

`home_limit` 默认 120、允许 24～300，只约束兼容 `home` 的最新内容池，不参与 `home_v2` 或目录分页。首页内容缓存默认 300 秒；分类与筛选总数缓存由 `summary_cache_seconds` 控制，默认 1800 秒、允许 0～86400 秒。缓存键包含用户组权限边界，HTTP 响应仍不允许共享缓存。普通内容响应不暴露 `vod_play_url`；关键词对影片名、演员和导演执行索引友好的前缀匹配，不执行会导致全表扫描的任意位置匹配，`%` 和 `_` 按普通字符处理。所有查询值继续由数据库参数绑定。

### 会话与写入安全

- 所有 POST 只接受不超过 32 KiB 的 JSON 对象，并按 action 拒绝未知字段；资源 ID 必须是正整数，批量删除最多 100 个。
- 所有 POST，包括登录，必须同时通过站内 `Origin`/`Referer`、`X-Requested-With`、`X-CSRF-Token` 和请求频率检查。插件不发送 CORS 允许头；React 客户端也拒绝绝对或协议相对 API 地址。
- 登录强制 `openid=''`、`col=''`，内部 `return_meta` 只用于创建设备会话，不进入响应。设备注册失败会撤销设备 Token 并回滚原生登录；登录和退出后轮换 PHP Session 与 CSRF。
- 注册、注册验证码和找回密码不在公开 action 白名单中；评论和留言复用原生审核、验证码、内容过滤、黑名单、Cookie 限频及通知行为。新增记录 ID 从同一数据库连接读取，避免写入成功却返回失败。
- 账户查询和写入的 `user_id` 永远来自服务端当前会话，不接受客户端用户 ID。设备响应不会输出 Token 摘要、原始 User-Agent 或 IP。
- `ulog_type=4` 同时可能保存付费播放凭证。历史读取沿用旧播放记录页的完整 type 4 范围；更新按影片、线路和剧集匹配现有记录并保留其 `ulog_points`，只有新增记录默认写入 0；删除按前端拿到的原生 `ulog_id` 精确执行。
- `home`、`home_v2`、分类统计、筛选总数和剧情筛选项只在服务端内部使用按权限隔离的可配置缓存；所有 HTTP 响应统一使用 `private, no-store`，避免 MacCMS Session Cookie 进入共享缓存。

### 安装、配置与验收

`npm run package` 生成 `dist/pingfangapi.tar.gz`。`npm run deploy` 会先安装 `pingfangdevice`，再备份并安装 `pingfangapi`，把应用控制器复制到 `application/index/controller/Pingfangapi.php`，检查 PHP 语法、设备插件依赖及 `ulog_point`、`ulog_duration` 数据列。插件不创建表、不修改 hook，也不会部署 React 静态文件。

首次建立生产 API、但不切换主题时，使用 `DEPLOY_SCOPE=backend npm run deploy` 安装并验证 `pingfangdevice` 与 `pingfangapi`。服务器已经具备这套依赖基线后，可使用 `DEPLOY_SCOPE=api npm run deploy` 只上传和替换 `pingfangapi` 及其应用控制器。API-only 会在修改前核对设备服务和 hook 文件摘要、`app_begin` 登记及设备会话表结构；不匹配时拒绝部署，不会自动更新设备插件。

React 生产构建可从 `apps/web/.env.example` 复制同源配置：

```dotenv
NEXT_PUBLIC_API_BASE_URL=/index.php/pingfangapi/index
NEXT_PUBLIC_HOME_API_URL=/index.php/pingfangapi/index
```

`tests/pingfang-api.test.php`、`tests/pingfang-api-controller.test.php` 与发布包校验覆盖分页参数、详情路由、服务、控制器 JSON 策略和静态安全边界，但不连接真实数据库。宣称生产可用前仍必须在 staging 完成：分页总数与跨页去重、组合筛选和关键词查询计划、详情字段对照、Cookie/CSRF 轮换、真实账号和设备撤销、收藏/历史用户隔离、付费记录保护，以及匿名/试看/付费/密码/版权播放器 iframe 验收。

## `videolint`

### 职责与扫描流程

`videolint` 是只记录问题、不自动修复视频数据的后台扫描工具：

1. 管理员从页面同步发起扫描，服务按 `vod_id` 分批读取 `vod` 表。
2. 扫描标题、海报、分类、地区、年份、简介、播放源和启用状态，并可选检测远程海报可达性。
3. 扫描结束后按“片名 + 年份”补充重复记录问题。
4. 问题按 `critical`、`warning`、`info` 保存，可筛选、导出 CSV，或仅标记为已处理。

### 结构与入口

- `Videolint.php`：插件主类，无运行时钩子。
- `controller/Index.php`：提供 `index`、`run`、`resolve`、`export` 四个动作。
- `service/QualityScanner.php`：扫描编排、规则判断、批量落库、历史查询与处理状态更新。
- `view/index/index.html`：扫描参数、结果列表、级别/片名筛选、历史切换和 CSV 导出界面。
- `config.php`、`install.sql`：扫描参数声明与扫描/问题表结构。

扫描表保存执行人、状态、范围、进度、参数、错误和时间；问题表保存视频标识、级别、问题码、字段、描述、快照及处理人/时间。当前没有外键、级联删除或历史清理逻辑。

### 配置与运行边界

服务会把批量大小限制为 50～2000、HEAD 超时限制为 1～10 秒、重复分组限制为 1～2000；`max_items_per_scan = 0` 表示扫描全库。扫描在 HTTP 请求内同步执行，并调用 `set_time_limit(0)`，大库运行时应评估 PHP-FPM、数据库和反向代理超时。

`config.php` 声明了默认参数，但当前控制器和页面没有读取已保存的插件配置；实际运行值来自页面 POST，再由 `QualityScanner` 归一化。不要假设后台插件配置会自动改变扫描表单或执行参数。

### 安全边界

- `index`、`run`、`resolve` 检查 `session('admin_id')`；`run`、`resolve` 还要求 POST，但没有独立 CSRF Token。
- `export` 当前只校验 `scan_id`，没有再次校验管理员会话。部署时不应假设所有动作都已在控制器内完成鉴权；应由路由/网关限制访问，或在后续代码修改中补齐校验。
- 远程海报 HEAD 检测默认关闭。开启后，服务器会访问视频库中任意 HTTP(S) 海报地址、跟随最多 3 次跳转，且当前关闭 TLS 证书校验。仅应在可信数据和受控出网环境下启用，以避免内部地址探测、恶意重定向和不可信响应风险。
- “标记已处理”只更新问题记录，不修改 `vod` 表，也不会验证源问题是否真的消失。

### 安装与测试定位

插件需要将 `addons/videolint` 放入可加载目录并执行 `install.sql`。当前打包脚本、发布校验、SSH 部署和 CI 产物只覆盖 `pingfangdevice`，没有为 `videolint` 提供自动安装或桥接控制器；其入口依赖 MacCMS 插件路由 `/addons/videolint/index/index`。

当前没有 `videolint` 的专门单元或行为测试。修改扫描规则、鉴权、导出或 SQL 时，应先补充相应回归测试，再把插件加入发布链路后宣称可部署。

## 历史 Douban 文档

以下带日期文档记录了曾规划的 Douban 评分插件，不属于当前插件清单：

- `docs/superpowers/specs/2026-07-10-douban-rating-integration-design.md`
- `docs/superpowers/plans/2026-07-10-douban-rating-integration.md`

当前仓库没有文中描述的 `addons/douban/**`、Douban 桥接控制器或网关实现，现行打包/部署链路也不包含它们。因此这些文件只能用于理解历史目标和取舍，不能作为当前安装说明、可用性证明或生产状态依据。方案是否曾在其他工作区或服务器落地，无法从当前仓库确认。
