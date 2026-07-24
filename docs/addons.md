# MacCMS 插件模块

本文说明当前仓库 `addons/**` 下实际存在的插件。代码、`info.ini` 与
`install.sql` 是事实源；带日期的方案文档只用于追溯设计背景，不能代替当前实现。

## 模块概览

| 插件 | 当前职责 | 持久化表 | 钩子 | 仓库发布链路 |
| --- | --- | --- | --- | --- |
| `pingfangdevice` | 管理会员设备会话；为主题提供动态筛选、线路检测和联机游戏短票据 | `__PREFIX__pingfang_device_session` | `app_begin` | 已纳入打包、发布校验和 SSH 部署 |
| `pingfangapi` | 为 React 提供 MacCMS 内容、播放、会话、收藏、历史和设备 JSON API | 复用 `vod`、`user`、`ulog` 与设备会话表 | 无 | 已纳入打包、发布校验和 SSH 部署 |
| `videolint` | 扫描视频库质量，记录、筛选、导出并人工标记问题 | `__PREFIX__pingfang_video_lint_scan`、`__PREFIX__pingfang_video_lint_issue` | 无 | 当前未纳入自动打包或部署 |

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

`VodFilterOptions`、`VodSourceQuality` 和 `GameAccessTicket` 是同一插件内的附加能力。前两者提供筛选和播放源检测；后者只为当前已登录会员签发 60 秒、限定单一游戏的 HMAC 票据。浏览器把票据放在 WebSocket 子协议头中，独立游戏服务验证后才允许进入房间。

### 结构与入口

- `Pingfangdevice.php`：插件主类，只实现 `appBegin()` 钩子。
- `application/index/controller/Pingfangdevice.php`：MacCMS 标准插件应用载荷中的前台兼容控制器，供主题使用 `url('pingfangdevice/...')` 访问。
- `controller/Index.php`：MacCMS 原生插件路由控制器，使用 `addon_url(...)` 和插件自带视图。
- `controller/DeviceActions.php`：两个控制器共用的登录、退出、撤销、筛选、线路检测和联机票据动作。
- `service/DeviceSession.php`：会话注册、校验、续用、撤销、过期、设备上限和展示数据清洗。
- `service/VodFilterOptions.php`：视频筛选项查询、栏目继承、输入归一化与缓存。
- `service/VodSourceQuality.php`：按视频/集数解析播放组、执行有界媒体抽样、计算速度并缓存结果。
- `service/GameAccessTicket.php`：校验会员与游戏类型，签发短期 HMAC 票据并约束同源 WebSocket 路径。
- `view/index/index.html`：插件路由下的设备管理页；主题桥接入口渲染的是主题内同名模板。
- `config.php`、`install.sql`：设备上限、Cookie 名、有效期配置及表结构/升级 SQL。

兼容控制器与插件控制器只分别维护页面渲染入口，请求动作集中在 `DeviceActions`，避免两套路由产生行为漂移。`application/` 目录遵循 [MacCMS 官方插件目录规范](https://www.maccms.la/plugin/plugin-dir)，便于标准插件安装器识别需要复制到 CMS 应用目录的文件。

### 数据与配置

设备会话表记录用户、Token 摘要、原生登录校验摘要、设备标签、User-Agent、IP、登录/活动/撤销时间和撤销原因。Token 摘要唯一；用户活动会话和登录时间均有索引。`install.sql` 还会为旧安装补加 `login_check_hash`。

配置在服务层做二次约束：设备数为 1～20，生命周期为 1～365 天，Cookie 名只接受长度不超过 64 的字母、数字、点、下划线和连字符。联机签名密钥至少 32 个字符并与 Node 服务环境变量完全一致；WebSocket 配置只接受 `/` 开头的当前站点路径。密钥为空时不影响普通登录和观影，但联机票据接口会稳定返回不可用。

会话记录没有自动清理任务；过期或撤销记录会保留，并在设备列表中最多展示 20 条。表中包含 IP 和 User-Agent，部署方应按实际隐私与留存要求处理。

### 安全边界

- 登录、退出和踢下线要求 POST；桥接/插件控制器还要求 Ajax 请求。设备撤销同时校验当前用户与目标会话归属，且不能通过“踢下线”撤销当前设备。
- Token 使用 32 字节随机数；Cookie 设置 HttpOnly、全站路径，并仅在 HTTPS 请求下设置 Secure。数据库不保存原始 Token。
- 会话创建使用事务和用户行锁；Cookie 写入失败会撤销刚创建的记录。同步过程异常时按失效登录处理。
- 展示给模板的设备标签、IP 和 User-Agent 会转义，Token 摘要和登录校验摘要不会传给视图。
- 当前动作未实现独立 CSRF Token；Ajax 请求头是请求形态约束，不应代替站点的同源、Cookie 和反跨站请求策略。
- `filters` 只要求 Ajax，不要求登录；它只查询 `vod_status = 1` 的视频，并对输入长度、栏目和返回数量做限制。
- `sourceQuality` 要求 POST + Ajax，但不要求登录；它只接受 `vod_id`、`nid`，只读取 `vod_status = 1` 的记录，最多检测前 12 个播放组，并在约 24 秒总预算后停止启动新线路。
- `gameTicket` 要求 POST + Ajax 和有效设备会话，只接受 `gomoku` 或 `drawguess`。票据含用户 ID、纯文本昵称、游戏、当前标签页随机 ID、签发/到期时间和随机 ID，不包含 Cookie、密码、邮箱或播放数据；标签页 ID 只用于区分同一账号打开的多个玩家连接，独立服务还会校验 Origin 并拒绝重复使用的票据。
- 线路检测只允许无账号信息的 HTTP(S) 公网地址。每次请求重新解析并固定公网 IPv4，拒绝私网/保留地址，手动校验最多 2 次跳转，开启 TLS 证书校验，禁用环境代理，并把响应样本限制在 256 KiB 以内。
- 接口只返回线路序号、集名、状态、HTTP 状态码、首字节耗时、有效样本数、中位抽样速度，以及 HLS 主清单声明的最高/本次测速分辨率、码率和编码格式；不返回播放地址、Variant URI、分片 URI 或解析 Token。可用线路按“有效测速样本、速度、延迟、样本数、线路序号”稳定排序，并返回唯一的 `recommended_sid`、`quality_rank` 和 `recommended` 标记。结果表示 MacCMS 服务器到播放源的即时网络状况，不等于访客设备的实际播放带宽。
- 一个真实媒体样本足以确认线路当时可访问，但不足以给出速度；此时接口返回“可用，但测速样本不足”且 `speed_kbps = null`。HLS 某个分片过期或失败时会继续检查后续分片，避免把单个旧分片的 404 误判成整条线路不可用。
- 分辨率只接受 HLS 主清单 `EXT-X-STREAM-INF` 中格式正确的 `RESOLUTION`；`resolution_basis = manifest` 表示分辨率字段来自清单声明，并不等于解析媒体码流后确认。`tested_width/height` 只在对应 Variant 取得媒体样本后返回，`max_width/height` 即使该 Variant 未测通也可表示清单声明的上限。直链、仅含媒体分片的 HLS 清单和异常声明均返回 `resolution_basis = unknown`，不会根据线路名或文件名猜测。
- 非 HTTP(S) 解析 Token、返回 HTML/JSON/XML 错误内容和没有可读媒体分片的清单会标记为“无法直测”，不会被误报为可用；连接或总预算超时使用独立的 `timeout` 状态。检测服务只负责返回健康排序，详情页和独立播放器分别消费该排序完成推荐入口与有界自动换线。

### 安装与主题关联

当前 `npm run package` 会生成 `dist/pingfangdevice.tar.gz`；`npm run deploy` 会备份并替换远端插件目录、保留旧配置中名称仍然存在的设置值、把插件 `application/` 载荷中的兼容控制器复制到对应 CMS 路径、执行 `install.sql`、把 `pingfangdevice` 注册到 `application/extra/addons.php` 的 `app_begin` 钩子，并校验 PHP 语法与 `login_check_hash` 列。随后联机服务部署会复用或生成签名密钥，并再次核对 PHP 插件与 Node 服务使用同一个值。

手工安装至少需要保证以下条件：

- `addons/pingfangdevice` 可被 MacCMS 加载，且 `install.sql` 已用实际表前缀执行；
- `app_begin` 钩子已启用，否则设备撤销和过期不会在普通请求中持续生效；
- 若主题使用 `url('pingfangdevice/...')`，`application/index/controller/Pingfangdevice.php` 已复制到前台控制器目录；只启用原生插件路由时则走 `controller/Index.php`；
- 当前主题中的登录表单、用户菜单、设备页、视频筛选、详情页线路检测和联机票据端点与这些兼容路由保持一致；游戏服务由完整部署流程安装，也可按 `services/game-server/README.md` 单独更新。

### 测试定位

- `tests/device-session.test.php`：用内存数据库/模型替身覆盖原生登录接管、Token 重绑、撤销与过期、Cookie 名、设备上限、事务回滚和展示数据脱敏。
- `tests/device-controller.test.php`：通过共享 `DeviceActions` 覆盖兼容入口的登录参数归一化、POST/Ajax 约束、线路检测与联机票据权限，以及登录/退出异常处理。
- `tests/game-access-ticket.test.php`：覆盖短票据签名、时效、游戏范围、游客拒绝和同源连接路径。
- `tests/vod-source-quality.test.php`：覆盖指定集数跨源映射、HLS/直链多样本中位速度、健康线路排序和唯一推荐、过期分片容错、主清单分辨率排序与回退、异常/未知分辨率、样本不足、超时、伪媒体内容、失败/缺集/解析型地址状态、私网拒绝和响应地址脱敏。
- 仓库的 `npm test` 会执行以上 PHP 测试。当前没有 `VodFilterOptions` 的专门行为测试。

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
| GET    | `playback`                        | 否                   | 校验影片、线路、集数和播放权限；登录时可返回当前剧集的精确云端续播位置             |
| GET    | `session`                         | 否                   | 当前 MacCMS 用户、白名单资料、会话 CSRF Token 和公开表单要求                     |
| GET    | `comments`                        | 否                   | 只返回已审核评论的纯文本白名单 DTO                                               |
| GET    | `favorites`、`history`、`devices` | 是                   | 当前用户的 Ulog 和活动设备会话；账户收藏/历史支持 24 条页码分页                  |
| POST   | `login`、`logout`                 | 登录不要求；退出要求 | 原生 `User` 登录/退出并同步 `DeviceSession`                                      |
| POST   | `favorite`、`favorites.delete`    | 是                   | 当前用户、`mid=1`、`type=2` 的收藏记录                                           |
| POST   | `history.save`、`history.delete`  | 是                   | 当前用户、`mid=1`、`type=4` 的播放进度；按原生 Ulog 精确更新或删除，并忽略同会话中更旧的并发断点 |
| POST   | `device.revoke`                   | 是                   | 仅撤销当前用户拥有的非当前设备会话                                               |
| POST   | `feedback`、`report`、`comment`   | 是                   | 复用原生验证码、审核、内容过滤、评论黑名单、Cookie 限频和回复通知规则            |
| POST   | `reaction`、`rating`              | 是                   | 校验目标内容权限后原子更新原生顶踩与评分计数                                     |

所有写操作都使用当前会话用户；API 有意比原生公开表单更严格，留言、报错、评论、顶踩和评分均要求登录。`session.requirements` 只公开 `loginCaptcha`、`feedbackEnabled`、`feedbackCaptcha`、`feedbackAudit`、`commentEnabled`、`commentCaptcha`、`commentAudit` 和同源 `captchaUrl`，React 据此显示可用表单、验证码和审核状态。新会员注册、注册验证码与账号找回不在公开 action 白名单中，请求均返回 404；前端只保留既有会员登录和账号管理。

### 内容与播放边界

当前 React 为 `home_v2`、`content` 和 `detail` 显式传 `compact=1`；旧形状继续保留给缓存中的旧静态资源。compact 目录和相关推荐只查询并返回 7 字段卡片，搜索额外增加 `typeName/actor/summary`，都不解析播放列表；完整剧集仅由详情读取。`home_v2` 按区块调用 MacCMS `Vod::listCacheData`，Hero 与普通卡片分别传精确字段白名单和独立原生缓存命名空间：轮播和年度榜各最多 5 条，本年最新及每个可见频道各最多 6 条。首页、目录、收藏、历史和评论响应均不返回原始播放地址。完整授权时，`playback` 响应返回 `url('pingfangapi/stream', id/sid/nid)` 生成的同源媒体入口和媒体类型；登录用户只有在当前影片、线路和剧集的 Ulog 进度大于 30 秒且小于有效时长的 95% 时，才会额外取得 `resumePositionSeconds`。React 关闭 Artplayer 本地自动续播，播放中每 20 秒及暂停、结束、隐藏或离页时按精确剧集保存，退出请求使用 `keepalive`；同会话的新协议水位会拦截更旧或无时间戳的晚到请求，新 React 对旧 API 的未知字段错误会降级重试旧请求体。`stream` 再次执行站点/地区策略和 `check_user_popedom`，成功后 302 到 `ps=0` 直连媒体。仅允许试看时服务端返回 403，避免 302 暴露无法限制时长的完整片源；`ps=1` 第三方解析线路明确返回 503。原 `pingfangapi/player` HTML 入口保留给 MacCMS 原生模板与回滚。

`content` 不返回完整目录。除筛选、排序和分页白名单外，compact 模式还接受 `include_category_totals` 与 `include_facets`。普通目录分类名直接来自 MacCMS 类型缓存；只有分类索引显式请求时才执行并返回分类总数，只有需要剧情筛选的页面才读取剧情选项。响应中的 `videos` 是当前页，`total`、`page`、`totalPages` 来自服务端查询；组合筛选与搜索的精确计数按条件缓存。详情页通过独立 `detail&compact=1` 动作读取，不依赖当前目录页。

账户收藏和历史仅在同时提供 `page/page_size` 时返回分页元数据；无分页参数的旧
`{items}` 契约及首页 `history&limit=4` 保留用于回滚。历史分页会在有效影片和剧集
过滤、按影片折叠并聚合全部原生 `ulog_id` 后再切页，避免跨页重复或删除后旧记录重新出现。
React 账号页固定每页 24 条，只选择当前页；底层 ID 超过单次 100 条上限时按顺序
分批精确删除，任一批失败会重新读取活动页；删除末页最后一项后回到仍有效的页码。

`lazyload_image` 使用 MacCMS 标准图片配置控件，控制 React 全局图片加载中、空图和加载失败占位；API 只接受当前站点路径，并通过 `navigation/home_v2` 的 `ui.lazyloadImage` 下发。`home_limit` 默认 120、允许 24～300，只约束兼容 `home` 的最新内容池，不参与 `home_v2` 或目录分页。首页内容缓存默认 300 秒；分类与筛选总数缓存由 `summary_cache_seconds` 控制，默认 1800 秒、允许 0～86400 秒。缓存键包含用户组权限边界，HTTP 响应仍不允许共享缓存。普通内容响应不暴露 `vod_play_url`；关键词对影片名、演员和导演执行索引友好的前缀匹配，不执行会导致全表扫描的任意位置匹配，`%` 和 `_` 按普通字符处理。所有查询值继续由数据库参数绑定。

播放器轻提示继续读取 MacCMS 系统播放器配置：`second + prestrain` 控制 React
启动等待提示，`buffer` 控制缓冲提示。API 只返回延迟和开关，不返回或加载后台
填写的 HTML 地址；原生模板仍按 MacCMS 既有方式使用这些地址。

### 会话与写入安全

- 所有 POST 只接受不超过 32 KiB 的 JSON 对象，并按 action 拒绝未知字段；资源 ID 必须是正整数，服务端单次批量删除最多 100 个。
- 所有 POST，包括登录，必须同时通过站内 `Origin`/`Referer`、`X-Requested-With`、`X-CSRF-Token` 和请求频率检查。插件不发送 CORS 允许头；React 客户端也拒绝绝对或协议相对 API 地址。
- 登录强制 `openid=''`、`col=''`，内部 `return_meta` 只用于创建设备会话，不进入响应。设备注册失败会撤销设备 Token 并回滚原生登录；登录和退出后轮换 PHP Session 与 CSRF。
- 注册、注册验证码和找回密码不在公开 action 白名单中；评论和留言复用原生审核、验证码、内容过滤、黑名单、Cookie 限频及通知行为。新增记录 ID 从同一数据库连接读取，避免写入成功却返回失败。
- 账户查询和写入的 `user_id` 永远来自服务端当前会话，不接受客户端用户 ID。设备响应不会输出 Token 摘要、原始 User-Agent 或 IP。
- `ulog_type=4` 同时可能保存付费播放凭证。历史读取沿用旧播放记录页的完整 type 4 范围，并返回数值进度、可空时长和服务端派生的 95% 完播状态；更新按影片、线路和剧集匹配现有记录并保留其 `ulog_points`，只有新增记录默认写入 0；删除按前端拿到的原生 `ulog_id` 精确执行。
- `home`、`home_v2`、分类统计、筛选总数和剧情筛选项只在服务端内部使用按权限隔离的可配置缓存；所有 HTTP 响应统一使用 `private, no-store`，避免 MacCMS Session Cookie 进入共享缓存。

### 安装、配置与验收

`npm run package` 生成 `dist/pingfangapi.tar.gz`。`npm run deploy` 会先安装 `pingfangdevice`，再备份并安装 `pingfangapi`，按配置名合并保留后台已经保存的插件配置，把应用控制器复制到 `application/index/controller/Pingfangapi.php`，检查 PHP 语法、设备插件依赖及 `ulog_point`、`ulog_duration` 数据列。插件不创建表、不修改 hook，也不会部署 React 静态文件。

首次建立生产 API、但不切换主题时，使用 `DEPLOY_SCOPE=backend npm run deploy` 安装并验证 `pingfangdevice` 与 `pingfangapi`。服务器已经具备这套依赖基线后，可使用 `DEPLOY_SCOPE=api npm run deploy` 只上传和替换 `pingfangapi` 及其应用控制器。API-only 会在修改前核对设备服务和 hook 文件摘要、`app_begin` 登记及设备会话表结构；不匹配时拒绝部署，不会自动更新设备插件。

React 生产构建可从 `apps/web/.env.example` 复制同源配置：

```dotenv
NEXT_PUBLIC_API_BASE_URL=/index.php/pingfangapi/index
NEXT_PUBLIC_HOME_API_URL=/index.php/pingfangapi/index
```

`tests/pingfang-api.test.php`、`tests/pingfang-api-controller.test.php` 与发布包校验覆盖分页参数、详情路由、服务、控制器 JSON 策略和静态安全边界，但不连接真实数据库。宣称生产可用前仍必须在 staging 完成：分页总数与跨页去重、组合筛选和关键词查询计划、详情字段对照、Cookie/CSRF 轮换、真实账号和设备撤销、收藏/历史用户隔离、付费记录保护，以及匿名/试看/付费/密码/版权的 `playback`、`stream` 和真实媒体播放验收。

## `videolint`

### 扫描边界与显式修复

`vodops` 是后台视频数据质量中心。管理员可以扫描全部分类，或选择一个分类限定范围；父分类会在任务创建时解析并固化自身及全部后代 `type_id`，末级分类只包含自身。查询使用这组 `type_id`，不依赖可能本身错误的 `type_id_1`；“全部分类”仍用于发现无法归入正常分类的无效分类 ID。插件以扫描开始时范围内的最大 `vod_id` 为上界，按 `vod_id` 游标每批读取 100～1000 条视频。管理员可保持仅由后台页面驱动，也可在启动时明确开启“后台 Worker”：页面关闭后，服务器 Cron 调用 CLI Worker 继续处理，不依赖前台访问量。扫描期间新增且 ID 超过上界的视频留待下一次扫描，扫描期间被删除或移出范围的行不会伪造为“已处理”。

对同一范围再次点击“开始或恢复扫描”时，进行中的任务会同步当前“后台 Worker”复选框：勾选可把旧的页面任务交给 CLI Worker，取消勾选可在当前批次结束后切回仅页面驱动，不需要丢弃已生成结果。旧版本写入的 `traffic` 执行模式会按 Worker 任务继续处理，不需要改写历史任务行。

当前规则只报告能够确定判定的异常：标题缺失、分类不存在、父分类不一致、年份缺失或格式异常、地区缺失、语言缺失、海报缺失、本地海报文件丢失、播放来源或播放载荷缺失、播放来源组数不一致或中间存在空组，以及分类、年份和完整播放载荷完全相同的严格重复候选。空组只记录一基序号，不保存播放载荷。远程访问和第三方对象存储模式不会用本机文件系统误判海报；重复检查只保存 SHA-256 指纹，不把播放地址写入审计表。

扫描不会对 MacCMS 的 `vod`、`type` 表执行 `UPDATE`、`DELETE`、`ALTER`、`OPTIMIZE` 或 `REPAIR`，也不会自动修复、合并视频。只有任务已经完成或结束、管理员在单条异常侧边栏中预览并再次确认时，修复服务才允许对 `vod` 的白名单字段执行一次条件 `UPDATE`。第一版只支持父分类、年份、地区、语言和海报；标题、无效分类、播放数据和严格重复候选继续通过原生编辑页人工处理。

年份缺失或格式异常、地区缺失、语言缺失、海报缺失和本地海报文件丢失会在修复侧边栏异步搜索豆瓣与标准视频采集源。采集源列表只读取已经保存到 MacCMS `mac_collect` 表的资源库配置，因此萌芽采集的内置来源必须先由管理员保存为标准资源库后才能复用；页面不会调用萌芽私有控制器、自动查询全部来源，也不会向浏览器返回采集接口地址或密钥。插件设置可开启“跟随已有播放组”，首次搜索会优先在“默认可信采集源”名称名单内按播放组代码推断来源；没有匹配时使用该名单兜底，名单留空即可完全关闭自动采集源。敏感来源即使被误写入默认名单也不会自动选择，但管理员仍可在单次人工审核中显式选择；单个来源失败不影响豆瓣候选和手工填写。

外部候选必须通过规范化片名匹配；本地年份有效时会排除年份冲突，本地年份缺失或候选没有年份时会明确降低匹配置信度。地区最长 20 个字符，语言最长 10 个字符，年份只接受 1800～2099；图片还须为实际可读取的 HTTPS JPEG、PNG、WebP 或 GIF。单次最多查询 8 个采集源并展示 12 个候选；豆瓣共享限流若预计排队超过 1 秒会跳过本次豆瓣查询，不阻塞人工修复。页面不会默认选中、自动修复或整片同步，管理员选择候选后仍须检查字段前后值并二次确认。候选生成后标题、年份或目标字段发生变化时，条件写入会停止并要求重新搜索。海报缩略图会在设置 `no-referrer` 后由管理员浏览器直接访问图片域名，因此图片站仍能看到管理员网络的出口 IP。

插件使用五张自有 InnoDB 表：

- `vodops_lock`：保存固定的 `scan_start` 和 `douban_enqueue` 互斥行，分别串行化扫描创建和豆瓣任务入队，避免并发请求生成重复任务；
- `vodops_scan`：任务状态、固化的分类范围、固定上界、游标、处理数、异常数、操作管理员、执行模式、工作租约和下次 Worker 重试时间；旧安装通过幂等迁移补充 `scope_json`、`execution_mode`、`lease_until`、`next_run_at`，既有任务默认保持仅页面驱动；
- `vodops_issue`：异常类型、视频 ID、经过长度约束的当前值、判定说明和结构化依据；
- `vodops_fingerprint`：进行中扫描用于严格重复识别的临时 SHA-256 指纹；任务完成或结束后自动清理。
- `vodops_repair_log`：在源表写入前保存本次字段原值、新值、来源、管理员和操作状态；复检与回滚也追加记录，不保存播放地址。

扫描结果是一次审计快照，不代表数据此后没有变化。任务完成但处理数小于开始时总数时，页面会显示上界内未读取数量，通常表示扫描期间源记录被删除；这些记录不会被伪装成已处理。修复会先重读源记录、用原值约束更新条件，再按同一分析规则即时复检；数据被其他管理员抢先修改时返回冲突，不覆盖新值。回滚也只在当前值仍等于该次修复新值、且没有后续修复时执行。该字段级审计不能替代生产数据库完整备份。

### 后台入口与安全

- 后台控制器位于 `application/admin/controller/Vodops.php` 载荷中，继承 MacCMS 原生 `Base`，因此沿用后台登录和 `controller/action` 权限检查；未单独授予路由时只有超级管理员可访问。
- 唯一工作台位于 `application/admin/view_new/vodops/index.html`，通过 `workspace=quality|douban` 在同一原生页面壳层切换“数据质量与修复”和“豆瓣匹配与同步”；插件内 `view/index/index.html` 只是由该页面按需包含的豆瓣模块片段，不再拥有独立 HTML 页面或第二套导航。`application/extra/quickmenu.php` 只保留“视频数据中心”快捷入口，插件不声明前台 URL，也不包含公开插件控制器。
- `application/admin/controller/Douban.php` 继续保留原 `admin/douban/*` 后台动作，实际控制器继承 MacCMS 原生 `Base`；旧 `admin/douban/index` 会跳转到统一工作台的豆瓣模块，其余动作 URL 不变，登录与 `controller/action` 权限检查不会被插件控制器绕过。
- CLI Worker 只处理标记为 `worker` 的进行中任务，并兼容旧版本的 `traffic` 值。认领使用条件更新和 180 秒租约，失败批次等待 30 秒再试；进程异常遗留的租约到期后可被下一次 Cron 自动恢复。部署的外层 `flock` 防止同一服务器重叠启动，数据库租约负责第二层并发保护。
- 插件主类不再注册 `response_end`，因此普通前台响应不会为 VodOps 查询任务表或执行扫描。Worker 每次调用最多处理指定批次数和时间预算，空闲时不输出日志。
- 启动、续跑、结束扫描、删除审计结果、加载修复信息、应用修复、复检和回滚只接受同源 Ajax POST；统一工作台的两个模块都会在后台提供令牌时转发 `X-CSRF-Token`。结束任务只改变插件任务状态，不删除已生成结果。底层数据库或文件异常只写入服务端日志，页面、豆瓣任务 `last_error` 和体检任务 `error_message` 统一保存可公开的重试提示。
- 豆瓣数据接口默认固定为插件内置 `internal` 网关。管理员保留的自定义 HTTP(S) 接口只允许公网 IPv4 和标准 80/443 端口；请求前会校验全部 DNS 结果并用 cURL 固定选中的公网地址，禁用代理与重定向、启用 TLS 校验，并把响应体限制为 1 MiB，避免把后台接口变成私网探测入口。
- 已有任务进行时，只能恢复相同根分类的任务；选择其他范围会返回明确冲突提示，不能静默扩大或替换原任务范围。历史下拉框、进度区域和分类化 CSV 文件名都会保留任务范围。
- 只有已完成或已结束的任务可由管理员确认后删除；该操作仅删除对应的 `vodops_issue`、`vodops_fingerprint` 和 `vodops_scan` 记录，不触碰视频、分类或其他 MacCMS 表，已经形成的 `vodops_repair_log` 继续保留，并以管理员 ID、任务 ID、状态和异常数写入服务端日志。插件不自动执行历史保留期清理，页面可选择最近 50 次任务。
- 列表支持异常类型、完整视频 ID 或视频名称筛选，每条异常可打开 MacCMS 原生视频编辑页；父分类期望值和播放空组位置等脱敏结构化依据直接显示在判定说明下方。CSV 导出沿用当前筛选，最多 50000 条，并处理电子表格公式前缀；进行中的任务不能导出，任务不存在或结果过多会返回可操作提示，其他数据库或文件异常只在服务端记录。导出不包含原始播放地址。

插件需要将 `addons/videolint` 放入可加载目录并执行 `install.sql`。当前插件打包、发布校验、SSH 部署和 CI 产物只覆盖 `pingfangdevice` 与 `pingfangapi`，没有为 `videolint` 提供自动安装或桥接控制器；其入口依赖 MacCMS 插件路由 `/addons/videolint/index/index`。

原豆瓣插件已整体吸收到 `addons/vodops`，不是删减版。以下能力继续保留：

- 按名称、分类、年份和处理状态搜索本地视频；手动设置、锁定或临时忽略豆瓣 ID；
- 搜索候选并按标题、年份排序，支持阈值自动确认和站点已有 AI 搜索能力辅助复核；
- 单条获取/同步、按筛选条件预览后批量入队、失败重试、任务限流和执行时再次检查忽略状态；
- 同步片名、年份、地区、语言、类型、导演、演员、简介、评分、集数和备注；`vod_douban_score` 为豆瓣标准值，同时镜像到 MacCMS 原生排序使用的 `vod_score`；
- 按分类预览评分校准并每次生成最多 500 个单片任务，由 Pending Worker 分批执行；旧全量入口保留为拒绝提示，不再发起整表 `UPDATE`；
- 独立豆瓣数据库体检、暂停/恢复、异常筛选和 CSV 导出，覆盖 ID、评分、字段长度、同步失败、待核查和停用状态；
- 保留简介锁、豆瓣 ID 锁、候选记录、历史图片回滚资格判断和 AI 复核状态。

同步入口统一经过 `DoubanData::buildVodUpdates()`，当前不会写入 `vod_pic`，因此合并不会恢复旧版自动覆盖图片的行为。同步、手动豆瓣 ID、评分校准和历史图片回滚会先创建审计记录，再以读取到的字段旧值约束 `mac_vod` 更新；原生编辑抢先保存时插件返回冲突，不覆盖新值。

为实现无损升级，安装 SQL 原样保留 `douban_config`、`douban_vod_meta`、`douban_task`、`douban_log`、`douban_review_candidate`、`douban_scan`、`douban_scan_issue` 表名及关键索引。`CREATE TABLE IF NOT EXISTS` 不重建已有表；部署在替换插件文件前依据 `schema.php` 只读检查已经存在的七张表是否为 InnoDB 且具备全部必要字段，不兼容时列出表名和缺口并停止，避免新代码运行在旧结构上。唯一数据兼容更新是把历史 `/extend/douban.php` 接口配置迁到等价的插件内置 `internal` 网关；安装过程不删除、重命名或清空任何 `douban_*`/`vodops_*` 数据。

### 安装、发布与测试

`npm run package` 只生成一个 `dist/vodops.tar.gz`，不再生成 `douban.tar.gz`。`npm run deploy` 会先检查 Cron 命令、现有 crontab 的读取权限和旧 `douban_*` 表结构，全部通过后才把原 VodOps/豆瓣插件目录、两个后台控制器、质量后台视图、旧公开豆瓣桥接、快捷菜单、Hook 配置和 crontab 保存到同一个 `vodops.backup.*` 迁移快照；快照成功后才停用独立 `addons/douban` 和旧公开桥接。随后脚本保留旧 VodOps 配置中仍存在的同名设置，安装完整豆瓣模块、`application/admin/view_new` 与 CLI Worker 载荷，执行并校验五张 `vodops_*` 和七张 `douban_*` 表、幂等补充扫描范围与 Worker 字段并写入两个固定互斥行；旧 VodOps/豆瓣快捷菜单会归并为一个入口，旧版 `response_end` 注册会被移除，并安装、复核每分钟一次且由 `flock` 保证单实例的 Cron。VodOps 安装阶段在文件替换后失败时，退出处理器会自动恢复上述文件与 Cron，并把失败版本保留为 `vodops.failed.*`/`douban.failed.*`；增量数据库变化不会被反向删除。服务器没有 `crontab` 或 `flock` 时会在替换插件前停止；明确由其他调度器接管时可设置 `VODOPS_INSTALL_CRON=0`。

插件设置中的 `scheduled_scan_hours` 控制定时新建任务，`0` 为默认值并表示关闭，`1`～`720` 表示间隔小时数；`scheduled_scope_type_id` 和 `scheduled_batch_size` 分别控制分类范围与每批 100～1000 条。定时器在 `scan_start` 互斥锁内重新检查进行中任务和上次自动任务时间，因此并发 Cron 不会重复创建任务；即使定时新建关闭，Cron 仍会继续管理员明确启用 Worker 的任务。

手工调度可执行 `php addons/vodops/bin/vodops-worker.php --max-chunks=20 --max-seconds=50`。该入口只允许 CLI，使用 MacCMS 自身的 ThinkPHP 初始化流程，不派发网页路由。生产日志默认写入 `runtime/log/vodops-worker.log`，应纳入服务器现有的日志轮转策略。

专项测试定位如下：

- `tests/vodops-analyzer.test.php`：覆盖规则判定、分类树范围固化、非法范围拒绝、远程海报边界、严格指纹、播放地址不落审计结果、公开错误文案、结构化依据、任务时长及租约状态展示；
- `tests/vodops-repair.test.php`：覆盖修复白名单、字段校验、父分类推导、本地海报存在性、原值审计先于源表写入、并发冲突和条件回滚；
- `tests/vodops-poster-candidate.test.php`：覆盖年份、地区、语言和海报的多采集源与豆瓣候选、来源显式选择、单源数量上限、标题和年份匹配、字段与图片验证、私网拒绝、来源去重、局部失败及候选上下文保护；
- `tests/vodops-controller.test.php`：覆盖原生后台渲染、管理员 ID、分类范围与 Worker 选择传递、范围冲突提示、POST/Ajax 约束、结束与删除任务、修复/复检/回滚入口，以及安全业务提示和内部异常分流后的响应；
- `tests/vodops-worker.test.php`：覆盖 CLI 帮助和批次、时间预算在 MacCMS 初始化前的边界校验；
- `tests/vodops-contract.test.php`：约束扫描只读、修复字段白名单、原值条件更新、并发锁、分类过滤、Worker 租约、定时任务互斥、旧前台钩子移除、幂等表升级、结果删除范围、游标和批次上限，以及后台载荷、打包、部署、CI 与文档边界。
- `tests/douban-gateway.test.php`、`tests/douban-matcher.test.php`、`tests/douban-ai-reviewer.test.php`：覆盖豆瓣数据标准化、评分边界、候选排序和 AI 结果约束；
- `tests/douban-data.test.php`、`tests/douban-controller.test.php`、`tests/douban-worker.test.php`：覆盖配置、全部后台动作、原生后台权限继承、安全错误、同步旧值冲突、图片保护、任务去重/重试/忽略、体检和分批校准；这些测试直接加载 `addons/vodops` 内的合并实现。

## 历史 Douban 文档

以下带日期文档记录了合并前独立 Douban 插件的设计过程，不再代表当前目录和发布边界：

- `docs/superpowers/specs/2026-07-10-douban-rating-integration-design.md`
- `docs/superpowers/plans/2026-07-10-douban-rating-integration.md`

当前实现位于 `addons/vodops/**`：豆瓣后台桥接控制器、服务和嵌入式模块均由同一个 VodOps 归档发布，并继续使用原 `douban_*` 数据表和 `admin/douban/*` 动作；可见后台只保留 `vodops/index` 这一套工作台。判断现状时以上文和代码为准。
