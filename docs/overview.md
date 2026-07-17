# SquaredMedia 项目总览

最后核验：2026-07-17

## 项目定位

本仓库维护一套 MacCMS V10 视频站主题，以及与主题交付直接相关的插件、预览、验证、发布和数据维护工具。

仓库名称是 `SquaredMedia`，但当前代码中的生产运行时标识仍是：

- 主题目录：`template/pingfangvideo/`
- 主题发布包：`dist/pingfangvideo.tar.gz`
- 登录设备插件：`addons/pingfangdevice/`
- 豆瓣数据插件：`addons/douban/`
- 插件发布包：`dist/pingfangdevice.tar.gz`、`dist/douban.tar.gz`

这些名称会参与 MacCMS 配置、远端目录、路由、数据库表和部署脚本，不应仅因仓库名称不同而单独重命名。若要迁移运行时标识，需要同时核对模板配置、插件钩子、数据库、发布脚本和线上安装状态。

## 目录结构

```text
SquaredMedia/
├── .github/workflows/ci.yml      # GitHub Actions 验证与发布包构建
├── addons/                       # MacCMS 插件源码
│   ├── douban/                   # 豆瓣评分同步与后台管理
│   ├── pingfangdevice/           # 登录设备与会话管理
│   └── videolint/                # 视频库质量扫描与问题导出
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

| 模块 | 主要职责 | 是否进入当前发布流程 | 详细说明 |
| --- | --- | --- | --- |
| `template/pingfangvideo/` | MacCMS 页面模板、公共片段、样式、脚本、图片和播放器提示页 | 是，打包为 `pingfangvideo.tar.gz` | [主题与本地预览](theme-and-preview.md) |
| `preview/`、`server/`、`docker/` | 使用模拟数据验证页面流程和 PHP 渲染，不替代真实 MacCMS | 否 | [主题与本地预览](theme-and-preview.md) |
| `addons/pingfangdevice/` | 将 MacCMS 登录态纳入设备会话管理，提供设备查看与撤销能力 | 是，打包并由部署脚本安装 | [MacCMS 插件](addons.md) |
| `addons/douban/` | 同步、匹配和校准豆瓣评分，提供后台管理页与任务队列 | 是，打包并由部署脚本安装 | [MacCMS 插件](addons.md) |
| `addons/videolint/` | 扫描视频库缺失字段、播放源、封面和重复数据，支持导出问题清单 | 否，当前需单独安装 | [MacCMS 插件](addons.md) |
| `ops/security/` | 保存需人工审核和应用的防火墙规则数据，不参与主题或插件发布 | 否 | 本文 |
| `scripts/`、`tests/`、`.github/` | 本地与 CI 验证、发布包构建、部署回滚、分类维护和海报修复 | 工程支撑 | [开发、发布与运维](development-and-operations.md) |
| `docs/` | 保存当前规范、模块上下文、操作手册和历史设计记录 | 不进入生产包 | 本文与各模块文档 |

## 核心工作流

### 主题开发

1. 以 `template/pingfangvideo/` 为生产事实源。
2. 修改模板前遵循 [MacCMS 主题开发规范](maccms-theme-development-spec.md)，并阅读对应的 MacCMS 官方主题文档。
3. `preview/` 和 `server/` 只用于本地验证；禁止把本地路径、Docker、localhost 或 npm 命令写入生产主题。
4. 页面、标签或路由变化应同步更新测试和兼容性校验。

### 验证与发布

日常主题修改至少执行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

生成发布包时继续执行：

```bash
npm run package
npm run verify:release
```

当前打包脚本生成 `pingfangvideo` 主题、`pingfangdevice` 插件和 `douban` 插件三个归档；`videolint` 不在自动打包或部署范围内。部署与回滚的环境变量、远端备份和缓存处理见 [开发、发布与运维](development-and-operations.md)。

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
- NOTE：仓库没有为未跟踪的 `output/` 目录定义稳定用途；长期资料应放入职责明确的 `docs/`，可再生成的结果应放入被忽略的生成目录。
