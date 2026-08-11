# MacCMS 插件模块

本文说明当前仓库 `addons/**` 下实际存在的插件。代码、`info.ini` 与
`install.sql` 是事实源；带日期的方案文档只用于追溯设计背景，不能代替当前实现。

## 模块概览

| 插件 | 当前职责 | 持久化表 | 钩子 | 仓库发布链路 |
| --- | --- | --- | --- | --- |
| `pingfangdevice` | 管理会员设备会话；为主题提供动态筛选、线路检测和联机游戏短票据 | `__PREFIX__pingfang_device_session` | `app_begin` | 已纳入打包、发布校验和 SSH 部署 |
| `vodops` | 通用质量扫描与单条修复；豆瓣 ID 匹配、资料/评分同步、任务、校准、专项体检和日志 | 五张 `vodops_*` 表及七张兼容保留的 `douban_*` 表 | 无前台钩子；质量扫描由 CLI/Cron Worker 执行，豆瓣外部请求由管理员动作或任务 Worker 明确触发 | 已作为一个插件纳入打包、发布校验和 SSH 部署 |

两个插件主类的 `install()`、`uninstall()` 都只返回成功，不负责建表或删表。
仓库部署脚本会执行对应的 `install.sql`；其他安装方式必须确认安装器已导入 SQL。卸载代码不会自动删除历史数据。

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

## `vodops` 统一视频数据中心

### 扫描边界与显式修复

`vodops` 是后台视频数据质量中心。管理员可以扫描全部分类，或选择一个分类限定范围；父分类会在任务创建时解析并固化自身及全部后代 `type_id`，末级分类只包含自身。查询使用这组 `type_id`，不依赖可能本身错误的 `type_id_1`；“全部分类”仍用于发现无法归入正常分类的无效分类 ID。插件以扫描开始时范围内的最大 `vod_id` 为上界，按 `vod_id` 游标每批读取 100～1000 条视频。管理员可保持仅由后台页面驱动，也可在启动时明确开启“后台 Worker”：页面关闭后，服务器 Cron 调用 CLI Worker 继续处理，不依赖前台访问量。扫描期间新增且 ID 超过上界的视频留待下一次扫描，扫描期间被删除或移出范围的行不会伪造为“已处理”。

对同一范围再次点击“开始或恢复扫描”时，进行中的任务会同步当前“后台 Worker”复选框：勾选可把旧的页面任务交给 CLI Worker，取消勾选可在当前批次结束后切回仅页面驱动，不需要丢弃已生成结果。旧版本写入的 `traffic` 执行模式会按 Worker 任务继续处理，不需要改写历史任务行。

当前规则只报告能够确定判定的异常：标题缺失、分类不存在、父分类不一致、年份缺失或格式异常、地区缺失、语言缺失、海报缺失、本地海报文件丢失、播放来源或播放载荷缺失、播放来源组数不一致或中间存在空组，以及分类、年份和完整播放载荷完全相同的严格重复候选。空组只记录一基序号，不保存播放载荷。远程访问和第三方对象存储模式不会用本机文件系统误判海报；重复检查只保存 SHA-256 指纹，不把播放地址写入审计表。

扫描不会对 MacCMS 的 `vod`、`type` 表执行 `UPDATE`、`DELETE`、`ALTER`、`OPTIMIZE` 或 `REPAIR`，也不会自动修复、合并视频。只有任务已经完成或结束、管理员在单条异常侧边栏中预览并再次确认时，修复服务才允许对 `vod` 的白名单字段执行一次条件 `UPDATE`。第一版只支持父分类、年份、地区、语言和海报；标题、无效分类、播放数据和严格重复候选继续通过原生编辑页人工处理。

插件使用五张自有 InnoDB 表：

- `vodops_lock`：保存固定的 `scan_start` 和 `douban_enqueue` 互斥行，分别串行化扫描创建和豆瓣任务入队，避免并发请求生成重复任务；
- `vodops_scan`：任务状态、固化的分类范围、固定上界、游标、处理数、异常数、操作管理员、执行模式、工作租约和下次 Worker 重试时间；旧安装通过幂等迁移补充 `scope_json`、`execution_mode`、`lease_until`、`next_run_at`，既有任务默认保持仅页面驱动；
- `vodops_issue`：异常类型、视频 ID、经过长度约束的当前值、判定说明和结构化依据；
- `vodops_fingerprint`：进行中扫描用于严格重复识别的临时 SHA-256 指纹；任务完成或结束后自动清理。
- `vodops_repair_log`：在源表写入前保存本次字段原值、新值、来源、管理员和操作状态；复检与回滚也追加记录，不保存播放地址。

扫描结果是一次审计快照，不代表数据此后没有变化。任务完成但处理数小于开始时总数时，页面会显示上界内未读取数量，通常表示扫描期间源记录被删除；这些记录不会被伪装成已处理。修复会先重读源记录、用原值约束更新条件，再按同一分析规则即时复检；数据被其他管理员抢先修改时返回冲突，不覆盖新值。回滚也只在当前值仍等于该次修复新值、且没有后续修复时执行。该字段级审计不能替代生产数据库完整备份。

### 后台入口与安全

- 后台控制器位于 `application/admin/controller/Vodops.php` 载荷中，继承 MacCMS 原生 `Base`，因此沿用后台登录和 `controller/action` 权限检查；未单独授予路由时只有超级管理员可访问。
- 质量页面位于 `application/admin/view_new/vodops/index.html`，豆瓣工作台位于插件内 `view/index/index.html`；两页互相提供模块导航，通过 `application/extra/quickmenu.php` 的唯一“视频数据中心”快捷入口打开。插件不声明前台 URL，也不包含公开插件控制器。
- `application/admin/controller/Douban.php` 继续保留原 `admin/douban/*` 后台动作，实际控制器继承 MacCMS 原生 `Base` 并显式使用插件私有视图目录；登录与 `controller/action` 权限检查不会再被插件控制器绕过，现有书签和任务按钮不需要改 URL。
- CLI Worker 只处理标记为 `worker` 的进行中任务，并兼容旧版本的 `traffic` 值。认领使用条件更新和 180 秒租约，失败批次等待 30 秒再试；进程异常遗留的租约到期后可被下一次 Cron 自动恢复。部署的外层 `flock` 防止同一服务器重叠启动，数据库租约负责第二层并发保护。
- 插件主类不再注册 `response_end`，因此普通前台响应不会为 VodOps 查询任务表或执行扫描。Worker 每次调用最多处理指定批次数和时间预算，空闲时不输出日志。
- 启动、续跑、结束扫描、删除审计结果、加载修复信息、应用修复、复检和回滚只接受同源 Ajax POST；质量页面和豆瓣工作台都会在后台提供令牌时转发 `X-CSRF-Token`。结束任务只改变插件任务状态，不删除已生成结果。底层数据库或文件异常只写入服务端日志，页面、豆瓣任务 `last_error` 和体检任务 `error_message` 统一保存可公开的重试提示。
- 已有任务进行时，只能恢复相同根分类的任务；选择其他范围会返回明确冲突提示，不能静默扩大或替换原任务范围。历史下拉框、进度区域和分类化 CSV 文件名都会保留任务范围。
- 只有已完成或已结束的任务可由管理员确认后删除；该操作仅删除对应的 `vodops_issue`、`vodops_fingerprint` 和 `vodops_scan` 记录，不触碰视频、分类或其他 MacCMS 表，已经形成的 `vodops_repair_log` 继续保留，并以管理员 ID、任务 ID、状态和异常数写入服务端日志。插件不自动执行历史保留期清理，页面可选择最近 50 次任务。
- 列表支持异常类型、完整视频 ID 或视频名称筛选，每条异常可打开 MacCMS 原生视频编辑页；父分类期望值和播放空组位置等脱敏结构化依据直接显示在判定说明下方。CSV 导出沿用当前筛选，最多 50000 条，并处理电子表格公式前缀；进行中的任务不能导出，任务不存在或结果过多会返回可操作提示，其他数据库或文件异常只在服务端记录。导出不包含原始播放地址。

### 豆瓣匹配、同步与专项体检

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

`npm run package` 只生成一个 `dist/vodops.tar.gz`，不再生成 `douban.tar.gz`。`npm run deploy` 会先检查 Cron 命令、现有 crontab 的读取权限和旧 `douban_*` 表结构，全部通过后才把原 VodOps/豆瓣插件目录、两个后台控制器、质量后台视图和旧公开豆瓣桥接保存到同一个 `vodops.backup.*` 迁移快照；快照成功后才停用独立 `addons/douban` 和旧公开桥接。随后脚本保留旧 VodOps 配置中仍存在的同名设置，安装完整豆瓣模块、`application/admin/view_new` 与 CLI Worker 载荷，执行并校验五张 `vodops_*` 和七张 `douban_*` 表、幂等补充扫描范围与 Worker 字段并写入两个固定互斥行；旧 VodOps/豆瓣快捷菜单会归并为一个入口，旧版 `response_end` 注册会被移除，并安装、复核每分钟一次且由 `flock` 保证单实例的 Cron。服务器没有 `crontab` 或 `flock` 时会在替换插件前停止；明确由其他调度器接管时可设置 `VODOPS_INSTALL_CRON=0`。

插件设置中的 `scheduled_scan_hours` 控制定时新建任务，`0` 为默认值并表示关闭，`1`～`720` 表示间隔小时数；`scheduled_scope_type_id` 和 `scheduled_batch_size` 分别控制分类范围与每批 100～1000 条。定时器在 `scan_start` 互斥锁内重新检查进行中任务和上次自动任务时间，因此并发 Cron 不会重复创建任务；即使定时新建关闭，Cron 仍会继续管理员明确启用 Worker 的任务。

手工调度可执行 `php addons/vodops/bin/vodops-worker.php --max-chunks=20 --max-seconds=50`。该入口只允许 CLI，使用 MacCMS 自身的 ThinkPHP 初始化流程，不派发网页路由。生产日志默认写入 `runtime/log/vodops-worker.log`，应纳入服务器现有的日志轮转策略。

专项测试定位如下：

- `tests/vodops-analyzer.test.php`：覆盖规则判定、分类树范围固化、非法范围拒绝、远程海报边界、严格指纹、播放地址不落审计结果、公开错误文案、结构化依据、任务时长及租约状态展示；
- `tests/vodops-repair.test.php`：覆盖修复白名单、字段校验、父分类推导、本地海报存在性、原值审计先于源表写入、并发冲突和条件回滚；
- `tests/vodops-controller.test.php`：覆盖原生后台渲染、管理员 ID、分类范围与 Worker 选择传递、范围冲突提示、POST/Ajax 约束、结束与删除任务、修复/复检/回滚入口，以及安全业务提示和内部异常分流后的响应；
- `tests/vodops-worker.test.php`：覆盖 CLI 帮助和批次、时间预算在 MacCMS 初始化前的边界校验；
- `tests/vodops-contract.test.php`：约束扫描只读、修复字段白名单、原值条件更新、并发锁、分类过滤、Worker 租约、定时任务互斥、旧前台钩子移除、幂等表升级、结果删除范围、游标和批次上限，以及后台载荷、打包、部署、CI 与文档边界。
- `tests/douban-gateway.test.php`、`tests/douban-matcher.test.php`、`tests/douban-ai-reviewer.test.php`：覆盖豆瓣数据标准化、评分边界、候选排序和 AI 结果约束；
- `tests/douban-data.test.php`、`tests/douban-controller.test.php`、`tests/douban-worker.test.php`：覆盖配置、全部后台动作、原生后台权限继承、安全错误、同步旧值冲突、图片保护、任务去重/重试/忽略、体检和分批校准；这些测试直接加载 `addons/vodops` 内的合并实现。

## 历史 Douban 文档

以下带日期文档记录了合并前独立 Douban 插件的设计过程，不再代表当前目录和发布边界：

- `docs/superpowers/specs/2026-07-10-douban-rating-integration-design.md`
- `docs/superpowers/plans/2026-07-10-douban-rating-integration.md`

当前实现位于 `addons/vodops/**`：豆瓣后台桥接控制器、服务和工作台均由同一个 VodOps 归档发布，并继续使用原 `douban_*` 数据表和 `admin/douban/*` 动作。判断现状时以上文和代码为准。
