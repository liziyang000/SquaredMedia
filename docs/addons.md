# MacCMS 插件模块

本文说明当前仓库 `addons/**` 下实际存在的插件。代码、`info.ini` 与
`install.sql` 是事实源；带日期的方案文档只用于追溯设计背景，不能代替当前实现。

## 模块概览

| 插件 | 当前职责 | 持久化表 | 钩子 | 仓库发布链路 |
| --- | --- | --- | --- | --- |
| `pingfangdevice` | 管理会员设备会话；为主题提供动态筛选、线路检测和联机游戏短票据 | `__PREFIX__pingfang_device_session` | `app_begin` | 已纳入打包、发布校验和 SSH 部署 |

插件主类的 `install()`、`uninstall()` 只返回成功，不负责建表或删表。
部署环境必须另行执行 `install.sql`；卸载代码不会自动删除历史数据。

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

## 历史 Douban 文档

以下带日期文档记录了曾规划的 Douban 评分插件，不属于当前插件清单：

- `docs/superpowers/specs/2026-07-10-douban-rating-integration-design.md`
- `docs/superpowers/plans/2026-07-10-douban-rating-integration.md`

当前仓库没有文中描述的 `addons/douban/**`、Douban 桥接控制器或网关实现，现行打包/部署链路也不包含它们。因此这些文件只能用于理解历史目标和取舍，不能作为当前安装说明、可用性证明或生产状态依据。方案是否曾在其他工作区或服务器落地，无法从当前仓库确认。
