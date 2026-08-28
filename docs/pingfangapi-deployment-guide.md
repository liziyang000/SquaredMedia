# PingFang API 生产部署指南

最近更新：2026-08-28（本地部署流程；服务器状态仍需发布当天核验）

自动部署入口：`scripts/deploy-pingfangapi.sh`

入口最初由 `e5fe291` 引入；本指南还要求包含 `test:backend` 后端独立门禁和
`addons/pingfangapi/service/DeploymentCheck.php` 共享体检实现。

本文说明如何人工触发并验收 `pingfangapi` 生产发布。优化后，操作员只负责四个
关口：只读检查、数据库备份、输入一次发布确认、发布后验收；环境检查、范围判断、
测试门禁、打包、文件快照、上传、安装、缓存清理和回环 smoke 均由脚本完成。

本文是操作手册，不代表插件已经发布。文中记录的服务器状态会变化，发布当天必须
重新执行只读检查并保存证据。

> **代码要求**：目标发布源码必须同时包含 `deploy:api`、`test:backend` 和共享体检文件。
> 只有旧版 `deploy:api` 入口的分支仍会安装前端依赖，不能视为已包含本轮优化。

## 1. 发布范围

`npm run deploy:api` 自动选择以下两个范围之一：

| 范围      | 使用条件                                  | 会修改的内容                                                                  |
| --------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `backend` | API 未安装或 `pingfangdevice` 基线不兼容  | `pingfangdevice`、设备控制器、Hook、设备会话结构、`pingfangapi` 和 API 控制器 |
| `api`     | 设备文件、Hook、登记及数据库结构均兼容   | 仅 `pingfangapi` 插件和 API 应用控制器                                        |

两个范围都会按配置清理 MacCMS 缓存并执行有界站点/API smoke。

以下内容始终不在专用 API 命令范围内：

- `template/pingfangvideo` 主题；
- `vodops` 和视频主表数据；
- Next.js 站点及 `/www/wwwroot/squaredMediaOnline`；
- Nginx、Cloudflare、证书和防火墙；
- 独立播放器和联机游戏服务。

不要使用根级 `npm run deploy` 代替本指南命令。根级命令还会部署主题、其他插件和
联机游戏服务，会扩大变更范围。

## 2. 最短人工流程

正常发布只需要以下四步。

### 2.1 进入包含新入口的干净源码

先将本轮实现和测试纳入经过审查的发布分支，再进入该分支的干净 worktree。
下面路径仅为示例，必须改成实际发布源码位置，不要直接发布仍有未提交修改的优化工作区：

```bash
export PFAPI_SOURCE=/Users/bytedance/Documents/SquaredMedia
cd "$PFAPI_SOURCE"

git status --short
git branch --show-current
git rev-parse --short HEAD

test -x scripts/deploy-pingfangapi.sh
test -f addons/pingfangapi/service/DeploymentCheck.php
node -e '
  const scripts = require("./package.json").scripts;
  const ready = scripts["deploy:api"] === "bash scripts/deploy-pingfangapi.sh"
    && typeof scripts["test:backend"] === "string"
    && scripts["test:backend"].includes("npm run test:api");
  process.exit(ready ? 0 : 1);
'
```

预期：

- `git status --short` 没有输出；
- 分支和提交为本次已审查的发布版本；
- 源码同时包含专用部署入口、后端独立门禁和共享体检文件；
- 脚本和 `package.json` 入口检查通过。

如果已经合入其他分支，应使用那个分支的干净发布 worktree，并记录实际提交；
仅检查旧提交 `e5fe291` 是否存在不足以证明部署流程已升级。

### 2.2 执行只读检查

```bash
npm run deploy:api -- --check
```

该命令会自动读取 `scripts/deploy-ping2.env`，通过 SSH 检查目标 MacCMS 路径、API
安装状态、设备服务和 Hook 摘要、API 控制器配对状态及 `app_begin` 登记，再检查
PHP CLI 扩展、数据库连接、必要字段、部署用户目录权限和可用磁盘空间，然后打印：

```text
Pingfangapi deployment plan
  target: <user>@<host>:<template path>
  site: <scheme>://<host>
  scope: backend | api
  reason: <判定原因>
  check: <PHP CLI、数据库、目录权限及可用空间结果>
```

共享检查代码通过 SSH 标准输入执行，不在服务器落盘。`--check` 不执行 `npm ci`、
不打包、不上传归档、不创建目录，也不执行建表或改字段 SQL。数据库诊断不会打印
连接密码；只读取当前配置对应的数据库元数据。

- 缺少 `pdo_mysql`、`json`、`mbstring` 或 `session` 扩展、数据库连接失败、目录
  不可写或磁盘空间无法读取/耗尽时，检查以非零退出；正常发布也会在确认前停止。
- 设备表不存在，或已有表仅缺少 `login_check_hash` 时，自动选择 `backend`。
  只有正式发布完成备份、确认后，才会由已有安装 SQL 创建表或补该列。
- Ulog 缺少 `ulog_point`/`ulog_duration`，或已有设备表缺少其他必需列时直接停止。
  需要单独审查迁移方案；不能靠 `--backend` 修复。

目录检查针对 SSH/CLI 部署用户，不能证明 PHP-FPM 用户具有缓存写权限。磁盘结果
是当前可用 MiB，不是备份容量保证；仍需按实际归档、文件快照和备份大小预留空间。
数据库检查不替代后续应用 API、登录和播放验收。

截至 2026-08-25 的真实只读结果是：

```text
target: root@144.34.184.95:/www/wwwroot/squaredMedia/template
site: https://www.ping2video.xyz
scope: backend
reason: pingfangapi is not installed, pingfangdevice service differs from this release
```

发布当天必须以重新执行得到的结果为准。目标、路径或原因无法解释时停止，不要使用
`--yes` 或手工设置 `DEPLOY_SCOPE` 绕过检查。

### 2.3 完成数据库备份

只要检查结果是 `backend`，数据库完整备份就是正式发布的前置条件。

推荐使用宝塔现有流程：

1. 打开“数据库”。
2. 找到 `/www/wwwroot/squaredMedia/application/database.php` 对应的数据库。
3. 创建完整备份，不要只导出设备会话表。
4. 确认任务成功且文件不是 0 字节。
5. 记录数据库名、表前缀、时间、位置、大小和校验和。
6. 至少确认恢复入口能识别该备份；允许时下载一份到服务器外。

数据库备份不能放在公开站点目录，也不能把数据库密码或备份下载地址写入 Git 和
共享日志。

`api` 范围不修改数据库，但生产发布仍建议确认最近一次可恢复数据库备份。

### 2.4 正式部署并保存日志

```bash
export PFAPI_RELEASE_ROOT="$(mktemp -d /tmp/pingfangapi-release.XXXXXX)"
export PFAPI_DEPLOY_LOG="$PFAPI_RELEASE_ROOT/pingfangapi-deploy.log"

set -o pipefail
npm run deploy:api 2>&1 | tee "$PFAPI_DEPLOY_LOG"
deploy_status=${PIPESTATUS[0]}

test "$deploy_status" -eq 0
```

脚本打印计划后会要求输入：

```text
deploy
```

只有已经核对目标、完成备份并获得发布授权时才输入。交互终端不可用时脚本会拒绝
继续；`--yes` 只允许用于已经审批的自动化发布，不能用来代替备份和范围确认。

首次安装通常选择 `backend`，已有安装必须以本次检查为准。以下是 `backend` 成功结束信息示例：

```text
Deployed pingfangdevice and pingfangapi to root@144.34.184.95 without changing the theme or vodops
Pingfangapi deployment completed with scope backend.
```

只看到测试通过、文件上传或 `Installed and verified` 不能代表整个发布成功。

## 3. 脚本自动完成什么

操作员不再需要手工重复以下步骤。

### 3.1 无需安装前端依赖

本地只需仓库支持的 Node.js/npm、PHP CLI、Git、tar 和 SSH。入口检查这些命令是否
可用，不再检查或安装 ESLint、Prettier、Artplayer、Next，也不要求 `node_modules`。

不需要先执行 `npm ci`；正式发布不会为了 API 安装前端依赖或升级锁文件。
服务器端仍需可运行当前插件的 PHP CLI、`pdo_mysql`、`json`、`mbstring`、`session`
及已有 MacCMS；体检不会安装扩展或修改 PHP 配置。

`--check` 仍在组包前退出，不会触发后端测试、依赖安装或远端写入。

### 3.2 自动执行发布门禁

首次安装和后续 API 更新都运行独立后端门禁，不再要求先执行一次前端完整门禁：

```bash
npm run test:backend
# 以下 scope 由入口自动判断；api 只组包 API，backend 另含设备插件。
DEPLOY_SCOPE=api node scripts/package-theme.mjs
DEPLOY_SCOPE=api node scripts/verify-release.mjs
```

这些步骤由入口执行，不需要操作员逐条重复。`test:backend` 包括生产 API、控制器、
设备会话、设备控制器、游戏票据、线路状态及部署/回滚回归；测试使用本地替身，不连接
生产服务。包校验检查归档结构及设备/API PHP 语法，不会组包主题、播放器或游戏服务。

后端源码、脚本、测试、包配置和工具链会计算内容指纹；指纹不可用或验证期间输入变化，
会在上传前停止。每次都重新执行后端门禁，不再依赖 `.cache/deploy-gates/v1/`。
完整主题发布仍有自己的完整门禁，Next 的发布流程和构建缓存不变。

本地 `dist/` 仍是按 scope 重建的临时产物目录，不要在其中保存数据库备份或唯一副本。

### 3.3 自动执行远端事务

底层 `scripts/deploy-theme.sh` 会：

1. 只上传当前范围需要的受控归档；
2. 在替换前验证归档和 PHP，并用归档中的同一体检实现复查环境、权限和数据库；
3. 创建本次事务的远端文件快照；
4. `backend` 时更新 `pingfangdevice`、保留配置、复制控制器、登记 Hook 并幂等执行
   `install.sql`；
5. 安装 `pingfangapi` 及应用控制器；
6. 清理配置允许的 MacCMS 缓存；
7. 通过服务器回环执行站点和 API smoke；
8. 普通失败时自动恢复本次范围的文件快照。

入口和底层预检共用 `DeploymentCheck.php`，避免两套数据库规则漂移。真正写文件
前仍会再次校验服务器状态；此时不会把已组好的 API-only 包自动升级为 backend。

### 3.4 自动备份与人工备份的区别

- 部署事务开始后，脚本会创建临时文件快照；事务失败时用于自动恢复。
- 更新已有插件或控制器时，安装逻辑还会保存带时间戳的组件备份。
- 成功提交后，临时事务快照会被清理。
- 设备 SQL 的增量变化不会由文件回滚自动撤销。
- 因此 `backend` 发布前的数据库完整备份仍必须由操作员完成。

若希望保留一个独立于站点目录的统一文件包，可在发布前额外执行以下可选步骤。
先登录服务器并严格核对根目录：

```bash
export PFAPI_CMS_ROOT=/www/wwwroot/squaredMedia
export PFAPI_BACKUP_ID="$(date -u +%Y%m%dT%H%M%SZ)"
export PFAPI_BACKUP_ROOT=/www/backup/squaredmedia-pingfangapi
export PFAPI_BACKUP_FILE="$PFAPI_BACKUP_ROOT/$PFAPI_BACKUP_ID.tar.gz"

test "$PFAPI_CMS_ROOT" = /www/wwwroot/squaredMedia
test -d "$PFAPI_CMS_ROOT/addons/pingfangdevice"
install -d -m 0700 "$PFAPI_BACKUP_ROOT"

cd "$PFAPI_CMS_ROOT"
backup_items=(
  addons/pingfangdevice
  application/index/controller/Pingfangdevice.php
  application/extra/addons.php
)

test ! -e addons/pingfangapi || backup_items+=(addons/pingfangapi)
test ! -e application/index/controller/Pingfangapi.php || \
  backup_items+=(application/index/controller/Pingfangapi.php)

tar -czf "$PFAPI_BACKUP_FILE" "${backup_items[@]}"
sha256sum "$PFAPI_BACKUP_FILE" > "$PFAPI_BACKUP_FILE.sha256"
test -s "$PFAPI_BACKUP_FILE"
```

该文件包不能代替数据库备份。把备份 ID、路径和摘要写入发布记录。

## 4. 当前服务器基线

2026-08-25 的只读快照如下，仅供解释当前自动判定：

| 检查项           | 当时结果                                     |
| ---------------- | -------------------------------------------- |
| SSH              | `root@144.34.184.95:814` 可连接              |
| MacCMS 根目录    | `/www/wwwroot/squaredMedia`                  |
| PHP CLI          | `8.2.33`                                     |
| `pingfangapi`    | 插件目录和应用控制器均不存在                 |
| `pingfangdevice` | 已存在，`app_begin` 已启用                   |
| 设备表           | 11 个必需字段已存在                          |
| Ulog             | `ulog_point`、`ulog_duration` 已存在         |
| `www.ping2.my`   | 当时 API 路由仍为 404，Next release 尚未建立 |

本地和远端 `DeviceSession.php` 摘要不同：

```text
本地：62f8eb87ef2a9e77abcdd2d5ca4b50cd9b1f7b5f89e6b1eb090de1f10885bb79
远端：9c93b5fd995076093f2983d3201b327e7a27e51f2861e987008285791f88e01b
```

因此当前首次发布必须由自动入口选择 `backend`。不要强行改为 API-only。

服务器 PHP CLI 还会提示：

```text
PHP Warning: Module "mbstring" is already loaded
```

这是现有 PHP CLI 扩展重复加载告警。它不等于部署失败；仍应以命令退出码和最终完成
行判断结果。该配置应作为独立运维项修复，不要在 API 发布过程中顺手修改 PHP 配置。

## 5. 发布前停止条件

出现以下任一情况时停止发布：

- 发布源码不包含 `scripts/deploy-pingfangapi.sh` 或 `deploy:api`；
- `git status --short` 出现无法解释的发布相关修改；
- `--check` 无法连接 SSH 或不能确定安全范围；
- 目标不是 `/www/wwwroot/squaredMedia/template`；
- 自动结果为 `backend`，但数据库备份尚未完成；
- Ulog 缺少 `ulog_point` 或 `ulog_duration`；
- 已有设备表缺少安装 SQL 无法补齐的必需列；
- 远端 API 插件和应用控制器处于无法解释的部分安装状态；
- 主机指纹变化但没有从可信控制台核对；
- 发布授权、维护窗口或回滚负责人不明确。

`pingfangdevice/install.sql` 不会补齐 Ulog 的两个进度字段。如果体检报告它们缺失，
必须先制定单独数据库迁移方案，反复执行 `--backend` 不能解决。

## 6. 发布后验收

### 6.1 检查远端文件和 PHP

登录服务器后执行：

```bash
export PFAPI_CMS_ROOT=/www/wwwroot/squaredMedia

test -d "$PFAPI_CMS_ROOT/addons/pingfangdevice"
test -d "$PFAPI_CMS_ROOT/addons/pingfangapi"
test -f "$PFAPI_CMS_ROOT/application/index/controller/Pingfangdevice.php"
test -f "$PFAPI_CMS_ROOT/application/index/controller/Pingfangapi.php"

cmp -s \
  "$PFAPI_CMS_ROOT/addons/pingfangapi/application/index/controller/Pingfangapi.php" \
  "$PFAPI_CMS_ROOT/application/index/controller/Pingfangapi.php"

php -l "$PFAPI_CMS_ROOT/addons/pingfangdevice/service/DeviceSession.php"
php -l "$PFAPI_CMS_ROOT/application/index/controller/Pingfangdevice.php"
php -l "$PFAPI_CMS_ROOT/application/index/controller/Pingfangapi.php"
```

### 6.2 检查 Hook 和数据库结构

下面的 PHP 只读取配置和 `information_schema`，不会输出数据库密码：

```bash
PFAPI_CMS_ROOT="$PFAPI_CMS_ROOT" php <<'PHP'
<?php
$root = rtrim((string) getenv('PFAPI_CMS_ROOT'), '/');
$addons = include $root . '/application/extra/addons.php';
$hooks = is_array($addons) ? ($addons['hooks']['app_begin'] ?? []) : [];
if (!is_array($hooks) || !in_array('pingfangdevice', $hooks, true)) {
    fwrite(STDERR, "pingfangdevice app_begin hook is missing\n");
    exit(1);
}

$db = include $root . '/application/database.php';
$prefix = isset($db['prefix']) ? (string) $db['prefix'] : '';
$dsn = !empty($db['dsn'])
    ? $db['dsn']
    : sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $db['hostname'] ?? '127.0.0.1',
        $db['hostport'] ?? '3306',
        $db['database'] ?? '',
        $db['charset'] ?? 'utf8'
    );
$pdo = new PDO($dsn, $db['username'] ?? '', $db['password'] ?? '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

$required = [
    $prefix . 'ulog' => ['ulog_duration', 'ulog_point'],
    $prefix . 'pingfang_device_session' => [
        'device_label', 'ip_address', 'last_seen_time', 'login_check_hash',
        'login_time', 'revoked_reason', 'revoked_time', 'session_id',
        'token_hash', 'user_agent', 'user_id',
    ],
];

foreach ($required as $table => $columns) {
    $placeholders = implode(',', array_fill(0, count($columns), '?'));
    $statement = $pdo->prepare(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS ' .
        'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ' .
        'AND COLUMN_NAME IN (' . $placeholders . ')'
    );
    $statement->execute(array_merge([$table], $columns));
    $actual = $statement->fetchAll(PDO::FETCH_COLUMN);
    sort($actual);
    sort($columns);
    if ($actual !== $columns) {
        fwrite(STDERR, $table . ": incompatible\n");
        exit(1);
    }
    echo $table . ": OK\n";
}

echo "pingfangdevice app_begin hook: OK\n";
PHP
```

### 6.3 验证 MacCMS 源站 API

部署脚本已经在服务器本机执行回环 smoke；还要从本机或独立网络确认公网返回 JSON：

```bash
curl -k -sS \
  --connect-timeout 5 \
  --max-time 15 \
  -H 'Accept: application/json' \
  'https://www.ping2video.xyz/index.php/pingfangapi/index?action=home_v2&compact=1' \
  | php -r '
    $payload = json_decode(stream_get_contents(STDIN), true);
    if (!is_array($payload) || !array_key_exists("code", $payload)) {
        fwrite(STDERR, "Invalid pingfangapi JSON envelope\n");
        exit(1);
    }
    printf("code=%s msg=%s\n", $payload["code"], $payload["msg"] ?? "");
  '
```

这里的 `-k` 只用于当前已知 TLS 域名/链告警条件下的功能核验，不代表证书验收通过，
也不授权在本次任务中修改证书。

再检查两个只读接口：

```bash
for query in \
  'action=navigation' \
  'action=content&compact=1&scope=library&sort=latest&page=1&page_size=24&include_facets=1'
do
  curl -k -sS --connect-timeout 5 --max-time 15 \
    -H 'Accept: application/json' \
    "https://www.ping2video.xyz/index.php/pingfangapi/index?$query"
done
```

精确的地区策略 403 只能证明路由和策略生效，不能替代允许地区的业务验收。

### 6.4 验证 `www.ping2.my` 联动

`pingfangapi` 安装在 MacCMS 根 `/www/wwwroot/squaredMedia`；Next 发布根
`/www/wwwroot/squaredMediaOnline` 不接收插件文件。完成 Next/Nginx 联动后执行：

```bash
curl -k -sS \
  --connect-timeout 5 \
  --max-time 15 \
  -H 'Accept: application/json' \
  'https://www.ping2.my/index.php/pingfangapi/index?action=home_v2&compact=1'
```

如果 MacCMS 源站正常，而 `www.ping2.my` 返回 404，应检查该域名的 Nginx include、
PHP location 和站点根，不要重复部署 API。该联动在 2026-08-25 快照中仍为 `需确认`。

### 6.5 真实账号和浏览器验收

使用专用测试账号和可回收数据，至少验证：

1. 游客首页、目录、搜索和详情没有 PHP 错误。
2. `session`、验证码和登录符合后台配置。
3. 收藏、历史和设备列表只属于当前账号。
4. 撤销其他设备成功；撤销失败时返回受控错误，不会先删除 Cookie。
5. 退出后服务端会话和浏览器状态都被清理。
6. 匿名、普通会员、VIP、付费、试看、密码和版权影片分别验收。
7. `playback` 只返回同源 `pingfangapi/stream` 描述符，JSON 不暴露媒体源。
8. 评论、留言/报错、顶踩和评分遵守审核、黑名单和限频配置。
9. 桌面和移动端各检查一次。

不要把真实密码、Cookie、CSRF、设备 Token 或媒体 URL 写入发布记录。

## 7. 失败与回滚

### 7.1 部署过程中失败

| 现象               | 处理                                                      |
| ------------------ | --------------------------------------------------------- |
| 本地依赖或门禁失败 | 服务器尚未修改；保存原始错误，修复后重新从 `--check` 开始 |
| 远端预检失败       | 通常尚未替换文件；根据原始 PHP、数据库或路径错误处理      |
| 替换后普通非零退出 | 脚本应自动恢复本次范围的文件快照；随后只读确认现场        |
| SSH 返回 255       | 远端状态未知；先检查文件、临时归档和 API，不要盲目重跑    |
| 脚本返回 95        | 自动恢复失败；保留日志和临时路径，立即进入人工恢复        |

检查日志中是否出现：

```text
Deployment failed; restoring the pre-deploy filesystem snapshot.
```

即使文件自动恢复，数据库的幂等增量也不会自动反向删除，所以不能丢失发布前数据库备份。

### 7.2 成功的 `backend` 发布需要回退

首次安装前 API 不存在，因此成功的 `backend` 发布不会输出 API-only 成对备份 ID。
回退时：

1. 停止继续发布和相关管理写入。
2. 先备份当前故障现场，不要覆盖发布前备份。
3. 核对脚本保留的组件备份和可选统一文件包。
4. 成对处理 API 插件与应用控制器；首次安装时二者应同时移走。
5. 恢复 `pingfangdevice`、设备控制器和 Hook 配置。
6. 清理缓存并重新检查 PHP、Hook、数据库和 API。
7. 只有确认 SQL 产生了需要撤销的结构变化，并评估发布后新增会话数据后，才恢复
   数据库；不要直接删除表或列。

### 7.3 成功的 `api` 发布需要回退

API-only 成功后终端会输出：

```text
API_ROLLBACK_BACKUP=<id> npm run rollback:api
```

立即把 ID 写入发布记录。回滚时执行：

```bash
source scripts/deploy-ping2.env
API_ROLLBACK_BACKUP=<id> npm run rollback:api
```

该命令只回滚 API 插件和应用控制器，不修改 `pingfangdevice`、Hook、数据库、主题或
Next。不要按目录时间猜测备份 ID。

## 8. 后续更新仍使用同一流程

以后不需要人工判断首次安装还是 API-only，始终先执行：

```bash
npm run deploy:api -- --check
npm run deploy:api
```

设备文件和数据库基线兼容时自动选择 `api`；缺设备表或可支持的增量列时，体检已经
会选择 `backend`。如果需要主动刷新兼容的设备依赖，完成数据库备份后可使用：

```bash
npm run deploy:api -- --backend
```

`--backend` 只用于明确刷新设备依赖基线，不能绕过体检，也不能解决 Ulog 字段缺失、
不受支持的设备字段缺失、数据库连接失败、部分安装状态或未知文件异常。底层复检
发现服务器与先前体检不一致时，停止并重新运行 `--check`，不要盲目重试安装。

已经审批的非交互任务可以执行：

```bash
npm run deploy:api -- --yes
```

使用 `--yes` 前仍必须单独保存 `--check` 结果和数据库备份证据。

## 9. 常见问题

### 9.1 找不到 `deploy:api`

当前发布源码尚未包含 `e5fe291` 或等价实现。不要退回旧的复杂命令临时发布；先把
部署入口和测试作为一组审查、合入目标分支，再重新创建干净发布 worktree。

### 9.2 提示设备服务不兼容

默认入口会把摘要不一致自动判定为 `backend`。确认数据库已备份后按普通流程继续，
不要伪造摘要或强制使用 API-only。

### 9.3 专用 API 部署仍提示 `artplayer` 或 Next 依赖缺失

先检查是否进入了旧版源码，或误用了根级 `npm run deploy` / `npm run package`。
执行 2.1 的入口检查，确认存在 `test:backend`，再使用 `npm run deploy:api`。
新流程只需要本地基础命令，不要求安装前端依赖；不要通过跳过测试或归档校验解决。

### 9.4 出现 `mbstring is already loaded`

这是服务器 PHP CLI 重复加载扩展的既有告警。若命令最终退出码为 0 且出现完整成功
行，可以单独记录为运维问题；不要仅凭这条警告判定发布失败或顺手修改 PHP 配置。

### 9.5 MacCMS 源站 API 返回 404

依次检查 API 插件、应用控制器、二者是否一致、PHP 语法、MacCMS 缓存和 Nginx 的
`/index.php` PHP location。

### 9.6 `www.ping2.my` 返回 404，但源站正常

这是 Next/Nginx 联动问题。按
[开发、发布与数据运维](development-and-operations.md)检查 `www.ping2.my` vhost、
PHP location 和 `/www/wwwroot/squaredMediaOnline/current`，不要再次覆盖插件。

### 9.7 返回 403 `当前地区不可访问`

检查客户端出口 IP、代理头和 GeoIP 服务。精确 403 envelope 可以作为策略链 smoke，
但不能代表允许地区的业务验收通过。

### 9.8 缓存清理后出现 500 或 `array_keys(false)`

先检查 `runtime/cache`、`runtime/temp` 和视图缓存的属主与 Web 用户写权限，再检查
PHP-FPM 日志，不要先修改 MacCMS 核心。

## 10. 发布记录模板

```md
# pingfangapi 发布记录

- 日期：
- 操作人：
- 发布授权：
- Git 分支：
- Git 提交：
- 发布 worktree：
- SSH 目标：
- MacCMS 根目录：
- 站点 Host：

## 只读检查

- `npm run deploy:api -- --check` 退出码：
- 自动范围：backend / api
- 判定原因：
- 目标路径复核：

## 备份

- 数据库备份位置、时间、大小、校验和：
- 可选文件包 ID、路径和 SHA-256：

## 自动门禁与部署

- 部署命令：
- 只读体检结果、CLI 身份与可用磁盘空间：
- 部署退出码：
- 完整日志位置：
- 最终成功行：
- API-only 成对备份 ID：

## 验收

- PHP 语法：
- Hook：
- 数据库结构：
- 缓存写权限：
- MacCMS 源站 API：
- `www.ping2.my`：已验证 / 未部署 / 需确认
- 浏览器账号和播放权限矩阵：

## 回滚

- backend 数据库备份：
- backend 文件备份：
- API-only 精确回滚命令：
- 未验证项：
```

## 11. 相关文件

- `scripts/deploy-pingfangapi.sh`
- [`DeploymentCheck.php`](../addons/pingfangapi/service/DeploymentCheck.php)
- [`scripts/deploy-theme.sh`](../scripts/deploy-theme.sh)
- [`scripts/rollback-api.sh`](../scripts/rollback-api.sh)
- [`scripts/deploy-ping2.env`](../scripts/deploy-ping2.env)
- [PingFang API 详细说明](pingfangapi.md)
- [开发、发布与数据运维](development-and-operations.md)
- [主题与插件手动部署手册](manual-theme-addon-deployment.md)
