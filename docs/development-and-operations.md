# 开发、发布与数据运维

本文说明仓库内工程脚本的职责和操作边界。主题模板与插件本身的设计另见对应模块文档；这里以 `package.json`、`scripts/`、`.github/workflows/ci.yml` 和现有测试为事实来源。

## 环境要求

- Node.js：Next.js 16 最低要求 Node.js 20.9；本仓库与 CI 继续固定使用 Node.js 22.22.0。先用 `npm ci` 安装根项目和 `apps/web` workspace 的锁定依赖。
- PHP：目标版本为 PHP 8.4。完整测试会调用 PHP CLI；海报修复工具还要求 `curl`、`mbstring`、`pdo_mysql` 扩展。
- 打包：需要系统 `tar`，且当前脚本使用 `--no-xattrs`。
- 部署：本机需要 `bash`、`ssh`、`scp`；使用密码认证时还需要 `sshpass`，日常发布优先使用 SSH 密钥。
- 远端：MacCMS 发布需要 `bash`、`tar`、PHP CLI 和 PDO MySQL；Next.js staging 另需 Node.js 22.22 以上、systemd、Nginx 和 `curl`。production build 与 Linux x64 原生依赖组包在本机完成，远端不再执行 `npm ci` 或 build。发布账号当前为受控 root SSH，Next 运行进程降权为 `www`。

## 开发验证

常用命令由 `package.json` 统一暴露：

| 命令                     | 作用                                                                                   | 是否写入仓库生成目录                       |
| ------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `npm ci`                 | 按 `package-lock.json` 安装前端检查工具                                                | 只写入已忽略的 `node_modules/`             |
| `npm run dev:local`      | 在 `127.0.0.1:8084` 启动 PHP 预览后端，并以 `127.0.0.1:5173` 作为 Next.js 本地前台入口 | 启动两个本地进程；退出命令后停止           |
| `npm run dev:web`        | 启动 `apps/web` 的 Next.js 开发服务器                                                  | 写入已忽略的 `apps/web/.next/`             |
| `npm run lint`           | 检查主题 JavaScript/CSS、React TypeScript/Oxc 和 Prettier 格式                         | 否                                         |
| `npm run format`         | 用 Prettier 格式化主题脚本、React 工程与配置文件                                       | 是，直接修改被覆盖的源码与配置             |
| `npm test`               | 运行模板契约、React/API、设备会话与控制器、海报修复测试                                | 否；测试只写入临时或忽略目录               |
| `npm run typecheck:web`  | 生成 App Router 类型并用严格 TypeScript 配置检查 Next.js 工程                          | 写入已忽略的 `.next/types/`                |
| `npm run build:web`      | 类型检查并生成 standalone Next.js `.next` 产物                                         | 是，重建已忽略的 `apps/web/.next/`         |
| `npm run test:e2e`       | 用 Playwright 验证本地 Next.js/PHP 路由、状态码、账号流程和响应式边界                  | 失败证据写入已忽略的 `output/playwright/`  |
| `npm run deploy:web`     | 验证、构建或复用 Linux standalone 归档并原子切换 `react.ping2.my`                      | 写入本地缓存、远端版本、systemd 与 Nginx   |
| `npm run rollback:web`   | 将 staging 切回 `previous` 或指定 Next.js release                                      | 修改远端 `current` 与对应运行配置          |
| `npm run lint:template`  | 检查模板 include、标签平衡、资源路径和生产模板中的开发环境引用                         | 否                                         |
| `npm run verify:compat`  | 检查 MacCMS 目录、标准路由页面和不安全链接模式                                         | 否                                         |
| `npm run verify:preview` | 用当前 PHP CLI 渲染本地预览的主要路由并核对完整 HTML                                   | 否                                         |
| `npm run package`        | 默认重建三个发布包；`DEPLOY_SCOPE=backend/api` 时只生成对应后端包                      | 是，重建整个 `dist/`                       |
| `npm run verify:release` | 默认检查三个归档；`DEPLOY_SCOPE=backend/api` 时只检查本次 scope 的归档                 | 只读 `dist/`                               |

提交主题相关修改前，至少执行：

```bash
npm ci
npm run lint
npm test
npm run typecheck:web
npx playwright install chromium
npm run test:e2e
npm run build:web
npm run lint:template
npm run verify:compat
npm run verify:preview
```

准备发布时再执行完整发布门禁：

```bash
npm ci
npm run lint
npm test
npm run typecheck:web
npx playwright install chromium
npm run test:e2e
npm run build:web
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

各层验证的关注点不同，不能互相替代：

- `tests/template.test.mjs` 是仓库级静态与预览契约测试，也会约束发布脚本、CI 配置和数据库维护文档中的关键入口。
- `npm run lint` 用 ESLint 检查主题浏览器脚本、用 Oxc 检查 React TypeScript、用 Stylelint 检查主题 CSS，并用 Prettier 验证源码与配置格式；压缩第三方库不在检查范围内。
- `npm run typecheck:web` 和 `npm run build:web` 分别验证 App Router 类型边界及 standalone Next.js 生产构建；开发服务器或单元测试通过不能替代生产构建。E2E 应在 production build 之前运行，避免 `next dev` 扫描刚生成的 standalone 树。
- `npm run dev:local` 让浏览器只访问 `http://127.0.0.1:5173/`；`next.config.ts` 在 development 中将 `/react-api.php` 重写到 `server/react-api.php`，并把 `/index.php`、`/api.php`、`/template`、`/static`、`/upload` 和 `/preview` 代理到端口 `8084` 的 PHP 预览后端，因此本地请求保持同源。`src/proxy.ts` 依据 `src/migrationRoutes.ts` 对已知旧公开 URL 返回单跳 `301`，对明确退场地址返回 HTTP `410`；生产 Nginx 和服务器部署仍需单独设计。
- `scripts/lint-template.mjs` 面向源模板结构，阻止本地预览、`localhost`、死链接或错误资源路径进入生产主题。
- `scripts/verify-compat.mjs` 面向 MacCMS 页面和目录兼容面。
- `tests/react-api.test.php` 验证本地 React API 的服务端分页、筛选、独立详情、字段白名单、媒体 URL 隔离、HTTP 状态、JSON Content-Type、有限数值与字段边界、session/CSRF、既有会员登录、注册/找回 action 退场、收藏/记录批量操作、设备及绑定 `mid`/内容 ID 的互动写入。
- `tests/pingfang-api.test.php` 验证生产 `pingfangapi` 的兼容 `home`、分区 `home_v2`、轻量 `navigation`、分页参数归一化、详情 action、action/method 白名单、同源与 CSRF、请求体上限、登录字段隔离、账户鉴权、原生播放器 iframe、Ulog 写入契约和列表媒体地址隔离；它使用服务替身，不连接真实 MacCMS 数据库。
- `tests/pingfang-api-controller.test.php` 直接加载生产应用控制器，验证站点关闭、地区限制和未知 action 都保持 JSON envelope；它仍不能代替真实 MacCMS autoload、数据库和 Cookie 验收。
- `apps/web/e2e/react-migration.spec.ts` 验证本地 `301`/`410`、干净 URL 直达刷新、匿名历史、登录账号写操作以及 320、390、1100、1180、1181、1440 像素边界；CI 在执行前安装 Chromium。它不能证明生产 Nginx、真实 MacCMS Cookie/权限或真实播放器线路可用。
- `scripts/verify-preview.mjs` 从仓库根目录调用 PHP CLI，验证旧 PHP 预览仍能渲染主要路由；它不连接真实 MacCMS 数据库。
- `scripts/verify-release.mjs` 只验证已经生成的归档，不会自动执行打包。

本地静态预览必须通过 HTTP 服务打开，因为 `preview/index.html` 使用绝对路径请求 `/preview/data.json`。直接以 `file://` 打开不能视为有效验证。Docker 通过 `PINGFANG_PREVIEW_DATA=/var/www/html/preview/data.json` 对齐容器挂载路径；不使用 Docker 时，`server/lib/data.php` 默认从仓库根目录读取相同样例数据。PHP 路由验证以 `npm run verify:preview` 为准。

## 打包与 `dist/`

`scripts/package-theme.mjs` 每次运行都会先递归删除整个 `dist/`。默认生成全部归档；`DEPLOY_SCOPE=backend` 只生成两个插件归档，`DEPLOY_SCOPE=api` 只生成 API 归档：

```text
dist/
├── pingfangvideo/
├── pingfangvideo.tar.gz
├── pingfangdevice/
├── pingfangdevice.tar.gz
├── pingfangapi/
└── pingfangapi.tar.gz
```

打包过程有以下固定行为：

- `pingfangvideo` 来自 `template/pingfangvideo/`，两个插件包分别来自 `addons/pingfangdevice/` 和 `addons/pingfangapi/`。
- 两个插件的 `application/` 都保留 MacCMS 标准插件应用载荷结构；SSH 部署会把兼容控制器复制到对应 CMS 应用目录。
- 任意层级以 `.` 开头的文件或目录不会进入包。
- 打包只接受普通文件和目录，发现符号链接、设备节点等其他类型会直接失败；发布校验还会拒绝 API 归档中的额外顶层路径或非普通条目，并逐个执行 PHP 语法检查。
- 主题 HTML 中的 `__PINGFANG_STYLE_VERSION__`、`__PINGFANG_APP_VERSION__` 和 `__PINGFANG_PROMPT_VERSION__` 会分别替换为对应文件的 12 位内容摘要，避免单个资源变化使其他资源缓存失效。新增需要内容版本的资源时，应同步维护打包映射和发布验证。
- 包内目录权限统一为 `0755`，文件权限统一为 `0644`；tar 包禁用 macOS 扩展属性元数据。
- 当前自动化只打包主题、`pingfangdevice` 和 `pingfangapi`，不会自动打包或部署其他 `addons/` 子目录。

根目录 `dist/` 已被 `.gitignore` 忽略，是可重复生成的主题/插件发布产物，不是源码。不要把人工报告、数据库备份或唯一副本放入其中，否则下次 `npm run package` 会直接删除。

`npm run build:web` 另行生成 `apps/web/.next/standalone/`。本项目没有配置静态导出：任意视频动态路由、Cookie 会话和 Proxy 均要求 Next.js runtime。该目录被忽略，也不会混入 `npm run package` 的 MacCMS 归档。`deploy-next-web.sh` 在本机持有互斥锁完成 production build，再用独立 lockfile 安装 Linux x64/glibc 版 Sharp 依赖并验证 ELF 类型；归档按构建输入指纹缓存在 `.cache/next-deploy/v1/`。相同输入的后续发布仍重新执行完整本地门禁和缓存归档校验，但跳过 production build、第二次 Linux 依赖安装与组包。缓存命中会先验签、复制，再对复制品重新计算摘要；缓存未命中时先在独占临时目录生成完整 entry，验证后才原子改名发布。设置 `NEXT_DEPLOY_FORCE_REBUILD=1` 可强制重建。

`output/playwright/` 已被 `.gitignore` 忽略，用于可重复生成的浏览器报告、截图和跟踪；它不是发布产物。`output/` 下的其他路径仍没有正式所有者，不应保存长期资料或被发布自动化依赖。

## 部署

### Next.js staging

Next.js 与 MacCMS 主题/addon 使用两条独立发布链。`npm run deploy:web` 的目标被脚本锁定为：

```text
域名：react.ping2.my
发布根：/www/wwwroot/react_squared_media
Node：127.0.0.1:3100
服务：squaredmedia-next.service
Nginx include：/www/server/panel/vhost/nginx/extension/react.ping2.my/react-spa.conf
```

服务器只需安装 Node.js 22.22 以上，不再要求在 1 GiB staging 主机执行 npm install 或 production build。不能直接上传未经脚本替换和验证原生依赖的 macOS `.next`。连接参数继续复用 `scripts/deploy-ping2.env`，其中的 `DEPLOY_PATH` 与 `DEPLOY_SITE_HOST` 只供 MacCMS 发布脚本使用，不会改变 Next.js 的锁定 staging 目标。

执行：

```bash
source scripts/deploy-ping2.env
npm run deploy:web
```

流程依次完成本地依赖安装、测试、Lint、类型检查和 E2E。脚本按当前工作区文件内容、权限、Node/npm 与固定 production 环境计算构建指纹：缓存未命中时执行 production build、Linux 原生依赖组包和完整归档验证；命中时复制缓存归档并重新验证摘要、tar 条目、standalone 结构、Sharp 版本和 ELF 平台。指纹获取失败、门禁或构建期间输入变化都会直接中止，不会降级复用缓存。新 release 会先在 `127.0.0.1:3101` 验证 `/healthz`、首页、动态路由、404 和真实静态 chunk，成功后才原子更新 `current`、启动 systemd、执行 `nginx -t`、reload，并从服务器回环验证 Next 页面、`/favicon.ico`、`home_v2&compact=1` 以及前端实际 `content&scope=library` 查询。content 必须在浏览器相同的 10 秒预算内返回有效 DTO；API 若被地区策略拒绝，只接受精确的 JSON 403 envelope。

本地锁位于 `.cache/next-deploy/v1/.deploy.lock`。正常退出会自动释放；若本机进程被 `SIGKILL` 或掉电打断，确认没有其他 `deploy:web` 进程后再手工移除这个空锁目录。

Nginx 保留 `/index.php`、`/api.php`、`/upload`、`/static` 和 `/template` 给 `/www/wwwroot/squaredMedia` 的 PHP/文件系统；`/react-api.php` 与 `/preview` 明确返回 404，其余干净 URL 反代 Next。Node 端口不向公网监听。失败会恢复旧 `current`、Nginx include 和服务状态；成功后旧目标记录为 `previous`。

回滚：

```bash
source scripts/deploy-ping2.env
npm run rollback:web
```

指定版本时使用 `NEXT_ROLLBACK_RELEASE=<release-id>`。回滚脚本可在 Next release 之间切换，也能在首次切流后恢复保存的旧静态 staging 配置；它不修改主站、MacCMS 文件或数据库。

### MacCMS 主题与 addon

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

首次建立生产 API、但保持线上主题不变时执行：

```bash
source scripts/deploy-ping2.env
DEPLOY_SCOPE=backend npm run deploy
```

服务器已经具备当前后端依赖基线后，只发布生产 API、保持线上主题和 `pingfangdevice` 文件不变时执行：

```bash
source scripts/deploy-ping2.env
DEPLOY_SCOPE=api npm run deploy
```

`DEPLOY_SCOPE` 只接受 `all`、`backend` 或 `api`，默认是 `all`。`backend` 上传并安装设备和 API 插件、应用控制器、hook 与所需数据库结构，但不上传或替换主题，适合首次建立生产 API 依赖基线。API-only 只上传 `dist/pingfangapi.tar.gz`，只快照和替换远端 API 插件与 `Pingfangapi.php` 控制器，不更新主题、设备插件、hook 或数据库结构；修改文件前会核对服务器已安装的设备服务和 hook 文件摘要、`app_begin` 登记及完整设备会话表结构，不兼容时直接失败并要求先执行一次 `backend` 部署。发布脚本会对包含未提交文件的当前工作区计算内容指纹，并额外纳入三个实际发布源中会进入归档的 Git ignored 文件：该指纹首次发布仍执行完整门禁并写入 `.cache/deploy-gates/v1/`；相同指纹的后续 API-only 发布只运行生产 API、控制器和设备会话测试，并只打包、验证 API 归档。任一发布输入、测试、门禁脚本或工具链变化都会使成功章失效并恢复完整门禁。

默认全量发布顺序如下：

1. 在本地重新执行测试、模板检查、兼容验证和预览验证。
2. 重建 `dist/`，再验证三个发布归档。
3. 上传主题、`pingfangdevice` 与 `pingfangapi` 归档到远端临时路径。
4. 在修改任何线上文件前，把三个归档解压到远端受控临时目录，检查必需文件、全部插件 PHP 语法、数据库连接及 API 所需的 `ulog_point`、`ulog_duration` 两列。
5. 安装并验证 `pingfangdevice`：备份旧插件，替换插件目录和 `application/` 载荷中的兼容控制器，补登记 `app_begin` hook，执行 `install.sql`，检查 PHP 语法和 `login_check_hash` 字段。
6. 安装并验证 `pingfangapi`：备份旧插件和应用控制器，复制标准 `application/` 载荷；该插件不登记 hook，也不执行 SQL。
7. 备份现有主题为 `pingfangvideo.backup.<时间戳>`，替换主题目录。
8. 默认清理 `runtime/cache`、`runtime/temp`、后台和前台视图缓存。
9. 配置了 `DEPLOY_SITE_HOST` 时，从服务器本机把真实 Host/SNI 解析到 `127.0.0.1`，检查 HTTP 状态和可选响应标记。
10. 同一次回环验证会串行执行最多 5 个 API 请求：`home_v2&compact=1`、`navigation`、与前端一致的 `scope=library` 目录第一页与 facets、分类统计，以及首页首个可见频道第一页。单个请求最长 10 秒，全部 API 网络请求共享 30 秒预算；响应解析和少量 shell 调度不计入 curl 的硬超时。任一性能超时、错误 DTO 或请求预算耗尽都会停止后续请求并触发当前 scope 的文件快照恢复。服务器启用地区访问限制且本机回环被策略拒绝时，只接受 HTTP 403、`code=403`、`msg=当前地区不可访问` 的精确 JSON 策略响应；此时脚本会明确记录“未预热”并停止后续请求，不把策略校验伪装成缓存命中。其他 403 或 HTML 错误页仍会触发回滚。该策略响应只能证明控制器与访问策略生效，发布后仍须从允许地区的公网客户端验证并按需预热真实接口。未配置 `DEPLOY_SITE_HOST` 时不会执行真实 API smoke，不能据此宣称服务器 API 已验收。

需要保留缓存时可设置 `DEPLOY_CLEAR_CACHE=0`，但只能用于明确的维护场景。站点回环验证能识别 PHP/Nginx 错误页、错误虚拟主机和缓存重建失败，但不会检查浏览器登录流程、外部 DNS/CDN 可达性，因此脚本成功仍不等于完整线上验收。

发布后至少确认：

- 首页、分类、详情、播放及用户入口返回预期页面，没有 PHP 运行时错误。
- `pingfangdevice` 管理页可访问，登录、设备登记和撤销流程按预期工作。
- 兼容 `home` 仍返回 JSON envelope 且列表没有原始播放 URL；`home_v2` 的轮播/年度榜不超过 5 条、最新/每频道不超过 6 条，卡片无剧集和播放字段，`navigation` 只返回站点名与可见频道；`content&page=1&page_size=24` 返回真实总数和当前页且卡片 `episodes` 为空，第二页 ID 与第一页不重复，重复请求和翻页不会再次执行相同的全表总数统计，`detail&vod_id=<id>` 可独立读取完整剧集；`session` 能签发 CSRF，真实账号登录、收藏、历史和设备撤销均按当前用户隔离。
- playback action 只返回同源 `pingfangapi/player` iframe；该入口会重新执行 MacCMS 播放权限并复用原生播放器/受限播放模板，不能退回可复制的直接 `vod/player` URL。
- 使用真实后台配置验收登录验证码、评论审核与黑名单、留言/报错、顶踩和评分；确认注册、注册验证码和找回 action 返回 404，新旧注册/找回页面路径族返回 410。
- MacCMS 缓存目录仍可由 Web 进程写入。
- 远端实际主题和插件文件来自本次归档，并记录本次生成的备份目录名。

### 发布安全边界

- 不要把 `DEPLOY_PASSWORD` 写入仓库或 `scripts/deploy-ping2.env`；优先使用 SSH 密钥。首次连接使用 `StrictHostKeyChecking=accept-new`，操作人仍应通过可信渠道核对主机指纹。
- 专用部署密钥不是默认 SSH Identity 时，通过 `DEPLOY_IDENTITY_FILE` 传入本机私钥路径；脚本会同时为 SSH 和 SCP 启用 `IdentitiesOnly`，但不会读取或复制私钥内容。
- `DEPLOY_SITE_HOST` 只填写主机名，不带协议或路径；协议由 `DEPLOY_SITE_SCHEME` 指定。`DEPLOY_SITE_MARKER` 应选择只有正确站点页面会出现的稳定片段，当前 ping2 配置使用主题资源路径。
- `DEPLOY_PATH` 必须是绝对路径并以 `/template` 结尾；远端还会解析真实路径并要求同级 MacCMS `application/database.php` 存在，避免把固定插件目录派生到根目录或无关站点。
- 当前 scope 使用的远端上传目标只允许是 `/tmp` 下的单个 `.tar.gz` 文件；上传前拒绝已存在文件或符号链接，退出清理也只删除本次 scope 使用且已验证的普通文件，不递归删除调用方提供的目录。
- 回环请求使用 `curl -k`，只用于绕过服务器本机访问虚拟主机时的证书信任问题；它不修改证书配置，也不能代替从公网检查 TLS、DNS 和 CDN。
- 全量模式会替换远端主题和两个插件目录、修改 `application/extra/addons.php` 并执行数据库 DDL；`backend` 执行相同的后端更新但不修改主题；API-only 只替换 API 插件和控制器。三种模式运行前都必须再次核对主机、账号和 `DEPLOY_PATH`。
- 全量模式通过预检后会保存主题、两个插件目录、两个应用控制器和 hook 配置的文件系统快照；`backend` 保存同一组后端文件但不保存或恢复主题；API-only 只保存 API 插件和控制器。安装或回环验证以非零状态退出时会自动恢复当前 scope 的快照并清缓存。恢复任一路径、缓存清理或快照完整性检查失败时会以状态 `95` 明确报错，并保留远端临时根、快照和本次上传归档；SSH 返回 `255` 时远端状态未知，也不会再次连接删除这些归档。
- `pingfangdevice/install.sql` 只执行幂等的新增表/列操作，文件系统恢复不会删除这些加法式数据库结构；`SIGKILL`、主机掉电或恢复本身失败也无法由 shell trap 兜底，仍需检查终端输出和部署生成的备份。
- `npm run rollback` 仍是一次成功发布后的显式主题回滚，不会主动回退插件或删除数据库结构。

API-only 安装成功后会保留 `pingfangapi.backup.<时间戳>` 目录和 `Pingfangapi.php.backup.<时间戳>` 控制器副本，但当前没有成功发布后的 API 自动回滚命令；`npm run rollback` 只处理主题。API smoke 失败发生在发布事务提交前，因此会自动恢复 API 文件快照。

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

此命令只回滚主题，不回滚 `pingfangdevice` 插件、应用兼容控制器、hook 配置或数据库表结构。若故障来自插件发布，必须基于部署时留下的备份和数据库审计结果制定单独恢复方案。主题回滚后仍需完成与发布后相同的线上验证。

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

`.github/workflows/ci.yml` 在每次 push 和 pull request 上运行，环境为 Node.js 22.22.0 和 PHP 8.4。CI 先执行 `npm ci` 并安装 Playwright Chromium，再运行仓库测试、前端检查、React 类型检查、生产构建与浏览器 E2E、模板检查、兼容验证、预览验证、打包和发布包验证。

验证通过后，CI 按独立发布单元上传：

```text
pingfangvideo-theme  -> dist/pingfangvideo.tar.gz
pingfangdevice-addon -> dist/pingfangdevice.tar.gz
pingfangapi-addon    -> dist/pingfangapi.tar.gz
```

CI 只构建和保存归档，不连接生产服务器，也不执行部署、回滚或数据库维护。下载 CI 产物后仍应核对对应提交和归档内容，再进入有授权的发布流程。

## 修改工程脚本时的同步检查

- 新增或改名 npm 命令：同步 `package.json`、CI、README 和 `tests/template.test.mjs` 中的契约。
- 改变发布包内容：同步 `scripts/package-theme.mjs`、`scripts/verify-release.mjs`、CI 上传路径和本文生成目录说明。
- 改变远端路径或安装步骤：同步部署与回滚脚本、环境示例、备份/失败恢复说明，并补充相应静态测试。
- 改变数据维护行为：先补单元测试和预演路径，再更新对应操作文档；任何扩大写入范围的变化都需要重新审视备份与回滚策略。
