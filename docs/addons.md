# MacCMS 插件模块

本文说明当前仓库 `addons/**` 下实际存在的插件。代码、`info.ini` 与
`install.sql` 是事实源；带日期的方案文档只用于追溯设计背景，不能代替当前实现。

## 模块概览

| 插件 | 当前职责 | 持久化表 | 钩子 | 仓库发布链路 |
| --- | --- | --- | --- | --- |
| `pingfangdevice` | 管理会员设备会话；为主题提供地区、年份、语言动态筛选项 | `__PREFIX__pingfang_device_session` | `app_begin` | 已纳入打包、发布校验和 SSH 部署 |
| `videolint` | 扫描视频库质量，记录、筛选、导出并人工标记问题 | `__PREFIX__pingfang_video_lint_scan`、`__PREFIX__pingfang_video_lint_issue` | 无 | 当前未纳入自动打包或部署 |

两个插件的主类 `install()`、`uninstall()` 都只返回成功，不负责建表或删表。
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
