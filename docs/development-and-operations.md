# 开发、发布与数据运维

本文说明仓库内工程脚本的职责和操作边界。主题模板与插件本身的设计另见对应模块文档；这里以 `package.json`、`scripts/`、`.github/workflows/ci.yml` 和现有测试为事实来源。

服务器重置后的现场操作、恢复顺序和验证证据统一记录在 [服务器重置后恢复记录](server-reset-recovery-runbook.md) 中。

## 环境要求

- Node.js：Next.js 16 最低要求 Node.js 20.9；本仓库、CI 和联机游戏服务固定使用 Node.js 22.22.0。先用 `npm ci` 安装根项目与 `apps/web` workspace 的检查工具、播放器依赖和锁定的 `ws` 8.21.1。
- PHP：目标版本为 PHP 8.4。完整测试会调用 PHP CLI；海报修复工具还要求 `curl`、`mbstring`、`pdo_mysql` 扩展。
- 打包：需要系统 `tar`，且当前脚本使用 `--no-xattrs`。
- 部署：本机需要 `bash`、`ssh`、`scp`；使用密码认证时还需要 `sshpass`，日常发布优先使用 SSH 密钥。
- 远端：MacCMS 发布需要 `bash`、`tar`、PHP CLI 和 PDO MySQL；联机游戏与 Next.js staging 另需 Node.js 22.22 以上、systemd、Nginx 和 `curl`。Next production build 与 Linux x64 原生依赖组包在本机完成，远端不执行 `npm ci` 或 build。发布账号必须能写入 MacCMS 模板、插件、控制器、配置和缓存目录，以及 `/opt/pingfanggames`、systemd 和对应站点的 Nginx 扩展配置；Next 运行进程降权为 `www`。

## 开发验证

常用命令由 `package.json` 统一暴露：

| 命令 | 作用 | 是否写入仓库生成目录 |
| --- | --- | --- |
| `npm ci` | 按 `package-lock.json` 安装根项目和 `apps/web` workspace 的检查工具、播放器与联机游戏发布依赖 | 只写入已忽略的 `node_modules/` |
| `npm run dev:local` | 在 `127.0.0.1:8084` 启动 PHP 预览后端，并以 `127.0.0.1:5173` 作为 Next.js 本地前台入口 | 启动两个本地进程；退出命令后停止 |
| `npm run dev:web` | 启动 `apps/web` 的 Next.js 开发服务器 | 写入已忽略的 `apps/web/.next/` |
| `npm run lint` | 检查主题 JavaScript/CSS、React TypeScript/Oxc 和 Prettier 格式 | 否 |
| `npm run format` | 用 Prettier 格式化主题脚本、React 工程与配置文件 | 是，直接修改被覆盖的源码与配置 |
| `npm test` | 运行模板、React/API、播放器、联机房间/WebSocket、设备会话与控制器、海报修复、VodOps 质量模块及豆瓣模块测试 | 否；测试只写入临时或忽略目录 |
| `npm run typecheck:web` | 生成 App Router 类型并用严格 TypeScript 配置检查 Next.js 工程 | 写入已忽略的 `.next/types/` |
| `npm run build:web` | 生成 standalone Next.js `.next` 产物，并验证无全页 CSR bailout 的 Session-first 静态壳 | 是，重建已忽略的 `apps/web/.next/` |
| `npm run verify:web-prerender` | 只读检查现有 Next 产物中的静态壳和 prerender manifest | 只读 `apps/web/.next/` |
| `npm run analyze:web` | 生成 Next bundle 分析结果并复用预渲染检查 | 是，重建 `.next/` 并生成分析产物 |
| `npm run performance:lighthouse` | 构建本地固定 fixture，并对首页、目录和详情运行 Lighthouse | 是，写入已忽略的 `output/lighthouse/` |
| `npm run test:e2e` | 用 Playwright 验证本地 Next.js/PHP 路由、状态码、账号流程和响应式边界 | 失败证据写入已忽略的 `output/playwright/` |
| `npm run deploy:web` | 验证、构建或复用 Linux standalone 归档并原子切换 `react.ping2.my` | 写入本地缓存、远端版本、systemd 与 Nginx |
| `npm run rollback:web` | 将 staging 切回 `previous` 或指定 Next.js release | 修改远端 `current` 与对应运行配置 |
| `npm run rollback:api` | 使用显式成对备份 ID 回滚生产 API 插件和应用控制器 | 修改远端 API 文件并清理 MacCMS 缓存 |
| `npm run lint:template` | 检查模板 include、标签平衡、资源路径和生产模板中的开发环境引用 | 否 |
| `npm run verify:compat` | 检查 MacCMS 目录、标准路由页面和不安全链接模式 | 否 |
| `npm run verify:preview` | 用当前 PHP CLI 渲染本地预览的主要路由并核对完整 HTML | 否 |
| `npm run package` | 默认重建主题、`pingfangdevice`、`pingfangapi`、`vodops`、独立播放器和联机游戏服务六个归档 | 是，先重建 MacCMS 产物，再加入独立产物 |
| `npm run package:player` | 只重建独立播放器发布包，保留 `dist/` 中其他产物 | 是，仅替换播放器目录和归档 |
| `npm run package:games` | 只重建自包含的联机游戏服务包 | 是，仅替换游戏服务目录和归档 |
| `npm run verify:release` | 解包检查六个归档的结构、生产边界、资源版本和依赖版本 | 只读 `dist/` |
| `npm run verify:player-release` | 单独检查播放器归档的严格白名单、文件一致性与链接边界 | 只读 `dist/` |
| `npm run verify:game-server-release` | 检查游戏服务源码、部署样例、固定 `ws` 版本和敏感文件边界 | 只读 `dist/` |
| `npm run start:games` | 启动本机联机游戏服务；必须先设置签名密钥和允许的 Origin | 否 |
| `npm run audit:legacy-access` | 对本地 Nginx access log 做旧入口访问审计，不输出原始请求或访问者信息 | 否 |
| `npm run deploy:vodops` | 只发布并验证合并后的 VodOps 数据中心 | 写入远端插件、后台载荷、调度与缓存 |
| `npm run deploy:games` | 单独验证、打包并部署联机游戏服务，复用现有签名密钥 | 写入远端服务、插件配置和 Nginx 配置 |

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
- `npm run typecheck:web` 和 `npm run build:web` 分别验证 App Router 类型边界及 standalone Next.js 生产构建；`build:web` 还检查静态路由保留 Session-first 壳，但不证明页面内容已经 SSR。开发服务器或单元测试通过不能替代生产构建。E2E 应在 production build 之前运行，避免 `next dev` 扫描刚生成的 standalone 树。
- `npm run dev:local` 让浏览器只访问 `http://127.0.0.1:5173/`；`next.config.ts` 在 development 中将 `/react-api.php` 重写到 `server/react-api.php`，并把 `/index.php`、`/api.php`、`/template`、`/static`、`/upload` 和 `/preview` 代理到端口 `8084` 的 PHP 预览后端，因此本地请求保持同源。`src/proxy.ts` 依据 `src/migrationRoutes.ts` 对已知旧公开 URL 返回单跳 `301`，对明确退场地址返回 HTTP `410`；生产是否生效仍必须以实际 Nginx 和服务器请求验收。
- `scripts/lint-template.mjs` 面向源模板结构，阻止本地预览、`localhost`、死链接或错误资源路径进入生产主题。
- `scripts/verify-compat.mjs` 面向 MacCMS 页面和目录兼容面。
- `tests/react-api.test.php` 验证本地 React API 的服务端分页、筛选、独立详情、字段白名单、媒体 URL 隔离、HTTP 状态、JSON Content-Type、有限数值与字段边界、session/CSRF、既有会员登录、注册/找回 action 退场、收藏/记录批量操作、设备及绑定 `mid`/内容 ID 的互动写入。
- `tests/pingfang-api.test.php` 验证生产 `pingfangapi` 的兼容 `home`、分区 `home_v2`、轻量 `navigation`、分页参数归一化、详情 action、action/method 白名单、同源与 CSRF、请求体上限、登录字段隔离、账户鉴权、受控媒体描述符、Ulog 写入契约和列表媒体地址隔离；它使用服务替身，不连接真实 MacCMS 数据库。
- `tests/pingfang-api-controller.test.php` 直接加载生产应用控制器，验证站点关闭、地区限制和未知 action 都保持 JSON envelope；它仍不能代替真实 MacCMS autoload、数据库和 Cookie 验收。
- `apps/web/e2e/react-migration.spec.ts` 验证本地 `301`/`410`、干净 URL 直达刷新、匿名历史、登录账号写操作以及 320、390、1100、1180、1181、1440 像素边界；CI 在执行前安装 Chromium。它不能证明生产 Nginx、真实 MacCMS Cookie/权限或真实播放器线路可用。
- `scripts/verify-preview.mjs` 从仓库根目录调用 PHP CLI，验证旧 PHP 预览仍能渲染主要路由；它不连接真实 MacCMS 数据库。
- `scripts/verify-release.mjs` 只验证已经生成的归档，不会自动执行打包。
- `scripts/verify-player-release.mjs` 只接受播放器白名单内的静态文件，并拒绝 PHP、隐藏路径、符号链接和硬链接。
- `tests/game-server.test.mjs` 覆盖票据伪造/过期、房间人数、落子顺序与五子胜负、绘画权限、答案隔离、Origin 拒绝和真实 WebSocket 握手。
- `scripts/verify-game-server-release.mjs` 确认服务包自带精确的 `ws` 8.21.1，且不包含环境文件或签名密钥。

本地静态预览必须通过 HTTP 服务打开，因为 `preview/index.html` 使用绝对路径请求 `/preview/data.json`。直接以 `file://` 打开不能视为有效验证。Docker 通过 `PINGFANG_PREVIEW_DATA=/var/www/html/preview/data.json` 对齐容器挂载路径；不使用 Docker 时，`server/lib/data.php` 默认从仓库根目录读取相同样例数据。PHP 路由验证以 `npm run verify:preview` 为准。

## 打包与 `dist/`

`scripts/package-theme.mjs` 每次运行都会先递归删除整个 `dist/`。默认生成主题和三个插件；根级 `npm run package` 随后追加独立播放器与游戏服务，共生成六个归档。部署脚本使用 `backend`、`api` 或 `vodops` scope 时只上传和替换对应的 MacCMS 发布单元，不能据此把播放器或游戏服务视为同一回滚事务：

```text
dist/
├── pingfangvideo/
├── pingfangvideo.tar.gz
├── pingfangdevice/
├── pingfangdevice.tar.gz
├── pingfangapi/
├── pingfangapi.tar.gz
├── vodops/
├── vodops.tar.gz
├── pingfangplayer-player/
├── pingfangplayer-player.tar.gz
├── pingfanggames-server/
└── pingfanggames-server.tar.gz
```

打包过程有以下固定行为：

- `pingfangvideo` 来自 `template/pingfangvideo/`，三个插件分别来自 `addons/pingfangdevice/`、`addons/pingfangapi/` 和 `addons/vodops/`。
- 三个插件的 `application/` 都保留 MacCMS 标准应用载荷结构；SSH 部署会复制设备/API 兼容控制器，以及 `vodops` 内的 VodOps/Douban 两个后台控制器和 `view_new` 统一工作台，豆瓣模块片段随插件目录发布。
- 任意层级以 `.` 开头的文件或目录不会进入包。
- 主题、插件和独立播放器打包只接受受控普通文件/目录，并拒绝或排除链接等异常条目；API 与 VodOps 发布校验还会拒绝额外顶层路径并执行 PHP 语法或结构检查。游戏服务打包当前只过滤点文件并复制整个固定 `ws` 包，验证器尚未做同等级的精确白名单、tar 链接类型和路径穿越检查。
- 主题 HTML 中的样式、共享脚本、播放器提示、俄罗斯方块初始化器、竹知了交互、联机游戏脚本和七夕粒子脚本版本占位符会分别替换为对应文件的 12 位内容摘要，避免单个资源变化使其他资源缓存失效。
- 包内目录权限统一为 `0755`，文件权限统一为 `0644`；tar 包禁用 macOS 扩展属性元数据。
- `scripts/package-player.mjs` 从 `maccms-player/` 精确复制自有播放器 HTML、CSS 和 JavaScript，并从 `node_modules/` 中锁定的 ArtPlayer 5.4.0 与 hls.js 1.6.16 生成版本化文件；它不会清空 `dist/` 中先生成的主题与插件产物，也不会把 PHP、隐藏文件或链接带入播放器归档。
- `scripts/package-game-server.mjs` 打包一方服务源码、systemd/Nginx 样例和锁定的 `ws` 运行依赖；归档可离线启动，不包含 `.env`。
- 当前自动化不会包含其他 `addons/` 子目录，也不会生成独立 `douban.tar.gz`。`npm run deploy` 会部署主题、三个生产插件与游戏服务，但不会安装独立播放器。`npm run rollback` 默认回滚主题，也可用 `ROLLBACK_SCOPE=vodops` 回滚合并插件代码和应用载荷；两种模式都不删除数据库数据。

根目录 `dist/` 已被 `.gitignore` 忽略，是可重复生成的主题/插件发布产物，不是源码。不要把人工报告、数据库备份或唯一副本放入其中，否则下次 `npm run package` 会直接删除。

`npm run build:web` 另行生成 `apps/web/.next/standalone/`。本项目没有配置静态导出：任意视频动态路由、Cookie 会话和 Proxy 均要求 Next.js runtime。该目录被忽略，也不会混入 `npm run package` 的 MacCMS 归档。`deploy-next-web.sh` 在本机持有互斥锁完成 production build，再用独立 lockfile 安装 Linux x64/glibc 版 Sharp 依赖并验证 ELF 类型；归档按构建输入指纹缓存在 `.cache/next-deploy/v1/`。相同输入的后续发布仍重新执行完整本地门禁和缓存归档校验，但跳过 production build、第二次 Linux 依赖安装与组包。缓存命中会先验签、复制，再对复制品重新计算摘要；缓存未命中时先在独占临时目录生成完整 entry，验证后才原子改名发布。设置 `NEXT_DEPLOY_FORCE_REBUILD=1` 可强制重建。

`output/playwright/` 已被 `.gitignore` 忽略，用于可重复生成的浏览器报告、截图和跟踪；它不是发布产物。`output/` 下的其他路径仍没有正式所有者，不应保存长期资料或被发布自动化依赖。

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

流程依次完成本地依赖安装、测试、Lint、类型检查和 E2E。脚本按当前工作区文件内容、权限、Node/npm 与固定 production 环境计算构建指纹：缓存未命中时执行 production build、Linux 原生依赖组包和完整归档验证；命中时复制缓存归档并重新验证摘要、tar 条目、standalone 结构、Sharp 版本和 ELF 平台。指纹获取失败、门禁或构建期间输入变化都会直接中止，不会降级复用缓存。React 专用的联机桥接运行时从主题源码复制进当前 standalone release，不依赖另行发布共享主题文件；候选进程和公开域名都必须返回与本地相同的 SHA-256。新 release 会先在 `127.0.0.1:3101` 验证 `/healthz`、首页、动态影片、游戏大厅、404 和真实静态 chunk，成功后才原子更新 `current`、启动 systemd、执行 `nginx -t`、reload，并从服务器回环验证 Next 页面、五个旧游戏地址的单跳目标、`/favicon.ico`、像素主题字体/粒子脚本、单机游戏资源、联机 bridge、`home_v2&compact=1`、前端实际 `content&scope=library` 查询以及 `pingfangdevice/sourceQuality` 的脱敏结果。content 必须在浏览器相同的 10 秒预算内返回有效 DTO；线路检测使用 35 秒总请求预算并拒绝携带 URL/Token 的结果；API 若被地区策略拒绝，只接受精确的 JSON 403 envelope。`/game-socket` 还会分别验证恶意 Origin 返回 403、合法测试域 Origin 携带无效票据可到达现有上游并返回 401，任何 404/502 都会回滚本次 Web release。

本地锁位于 `.cache/next-deploy/v1/.deploy.lock`。正常退出会自动释放；若本机进程被 `SIGKILL` 或掉电打断，确认没有其他 `deploy:web` 进程后再手工移除这个空锁目录。

Nginx 保留 `/index.php`、`/api.php`、`/upload`、`/static` 和 `/template` 给 `/www/wwwroot/squaredMedia` 的 PHP/文件系统；两个 PHP 入口只检查真实的 `index.php` 或 `api.php` 文件，并显式把 `SCRIPT_NAME` 与 `PATH_INFO` 传给 FastCGI，保证插件 action 和 provider 路由不会被完整 URI 的物理文件检查误拦。旧播放页 `/index.php/vod/play/id/<vod_id>/sid/<sid>/nid/<nid>.html`、rewrite `/vodplay/<vod_id>-<sid>-<nid>.html` 和五个旧游戏 label 地址的 GET/HEAD 会在通用 PHP 规则之前交给 Next 迁移规则并返回单跳 `301`；其他方法继续进入 MacCMS PHP。播放别名共享 1～2147483647 的正整数校验，联机邀请仅保留 `[A-Z2-9]{6}` 房间码；非数字播放地址、非法房间码和外部跳转参数不会进入重定向目标。`/game-socket` 只接受浏览器 Origin 精确为 `https://react.ping2.my` 的 GET WebSocket 握手，并在代理到现有 `127.0.0.1:8787` 服务前把 Host/Origin 固定改写为主站已允许值；这不会扩大独立服务的允许来源，也不会把浏览器 Cookie 交给它。`/react-api.php` 与 `/preview` 明确返回 404，其余干净 URL 反代 Next。Node 端口不向公网监听。失败会恢复旧 `current`、Nginx include 和服务状态；成功后旧目标记录为 `previous`。

测试域名的夸克兼容凭证由 Next 路由隔离承载，不修改共享 MacCMS PHP：
`POST /api/native-playback-ticket` 只接受 `react.ping2.my` 的同源 JSON，并且只允许
现有 `pingfangapi/stream/id/.../sid/.../nid/...` 路径。Next 通过服务器回环请求把
浏览器 Cookie 和 Nginx 提供的客户端 IP 交给原 `stream` 再授权，只有得到 302 后才
在当前 Node 进程内保存 120 秒媒体凭证；无 Cookie 的
`GET /api/native-playback-stream/<ticket>` 校验后返回不可缓存的 302。凭证最多
同时保留 5000 条，服务重启或版本切换会立即失效，不写数据库、文件或共享 PHP
缓存。生产 API 将来若直接返回服务端 ticket，React 会直接使用，不再套一层
staging ticket。

回滚：

```bash
source scripts/deploy-ping2.env
npm run rollback:web
```

`deploy:web` 成功后会根据切换前的 Next release 输出精确命令
`NEXT_ROLLBACK_RELEASE=<release-id> npm run rollback:web`；没有可识别的旧 Next
release 时只输出通用回滚命令。指定 Next 版本回滚时，目标目录中的
`release.env`、`release.json` 和目录名必须报告同一个 release ID；切换后服务器
回环及公开 `/healthz` 都必须返回该精确 ID，并继续验证首页以及真实
`home_v2&compact=1`、`content&scope=library` API 响应。任一验证失败都会恢复回滚前
的 `current`、Nginx 配置和服务状态。脚本也能在首次切流后恢复保存的旧静态
staging 配置；它不修改主站、MacCMS 文件或数据库。

API 与 React 同时变更时，先发布向后兼容的 API，再发布 React。React 故障只执行
`rollback:web`；若 API 故障且新 React 依赖新契约，先回滚 Web，再回滚 API。

### MacCMS 主题、addon 与联机游戏

`npm run deploy` 先调用 `scripts/deploy-theme.sh` 完成主题与 addon 发布，再调用 `scripts/deploy-game-server.sh` 更新联机游戏服务。MacCMS 发布阶段必须提供：

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

`DEPLOY_SCOPE` 只接受 `all`、`backend`、`api` 或 `vodops`，默认是 `all`。`backend` 上传并安装设备和 API 插件、应用控制器、hook 与所需数据库结构，但不上传或替换主题，适合首次建立生产 API 依赖基线。API-only 只上传 `dist/pingfangapi.tar.gz`，只快照和替换远端 API 插件与 `Pingfangapi.php` 控制器，不更新主题、设备插件、hook 或数据库结构；修改文件前会核对服务器已安装的设备服务和 hook 文件摘要、`app_begin` 登记及完整设备会话表结构，不兼容时直接失败并要求先执行一次 `backend` 部署。VodOps-only 的边界见下文专节。发布脚本会对包含未提交文件的当前工作区计算内容指纹，并额外纳入实际发布源中会进入归档的 Git ignored 文件：该指纹首次发布仍执行完整门禁并写入 `.cache/deploy-gates/v1/`；相同指纹的后续 API-only 发布只运行生产 API、控制器和设备会话测试，并只打包、验证 API 归档。任一发布输入、测试、门禁脚本或工具链变化都会使成功章失效并恢复完整门禁。

API-only 在替换文件前为旧插件目录和旧应用控制器生成同一个成对备份 ID；发布
成功后终端会输出对应的
`API_ROLLBACK_BACKUP=<id> npm run rollback:api`，应随发布记录保存。

### VodOps-only 发布

只发布合并后的视频数据中心时使用专用范围，不要执行上面的全量命令：

```bash
source scripts/deploy-ping2.env
npm run deploy:vodops
```

`deploy:vodops` 仍会在本地执行完整发布门禁并重建、校验归档，但远端只上传和安装一个 `vodops`：先只读检查现有七张 `douban_*` 表的 InnoDB 引擎和必要字段，兼容后才把 VodOps/豆瓣目录、应用载荷、快捷菜单、Hook 配置和 crontab 写入同一个 `vodops.backup.*` 迁移快照；随后停用独立 `addons/douban` 和旧公开豆瓣桥接，保留旧 VodOps 配置值，增量创建并校验五张 `vodops_*` 和七张兼容保留的 `douban_*` 表，幂等补充并验证 `vodops_scan` 的分类范围、执行模式、租约和下次重试字段，归并旧快捷菜单、移除旧版 `response_end` hook，安装并验证单实例 CLI Worker Cron，最后清理 MacCMS 缓存并执行站点回环检查。文件替换后发生错误时会自动恢复快照内的文件和 Cron、保留失败版本并保持非零退出；数据库增量不做反向删除。它不会上传或替换主题、`pingfangdevice`、游戏服务和独立播放器，也不会删除旧豆瓣数据；旧表引擎或字段不兼容时会在替换任何插件文件前停止并列出缺口。

默认全量发布顺序如下：

1. `deploy-theme.sh` 的本地 full gate 执行 `npm test`、Lint、模板检查、兼容验证、预览验证、打包和归档验证；它不会自行执行 `npm ci`、React typecheck、E2E 或 `build:web`。需要完整 React 门禁时，应先按本文“开发验证”命令或 CI 完成这些步骤。
2. 重建 `dist/`，验证主题、三个插件、播放器和联机游戏服务六个发布归档。
3. 上传主题、`pingfangdevice`、`pingfangapi` 与 `vodops` 归档到远端受控临时路径；播放器归档不上传，游戏服务由后续独立阶段处理。
4. 先安装并验证 `pingfangdevice`：备份旧插件，替换插件目录和 `application/` 载荷中的兼容控制器，补登记 `app_begin` hook，执行 `install.sql`，检查 PHP 语法和 `login_check_hash` 字段。
5. 把旧插件配置中仍存在的同名设置值合并到新配置，避免主题发布清空设备限制或联机签名密钥。
6. 安装并验证 `pingfangapi`：备份旧插件和应用控制器，复制标准 `application/` 载荷；该插件不登记 hook，也不执行 SQL。
7. 安装并验证合并后的 `vodops`：先只读核对旧 `douban_*` 必要字段，再用同一时间戳快照旧 VodOps/豆瓣目录和应用载荷，停用独立豆瓣目录及旧公开桥接，保留已有配置，创建或复用五张 `vodops_*` 与七张 `douban_*` 表，幂等补齐分类范围与 Worker 字段并实际查询验证扫描锁、豆瓣入队锁，移除旧 `response_end` hook，安装由 `flock` 防重入的每分钟 Cron，并把旧 VodOps/豆瓣菜单归并为一个“视频数据中心”入口。
8. 备份现有主题为 `pingfangvideo.backup.<时间戳>`，替换主题目录并默认清理 `runtime/cache`、`runtime/temp`、后台和前台视图缓存。
9. 配置了 `DEPLOY_SITE_HOST` 时，从服务器本机把真实 Host/SNI 解析到 `127.0.0.1`，检查 HTTP 状态和可选响应标记；同一次回环验证还会检查 API 的关键只读 action，任一超时、错误 DTO 或请求预算耗尽都会停止后续请求并触发当前 scope 的文件快照恢复。
10. MacCMS 阶段成功后上传联机服务包，原子切换 `/opt/pingfanggames/current`，复用已有密钥或首次生成密钥，并同步插件配置、systemd 与 Nginx。
11. 校验 Nginx 配置、重启并启用游戏服务、检查 `/healthz`，再按服务器实际管理方式无中断重载 Nginx。

VodOps Cron 默认启用，远端必须提供 `crontab`、`flock` 和 CLI `php`。若服务器由 systemd timer、面板计划任务或其他调度器接管，可在发布时设置 `VODOPS_INSTALL_CRON=0`，再按每分钟一次调用 `php <站点根>/addons/vodops/bin/vodops-worker.php --max-chunks=20 --max-seconds=50`；否则勾选“后台 Worker”的任务在页面关闭后不会前进。Worker 空闲时不输出，活动记录写入 `runtime/log/vodops-worker.log`，需要纳入现有日志轮转。

需要保留缓存时可设置 `DEPLOY_CLEAR_CACHE=0`，但只能用于明确的维护场景。站点回环验证能识别 PHP/Nginx 错误页、错误虚拟主机和缓存重建失败，但不会检查浏览器登录流程、外部 DNS/CDN 可达性，因此脚本成功仍不等于完整线上验收。

发布后至少确认：

- 首页、分类、详情、播放及用户入口返回预期页面，没有 PHP 运行时错误。
- `pingfangdevice` 管理页可访问，登录、设备登记和撤销流程按预期工作。
- 当前 React 和插件管理入口使用 `home_v2&compact=1`；兼容 `home` 仅供旧发布包和回滚，仍须返回 JSON envelope 且列表没有原始播放 URL。`home_v2` 的轮播/年度榜不超过 5 条、最新/每频道不超过 6 条，卡片无剧集和播放字段，`navigation` 只返回站点名与可见频道；`content&page=1&page_size=24` 返回真实总数和当前页且卡片 `episodes` 为空，第二页 ID 与第一页不重复，重复请求和翻页不会再次执行相同的全表总数统计，`detail&vod_id=<id>` 可独立读取完整剧集；`session` 能签发 CSRF，真实账号登录、收藏、历史和设备撤销均按当前用户隔离。
- `playback` action 只返回同源 `pingfangapi/stream` 描述符；React 直接使用 Artplayer/HLS，`stream` 会重新执行 MacCMS 播放权限并仅对 `ps=0` 直连媒体返回 302。原 `pingfangapi/player` 保留作原生模板与回滚，React 不得重新嵌入 iframe。
- 使用真实后台配置验收登录验证码、评论审核与黑名单、留言/报错、顶踩和评分；确认注册、注册验证码和找回 action 返回 404，新旧注册/找回页面路径族返回 410。
- 超级管理员可从快捷菜单打开 `vodops`，分别验证仅页面驱动和“后台 Worker”任务，执行一批扫描、继续或结束任务，并导出当前筛选 CSV；Worker 验收应关闭后台页且不制造任何前台访问，等待下一次 Cron 后刷新任务，确认进度或心跳前进，并检查 `crontab -l` 中当前站点标记恰好一条。确认已结束任务为支持类型显示修复侧边栏，播放和重复候选仍只显示原生编辑入口；未取得单独的数据写入授权时，只检查预览，不点击确认修改或回滚，并确认部署过程没有写入视频主表。
- 在同一工作台切换到“豆瓣匹配与同步”，确认没有打开第二套页面壳层，旧 `admin/douban/index` 跳转到该模块，其余 `admin/douban/*` 动作仍受管理员登录保护，现有配置、元数据、任务、候选、日志和体检历史能够读取；发布验收只做查询和预览，不执行真实同步、评分校准、图片回滚或批量任务。
- MacCMS 缓存目录仍可由 Web 进程写入。
- 远端实际主题和插件文件来自本次归档，并记录本次生成的备份目录名。

API 的 `X-Request-ID` 由服务器生成，并传入 `AccountService` 关联同一次请求。服务端
错误日志只包含 `request_id`、`endpoint`、白名单 `action`、`status` 和
`exception_class`；不记录异常消息、请求体、Cookie、CSRF、Token 或媒体 URL。
4xx 默认不记录，转换为响应的 5xx 仍会记录，排障时可用响应头中的 ID 关联日志。

### 旧入口访问审计

旧入口删除前，先把目标站点的 Nginx access log 和轮转后的 `.gz` 文件安全导出到
本机，再执行只读审计：

```bash
npm run audit:legacy-access -- \
  --through 2026-07-23 \
  --days 30 \
  /private/tmp/pingfang-access.log \
  /private/tmp/pingfang-access.log.1.gz
```

`--through` 必须是昨天或更早的日期，窗口至少 30 日。工具只接受本地普通文件和
预期的 Nginx combined 格式，不通过 SSH 或网络取日志；报告只包含按固定路由族
聚合的计数、浏览器成功计数、方法、状态码分组、首末时间和输入内容 SHA-256，
不输出路径查询、IP、Referer、User-Agent、Cookie、Token 或媒体地址。路径按
Nginx 默认规则解码、消解点段并合并重复斜杠，重复 `action` 按 PHP 最后一个标量值
统计。坏行、完全重复文件、读取期间变化或混用时区都会使证据失效。

默认清单 `ops/legacy-access-targets.json` 故意将 `aliasInventoryComplete` 设为
`false`，`logCoverage` 也为 `null`。先复制到仓库外的临时文件：

```json
{
  "schemaVersion": 1,
  "siteLabel": "目标站点标识",
  "aliasInventoryComplete": true,
  "logCoverage": {
    "from": "2026-06-24",
    "through": "2026-07-23",
    "targetVhostOnly": true,
    "allRotationsIncluded": true,
    "locationsLogged": true,
    "staticExports": true,
    "nonOverlappingFiles": true
  },
  "additionalPrefixes": {
    "retiredActors": ["/actorsearch/"]
  },
  "legacyPlayPrefixes": ["/vodplay/"]
}
```

五项确认分别表示：日志只属于目标 vhost；窗口内 active 与 rotated 文件齐全；目标
location 没有关闭、采样或条件过滤 access log；导出后文件不再写入；轮转文件没有
部分重叠。还要核对生产 MacCMS `mac_url*` 和 Nginx rewrite，补齐
`legacyPlayPrefixes`，并按报告中的固定目标名把其他自定义别名前缀写入
`additionalPrefixes`；存在无法用前缀覆盖的 rewrite 时保持
`aliasInventoryComplete=false` 并另行分析。工具只能发现内容完全相同的重复文件，
不能自行证明轮转边界或 vhost 归属；输入 SHA-256 用于让报告事后绑定到本次导出。

报告只给出 `INSUFFICIENT_EVIDENCE` 或 `MANUAL_REVIEW_REQUIRED`，永远不会自动给出
`KEEP` 或 `RETIRE`；每个退场路由族必须分别人工评估。零访问不等于可删除：
`action=home` 至少保留到所有可回滚 Web 版本都不再依赖它；
`pingfangapi/player` 继续服务原生模板、权限场景和回滚；两个旧播放页地址继续保留
单跳 `301`。本仓库本次只准备工具和路由契约，没有读取生产日志，也没有执行部署。

### 发布安全边界

- 不要把 `DEPLOY_PASSWORD` 写入仓库或 `scripts/deploy-ping2.env`；优先使用 SSH 密钥。首次连接使用 `StrictHostKeyChecking=accept-new`，操作人仍应通过可信渠道核对主机指纹。
- 专用部署密钥不是默认 SSH Identity 时，通过 `DEPLOY_IDENTITY_FILE` 传入本机私钥路径；脚本会同时为 SSH 和 SCP 启用 `IdentitiesOnly`，但不会读取或复制私钥内容。
- `DEPLOY_SITE_HOST` 只填写主机名，不带协议或路径；协议由 `DEPLOY_SITE_SCHEME` 指定。`DEPLOY_SITE_MARKER` 应选择只有正确站点页面会出现的稳定片段，当前 ping2 配置使用主题资源路径。
- `DEPLOY_PATH` 必须是绝对路径并以 `/template` 结尾；远端还会解析真实路径并要求同级 MacCMS `application/database.php` 存在，避免把固定插件目录派生到根目录或无关站点。
- 当前 scope 使用的远端上传目标只允许是 `/tmp` 下的单个 `.tar.gz` 文件；上传前拒绝已存在文件或符号链接，退出清理也只删除本次 scope 使用且已验证的普通文件，不递归删除调用方提供的目录。
- 回环请求使用 `curl -k`，只用于绕过服务器本机访问虚拟主机时的证书信任问题；它不修改证书配置，也不能代替从公网检查 TLS、DNS 和 CDN。
- 全量模式会替换远端主题和三个插件目录，并按需修改 `application/extra/addons.php`、`application/extra/quickmenu.php`、应用控制器、hook、Cron 和数据库结构；`backend` 不修改主题，API-only 只替换 API 插件和控制器，VodOps-only 只处理合并的数据中心。所有 scope 运行前都必须再次核对主机、账号和 `DEPLOY_PATH`。
- 插件安装先于主题替换，文件系统、配置与数据库之间没有统一事务。中途失败可能形成“插件已更新、主题未更新”的部分发布状态，应根据终端输出逐项核对，而不是直接重复运行。
- 全量、`backend` 与 API-only 通过预检后保存当前 scope 的文件系统快照；安装或回环验证以非零状态退出时会尝试恢复快照并清缓存。恢复任一路径、缓存清理或快照完整性检查失败时会以状态 `95` 明确报错，并保留远端临时根、快照和本次上传归档；SSH 返回 `255` 时远端状态未知，也不会再次连接删除这些归档。
- VodOps 安装会为插件目录、两个后台控制器、后台视图、旧公开豆瓣桥接、hook、快捷菜单配置和 crontab 创建同一份迁移快照。`deploy:vodops` 在缓存清理和回环验证完成前保持文件回滚保护；失败会恢复这些非数据库载荷与 Cron，但保留已经完成的增量数据库变化。完整部署中的保护也不会跨越后续主题或游戏服务阶段。
- `pingfangdevice/install.sql` 与 VodOps 安装 SQL 都只执行幂等的新增或兼容更新；文件系统恢复不会反向删除这些数据库结构。`SIGKILL`、主机掉电或恢复本身失败也无法由 shell trap 兜底，仍需检查终端输出和部署生成的备份。
- `npm run rollback` 默认是成功发布后的显式主题回滚；只有指定 `ROLLBACK_SCOPE=vodops` 时才恢复 VodOps 文件和应用载荷，两种模式都不删除数据库结构。
- 游戏服务部署是 MacCMS 文件阶段之后的独立事务，会单独备份服务环境、systemd、Nginx 和插件配置；该阶段失败时自动恢复上一个游戏服务版本，但不会回滚此前已成功更新的主题与插件。

API-only 安装成功后会保留共享同一 ID 的
`pingfangapi.backup.<id>` 与 `Pingfangapi.php.backup.<id>`。API smoke 失败发生在
发布事务提交前，因此会自动恢复 API 文件快照；成功提交后的回退使用下述显式
`rollback:api` 命令。

## 回滚

### MacCMS 主题

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

此命令只回滚主题，不回滚 `pingfangdevice`、`pingfangapi`、`vodops`、应用控制器、hook、Cron、数据库表结构或联机游戏服务。若故障来自插件或游戏服务发布，必须使用对应阶段留下的备份或恢复链制定单独方案。主题回滚后仍需完成与发布后相同的线上验证。

### PingFang API

API-only 发布后，使用该次终端输出的成对备份 ID：

```bash
source scripts/deploy-ping2.env
API_ROLLBACK_BACKUP=<id> npm run rollback:api
```

回滚会严格校验同一 ID 的插件目录和应用控制器备份，先保存当前 API 文件快照，再
替换这两个目标、检查 PHP、清理缓存并执行真实 `home_v2&compact=1` 回环 smoke。
它不修改主题、`pingfangdevice`、hook 或数据库。任一替换、校验、缓存清理或 smoke
失败都会尝试恢复回滚前快照；恢复本身失败时以状态 `95` 报错并保留现场。

### VodOps

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

`.github/workflows/ci.yml` 在每次 push 和 pull request 上运行。`verify` job 使用 Node.js 22.22.0、PHP 8.4 和 Chromium，先执行 `npm ci`，再运行仓库测试、前端检查、React 类型检查、浏览器 E2E、生产构建与静态壳检查、模板检查、兼容验证、预览验证、打包和发布包验证。

验证通过后，CI 按独立发布单元上传：

```text
pingfangvideo-theme  -> dist/pingfangvideo.tar.gz
pingfangdevice-addon -> dist/pingfangdevice.tar.gz
pingfangapi-addon    -> dist/pingfangapi.tar.gz
vodops-addon         -> dist/vodops.tar.gz
pingfangplayer-player -> dist/pingfangplayer-player.tar.gz
pingfanggames-server -> dist/pingfanggames-server.tar.gz
```

独立的 `performance` job 使用本地固定 fixture，对 `/`、`/videos` 和 `/vod/1` 各运行 5 次 Lighthouse，并保留 14 天报告。performance score、LCP、TBT 和 CLS 当前是 warning；只有脚本 330 KB 与样式 65 KB 预算会使该 job 失败。该实验室结果不能替代生产 RUM、CDN 或客户端播放 QoE。

CI 只构建、检查和保存归档/报告，不连接生产服务器，也不执行部署、回滚或数据库维护。下载 CI 产物后仍应核对对应提交和归档内容，再进入有授权的发布流程。

## 修改工程脚本时的同步检查

- 新增或改名 npm 命令：同步 `package.json`、CI、README 和 `tests/template.test.mjs` 中的契约。
- 改变主题或插件发布包内容：同步 `scripts/package-theme.mjs`、`scripts/verify-release.mjs`、CI 上传路径和本文生成目录说明。
- 改变播放器发布包内容：同步 `scripts/package-player.mjs`、`scripts/verify-player-release.mjs`、CI 上传路径和本文白名单说明。
- 改变远端路径或安装步骤：同步部署与回滚脚本、环境示例、备份/失败恢复说明，并补充相应静态测试。
- 改变数据维护行为：先补单元测试和预演路径，再更新对应操作文档；任何扩大写入范围的变化都需要重新审视备份与回滚策略。
