# PingFangVideo 主题与插件手动部署手册

最后核验：2026-08-21

核验源码：`master` @ `da288100bf0d4bc8c0f029c7d5e5a7f88eddcc97`

本文用于由操作人手动发布本仓库的 MacCMS V10 主题和插件。这里的“手动发布”是指操作人亲自核对目标、备份、运行命令并完成验收；推荐复用仓库已经测试过的部署脚本，不建议把复杂插件升级简化为在宝塔文件管理器中直接覆盖目录。

本文不会执行部署，也不包含数据库密码、后台账号、SSH 私钥或联机游戏签名密钥。实际发布前必须以准备发布的提交重新执行全部检查，不能直接把本文记录的提交号当成本次发布版本。

## 1. 发布范围

本手册只覆盖以下三个发布单元：

| 发布单元 | 本地产物 | 远端主要位置 | 附加动作 |
| --- | --- | --- | --- |
| `pingfangvideo` 主题 | `dist/pingfangvideo.tar.gz` | `<MacCMS 根目录>/template/pingfangvideo` | 首次安装时在后台选择主题；更新后清理模板缓存 |
| `pingfangdevice` 插件 | `dist/pingfangdevice.tar.gz` | `<MacCMS 根目录>/addons/pingfangdevice` | 保留旧配置、复制前台控制器、登记 `app_begin` Hook、执行 SQL |
| `vodops` 插件 | `dist/vodops.tar.gz` | `<MacCMS 根目录>/addons/vodops` | 保留旧配置、迁移旧 Douban、复制后台控制器/视图、执行 SQL、更新菜单和 Hook、安装 Worker 计划任务 |

以下内容不在本次范围内：

- `dist/pingfangplayer-player.tar.gz`：独立播放器，不属于主题目录；
- `dist/pingfanggames-server.tar.gz`：独立 Node.js 联机服务；
- MacCMS 核心、Nginx、Cloudflare、防火墙、证书和播放器线路配置；
- 视频资料同步、评分校准、海报回滚、批量修复等生产数据操作。

> 注意：`npm run deploy` 会在主题和插件之后继续部署联机游戏服务。只部署本文的主题和插件时，应直接运行 `bash scripts/deploy-theme.sh`，不要运行 `npm run deploy`。

## 2. 成功标准

只有同时满足以下条件，才能把本次发布记为完成：

- [ ] 发布提交、工作区状态和三个归档的 SHA-256 已记录；
- [ ] 本地测试、Lint、模板检查、兼容检查、预览检查、打包检查全部通过；
- [ ] 目标 SSH 主机、端口和 MacCMS 根目录已经二次确认；
- [ ] 数据库完整备份和必要文件备份已完成，备份位置与时间已记录；
- [ ] `pingfangdevice` 原有配置值未丢失，`app_begin` Hook 和兼容控制器有效；
- [ ] `vodops` 原有配置与 `douban_*` 数据未丢失，后台控制器、统一工作台、菜单、Hook 和表结构有效；
- [ ] VodOps Worker 只存在一条计划任务，并以确认过的 Web 用户运行；
- [ ] 主题已启用，模板 HTML 目录为真实的 `html` 目录；
- [ ] 四组 MacCMS 缓存已清理并仍可由 Web 用户写入；
- [ ] 服务器本机回环、公网 HTTP 和真实浏览器验收分别通过；
- [ ] 本次备份目录名、验收结果和明确未验证项已记录。

“文件已上传”“脚本退出码为 0”或“首页能打开”都不能单独代表完整发布成功。

## 3. 当前生产参数与待确认项

仓库中的 `scripts/deploy-ping2.env` 保存了当前非敏感目标参数：

| 项目 | 当前仓库值 | 发布前动作 |
| --- | --- | --- |
| SSH 目标 | `144.34.184.95:814` | 通过可信渠道核对主机指纹；不要只依赖首次自动接受 |
| SSH 用户 | `root` | 确认仍是本次获授权的发布账号 |
| MacCMS 模板目录 | `/www/wwwroot/squaredMedia/template` | 确认其父目录确实是当前站点根目录 |
| MacCMS 根目录 | `/www/wwwroot/squaredMedia` | 检查 `application/database.php`、`template/`、`runtime/` |
| 公网站点 | `www.ping2video.xyz` | 与 SSH 目标分开核对，不把域名解析结果当作 SSH 目标 |
| Web 用户 | 常见值为 `www` | **需确认**，以 PHP-FPM 进程和目录属主为准 |
| PHP CLI | 未在仓库固定 | **需确认**，应与站点 PHP-FPM 版本和扩展一致 |
| 数据库表前缀 | 来自 `application/database.php` | **需确认**，不要手写猜测 `mac_` |

仓库 CI 以 PHP 8.4 运行；服务器恢复记录中曾出现 PHP 8.2。两者是不同时间点的证据，实际发布前必须重新核对 PHP-FPM 与 CLI，不能默认为其中任一版本。

## 4. 发布流程总览

```text
锁定源码和范围
  -> 本地完整门禁
  -> 生成并核对三个归档
  -> 远端环境、任务和权限预检
  -> 数据库与文件备份
  -> pingfangdevice
  -> vodops
  -> pingfangvideo
  -> 清缓存并恢复 Web 用户计划任务
  -> 服务器本机验收
  -> 公网与浏览器验收
  -> 记录证据
```

插件先于主题，是因为当前主题的登录、设备页、动态筛选、线路检测和联机票据会调用 `pingfangdevice`。主题最后切换可以缩短“新主题已经引用新接口，但插件尚未就绪”的时间。

## 5. 发布前：锁定本地源码

在本机进入仓库：

```bash
cd /Users/bytedance/Documents/SquaredMedia
```

先确认分支、提交和与远端的差异：

```bash
git fetch --prune origin
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git rev-list --left-right --count HEAD...origin/master
git status --short -- \
  template/pingfangvideo \
  addons/pingfangdevice \
  addons/vodops \
  scripts/package-theme.mjs \
  scripts/verify-release.mjs \
  scripts/deploy-theme.sh \
  package.json \
  package-lock.json
```

判断规则：

- 上述发布路径有未提交修改时，先确认它们是否就是本次要发布的内容；
- 不要因为只有文档改动就误判发布代码已变更，反之也不要忽略未提交的主题、插件或脚本；
- 不要在脏工作区直接执行会覆盖用户修改的 `git reset --hard`、`git checkout --`；
- 记录实际提交 SHA；如果有获准发布的未提交改动，还要另外保存 `git diff`，不能只记录提交号。

## 6. 发布前：本地完整门禁与打包

安装锁定依赖并运行仓库规定的完整检查：

```bash
npm ci
npm test
npm run lint
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

注意：`npm run package` 会先删除并重建整个 `dist/`。不要把唯一的数据库备份、人工报告或其他文件放在 `dist/`。

确认三个目标归档存在且顶层目录正确：

```bash
test -f dist/pingfangvideo.tar.gz
test -f dist/pingfangdevice.tar.gz
test -f dist/vodops.tar.gz

tar -tzf dist/pingfangvideo.tar.gz | sed -n '1,20p'
tar -tzf dist/pingfangdevice.tar.gz | sed -n '1,20p'
tar -tzf dist/vodops.tar.gz | sed -n '1,30p'
```

三个归档必须分别以 `pingfangvideo/`、`pingfangdevice/`、`vodops/` 开头。生成校验和：

```bash
shasum -a 256 \
  dist/pingfangvideo.tar.gz \
  dist/pingfangdevice.tar.gz \
  dist/vodops.tar.gz \
  | tee dist/theme-addon-SHA256SUMS.txt
```

把校验和复制到不会被下一次打包删除的发布记录中。不要把 `dist/` 中未校验的旧包与新包混用。

## 7. 发布前：远端只读预检

先载入当前目标参数并显示关键值：

```bash
source scripts/deploy-ping2.env
printf 'SSH=%s@%s:%s\nDEPLOY_PATH=%s\nSITE=%s\n' \
  "$DEPLOY_USER" "$DEPLOY_HOST" "$DEPLOY_PORT" \
  "$DEPLOY_PATH" "$DEPLOY_SITE_HOST"
```

首次或主机重装后连接时，先通过服务器控制台核对 ED25519 指纹，再连接。不要使用 `StrictHostKeyChecking=no` 绕过身份校验。

```bash
ssh \
  -p "$DEPLOY_PORT" \
  -i "$DEPLOY_IDENTITY_FILE" \
  -o IdentitiesOnly=yes \
  "$DEPLOY_USER@$DEPLOY_HOST"
```

进入远端后，使用任务专用变量，不要改写系统的 `HOME` 等变量：

```bash
export PFV_CMS_ROOT=/www/wwwroot/squaredMedia
export PFV_TEMPLATE_ROOT="$PFV_CMS_ROOT/template"

test "$PFV_CMS_ROOT" = /www/wwwroot/squaredMedia
test -d "$PFV_TEMPLATE_ROOT"
test -f "$PFV_CMS_ROOT/application/database.php"
test -d "$PFV_CMS_ROOT/runtime"
realpath "$PFV_CMS_ROOT"
df -h "$PFV_CMS_ROOT"
```

确认依赖命令：

```bash
for PFV_COMMAND in bash tar php curl crontab flock find runuser; do
  command -v "$PFV_COMMAND" || exit 1
done

php -v
php -m | grep -E 'PDO|pdo_mysql|mbstring|curl'
```

如果宝塔站点使用的 PHP 与 `command -v php` 不同，找到站点绑定的 PHP CLI 绝对路径，再设置：

```bash
export PFV_PHP_BIN=/已确认的/php/绝对路径
"$PFV_PHP_BIN" -v
"$PFV_PHP_BIN" -m | grep -E 'PDO|pdo_mysql|mbstring|curl'
```

确认 Web 用户。下面的 `www` 只是当前常见候选，必须用 PHP-FPM 进程和目录属主验证：

```bash
ps -eo user,group,comm,args | grep '[p]hp-fpm'
stat -c '%U:%G %a %n' \
  "$PFV_CMS_ROOT/runtime" \
  "$PFV_CMS_ROOT/runtime/cache" \
  "$PFV_CMS_ROOT/runtime/temp"
```

确认后再设置：

```bash
export PFV_WEB_USER=www
export PFV_WEB_GROUP="$(id -gn "$PFV_WEB_USER")"
getent passwd "$PFV_WEB_USER"
```

检查缓存目录能否由 Web 用户写入：

```bash
runuser -u "$PFV_WEB_USER" -- test -w "$PFV_CMS_ROOT/runtime/cache"
runuser -u "$PFV_WEB_USER" -- test -w "$PFV_CMS_ROOT/runtime/temp"
```

只显示数据库前缀，不输出账号或密码：

```bash
"$PFV_PHP_BIN" -r '
$db = include $argv[1];
if (!is_array($db)) { fwrite(STDERR, "invalid database config\n"); exit(1); }
echo "database config: ok; prefix=" . ($db["prefix"] ?? "") . PHP_EOL;
' "$PFV_CMS_ROOT/application/database.php"
```

检查是否有正在运行的 VodOps Worker 或计划任务：

```bash
ps -ef | grep '[v]odops-worker.php'
crontab -l 2>/dev/null | grep -F "vodops-worker:$PFV_CMS_ROOT" || true
crontab -u "$PFV_WEB_USER" -l 2>/dev/null | grep -F "vodops-worker:$PFV_CMS_ROOT" || true
```

如果已有 Worker 正在执行或后台有运行中的任务，先等待该批次结束或按业务流程结束任务，再进入文件替换。不要直接杀死进程后忽略任务租约状态。

## 8. 发布前：数据库与文件备份

### 8.1 数据库备份

在宝塔或受控的数据库工具中创建本次发布前的完整数据库备份，并记录：

- 备份开始与完成时间；
- 数据库名和表前缀；
- 备份文件位置、大小和校验和；
- 压缩包完整性检查结果；
- 恢复所需账号或凭据的安全保存位置，不记录凭据本身。

至少确认备份包含：

- `<前缀>pingfang_device_session`；
- 五张 `<前缀>vodops_*` 表；
- 七张 `<前缀>douban_*` 表；
- `<前缀>vod` 等 MacCMS 业务表和系统配置表。

插件 SQL 是增量 DDL。仓库回滚脚本不会删除新增列、删除插件表或恢复数据库，因此没有数据库备份时禁止继续。

### 8.2 文件与计划任务备份

仓库部署脚本会创建带时间戳的主题和插件备份，但仍应在站点目录之外保留一份本次发布记录。至少覆盖：

```text
template/pingfangvideo
addons/pingfangdevice
addons/vodops
addons/douban                         # 若仍存在
application/index/controller/Pingfangdevice.php
application/index/controller/Douban.php
application/admin/controller/Vodops.php
application/admin/controller/Douban.php
application/admin/view_new/vodops/index.html
application/extra/addons.php
application/extra/quickmenu.php
当前发布用户的 crontab
Web 用户的 crontab
```

备份应放在 Web 根目录之外，并使用限制访问的目录。复制完成后检查文件数、大小和关键文件，不要只看复制命令退出码。

### 8.3 暂停旧 VodOps Cron

如果第 7 节发现已有 VodOps Cron，在完整备份两个 crontab 后，用 `crontab -e` 或 `crontab -u "$PFV_WEB_USER" -e` 暂时删除当前站点标记行。首次安装且没有该行时无需操作。

暂停后确认两个 crontab 合计没有当前站点标记，并再次确认没有正在运行的 Worker：

```bash
{
  crontab -l 2>/dev/null || true
  crontab -u "$PFV_WEB_USER" -l 2>/dev/null || true
} | grep -Fc "vodops-worker:$PFV_CMS_ROOT" || true

ps -ef | grep '[v]odops-worker.php'
```

第一条命令在发布窗口内应输出 `0`，第二条不应显示正在执行的 Worker。不要使用 `kill -9` 跳过任务的正常结束和租约处理。发布完成后按第 10 节只恢复到 Web 用户。

## 9. 推荐部署方式：操作人手动运行仓库脚本

### 9.1 为什么使用该脚本

`scripts/deploy-theme.sh` 不只是上传文件。它还会：

- 重新执行完整本地门禁并重建归档；
- 保留插件旧配置中的同名设置；
- 为 `pingfangdevice` 复制兼容控制器、登记 Hook、执行和验证 SQL；
- 对旧 `douban_*` 表做只读兼容预检；
- 为 VodOps、旧 Douban、应用载荷、菜单、Hook 和 Cron 建立迁移快照；
- 复制 VodOps/Douban 后台控制器和统一工作台；
- 执行并验证 VodOps/Douban 增量表结构；
- 归并快捷菜单并移除旧 `response_end` Hook；
- 备份并替换主题；
- 清理四组 MacCMS 缓存；
- 使用真实 Host/SNI 做服务器本机回环检查。

直接覆盖 `addons/` 目录不会完成这些动作。

### 9.2 当前版本的 Cron 规避项

当前基线的部署脚本把 VodOps Cron 安装到 SSH 发布用户的 crontab。当前生产参数使用 `root` 发布，这会让 Worker 以 root 运行，并可能在 `runtime/cache`、`runtime/temp` 或日志目录产生 Web 进程不可写的文件。

因此在当前基线上发布主题与插件时，明确跳过脚本内 Cron 安装；文件发布完成后，再按第 10 节把计划任务安装到已经确认的 Web 用户：

```bash
cd /Users/bytedance/Documents/SquaredMedia
source scripts/deploy-ping2.env

DEPLOY_SCOPE=all \
VODOPS_INSTALL_CRON=0 \
DEPLOY_CLEAR_CACHE=1 \
bash scripts/deploy-theme.sh
```

这条命令只部署主题、`pingfangdevice` 和 `vodops`，不会调用 `scripts/deploy-game-server.sh`，也不会安装独立播放器。

执行前最后确认终端中显示的 SSH 目标和路径。执行中任何一步失败后，不要不加判断地重复运行；先依据输出判断已经完成的是设备插件、VodOps 还是主题，并核对对应备份。

脚本会再次运行 `npm run package`，所以部署前生成的校验和文件会随 `dist/` 一起重建。脚本结束后，重新计算下面三个归档的 SHA-256；这组发布后校验和才是本次实际上传归档的权威记录：

```bash
shasum -a 256 \
  dist/pingfangvideo.tar.gz \
  dist/pingfangdevice.tar.gz \
  dist/vodops.tar.gz
```

### 9.3 可选的单插件范围

只发布 VodOps 时：

```bash
cd /Users/bytedance/Documents/SquaredMedia
source scripts/deploy-ping2.env

VODOPS_INSTALL_CRON=0 \
DEPLOY_CLEAR_CACHE=1 \
npm run deploy:vodops
```

该命令不会替换主题、`pingfangdevice`、游戏服务或播放器。当前脚本没有“仅主题”或“仅 `pingfangdevice`”范围；遇到这两种需求时应另行确认手工文件范围，不要用全量命令冒充单组件发布。

## 10. 发布后：以 Web 用户安装 VodOps Worker

### 10.1 清理重复任务前先备份

分别查看发布用户和 Web 用户的 crontab：

```bash
crontab -l
crontab -u "$PFV_WEB_USER" -l
```

如果任一命令返回权限错误而不是“没有 crontab”，先停止，不要覆盖现有计划任务。编辑前分别保存完整副本。绝对不要使用 `crontab -r`。

### 10.2 准备可写日志目录

```bash
install -d \
  -o "$PFV_WEB_USER" \
  -g "$PFV_WEB_GROUP" \
  -m 0755 \
  "$PFV_CMS_ROOT/runtime/log"

touch "$PFV_CMS_ROOT/runtime/log/vodops-worker.log"
chown "$PFV_WEB_USER:$PFV_WEB_GROUP" \
  "$PFV_CMS_ROOT/runtime/log/vodops-worker.log"
```

先只读检查旧的 root 属主文件：

```bash
find \
  "$PFV_CMS_ROOT/runtime/cache" \
  "$PFV_CMS_ROOT/runtime/temp" \
  "$PFV_CMS_ROOT/runtime/log" \
  -xdev ! -user "$PFV_WEB_USER" -print
```

若有输出，先确认这些目录只属于当前 MacCMS 实例，再修复明确的异常项。不要对整个 `/www` 或站点根目录递归改属主。

### 10.3 安装唯一一条 Web 用户 Cron

使用 `crontab -u "$PFV_WEB_USER" -e` 编辑 Web 用户计划任务，加入一行。把下面的 `/已确认的/php/绝对路径` 替换为第 7 节验证过的 PHP CLI；不得原样保留占位符：

```cron
* * * * * /usr/bin/flock -n '/www/wwwroot/squaredMedia/runtime/vodops-worker.lock' '/已确认的/php/绝对路径' '/www/wwwroot/squaredMedia/addons/vodops/bin/vodops-worker.php' --max-chunks=20 --max-seconds=50 >> '/www/wwwroot/squaredMedia/runtime/log/vodops-worker.log' 2>&1 # vodops-worker:/www/wwwroot/squaredMedia
```

然后从 root 或其他发布用户的 crontab 中删除相同站点标记的旧行，只保留 Web 用户下的一条。再次验证：

```bash
crontab -l 2>/dev/null | grep -F "vodops-worker:$PFV_CMS_ROOT" || true
crontab -u "$PFV_WEB_USER" -l | grep -F "vodops-worker:$PFV_CMS_ROOT"

{
  crontab -l 2>/dev/null || true
  crontab -u "$PFV_WEB_USER" -l 2>/dev/null || true
} | grep -Fc "vodops-worker:$PFV_CMS_ROOT"
```

最后一条命令必须输出 `1`。只验证 CLI 入口时可以运行：

```bash
runuser -u "$PFV_WEB_USER" -- \
  "$PFV_PHP_BIN" \
  "$PFV_CMS_ROOT/addons/vodops/bin/vodops-worker.php" \
  --help
```

在没有确认队列内容和数据写入授权时，不要为了测试 Cron 直接执行 Worker 正常模式。`scheduled_scan_hours` 默认应为 `0`，表示 Cron 不会自行新建周期扫描；它仍会继续管理员明确启动的后台任务。

## 11. 首次安装时启用主题

如果生产站已经使用 `pingfangvideo`，更新文件后通常不需要重新切换模板。

首次安装时按照 MacCMS 官方方式操作：

1. 登录 MacCMS 后台；
2. 进入“系统 → 网站参数配置 → 基本设置”；
3. 将“网站模板”选择为 `pingfangvideo`；
4. 将模板 HTML 目录填写为主题中真实存在的 `html`；
5. 保存后清理缓存，再访问前台。

模板目录必须与 `template/pingfangvideo/html` 完全一致。出现“模板不存在”时，先核对目录层级和该设置，不要先修改模板源码。

## 12. 发布后服务器校验

### 12.1 文件与 PHP 语法

```bash
test -f "$PFV_CMS_ROOT/template/pingfangvideo/info.ini"
test -f "$PFV_CMS_ROOT/addons/pingfangdevice/info.ini"
test -f "$PFV_CMS_ROOT/addons/vodops/info.ini"

test -f "$PFV_CMS_ROOT/application/index/controller/Pingfangdevice.php"
test -f "$PFV_CMS_ROOT/application/admin/controller/Vodops.php"
test -f "$PFV_CMS_ROOT/application/admin/controller/Douban.php"
test -f "$PFV_CMS_ROOT/application/admin/view_new/vodops/index.html"

"$PFV_PHP_BIN" -l "$PFV_CMS_ROOT/application/index/controller/Pingfangdevice.php"
"$PFV_PHP_BIN" -l "$PFV_CMS_ROOT/application/admin/controller/Vodops.php"
"$PFV_PHP_BIN" -l "$PFV_CMS_ROOT/application/admin/controller/Douban.php"
"$PFV_PHP_BIN" -l "$PFV_CMS_ROOT/addons/vodops/bin/vodops-worker.php"
```

确认归档内 `application/` 载荷与 MacCMS 实际位置一致；只看到插件目录中的副本不算安装完成。

### 12.2 Hook 与快捷菜单

检查 `application/extra/addons.php`：

- `hooks.app_begin` 中恰好包含一次 `pingfangdevice`；
- `hooks.response_end` 中不再包含 `vodops`；
- 其他插件 Hook 未被删除。

检查 `application/extra/quickmenu.php`：

- 恰好有一个 `视频数据中心,vodops/index`；
- 不再保留旧 `douban/index` 或重复 VodOps 入口；
- 其他快捷菜单项未被删除。

可以用 PHP 只读显示：

```bash
"$PFV_PHP_BIN" -r '
$config = include $argv[1];
var_export($config["hooks"] ?? []);
echo PHP_EOL;
' "$PFV_CMS_ROOT/application/extra/addons.php"

"$PFV_PHP_BIN" -r '
$menu = include $argv[1];
foreach ((array) $menu as $item) { echo $item, PHP_EOL; }
' "$PFV_CMS_ROOT/application/extra/quickmenu.php"
```

### 12.3 数据库结构

从 `application/database.php` 确认实际表前缀，然后在 phpMyAdmin 或只读数据库客户端执行检查。至少应存在：

```text
<前缀>pingfang_device_session

<前缀>vodops_lock
<前缀>vodops_scan
<前缀>vodops_issue
<前缀>vodops_fingerprint
<前缀>vodops_repair_log

<前缀>douban_config
<前缀>douban_vod_meta
<前缀>douban_task
<前缀>douban_log
<前缀>douban_review_candidate
<前缀>douban_scan
<前缀>douban_scan_issue
```

还要确认：

- `pingfang_device_session.login_check_hash` 存在；
- 五张 `vodops_*` 表和七张 `douban_*` 表为 InnoDB；
- `vodops_scan` 包含 `scope_json`、`execution_mode`、`lease_until`、`next_run_at`；
- `vodops_lock` 中存在 `scan_start` 和 `douban_enqueue` 两个固定互斥行；
- 原有 `douban_*` 记录数没有因发布被清零；
- 发布过程没有写入或删除实际 `<前缀>vod` 业务记录（当前常见表名为 `mac_vod`）。

### 12.4 缓存与权限

部署脚本默认清理以下四组目录的直接子项：

```text
runtime/cache
runtime/temp
application/admin/view/_cache
application/index/view/_cache
```

发布后检查 Web 用户仍可写：

```bash
runuser -u "$PFV_WEB_USER" -- test -w "$PFV_CMS_ROOT/runtime/cache"
runuser -u "$PFV_WEB_USER" -- test -w "$PFV_CMS_ROOT/runtime/temp"

find \
  "$PFV_CMS_ROOT/runtime/cache" \
  "$PFV_CMS_ROOT/runtime/temp" \
  -xdev ! -user "$PFV_WEB_USER" -print
```

如果缓存重建后再次出现 root 属主文件，先停止对应 root Worker/Cron，再修复明确的运行时目录；不要通过修改 MacCMS 核心或给全站 `0777` 掩盖属主问题。

### 12.5 服务器本机回环

仓库脚本已经执行一次回环检查，发布后再记录一次独立结果：

```bash
curl -k -sS -L --max-time 60 \
  --resolve 'www.ping2video.xyz:443:127.0.0.1' \
  -o /tmp/pfv-deploy-home.html \
  -w 'HTTP=%{http_code} bytes=%{size_download}\n' \
  'https://www.ping2video.xyz/'

grep -F '/template/pingfangvideo/' /tmp/pfv-deploy-home.html
```

`curl -k` 这里只用于本机虚拟主机诊断，不修改或认可证书状态。回环成功不能替代公网 DNS/CDN 检查；回环失败也不能被简单解释为发布失败或成功，必须继续核对 Nginx、PHP、响应内容和文件摘要。

## 13. 公网与浏览器验收

### 13.1 公网 HTTP

从服务器外部执行：

```bash
curl -k -sS -L --max-time 60 \
  -o /tmp/pfv-public-home.html \
  -w 'HTTP=%{http_code} bytes=%{size_download}\n' \
  'https://www.ping2video.xyz/'

grep -F '/template/pingfangvideo/' /tmp/pfv-public-home.html
```

如现场证书链或域名提示已知异常，可用 `-k` 继续完成本次内容验证，并把 TLS 状态单独记录为“需确认”；本手册不授权修改证书。

### 13.2 真实浏览器

至少逐项验证：

- 首页、分类、搜索、详情、播放、登录和用户中心；
- 桌面端与移动端样式、主题切换、主要静态资源无 404；
- 使用测试账号退出后重新登录，确认当前设备被登记；
- 打开“登录设备管理”，确认列表可见，并只用测试设备验证撤销流程；
- 分类页动态年份/地区/语言接口正常；
- 详情页线路检测接口不暴露播放地址；
- 超级管理员能从唯一的“视频数据中心”入口打开 VodOps；
- VodOps 的质量与豆瓣两个工作区都在同一后台页面壳层中；
- 旧 `admin/douban/index` 能按当前实现进入统一工作台；
- 未授权数据写入时，只查看页面、配置、历史和预览，不执行同步、校准、修复、回滚或批量任务。

浏览器验收时同时查看 Network 和 Console。PHP/Nginx 日志、浏览器控制台和业务功能应分别记录，不能用其中一项代替其他项。

## 14. 完全逐文件手工操作的边界

### 14.1 主题可以独立手工替换

主题归档只有一个 `pingfangvideo/` 顶层目录。完全手工替换时仍应遵守以下顺序：

1. 在非公开临时目录解压，不直接解压到在线目录；
2. 检查顶层目录和 `pingfangvideo/info.ini`；
3. 对照本地 SHA-256，确认上传文件未损坏；
4. 把在线目录复制为 `template/pingfangvideo.backup.<时间戳>`；
5. 把解压后的完整目录切换为 `template/pingfangvideo`，不要只覆盖部分文件；
6. 清理四组缓存；
7. 首次安装时在后台选择 `pingfangvideo` 和 `html`；
8. 完成服务器本机、公网和浏览器验收。

不要把 `preview/`、`server/`、`docker/`、`tests/`、`scripts/` 或仓库根目录整体上传到生产主题目录。

### 14.2 插件不能只复制一个目录

官方插件约定中，`addons/<插件名>/application` 会映射到 MacCMS 根目录的 `application/`，`install.sql` 还需要按实际数据库前缀执行。本仓库在此基础上还有配置保留、Hook、快捷菜单、旧 Douban 迁移和 Cron。

完全逐文件操作至少要完成以下映射：

| 包内来源 | 生产目标 |
| --- | --- |
| `pingfangdevice/` | `addons/pingfangdevice/` |
| `pingfangdevice/application/index/controller/Pingfangdevice.php` | `application/index/controller/Pingfangdevice.php` |
| `vodops/` | `addons/vodops/` |
| `vodops/application/admin/controller/Vodops.php` | `application/admin/controller/Vodops.php` |
| `vodops/application/admin/controller/Douban.php` | `application/admin/controller/Douban.php` |
| `vodops/application/admin/view_new/vodops/index.html` | `application/admin/view_new/vodops/index.html` |

此外还必须：

1. 按配置项 `name` 合并旧 `config.php` 的值，不能用旧文件整体覆盖新配置，也不能用默认配置覆盖签名密钥和业务设置；
2. 用 `application/database.php` 中的真实前缀替换 `__PREFIX__` 后执行两个 `install.sql`；
3. 为 `pingfangdevice` 登记唯一 `app_begin` Hook；
4. 对已有七张 `douban_*` 表先按 `vodops/schema.php` 检查 InnoDB 和必要字段；
5. 在同一份快照中备份旧 VodOps、旧 Douban、两个后台控制器、后台视图、旧前台 Douban 控制器、菜单、Hook 和 crontab；
6. 兼容检查通过后才停用 `addons/douban` 和 `application/index/controller/Douban.php`；
7. 把 VodOps/Douban 快捷入口归并为唯一 `视频数据中心,vodops/index`；
8. 从 `response_end` 中只移除 `vodops`，不能删除其他 Hook；
9. 验证 13 张插件表、必要列、引擎和两个互斥行；
10. 按第 10 节以 Web 用户安装唯一 Cron；
11. 清缓存并完成完整验收。

当前三个发布包是仓库生成的 `.tar.gz`，不是 MacCMS 当前本地插件安装入口要求的签名 ZIP。不要把它们直接上传到后台“离线安装”，也不要因为插件目录出现在后台列表中就认为 SQL、`application/` 载荷和迁移已经完成。

如果无法逐项完成以上动作，应停止逐文件发布，改用第 9 节的仓库脚本。

## 15. 回滚

回滚前先确定失败范围，不要默认全站一起回退。

### 15.1 主题回滚

列出远端主题备份，确认要恢复的目录名后执行：

```bash
cd /Users/bytedance/Documents/SquaredMedia
source scripts/deploy-ping2.env

ROLLBACK_SCOPE=theme \
ROLLBACK_BACKUP=pingfangvideo.backup.<时间戳> \
npm run rollback
```

脚本会把当前主题移为 `pingfangvideo.failed.<时间戳>`，恢复选定备份并清缓存。`ROLLBACK_BACKUP` 只能是远端 `template/` 下的单个目录名。

### 15.2 VodOps 回滚

先列出并核对 `addons/vodops.backup.*`：

```bash
ROLLBACK_SCOPE=vodops \
ROLLBACK_BACKUP=vodops.backup.<时间戳> \
npm run rollback
```

VodOps 回滚会恢复插件目录和应用控制器/视图，但不会反向修改数据库。显式回滚脚本也不会自动把快捷菜单、Hook 和 Cron 恢复到旧版本所需状态；回滚后必须结合备份中的 `.vodops-deploy-state` 手工复核这三项。

### 15.3 `pingfangdevice` 回滚

仓库当前没有 `pingfangdevice` 专用回滚命令。需要手工恢复本次记录的：

- `addons/pingfangdevice.backup.<时间戳>`；
- `application/index/controller/Pingfangdevice.php.backup.<时间戳>`；
- `application/extra/addons.php.backup.<时间戳>.<进程号>`。

恢复后检查 `app_begin` Hook、PHP 语法、设备页面和缓存。设备会话表及新增列不会被删除；是否回退数据必须作为独立数据库恢复操作另行确认。

### 15.4 部分发布失败

全量脚本不是跨文件系统和数据库的统一事务。可能出现：

- `pingfangdevice` 已更新，VodOps 失败；
- 两个插件已更新，主题替换失败；
- 文件和 SQL 已完成，但站点回环失败；
- 主题与插件成功，但 Web 用户 Cron 尚未安装。

发生上述情况时，先按终端输出和远端文件时间确认每个组件的真实状态，再决定继续、回滚或修复。不要直接重复全量命令，否则会再生成一组备份并掩盖第一次失败状态。

## 16. 常见问题

### 前台提示“模板不存在”

检查实际目录是否为 `template/pingfangvideo/html`，后台“网站模板”是否为 `pingfangvideo`，模板目录是否为 `html`，然后清缓存。

### 登录页或设备页 404

检查 `application/index/controller/Pingfangdevice.php` 是否来自本次包，以及 `application/extra/addons.php` 中 `app_begin` 是否包含 `pingfangdevice`。

### VodOps 菜单不存在或出现两个入口

检查 `application/extra/quickmenu.php` 是否只保留一个 `视频数据中心,vodops/index`，再清后台视图缓存。不要删除其他插件菜单。

### VodOps 后台页 500

依次检查 PHP 语法、两个后台控制器、`view_new/vodops/index.html`、数据库表引擎和必要字段。不要在未查日志前反复执行 `install.sql`。

### Worker 不推进

检查 Web 用户 crontab、PHP CLI 绝对路径、`flock`、日志权限、任务是否选择“后台 Worker”，以及 `runtime/log/vodops-worker.log`。`scheduled_scan_hours=0` 只关闭自动新建周期任务，不会阻止已有后台任务继续。

### 出现 `array_keys(false)` 或缓存写入失败

先查 `runtime/cache`、`runtime/temp`、锁文件和 Worker 日志的属主，确认是否由 root Cron 产生。停止错误用户的 Cron，修复明确的运行时目录属主，再清缓存验证；不要先修改 MacCMS 核心。

### 回环检查超时

分别核对 Nginx 虚拟主机、PHP-FPM、`--resolve` 的 Host/SNI、服务器本机网络和响应文件。随后再从公网独立验证。一次 `curl` 超时不能单独证明发布成功或失败。

## 17. 发布记录模板

每次手动发布复制以下模板，填写真实结果：

```markdown
# SquaredMedia 手动发布记录

- 时间：YYYY-MM-DD HH:mm（Asia/Shanghai）
- 操作人：
- 发布范围：theme / pingfangdevice / vodops
- Git 分支：
- Git 提交：
- 发布路径工作区是否干净：是 / 否（附说明）
- 目标 SSH：<脱敏后的 user@host:port>
- MacCMS 根目录：
- Web 用户：
- PHP CLI：
- PHP-FPM 版本：
- 数据库前缀：
- 数据库备份：
- 文件备份：
- root crontab 备份：
- Web 用户 crontab 备份：

## 归档 SHA-256

- pingfangvideo.tar.gz：
- pingfangdevice.tar.gz：
- vodops.tar.gz：

## 本地门禁

- npm test：
- npm run lint：
- npm run lint:template：
- npm run verify:compat：
- npm run verify:preview：
- npm run package：
- npm run verify:release：

## 远端结果

- pingfangdevice 备份目录：
- vodops 备份目录：
- pingfangvideo 备份目录：
- 数据库结构检查：
- Hook 检查：
- 快捷菜单检查：
- Cron 唯一性与运行用户：
- 缓存写权限：
- 本机回环：
- 公网 HTTP：
- 浏览器验收：
- PHP/Nginx/Worker 日志：

## 未验证项与回滚点

- 未验证：
- 主题回滚备份：
- VodOps 回滚备份：
- pingfangdevice 手工回滚文件：
- 是否需要后续观察：
```

## 18. 依据

- [开发、发布与数据运维](development-and-operations.md)
- [MacCMS 插件说明](addons.md)
- [主题与本地预览](theme-and-preview.md)
- [MacCMS 官方：使用模板](https://www.maccms.la/theme/using-a-theme)
- [MacCMS 官方：插件目录](https://www.maccms.la/plugin/plugin-dir)
- [MacCMS 官方源码：本地插件安装入口](https://github.com/magicblack/maccms10/blob/master/application/admin/controller/Addon.php)
- `scripts/package-theme.mjs`
- `scripts/verify-release.mjs`
- `scripts/deploy-theme.sh`
- `scripts/rollback-theme.sh`

本文描述的是当前仓库发布契约。若归档结构、远端应用载荷、数据库表、Hook、菜单、Cron 或回滚脚本发生变化，必须同步更新本文后再发布。
