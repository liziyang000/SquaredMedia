# 开发、发布与数据运维

本文说明仓库内工程脚本的职责和操作边界。主题模板与插件本身的设计另见对应模块文档；这里以 `package.json`、`scripts/`、`.github/workflows/ci.yml` 和现有测试为事实来源。

## 环境要求

- Node.js：CI 使用 Node.js 22；仓库没有第三方 npm 依赖，命令直接调用 Node.js 标准库。
- PHP：目标版本为 PHP 8.4。完整测试会调用 PHP CLI；海报修复工具还要求 `curl`、`mbstring`、`pdo_mysql` 扩展。
- 打包：需要系统 `tar`，且当前脚本使用 `--no-xattrs`。
- 部署：本机需要 `bash`、`ssh`、`scp`；使用密码认证时还需要 `sshpass`，日常发布优先使用 SSH 密钥。
- 远端：需要可执行 `bash`、`tar`、PHP CLI 和 PDO MySQL，并且发布账号必须能写入 MacCMS 模板、插件、控制器、配置和缓存目录。

## 开发验证

常用命令由 `package.json` 统一暴露：

| 命令 | 作用 | 是否写入仓库生成目录 |
| --- | --- | --- |
| `npm test` | 运行模板契约、设备会话与控制器、海报修复及 Douban 数据/网关/匹配测试 | 否；测试只使用系统临时目录 |
| `npm run lint:template` | 检查模板 include、标签平衡、资源路径和生产模板中的开发环境引用 | 否 |
| `npm run verify:compat` | 检查 MacCMS 目录、标准路由页面和不安全链接模式 | 否 |
| `npm run verify:preview` | 用当前 PHP CLI 渲染本地预览的主要路由并核对完整 HTML | 否 |
| `npm run package` | 重建主题、`pingfangdevice` 和 `douban` 发布包 | 是，重建整个 `dist/` |
| `npm run verify:release` | 解包检查三个归档的结构、生产边界、资源版本和插件表结构 | 只读 `dist/` |

提交主题相关修改前，至少执行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

准备发布时再执行完整发布门禁：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

各层验证的关注点不同，不能互相替代：

- `tests/template.test.mjs` 是仓库级静态与预览契约测试，也会约束发布脚本、CI 配置和数据库维护文档中的关键入口。
- `scripts/lint-template.mjs` 面向源模板结构，阻止本地预览、`localhost`、死链接或错误资源路径进入生产主题。
- `scripts/verify-compat.mjs` 面向 MacCMS 页面和目录兼容面。
- `scripts/verify-preview.mjs` 从仓库根目录调用 PHP CLI，验证本地模拟数据能够渲染主要路由；它不连接真实 MacCMS 数据库。
- `scripts/verify-release.mjs` 只验证已经生成的归档，不会自动执行打包。

本地静态预览必须通过 HTTP 服务打开，因为 `preview/index.html` 使用绝对路径请求 `/preview/data.json`。直接以 `file://` 打开不能视为有效验证。Docker 通过 `PINGFANG_PREVIEW_DATA=/var/www/html/preview/data.json` 对齐容器挂载路径；不使用 Docker 时，`server/lib/data.php` 默认从仓库根目录读取相同样例数据。PHP 路由验证以 `npm run verify:preview` 为准。

## 打包与 `dist/`

`scripts/package-theme.mjs` 每次运行都会先递归删除整个 `dist/`，再生成：

```text
dist/
├── pingfangvideo/
├── pingfangvideo.tar.gz
├── pingfangdevice/
├── pingfangdevice.tar.gz
├── douban/
└── douban.tar.gz
```

打包过程有以下固定行为：

- `pingfangvideo` 来自 `template/pingfangvideo/`，两个插件分别来自 `addons/pingfangdevice/` 和 `addons/douban/`。
- 两个插件的 `application/` 都保留 MacCMS 标准应用载荷结构；`pingfangdevice` 安装前台兼容控制器，`douban` 只安装后台控制器。
- 任意层级以 `.` 开头的文件或目录不会进入包。
- 主题 HTML 中的 `__PINGFANG_ASSET_VERSION__` 会替换为 12 位内容摘要；当前摘要输入为 `css/style.css`、`js/rank-react.js`、`js/app.js` 和 `player/prompt.css`。新增需要同一版本策略的资源时，应同步维护该输入列表和发布验证。
- 包内目录权限统一为 `0755`，文件权限统一为 `0644`；tar 包禁用 macOS 扩展属性元数据。
- 当前自动化只打包主题、`pingfangdevice` 和 `douban`，不会自动打包或部署其他 `addons/` 子目录。

`dist/` 已被 `.gitignore` 忽略，是可重复生成的发布产物，不是源码。不要把人工报告、数据库备份或唯一副本放入其中，否则下次 `npm run package` 会直接删除。

仓库根目录下可能出现 `output/`，但当前 `package.json`、`scripts/`、测试和 CI 都没有把它定义为正式输出目录；它也未被 `.gitignore` 忽略。应把它视为本地工具临时目录，不在文档或自动化中依赖其内容。若后续引入稳定的生成器，应同时明确所有者、清理策略和忽略规则。

## 部署

`npm run deploy` 调用 `scripts/deploy-theme.sh`。必须提供：

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=deploy \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run deploy
```

`DEPLOY_PATH` 必须是远端 MacCMS 的 `template` 目录，脚本以其父目录作为站点根目录。仓库中的 `scripts/deploy-ping2.env` 只保存当前目标的非密码连接参数、专用密钥路径和站点验证 Host；其中 `ping2.my` 是 SSH 主机，`www.ping2video.xyz` 才是公开站点域名。在确认目标无误且已获得发布授权后可执行：

```bash
source scripts/deploy-ping2.env
npm run deploy
```

只发布 Douban 后台插件时使用 `DEPLOY_SCOPE=douban npm run deploy`。该模式仍执行全部本地门禁、Douban 备份、数据库增量、后台控制器安装、缓存清理和站点回环验证，但不会上传或替换主题与 `pingfangdevice`。

发布顺序如下：

1. 在本地重新执行测试、模板检查、兼容验证和预览验证。
2. 重建 `dist/`，再验证三个发布归档。
3. 上传主题、`pingfangdevice` 与 `douban` 归档到远端临时路径。
4. 先安装并验证 `pingfangdevice`：备份旧插件，替换插件目录和 `application/` 载荷中的兼容控制器，补登记 `app_begin` hook，执行 `install.sql`，检查 PHP 语法和 `login_check_hash` 字段。
5. 安装并验证 `douban`：备份旧插件，替换插件目录，只复制后台 `application/` 控制器载荷，备份后移除旧前台兼容控制器，并执行 `install.sql`。默认 `internal` 数据源直接调用插件内置网关，不再部署根目录 `extend/douban.php`。
6. 备份现有主题为 `pingfangvideo.backup.<时间戳>`，替换主题目录。
7. 默认清理 `runtime/cache`、`runtime/temp`、后台和前台视图缓存。
8. 配置了 `DEPLOY_SITE_HOST` 时，从服务器本机把真实 Host/SNI 解析到 `127.0.0.1`，检查 HTTP 状态和可选响应标记。

结构升级会备份并移除明确属于旧插件的 `application/index/controller/Douban.php`；不会自动删除服务器上历史部署的 `extend/douban.php`。确认没有外部调用方后，应先备份再单独清理该根目录文件。

需要保留缓存时可设置 `DEPLOY_CLEAR_CACHE=0`，但只能用于明确的维护场景。站点回环验证能识别 PHP/Nginx 错误页、错误虚拟主机和缓存重建失败，但不会检查浏览器登录流程、外部 DNS/CDN 可达性，因此脚本成功仍不等于完整线上验收。

发布后至少确认：

- 首页、分类、详情、播放及用户入口返回预期页面，没有 PHP 运行时错误。
- `pingfangdevice` 管理页可访问，登录、设备登记和撤销流程按预期工作。
- Douban 后台菜单打开标准后台控制器，任务生成、同步和评分校准操作返回预期结果。
- MacCMS 缓存目录仍可由 Web 进程写入。
- 远端实际主题和插件文件来自本次归档，并记录本次生成的备份目录名。

### 发布安全边界

- 不要把 `DEPLOY_PASSWORD` 写入仓库或 `scripts/deploy-ping2.env`；优先使用 SSH 密钥。首次连接使用 `StrictHostKeyChecking=accept-new`，操作人仍应通过可信渠道核对主机指纹。
- 专用部署密钥不是默认 SSH Identity 时，通过 `DEPLOY_IDENTITY_FILE` 传入本机私钥路径；脚本会同时为 SSH 和 SCP 启用 `IdentitiesOnly`，但不会读取或复制私钥内容。
- `DEPLOY_SITE_HOST` 只填写主机名，不带协议或路径；协议由 `DEPLOY_SITE_SCHEME` 指定。`DEPLOY_SITE_MARKER` 应选择只有正确站点页面会出现的稳定片段，当前 ping2 配置使用主题资源路径。
- 回环请求使用 `curl -k`，只用于绕过服务器本机访问虚拟主机时的证书信任问题；它不修改证书配置，也不能代替从公网检查 TLS、DNS 和 CDN。
- 发布脚本会替换远端目录、修改 `application/extra/addons.php` 并执行数据库 DDL。运行前必须再次核对主机、账号和 `DEPLOY_PATH`。
- 插件安装先于主题替换，文件系统、配置与数据库之间没有统一事务。中途失败可能形成“插件已更新、主题未更新”的部分发布状态，应根据终端输出逐项核对，而不是直接重复运行。
- 站点回环验证发生在文件、hook 和数据库更新之后；验证失败会让部署命令返回非零，但不会自动回滚已经应用的变化，应先检查响应和备份，再决定修复或执行明确回滚。
- 脚本会为两个插件目录、应用控制器、被清理的旧 Douban 前台控制器和 hook 配置创建备份，但不会自动执行插件回滚。

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

回滚会把当前主题移为 `pingfangvideo.failed.<时间戳>`，复制选定备份为新的 `pingfangvideo`，并默认清理同一组 MacCMS 缓存。复制失败时脚本会尝试恢复刚移走的主题。

此命令只回滚主题，不回滚 `pingfangdevice`、`douban`、应用兼容控制器、hook 配置或数据库表结构。若故障来自插件发布，必须基于部署时留下的备份和数据库审计结果制定单独恢复方案。主题回滚后仍需完成与发布后相同的线上验证。

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

`.github/workflows/ci.yml` 在每次 push 和 pull request 上运行，环境为 Node.js 22 和 PHP 8.4。顺序与本地完整发布门禁一致：测试、模板检查、兼容验证、预览验证、打包、发布包验证。

验证通过后，CI 按独立发布单元上传：

```text
pingfangvideo-theme  -> dist/pingfangvideo.tar.gz
pingfangdevice-addon -> dist/pingfangdevice.tar.gz
douban-addon         -> dist/douban.tar.gz
```

CI 只构建和保存归档，不连接生产服务器，也不执行部署、回滚或数据库维护。下载 CI 产物后仍应核对对应提交和归档内容，再进入有授权的发布流程。

## 修改工程脚本时的同步检查

- 新增或改名 npm 命令：同步 `package.json`、CI、README 和 `tests/template.test.mjs` 中的契约。
- 改变发布包内容：同步 `scripts/package-theme.mjs`、`scripts/verify-release.mjs`、CI 上传路径和本文生成目录说明。
- 改变远端路径或安装步骤：同步部署与回滚脚本、环境示例、备份/失败恢复说明，并补充相应静态测试。
- 改变数据维护行为：先补单元测试和预演路径，再更新对应操作文档；任何扩大写入范围的变化都需要重新审视备份与回滚策略。
