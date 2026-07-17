# MacCMS 插件模块

本文说明当前仓库 `addons/**` 下实际存在的插件。代码、`info.ini` 与
`install.sql` 是事实源；带日期的方案文档只用于追溯设计背景，不能代替当前实现。

## 模块概览

| 插件 | 当前职责 | 持久化表 | 钩子 | 仓库发布链路 |
| --- | --- | --- | --- | --- |
| `pingfangdevice` | 管理会员设备会话；为主题提供地区、年份、语言动态筛选项 | `__PREFIX__pingfang_device_session` | `app_begin` | 已纳入打包、发布校验和 SSH 部署 |
| `douban` | 匹配、同步和校准豆瓣评分；提供后台任务与人工核查页面 | `__PREFIX__douban_config`、`__PREFIX__douban_vod_meta`、`__PREFIX__douban_task`、`__PREFIX__douban_log`、`__PREFIX__douban_review_candidate` | 无 | 已纳入打包、发布校验和 SSH 部署 |
| `videolint` | 扫描视频库质量，记录、筛选、导出并人工标记问题 | `__PREFIX__pingfang_video_lint_scan`、`__PREFIX__pingfang_video_lint_issue` | 无 | 当前未纳入自动打包或部署 |

三个插件的主类 `install()`、`uninstall()` 都只返回成功，不负责建表或删表。
部署环境必须另行执行对应 `install.sql`；卸载代码不会自动删除历史数据。

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

## `douban`

### 职责与数据流程

插件以 `vod_douban_score` 保存豆瓣原始评分，并同步镜像到 `vod_score`，从而兼容 MacCMS 原生 `by="score"` 排序。它不会覆盖 `vod_score_num` 或 `vod_score_all`。主要流程是：

1. 已有 `vod_douban_id` 的影片直接进入同步任务；没有 ID 的影片按标题搜索候选项。
2. 唯一且达到阈值的标题/年份匹配可以自动确认；歧义候选按页面批量读取，管理员可以直接采用候选项。
3. Worker 按限额执行待处理任务，校验返回 ID 与评分后更新影片和插件元数据。
4. 失败任务按次数延后，达到最大次数后进入 `FAILED`；管理员可以批量重新入队，也可以手动同步、锁定 ID、忽略影片或校准评分。

### 结构与入口

- `Douban.php`：插件主类，无运行时钩子。
- `application/admin/controller/Douban.php`：唯一的路由控制器，正式后台菜单入口为 `admin/douban/index`。
- `backend/DoubanController.php`：后台业务控制器实现，提供配置、到期/定向任务生成、任务明细、Worker、失败重试、同步、校准、ID 锁定和忽略动作；它不位于插件公开 `controller/` 目录。
- `service/DoubanData.php`：配置、任务、匹配、同步、校准、失败退避和日志编排。
- `service/DoubanGateway.php`、`service/DoubanMatcher.php`：豆瓣数据请求/归一化与候选匹配排序。
- `view/index/index.html`：后台管理页面。
- `config.php`、`install.sql`：数据源、分类排除、匹配阈值、请求限速、最大尝试次数和五张插件表。

插件仅提供后台管理入口：`info.ini` 不声明公开 URL，包内没有 `application/index` 或插件公开 `controller/` 控制器。后台控制器位于官方插件目录规范定义的 `application/` 载荷中；仓库 SSH 部署会复制它，并备份后移除旧版本遗留的前台兼容控制器。插件源码不再携带或部署旧 `bridge/` 目录与根目录 `extend/douban.php`。

### 数据源与兼容性

默认 `douban_endpoint = internal`，同步服务直接调用插件内的 `DoubanGateway`，不经过站点自身的公开 HTTP 代理。升级时仅会把旧版精确值 `/extend/douban.php` 迁移为 `internal`，不会覆盖自定义外部接口。配置也接受完整 HTTP(S) URL，或在站点 URL 已配置时接受以 `/` 开头的兼容接口地址。

旧安装若仍保存 `/extend/douban.php`，服务会把它视为 `internal` 直接调用，以避免结构升级后依赖已经移除的根目录脚本；保存配置后建议明确改为 `internal`。请求会校验 Douban ID、评分范围和响应结构，并按 `request_per_minute` 节流。

新部署不会再创建或覆盖根目录 `extend/douban.php`，也不会自动删除服务器上历史遗留的同名文件。确认没有外部调用方后，应单独备份并清理该旧文件；不要在通用部署脚本中无条件删除无法确认归属的服务器文件。

### 负载控制

- 生成任务不会触发全表评分校准；到期入队只扫描当前批次，定向入队只扫描确认后的分类和筛选范围。两者都一次预取已有活动任务、批量写入元数据和任务，避免按影片重复查询和插入。
- Worker 在同一批次复用一份配置，由 `worker_limit` 限制执行规模；所有 PHP Worker 通过配置表行锁预留请求时间槽，实现跨 Worker 共享限流。数据库限流状态不可用时才回退到当前进程内节流。
- 每个任务默认最多尝试 5 次，可配置为 1～10 次。达到最大次数后进入 `FAILED` 并停止自动入队，避免持续故障反复消耗外部请求；后台“重试失败任务”会按影片和任务类型去重、清零次数后重新入队。
- 待核查页面只在当前核查分页执行一次候选批量查询，候选项采用复用现有 ID 保存动作，不会产生逐影片查询。
- 任务表使用覆盖 `task_type`、`status`、`attempts` 的监控索引；`install.sql` 会通过 `information_schema.STATISTICS` 为旧安装幂等补齐索引，不依赖特定版本的 `ADD INDEX IF NOT EXISTS`。
- 后台概况把视频、核查状态和锁定状态合并为一次聚合查询，重复豆瓣 ID 使用单独的聚合查询，不再为每个状态分别计数。概况统计缓存 60 秒，入队、Worker、同步、锁定和忽略等变更会主动失效缓存。
- 全量评分校准会扫描视频表，必须在后台二次确认后单独执行。它适合修复历史评分字段，不应作为每次生成任务的前置步骤；大库建议在低峰期操作。

### 定向生成与任务查看

- “定向生成豆瓣任务”必须选择至少一个视频分类，可选择包含全部后代分类，并可继续按数据范围、起止年份、影片名或视频 ID 缩小范围。数据范围包括无豆瓣评分、无豆瓣 ID、已有 ID 但无评分、已到同步时间和所选范围全部视频。
- 预览只做一次聚合查询，不写数据库，也不访问豆瓣；确认后最多按“本批上限”生成任务。无有效豆瓣 ID 的视频生成 `MATCH_DOUBAN_ID`，已有 ID 的视频生成 `SYNC_DOUBAN`，真正的外部请求仍由 Pending Worker 执行。
- 定向范围仍受全局排除分类、忽略期限、视频启用状态和豆瓣 ID 锁定约束。相同视频和任务类型若已有 `PENDING`、`RUNNING` 或 `FAILED` 记录，不会重复入队；失败任务应通过“重试失败任务”恢复。
- “待执行任务明细”默认显示前 50 条 `PENDING` 任务，并可切换查看运行中、失败、成功、跳过或全部状态；列表展示视频、分类、任务类型、尝试次数、计划执行时间和最近错误。

### 按分类校准

- 后台只展示 `type_mid=1` 的视频分类，可多选并默认包含全部后代分类；分类层级来自 MacCMS `type_list` 缓存，缓存不可用时读取 `type` 表的 `type_id`、`type_pid`、`type_mid`、`type_name` 和 `type_sort`。
- “预览分类校准”使用一次聚合查询统计范围内视频数、异常评分归零数、评分镜像数和无豆瓣评分清零数。预览不会写入数据库，确认后才执行分类范围更新。
- 服务端会拒绝空分类和不存在的分类 ID。分类更新只使用展开后的 `type_id IN (...)` 条件，不依赖可能存在历史不一致的 `type_id_1`。
- 分类校准记录 `CALIBRATE_TYPE_SCORE` 日志及实际分类范围；原“全量校准豆瓣评分”入口继续保留，并使用独立的二次确认。

### 安全边界

- 管理页面和所有写操作通过 `model('Admin')->checkLogin()` 检查 MacCMS 后台登录态；写操作额外要求 POST。
- `info.ini` 不提供前台链接，发布包不包含前台模块或公开插件控制器；管理功能只能经随机后台入口的 `admin/douban/*` 路由访问。
- 当前动作没有独立 CSRF Token，部署方仍需依赖后台同源、Cookie 和站点反跨站请求策略。
- 默认内部数据源避免暴露一个无需登录即可转发豆瓣请求的根目录端点；自定义外部接口的鉴权、可用性和数据可信度由部署方负责。
- 插件会发起外部 HTTP 请求并处理第三方元数据；生产环境应评估出网策略、超时、数据来源许可和错误重试规模。

### 安装、菜单与测试

`npm run package` 生成 `dist/douban.tar.gz`；`npm run deploy` 会预检所有 PHP 文件和标准后台 `application/` 载荷，备份并替换插件目录，执行 `install.sql`，再备份并复制后台控制器，同时备份后移除旧版本遗留的前台兼容控制器。后台自定义菜单应配置为：

```text
豆瓣评分,admin/douban/index
```

实际后台入口随随机后台文件名变化，完整地址为 `/<admin-entry>.php/admin/douban/index.html`。安装后还需确认管理员请求不会跳回登录页，页面动作生成后台模块 URL，任务生成、Worker 和单片同步均返回成功。

- `tests/douban-data.test.php`：覆盖 ID、评分、有限重试、限流时间槽、候选展示数据及定向分类/年份/数据范围 SQL 不变量。
- `tests/douban-worker.test.php`：通过内存任务表覆盖终态失败、过期租约回收、人工重新入队和跨 Worker 限流槽。
- `tests/douban-gateway.test.php`：覆盖豆瓣详情与候选数据归一化、评分边界和本地统计字段保护。
- `tests/douban-matcher.test.php`：覆盖候选匹配评分与阈值。
- `tests/template.test.mjs` 和 `scripts/verify-release.mjs`：约束标准应用载荷、部署顺序、发布包结构、菜单路由和页面契约。

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

当前没有 `videolint` 的专门单元或行为测试。修改扫描规则、鉴权、导出或 SQL 时，应先补充相应回归测试，再把插件加入发布链路后宣称可部署。当前自动化发布链路覆盖主题、`pingfangdevice` 和 `douban`，不包含 `videolint`。
