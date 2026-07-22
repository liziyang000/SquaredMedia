# SquaredMedia 项目总览

最后核验：2026-07-21

## 项目定位

本仓库维护一套 MacCMS V10 视频站主题，以及与主题交付直接相关的插件、预览、验证、发布和数据维护工具。

仓库名称是 `SquaredMedia`，但当前代码中的生产运行时标识仍是：

- 主题目录：`template/pingfangvideo/`
- 主题发布包：`dist/pingfangvideo.tar.gz`
- 登录设备插件：`addons/pingfangdevice/`
- 生产 API 插件：`addons/pingfangapi/`
- 插件发布包：`dist/pingfangdevice.tar.gz`、`dist/pingfangapi.tar.gz`

这些名称会参与 MacCMS 配置、远端目录、路由、数据库表和部署脚本，不应仅因仓库名称不同而单独重命名。若要迁移运行时标识，需要同时核对模板配置、插件钩子、数据库、发布脚本和线上安装状态。

## 目录结构

```text
SquaredMedia/
├── .github/workflows/ci.yml      # GitHub Actions 验证与发布包构建
├── addons/                       # MacCMS 插件源码
│   ├── pingfangapi/              # React 生产 API 与 MacCMS 数据适配
│   ├── pingfangdevice/           # 登录设备与会话管理
│   └── videolint/                # 视频库质量扫描与问题导出
├── apps/web/                     # Next.js App Router 前台、API 客户端、单元/E2E 测试与构建配置
├── docker/                       # PHP 8.4 + Apache 开发镜像
├── docs/                         # 规范、模块说明、运维文档和历史方案
├── ops/security/                 # 独立的安全规则数据快照
├── preview/                      # 浏览器预览页面及模拟数据
├── scripts/                      # 校验、打包、部署、回滚和数据维护脚本
├── server/                       # PHP 后端联动预览入口与渲染器
├── template/pingfangvideo/       # 可部署的 MacCMS 主题源码
├── tests/                        # Node.js 与 PHP 回归测试
├── docker-compose.yml            # 本地 PHP 预览容器编排
├── package.json                  # 项目命令入口
└── README.md                     # 安装、发布与部署使用说明
```

`dist/` 是 `npm run package` 生成且被 Git 忽略的发布目录，不是源码。`.worktrees/`、依赖目录、缓存、日志及 `.DS_Store` 也不属于项目交付内容。

## 模块职责

| 模块                             | 主要职责                                                                                           | 是否进入当前发布流程                  | 详细说明                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `template/pingfangvideo/`        | MacCMS 页面模板、公共片段、样式、脚本、图片和播放器提示页                                          | 是，打包为 `pingfangvideo.tar.gz`     | [主题与本地预览](theme-and-preview.md)            |
| `apps/web/`                      | Next.js App Router、干净 URL 路由、Query Provider、TypeScript API、组件/API 与 Playwright E2E 测试 | 是，仅发布到 `react.ping2.my` staging | 本文                                              |
| `preview/`、`server/`、`docker/` | 使用模拟数据验证页面流程和 PHP 渲染，不替代真实 MacCMS                                             | 否                                    | [主题与本地预览](theme-and-preview.md)            |
| `addons/pingfangapi/`            | 为 React 前台提供同源、白名单化的 MacCMS 内容、播放、会话和账户 API                                | 是，打包并由部署脚本安装              | [生产 API](pingfangapi.md)                        |
| `addons/pingfangdevice/`         | 将 MacCMS 登录态纳入设备会话管理，提供设备查看与撤销能力                                           | 是，打包并由部署脚本安装              | [MacCMS 插件](addons.md)                          |
| `addons/videolint/`              | 扫描视频库缺失字段、播放源、封面和重复数据，支持导出问题清单                                       | 否，当前需单独安装                    | [MacCMS 插件](addons.md)                          |
| `ops/security/`                  | 保存需人工审核和应用的防火墙规则数据，不参与主题或插件发布                                         | 否                                    | 本文                                              |
| `scripts/`、`tests/`、`.github/` | 本地与 CI 验证、发布包构建、部署回滚、分类维护和海报修复                                           | 工程支撑                              | [开发、发布与运维](development-and-operations.md) |
| `docs/`                          | 保存当前规范、模块上下文、操作手册和历史设计记录                                                   | 不进入生产包                          | 本文与各模块文档                                  |

## 核心工作流

### 主题开发

1. 以 `template/pingfangvideo/` 为生产事实源。
2. 修改模板前遵循 [MacCMS 主题开发规范](maccms-theme-development-spec.md)，并阅读对应的 MacCMS 官方主题文档。
3. `preview/` 和 `server/` 只用于本地验证；禁止把本地路径、Docker、localhost 或 npm 命令写入生产主题。
4. 页面、标签或路由变化应同步更新测试和兼容性校验。

### Next.js 前台基座

- `apps/web/` 是 npm workspace，使用 Next.js 16 App Router、React、TypeScript、TanStack Query、React Hook Form、Zod、Vitest 和 Testing Library。Node.js 负责前台开发、构建和 staging 运行时，MacCMS/PHP 继续负责后台和业务数据。
- `src/app/**/page.tsx` 以显式 App Router 路径承载发现、内容/播放、账号、互动、挑战/状态和真实 `404`；`src/screens/` 保留页面 UI，`src/app/routing.tsx` 提供客户端导航适配。站内链接均使用不含 `index.php` 的干净 URL。
- `src/api/http.ts` 统一处理同源 Cookie、JSON 请求头、超时、取消、HTTP 错误和响应解析；React Query 对 4xx、业务、校验及配置错误不重试，网络、超时和 5xx 最多重试两次。`src/api/home.ts` 通过独立 `navigation` 与分区 `home_v2` 契约避免非首页路由等待完整首页，`content.ts`、`account.ts` 分别约束公开内容/播放和会话写操作 DTO。播放 URL 只能通过独立 playback 响应进入前端。
- `server/react-api.php` 仅用于本地验收：从 fixture 生成白名单 DTO，并用 PHP session、严格 JSON 输入与 CSRF 完成可观察的本地写入。公开首页响应不携带浏览器或账号历史；匿名历史读取经过校验的本地存储，账号历史由私有会话接口提供。Next.js development rewrite 将 `/react-api.php` 指向该文件；production build 不包含本地适配器，必须配置经过真实 MacCMS 验证的 `NEXT_PUBLIC_API_BASE_URL`。
- `addons/pingfangapi/` 是独立生产 API 插件，标准入口为 `/index.php/pingfangapi/index?action=...`。当前 React 对首页、目录和详情使用向后兼容的 `compact=1`：`home_v2` 以 MacCMS 原生列表字段白名单返回有界区块，目录卡片只取 7 个渲染字段，搜索只增加 3 个字段，分类总数和剧情选项按需查询；旧响应仍保留供缓存中的旧发布包回滚。插件同时从用户、Ulog 和设备会话生成白名单 DTO，并复用原生登录、验证码、评论审核和互动计数逻辑；新会员注册、注册验证码和账号找回不对外开放。playback 只返回会重新校验播放权限的同源 `pingfangapi/player` iframe。React 生产环境示例固定使用站内相对地址，真实数据和权限链仍需 staging 验收。
- `src/migrationRoutes.ts` 与 `src/proxy.ts` 验证已知旧公开 URL 的单跳 `301`、参数保留和退场地址的 HTTP `410`。staging Nginx 优先保留 MacCMS `/index.php`，但对旧注册与找回页面的 PATH_INFO 路径族统一返回 `410`；其他旧 PHP URL 仍由后端处理。当前用户明确不做 SEO，完整旧 rewrite/RSS 切流不属于本次 staging 发布。
- React 复用现有主题 CSS 和品牌资源，但轮播、主题、筛选、账号、播放器外壳、移动抽屉及状态切换均由 React 管理，不加载旧 `app.js`。79 个模板的最终归属记录在 [React 模板迁移矩阵](react-template-migration-matrix.md)。
- `apps/web/e2e/react-migration.spec.ts` 用 Playwright 覆盖路由状态码、干净 URL 直达、匿名历史、账号操作和六个响应式宽度；CI 安装 Chromium 后运行同一门禁。
- `npm run build:web` 生成 `output: "standalone"` 的 `apps/web/.next/` 产物。由于任意视频动态路由、Cookie 会话和 Proxy 不支持静态导出，本项目没有配置 `output: "export"`。`npm run deploy:web` 在本机生成并校验 Linux x64/glibc standalone 归档，相同构建输入可复用 `.cache/next-deploy/` 中的已验证产物；服务器只负责候选进程验收和 systemd/Nginx 原子切换。它与主题/addon 发布互不替代。

### 验证与发布

日常主题修改至少执行：

```bash
npm test
npm run lint
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run typecheck:web
npm run test:e2e
npm run build:web
```

生成发布包时继续执行：

```bash
npm run package
npm run verify:release
```

当前打包脚本生成 `pingfangvideo` 主题、`pingfangdevice` 插件和 `pingfangapi` 插件三个归档；`videolint` 不在自动打包或部署范围内。部署与回滚的环境变量、远端备份和缓存处理见 [开发、发布与运维](development-and-operations.md)。

### 数据维护

数据库维护工具独立于主题发布：

- `scripts/sql/maccms-vod-category-maintenance.sql` 只修正分类父子关系，不根据片名猜测分类。
- `scripts/repair-vod-posters.php` 默认预演，按本地文件存在性和确定性匹配修复海报，并保留应用报告与备份表。

执行前分别阅读 [视频分类整理](maccms-vod-category-maintenance.md) 与 [视频海报修复](maccms-vod-poster-repair.md)。生产数据快照类文档只用于审计，不应当作长期不变的代码配置。

## 文档使用约定

- `docs/overview.md` 和模块说明描述当前仓库事实，目录或交付流程变化时应同步更新。
- `docs/maccms-theme-development-spec.md` 是主题修改的仓库内规范。
- `docs/maccms-vod-*.md` 是数据维护操作手册。
- `docs/superpowers/` 保存带日期的设计、实施计划和交接记录，主要用于追溯决策；其中的待办、路径和预期结果不自动代表当前实现。
- `docs/vod-poster-provider-matches-20260716.md` 是特定日期的生产数据审计快照，可能随持续采集或人工修复失效。

## 已知边界

- 本仓库不是完整的 MacCMS 应用，不包含 MacCMS 核心、生产数据库或服务器运行时配置。
- 本地模拟数据只能验证页面结构和交互流程，不能证明真实模板标签、登录态、插件钩子或生产数据已经正确运行。
- Docker 通过 `PINGFANG_PREVIEW_DATA` 显式指向容器内挂载的样例数据；自动路由验证仍以 `npm run verify:preview` 为准，浏览器静态预览需通过 HTTP 服务访问 `/preview/index.html`。
- `ops/security/gptbot-ip-rules.json` 是独立规则数据文件，仓库内没有自动应用它的脚本；使用前需要在目标防火墙或面板中再次核对格式、来源和有效期。
- `output/playwright/` 是被忽略的 Playwright 截图、跟踪和报告目录，可随时重建；`output/` 下的其他内容没有稳定用途，长期资料应放入职责明确的 `docs/`。
