# 开发、发布与数据运维

本文说明仓库内工程脚本的职责和操作边界。主题模板与插件本身的设计另见对应模块文档；这里以 `package.json`、`scripts/`、`.github/workflows/ci.yml` 和现有测试为事实来源。

服务器重置后的现场操作、恢复顺序和验证证据统一记录在 [服务器重置后恢复记录](server-reset-recovery-runbook.md) 中。

## 环境要求

- Node.js：CI 和联机游戏服务使用 Node.js 22；先用 `npm ci` 安装锁定版本的检查工具、播放器依赖和 `ws` 8.21.1。
- PHP：目标版本为 PHP 8.4。完整测试会调用 PHP CLI；海报修复工具还要求 `curl`、`mbstring`、`pdo_mysql` 扩展。
- 打包：需要系统 `tar`，且当前脚本使用 `--no-xattrs`。
- 部署：本机需要 `bash`、`ssh`、`scp`；使用密码认证时还需要 `sshpass`，日常发布优先使用 SSH 密钥。
- 远端：需要可执行 `bash`、`tar`、PHP CLI、PDO MySQL、Node.js 22、systemd、Nginx 和 `curl`，并且发布账号必须能写入 MacCMS 模板、插件、控制器、配置和缓存目录以及 `/opt/pingfanggames`、`/etc/systemd/system` 和站点 Nginx 扩展配置。

## 开发验证

常用命令由 `package.json` 统一暴露：

| 命令 | 作用 | 是否写入仓库生成目录 |
| --- | --- | --- |
| `npm ci` | 按 `package-lock.json` 安装前端检查工具与播放器发布依赖 | 只写入已忽略的 `node_modules/` |
| `npm run lint` | 依次检查一方浏览器 JavaScript、主题 CSS 和 Prettier 格式 | 否 |
| `npm run format` | 用 Prettier 格式化一方 JavaScript 与配置文件 | 是，直接修改被覆盖的源码与配置 |
| `npm test` | 运行模板、播放器、联机房间/WebSocket、设备会话、海报修复、VodOps 质量模块及豆瓣模块测试 | 否；WebSocket 测试只临时监听本机随机端口 |
| `npm run lint:template` | 检查模板 include、标签平衡、资源路径和生产模板中的开发环境引用 | 否 |
| `npm run verify:compat` | 检查 MacCMS 目录、标准路由页面和不安全链接模式 | 否 |
| `npm run verify:preview` | 用当前 PHP CLI 渲染本地预览的主要路由并核对完整 HTML | 否 |
| `npm run package` | 重建主题、`pingfangdevice`、`vodops`、独立播放器和联机游戏服务发布包 | 是，先重建整个 `dist/` 再加入独立产物 |
| `npm run package:player` | 只重建独立播放器发布包，保留 `dist/` 中其他产物 | 是，仅替换播放器目录和归档 |
| `npm run package:games` | 只重建自包含的联机游戏服务包 | 是，仅替换游戏服务目录和归档 |
| `npm run verify:release` | 解包检查五个归档的结构、生产边界、资源版本和依赖版本 | 只读 `dist/` |
| `npm run verify:player-release` | 单独检查播放器归档的严格白名单、文件一致性与链接边界 | 只读 `dist/` |
| `npm run verify:game-server-release` | 检查游戏服务源码、部署样例、固定 `ws` 版本和敏感文件边界 | 只读 `dist/` |
| `npm run start:games` | 启动本机联机游戏服务；必须先设置签名密钥和允许的 Origin | 否 |
| `npm run deploy:games` | 单独验证、打包并部署联机游戏服务，复用现有签名密钥 | 写入远端服务、插件配置和 Nginx 配置 |

提交主题相关修改前，至少执行：

```bash
npm ci
npm run lint
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

准备发布时再执行完整发布门禁：

```bash
npm ci
npm run lint
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

各层验证的关注点不同，不能互相替代：

- `tests/template.test.mjs` 是仓库级静态与预览契约测试，也会约束发布脚本、CI 配置和数据库维护文档中的关键入口。
- `npm run lint` 用 ESLint 检查一方浏览器脚本、用 Stylelint 检查主题 CSS，并用 Prettier 验证 JavaScript 与配置格式；压缩第三方库不在检查范围内。
- `scripts/lint-template.mjs` 面向源模板结构，阻止本地预览、`localhost`、死链接或错误资源路径进入生产主题。
- `scripts/verify-compat.mjs` 面向 MacCMS 页面和目录兼容面。
- `scripts/verify-preview.mjs` 从仓库根目录调用 PHP CLI，验证本地模拟数据能够渲染主要路由；它不连接真实 MacCMS 数据库。
- `scripts/verify-release.mjs` 只验证已经生成的归档，不会自动执行打包。
- `scripts/verify-player-release.mjs` 只接受播放器白名单内的静态文件，并拒绝 PHP、隐藏路径、符号链接和硬链接。
- `tests/game-server.test.mjs` 覆盖票据伪造/过期、房间人数、落子顺序与五子胜负、绘画权限、答案隔离、Origin 拒绝和真实 WebSocket 握手。
- `scripts/verify-game-server-release.mjs` 确认服务包自带精确的 `ws` 8.21.1，且不包含环境文件或签名密钥。

本地静态预览必须通过 HTTP 服务打开，因为 `preview/index.html` 使用绝对路径请求 `/preview/data.json`。直接以 `file://` 打开不能视为有效验证。Docker 通过 `PINGFANG_PREVIEW_DATA=/var/www/html/preview/data.json` 对齐容器挂载路径；不使用 Docker 时，`server/lib/data.php` 默认从仓库根目录读取相同样例数据。PHP 路由验证以 `npm run verify:preview` 为准。

## 打包与 `dist/`

`scripts/package-theme.mjs` 每次运行都会先递归删除整个 `dist/`，再生成：

```text
dist/
├── pingfangvideo/
├── pingfangvideo.tar.gz
├── pingfangdevice/
├── pingfangdevice.tar.gz
├── vodops/
├── vodops.tar.gz
├── pingfangplayer-player/
├── pingfangplayer-player.tar.gz
├── pingfanggames-server/
└── pingfanggames-server.tar.gz
```

打包过程有以下固定行为：

- `pingfangvideo` 来自 `template/pingfangvideo/`，两个插件分别来自 `addons/pingfangdevice/` 和 `addons/vodops/`。
- 两个插件的 `application/` 都保留 MacCMS 标准应用载荷结构；SSH 部署会把设备兼容控制器，以及 `vodops` 内的 VodOps/Douban 两个后台控制器和 `view_new` 统一工作台复制到对应 CMS 应用目录，豆瓣模块片段随插件目录发布。
- 任意层级以 `.` 开头的文件或目录不会进入包。
- 主题 HTML 中的样式、共享脚本、播放器提示、俄罗斯方块初始化器、竹知了交互和联机游戏脚本版本占位符会分别替换为对应文件的 12 位内容摘要，避免单个资源变化使其他资源缓存失效。
- 包内目录权限统一为 `0755`，文件权限统一为 `0644`；tar 包禁用 macOS 扩展属性元数据。
- `scripts/package-player.mjs` 从 `maccms-player/` 精确复制自有播放器 HTML、CSS 和 JavaScript，并从 `node_modules/` 中锁定的 ArtPlayer 5.4.0 与 hls.js 1.6.16 生成版本化文件；它不会清空 `dist/` 中先生成的主题与插件产物，也不会把 PHP、隐藏文件或链接带入播放器归档。
- `scripts/package-game-server.mjs` 打包一方服务源码、systemd/Nginx 样例和锁定的 `ws` 运行依赖；归档可离线启动，不包含 `.env`。
- 当前自动化打包主题、`pingfangdevice`、合并后的 `vodops`、独立播放器和联机游戏服务，不会自动包含其他 `addons/` 子目录；不会生成独立 `douban.tar.gz`。`npm run deploy` 会部署主题、两个插件与游戏服务，但不会安装独立播放器。`npm run rollback` 默认回滚主题，也可用 `ROLLBACK_SCOPE=vodops` 回滚合并插件代码和应用载荷；两种模式都不删除数据库数据。

`dist/` 已被 `.gitignore` 忽略，是可重复生成的发布产物，不是源码。不要把人工报告、数据库备份或唯一副本放入其中，否则下次 `npm run package` 会直接删除。

仓库根目录下可能出现 `output/`，但当前 `package.json`、`scripts/`、测试和 CI 都没有把它定义为正式输出目录；它也未被 `.gitignore` 忽略。应把它视为本地工具临时目录，不在文档或自动化中依赖其内容。若后续引入稳定的生成器，应同时明确所有者、清理策略和忽略规则。

### 独立播放器包边界

`dist/pingfangplayer-player.tar.gz` 是 HLS 播放性能优先方案，不属于 MacCMS 主题目录。它保留 ArtPlayer 控制、倍速、进度恢复、Safari/iOS 原生 HLS 回退和 hls.js 有界媒体错误恢复；首播关键路径不再请求旧播放器使用的 jQuery、CryptoJS、FLV、广告、弹幕和 PHP 配置接口。与当前主题配套使用时，播放器会在启动超时、持续缓冲、致命 HLS 错误或原生视频错误后，按详情页短期健康排序自动切换到同一集的下一条可用线路，并通过当前标签页的 `sessionStorage` 恢复换线前进度、记录已尝试线路以避免循环；没有健康记录时回退页面线路顺序，没有候选时保留手动提示。若站点必须保留旧播放器功能，应先做兼容版设计和独立验收，不要直接安装此性能版。

播放器包只包含 5 个静态文件。将来获得明确发布授权后，应先备份站点根目录中的 `static/player/artplayer.html`，再把 4 个版本化资产写入 `static/player/artplayer/`，最后替换入口 HTML。不得整体删除或覆盖现有 `static/player/artplayer/` 目录，因为现网目录还可能包含 PHP、数据库类、配置、插件和旧版回滚文件。回滚只需恢复旧入口 HTML；版本化新资产可以在确认无引用后另行清理。

当前 `npm run deploy` 和 `npm run rollback` 不操作播放器包。MacCMS 后台中的播放器线路、解析状态和 `/static/js/playerconfig.js` 也不由这个仓库生成；其中解析接口及播放前等待秒数必须在后台按实际配置单独核对。

### 联机游戏服务包边界

`dist/pingfanggames-server.tar.gz` 是独立 Node.js 服务，不属于 MacCMS 主题或 PHP 插件。它只在内存中保存房间，不持久化画作、猜词、战绩或聊天；重启进程会结束现有房间。默认监听 `127.0.0.1:8787`，消息上限 16 KiB，关闭 WebSocket 压缩；断线席位保留 45 秒用于重连，超时后自动清理，空房间同样在 45 秒后回收。

安装时需要完成三方一致配置：

1. 用随机值设置服务的 `GAME_TICKET_SECRET`，并把同一个值保存到 MacCMS `pingfangdevice` 的“联机游戏签名密钥”。
2. 设置精确的 `GAME_ALLOWED_ORIGINS`，通过 Nginx 将同源 `/game-socket` 反代到本机服务。
3. 使用归档内的 systemd 样例启动服务，确认 `/healthz`、错误 Origin 403、游客无法取票，以及两个真实会员能进入同一房间。

详细环境变量和配置样例见 `services/game-server/README.md`。密钥轮换会让尚未使用的旧票据立即失效，但不会主动关闭已经完成握手的连接；需要强制断开时应重启服务。`npm run deploy` 会在主题和插件成功后自动执行这些主机级配置；仅更新游戏服务时可使用 `npm run deploy:games`。

## 部署

`npm run deploy` 先调用 `scripts/deploy-theme.sh`，再调用 `scripts/deploy-game-server.sh`。必须提供：

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=deploy \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run deploy
```

`DEPLOY_PATH` 必须是远端 MacCMS 的 `template` 目录，脚本以其父目录作为站点根目录。仓库中的 `scripts/deploy-ping2.env` 只保存当前目标的非密码连接参数、专用密钥路径和站点验证 Host；当前 SSH 目标是 `144.34.184.95:814`，`www.ping2video.xyz` 是公开站点域名。在确认目标无误且已获得发布授权后可执行：

```bash
source scripts/deploy-ping2.env
npm run deploy
```

只发布合并后的视频数据中心时使用专用范围，不要执行上面的全量命令：

```bash
source scripts/deploy-ping2.env
npm run deploy:vodops
```

`deploy:vodops` 仍会在本地执行完整发布门禁并重建、校验归档，但远端只上传和安装一个 `vodops`：先只读检查现有七张 `douban_*` 表的 InnoDB 引擎和必要字段，兼容后才把 VodOps/豆瓣目录、应用载荷、快捷菜单、Hook 配置和 crontab 写入同一个 `vodops.backup.*` 迁移快照；随后停用独立 `addons/douban` 和旧公开豆瓣桥接，保留旧 VodOps 配置值，增量创建并校验五张 `vodops_*` 和七张兼容保留的 `douban_*` 表，幂等补充并验证 `vodops_scan` 的分类范围、执行模式、租约和下次重试字段，归并旧快捷菜单、移除旧版 `response_end` hook，安装并验证单实例 CLI Worker Cron，最后清理 MacCMS 缓存并执行站点回环检查。文件替换后发生错误时会自动恢复快照内的文件和 Cron、保留失败版本并保持非零退出；数据库增量不做反向删除。它不会上传或替换主题、`pingfangdevice`、游戏服务和独立播放器，也不会删除旧豆瓣数据；旧表引擎或字段不兼容时会在替换任何插件文件前停止并列出缺口。

发布顺序如下：

1. 在本地重新执行测试、模板检查、兼容验证和预览验证。
2. 重建 `dist/`，验证主题、两个插件、播放器和联机游戏服务五个发布归档。
3. 上传主题、`pingfangdevice` 与 `vodops` 归档到远端临时路径。
4. 先安装并验证 `pingfangdevice`：备份旧插件，替换插件目录和 `application/` 载荷中的兼容控制器，补登记 `app_begin` hook，执行 `install.sql`，检查 PHP 语法和 `login_check_hash` 字段。
5. 把旧插件配置中仍存在的同名设置值合并到新配置，避免主题发布清空设备限制或联机签名密钥。
6. 安装并验证合并后的 `vodops`：先只读核对旧 `douban_*` 必要字段，再用同一时间戳快照旧 VodOps/豆瓣目录和应用载荷，停用独立豆瓣目录及旧公开桥接，保留已有配置，创建或复用五张 `vodops_*` 与七张 `douban_*` 表，幂等补齐分类范围与 Worker 字段并实际查询验证扫描锁、豆瓣入队锁，移除旧 `response_end` hook，安装由 `flock` 防重入的每分钟 Cron，并把旧 VodOps/豆瓣菜单归并为一个“视频数据中心”入口。
7. 备份现有主题为 `pingfangvideo.backup.<时间戳>`，替换主题目录。
8. 默认清理 `runtime/cache`、`runtime/temp`、后台和前台视图缓存。
9. 配置了 `DEPLOY_SITE_HOST` 时，从服务器本机把真实 Host/SNI 解析到 `127.0.0.1`，检查 HTTP 状态和可选响应标记。
10. 上传联机服务包，原子切换 `/opt/pingfanggames/current`，复用已有密钥或首次生成密钥，同步插件配置、systemd 与 Nginx。
11. 校验 Nginx 配置、重启并启用游戏服务、检查 `/healthz`，再按服务器实际管理方式无中断重载 Nginx。

VodOps Cron 默认启用，远端必须提供 `crontab`、`flock` 和 CLI `php`。若服务器由 systemd timer、面板计划任务或其他调度器接管，可在发布时设置 `VODOPS_INSTALL_CRON=0`，再按每分钟一次调用 `php <站点根>/addons/vodops/bin/vodops-worker.php --max-chunks=20 --max-seconds=50`；否则勾选“后台 Worker”的任务在页面关闭后不会前进。Worker 空闲时不输出，活动记录写入 `runtime/log/vodops-worker.log`，需要纳入现有日志轮转。

需要保留缓存时可设置 `DEPLOY_CLEAR_CACHE=0`，但只能用于明确的维护场景。站点回环验证能识别 PHP/Nginx 错误页、错误虚拟主机和缓存重建失败，但不会检查浏览器登录流程、外部 DNS/CDN 可达性，因此脚本成功仍不等于完整线上验收。

发布后至少确认：

- 首页、分类、详情、播放及用户入口返回预期页面，没有 PHP 运行时错误。
- `pingfangdevice` 管理页可访问，登录、设备登记和撤销流程按预期工作。
- 超级管理员可从快捷菜单打开 `vodops`，分别验证仅页面驱动和“后台 Worker”任务，执行一批扫描、继续或结束任务，并导出当前筛选 CSV；Worker 验收应关闭后台页且不制造任何前台访问，等待下一次 Cron 后刷新任务，确认进度或心跳前进，并检查 `crontab -l` 中当前站点标记恰好一条。确认已结束任务为支持类型显示修复侧边栏，播放和重复候选仍只显示原生编辑入口；未取得单独的数据写入授权时，只检查预览，不点击确认修改或回滚，并确认部署过程没有写入视频主表。
- 在同一工作台切换到“豆瓣匹配与同步”，确认没有打开第二套页面壳层，旧 `admin/douban/index` 跳转到该模块，其余 `admin/douban/*` 动作仍受管理员登录保护，现有配置、元数据、任务、候选、日志和体检历史能够读取；发布验收只做查询和预览，不执行真实同步、评分校准、图片回滚或批量任务。
- MacCMS 缓存目录仍可由 Web 进程写入。
- 远端实际主题和插件文件来自本次归档，并记录本次生成的备份目录名。

### 发布安全边界

- 不要把 `DEPLOY_PASSWORD` 写入仓库或 `scripts/deploy-ping2.env`；优先使用 SSH 密钥。首次连接使用 `StrictHostKeyChecking=accept-new`，操作人仍应通过可信渠道核对主机指纹。
- 专用部署密钥不是默认 SSH Identity 时，通过 `DEPLOY_IDENTITY_FILE` 传入本机私钥路径；脚本会同时为 SSH 和 SCP 启用 `IdentitiesOnly`，但不会读取或复制私钥内容。
- `DEPLOY_SITE_HOST` 只填写主机名，不带协议或路径；协议由 `DEPLOY_SITE_SCHEME` 指定。`DEPLOY_SITE_MARKER` 应选择只有正确站点页面会出现的稳定片段，当前 ping2 配置使用主题资源路径。
- 回环请求使用 `curl -k`，只用于绕过服务器本机访问虚拟主机时的证书信任问题；它不修改证书配置，也不能代替从公网检查 TLS、DNS 和 CDN。
- 发布脚本会替换远端目录、修改 `application/extra/addons.php` 与 `application/extra/quickmenu.php` 并执行数据库 DDL。运行前必须再次核对主机、账号和 `DEPLOY_PATH`。
- 插件安装先于主题替换，文件系统、配置与数据库之间没有统一事务。中途失败可能形成“插件已更新、主题未更新”的部分发布状态，应根据终端输出逐项核对，而不是直接重复运行。
- 站点回环验证发生在文件、hook 和数据库更新之后。`deploy:vodops` 在缓存清理和该验证完成前一直保持文件回滚保护；验证失败会恢复 VodOps 文件与 Cron，但保留已完成的增量数据库变化。完整部署中该保护只覆盖 VodOps 安装阶段，不会把后续主题或其他服务发布合并成一个跨组件事务。
- 脚本会为插件目录、两个后台控制器、`vodops` 后台视图、旧公开豆瓣桥接、hook、快捷菜单配置和 crontab 创建同一份迁移快照。VodOps 安装阶段失败时会自动恢复这些非数据库载荷，并保留失败版本供排查；显式执行 `ROLLBACK_SCOPE=vodops` 仍是人工选定备份的另一条回退路径，不修改数据库。
- 游戏服务部署会单独备份服务环境、systemd、Nginx 和插件配置；该阶段失败时自动恢复上一个服务版本，但不会回滚此前已成功更新的主题与插件代码。

## 回滚

`npm run rollback` 调用 `scripts/rollback-theme.sh`。默认选择远端模板目录中名称排序最后的 `pingfangvideo.backup.*`：

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=deploy \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run rollback
```

也可以指定备份目录名，但只允许传入 `DEPLOY_PATH` 内的单个目录名：

```bash
ROLLBACK_BACKUP=pingfangvideo.backup.20260701093000 npm run rollback
```

默认回滚会把当前主题移为 `pingfangvideo.failed.<时间戳>`，复制选定备份为新的 `pingfangvideo`，并清理同一组 MacCMS 缓存。复制失败时脚本会尝试恢复刚移走的主题。

合并插件可显式回滚到 `addons/` 目录中的某个 `vodops.backup.*`：

```bash
ROLLBACK_SCOPE=vodops ROLLBACK_BACKUP=vodops.backup.20260810120000 npm run rollback
```

该模式读取备份内的迁移状态：首次合并发布可恢复发布前的 VodOps 与独立豆瓣目录、两个后台控制器、质量后台视图及当时存在的旧公开豆瓣桥接；后续发布则恢复上一版合并插件。切换或载荷恢复失败时会放回当前插件和应用文件。回滚不会修改 `vodops_*`、`douban_*` 表、快捷菜单、hook 或 Cron，因此数据库与调度兼容性必须结合目标备份版本复核。

## 数据维护工具

数据维护与主题发布是两条独立流程。不要把数据库维护命令加入普通主题部署，也不要把生产报告保存在会被重建的 `dist/`。

### 视频分类一致性

入口：

- `scripts/sql/maccms-vod-category-maintenance.sql`
- `docs/maccms-vod-category-maintenance.md`

脚本只根据 `${前缀}type` 的父子关系修正 `${前缀}vod.type_id_1`，不会猜测或重分配错误的 `type_id`。默认表名为 `mac_vod` 和 `mac_type`，自定义前缀必须先复制脚本并替换表名。

安全注意：

- 执行前必须完整备份数据库，并先单独检查分类层级、失效分类和不一致行。
- SQL 文件末尾包含 `COMMIT`；通过输入重定向执行时会自动提交，不能在看到行数后再交互式选择 `ROLLBACK`。需要预演时，应在隔离环境执行，或复制脚本并把末尾 `COMMIT` 改为 `ROLLBACK` 后核对结果。
- 片名到分类的业务映射必须人工确认，不应加入通用一致性脚本。

### 视频海报修复

入口：

- `scripts/repair-vod-posters.php`
- `tests/poster-repair.test.php`
- `docs/maccms-vod-poster-repair.md`

工具默认是只读预演：它处理空海报，以及本地上传模式下实际文件缺失的相对路径；已经存在的本地文件、远程上传模式的相对存储键和现有 HTTP/HTTPS 海报不会被盲目覆盖。候选依次来自已验证 ID 的豆瓣数据、后台视频采集源，以及可选的 Bangumi 动画查询，并要求规范化片名和可用年份能够确定性匹配。

推荐流程：

1. 备份数据库，确认 MacCMS 根目录和上传模式。
2. 不带 `--apply` 生成一份全新的 JSONL 预演报告。
3. 审核 `old_pic`、`new_pic`、来源、匹配状态和未匹配项；保留原始报告的校验和或只读副本。
4. 优先用 `--apply --apply-report=<已审核报告>` 应用已确认映射，同时把应用结果写入另一份新报告。
5. 核对数据库更新数、跳过原因、备份表和站点实际海报，再决定是否需要回滚。

每次 `--apply` 会把匹配记录第一次修复前的值保存到 `${前缀}vod_pic_repair_backup`。更新语句同时比较 `vod_id` 和原始 `vod_pic`，预演后被人工修改的行会跳过；恢复出来的本地文件也会再次阻止旧报告覆盖。这个保护不能替代数据库备份，且整体 SQL 回滚可能覆盖修复后的人工改动，必须按应用报告逐条评估。

`docs/vod-poster-provider-matches-20260716.md` 是基于 2026-07-16 报告与当时生产库生成的历史审计快照，不是采集源配置，也不能代表当前数据库状态。后续核验应生成新的、带日期的审计产物，不要直接改写该快照来表示最新状态。

## CI

`.github/workflows/ci.yml` 在每次 push 和 pull request 上运行，环境为 Node.js 22 和 PHP 8.4。CI 先执行 `npm ci`，再按本地完整发布门禁运行测试、前端检查、模板检查、兼容验证、预览验证、打包和发布包验证。

验证通过后，CI 按独立发布单元上传：

```text
pingfangvideo-theme  -> dist/pingfangvideo.tar.gz
pingfangdevice-addon -> dist/pingfangdevice.tar.gz
vodops-addon -> dist/vodops.tar.gz
pingfangplayer-player -> dist/pingfangplayer-player.tar.gz
pingfanggames-server -> dist/pingfanggames-server.tar.gz
```

CI 只构建和保存归档，不连接生产服务器，也不执行部署、回滚或数据库维护。下载 CI 产物后仍应核对对应提交和归档内容，再进入有授权的发布流程。

## 修改工程脚本时的同步检查

- 新增或改名 npm 命令：同步 `package.json`、CI、README 和 `tests/template.test.mjs` 中的契约。
- 改变主题或插件发布包内容：同步 `scripts/package-theme.mjs`、`scripts/verify-release.mjs`、CI 上传路径和本文生成目录说明。
- 改变播放器发布包内容：同步 `scripts/package-player.mjs`、`scripts/verify-player-release.mjs`、CI 上传路径和本文白名单说明。
- 改变远端路径或安装步骤：同步部署与回滚脚本、环境示例、备份/失败恢复说明，并补充相应静态测试。
- 改变数据维护行为：先补单元测试和预演路径，再更新对应操作文档；任何扩大写入范围的变化都需要重新审视备份与回滚策略。
