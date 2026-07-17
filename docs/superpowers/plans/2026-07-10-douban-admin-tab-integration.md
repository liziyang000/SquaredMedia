# 豆瓣评分后台标签页集成实施计划

> **历史状态（2026-07-17）：** 本文保留首次实现步骤。当前后台控制器源码位于
> `addons/douban/application/admin/controller/Douban.php`，不再使用 `bridge/` 目录；
> 下方旧路径、断言和提交命令只用于追溯。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 让自定义菜单项 `豆瓣评分,admin/douban/index` 在 MacCMS 后台右侧标签页中打开完整豆瓣管理功能。

**架构：** 新增一个 `app\admin\controller\Douban` 桥接控制器，把后台模块请求委托给现有插件控制器。发布包携带该桥接文件，部署脚本将其备份后安装到 `application/admin/controller/Douban.php`，不修改 MacCMS 核心菜单代码。

**技术栈：** PHP 8.2、ThinkPHP/MacCMS 控制器与路由、Node.js 模板断言、Bash/SSH 部署。

---

## 文件职责

- 新建 `addons/douban/bridge/DoubanAdmin.php`：后台模块到现有豆瓣插件控制器的唯一桥接入口。
- 修改 `tests/template.test.mjs`：校验后台桥接文件、命名空间、构造函数和部署目标。
- 修改 `scripts/verify-release.mjs`：确保豆瓣发布包包含后台桥接文件。
- 修改 `scripts/deploy-theme.sh`：备份并安装后台桥接控制器。
- 修改 `README.md`：记录后台菜单配置和正式管理入口。

### 任务 1：增加后台控制器桥接

**文件：**
- 新建：`addons/douban/bridge/DoubanAdmin.php`
- 修改：`tests/template.test.mjs`

- [ ] **步骤 1：写入失败断言**

在 `requiredRootFiles` 中加入：

```js
"addons/douban/bridge/DoubanAdmin.php",
```

在现有 `doubanBridgeController` 断言后加入：

```js
const doubanAdminBridgeController = readDoubanAddonFile("bridge/DoubanAdmin.php");
assert.match(doubanAdminBridgeController, /namespace app\\admin\\controller/);
assert.match(doubanAdminBridgeController, /extends AddonIndex/);
assert.match(doubanAdminBridgeController, /__construct\(\?Request \$request = null\)/);
assert.match(doubanAdminBridgeController, /'addon' => 'douban'/);
assert.match(doubanAdminBridgeController, /'controller' => 'index'/);
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node tests/template.test.mjs
```

预期：失败，并提示 `addons/douban/bridge/DoubanAdmin.php should exist`。

- [ ] **步骤 3：实现最小后台桥接**

创建 `addons/douban/bridge/DoubanAdmin.php`：

```php
<?php

namespace app\admin\controller;

use addons\douban\controller\Index as AddonIndex;
use think\Request;

class Douban extends AddonIndex
{
    public function __construct(?Request $request = null)
    {
        $request = $request ?: Request::instance();
        $request->route([
            'addon' => 'douban',
            'controller' => 'index',
            'action' => $request->action() ?: 'index',
        ]);

        parent::__construct($request);
    }
}
```

- [ ] **步骤 4：验证桥接文件**

运行：

```bash
node tests/template.test.mjs
php -l addons/douban/bridge/DoubanAdmin.php
```

预期：Node 测试通过，PHP 输出 `No syntax errors detected`。

- [ ] **步骤 5：提交**

```bash
git add addons/douban/bridge/DoubanAdmin.php tests/template.test.mjs
git commit -m "feat: add douban admin controller bridge"
```

### 任务 2：接入发布包和部署流程

**文件：**
- 修改：`scripts/verify-release.mjs`
- 修改：`scripts/deploy-theme.sh`
- 修改：`tests/template.test.mjs`
- 修改：`README.md`

- [ ] **步骤 1：写入发布和部署失败断言**

在 `requiredDoubanAddonEntries` 中加入：

```js
"douban/bridge/DoubanAdmin.php",
```

在 `tests/template.test.mjs` 的部署断言中加入：

```js
assert.match(deployScript, /bridge\/DoubanAdmin\.php/);
assert.match(deployScript, /application\/admin\/controller\/Douban\.php/);
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
npm test
```

预期：失败，并指出部署脚本缺少后台桥接源文件或目标路径。

- [ ] **步骤 3：扩展部署安装逻辑**

将 `install_simple_addon()` 的局部变量补充为：

```bash
local addon_name remote_tmp maccms_root addon_dir backup tmp_dir bridge_controller_source bridge_controller_target admin_bridge_source admin_bridge_target gateway_source gateway_target target_backup
```

在豆瓣插件分支中增加后台桥接路径，并把它加入存在性检查、目录创建、备份与复制：

```bash
admin_bridge_source="$addon_dir/bridge/DoubanAdmin.php"
admin_bridge_target="$maccms_root/application/admin/controller/Douban.php"

if [[ ! -f "$bridge_controller_source" || ! -f "$admin_bridge_source" || ! -f "$gateway_source" ]]; then
  echo "Douban addon archive does not contain required bridge files" >&2
  exit 1
fi

mkdir -p \
  "$(dirname "$bridge_controller_target")" \
  "$(dirname "$admin_bridge_target")" \
  "$(dirname "$gateway_target")"

for target in "$bridge_controller_target" "$admin_bridge_target" "$gateway_target"
do
  if [[ -f "$target" ]]; then
    target_backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$target" "$target_backup"
  fi
done

cp -a "$bridge_controller_source" "$bridge_controller_target"
cp -a "$admin_bridge_source" "$admin_bridge_target"
cp -a "$gateway_source" "$gateway_target"
```

- [ ] **步骤 4：更新使用说明**

将 README 中豆瓣管理入口说明更新为：

````markdown
在 MacCMS 后台“自定义菜单配置”中加入：

```text
豆瓣评分,admin/douban/index
```

该菜单会在后台标签页打开 `/lbk-admin.php/admin/douban/index.html`。原
`/index.php/douban/index.html` 路由继续保留用于兼容。
````

- [ ] **步骤 5：验证发布包**

运行：

```bash
npm test
npm run package
npm run verify:release
tar -tzf dist/douban.tar.gz | grep 'douban/bridge/DoubanAdmin.php'
```

预期：所有命令成功，`tar` 输出 `douban/bridge/DoubanAdmin.php`。

- [ ] **步骤 6：提交**

```bash
git add README.md scripts/deploy-theme.sh scripts/verify-release.mjs tests/template.test.mjs
git commit -m "feat: deploy douban admin tab bridge"
```

### 任务 3：完整验证、部署和生产验收

**文件：**
- 验证：`addons/douban/bridge/DoubanAdmin.php`
- 验证：`dist/douban.tar.gz`
- 部署目标：`/www/wwwroot/ping2.my/application/admin/controller/Douban.php`

- [ ] **步骤 1：执行项目完整验证并部署**

运行：

```bash
source scripts/deploy-ping2.env
npm run deploy
```

预期输出同时包含：

```text
Douban data tests passed
Douban gateway tests passed
Douban matcher tests passed
Template lint passed for 79 files
Compatibility verification passed
Preview verification passed
Verified .../dist/douban.tar.gz
Installed douban addon under /www/wwwroot/ping2.my/addons/douban
```

- [ ] **步骤 2：验证未登录后台路由被拦截**

运行：

```bash
curl -fsS https://ping2.my/lbk-admin.php/admin/douban/index.html
```

预期：请求不会返回豆瓣配置表单，而是被 MacCMS 后台登录校验拦截或跳转到登录页。

- [ ] **步骤 3：创建短生命周期管理员会话**

通过服务器 CLI 初始化 MacCMS，并写入与真实登录一致的会话字段：

```php
$admin = \think\Db::name('admin')->where('admin_id', 1)->find();
$admin = is_object($admin) && method_exists($admin, 'toArray')
    ? $admin->toArray()
    : (array) $admin;
session('admin_auth', '1');
session('admin_info', $admin);
\think\Session::pause();
```

会话 ID 使用 `codexdoubanadmin` 加当前时间戳，并以 `www` 用户运行 PHP，确保 PHP-FPM 可以读取该会话。

- [ ] **步骤 4：通过真实后台 URL 验证完整页面和操作地址**

携带步骤 3 的 `PHPSESSID` 请求：

```bash
curl -fsS \
  -b "PHPSESSID=$sid" \
  -o /tmp/douban-admin-tab.html \
  https://ping2.my/lbk-admin.php/admin/douban/index.html

grep -qi '<!doctype html>' /tmp/douban-admin-tab.html
grep -q '<title>豆瓣数据</title>' /tmp/douban-admin-tab.html
grep -q '/lbk-admin.php/admin/douban/saveconfig.html' /tmp/douban-admin-tab.html
grep -q '/lbk-admin.php/admin/douban/enqueue.html' /tmp/douban-admin-tab.html
grep -q '/lbk-admin.php/admin/douban/run.html' /tmp/douban-admin-tab.html
! grep -q '请先使用管理员账号登录后台' /tmp/douban-admin-tab.html
```

预期：所有 `grep` 成功，最后一个反向检查也成功。

- [ ] **步骤 5：销毁临时会话并检查工作区**

使用相同会话 ID 初始化 ThinkPHP 后执行：

```php
\think\Session::destroy();
```

随后运行：

```bash
git status --short
```

预期：没有未提交文件。
