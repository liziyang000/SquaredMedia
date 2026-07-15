# Squared Media

Squared Media 是一套面向 **MacCMS V10（苹果 CMS）** 的响应式影视站主题与配套运营工具。仓库不仅包含生产主题，还提供本地预览、模板兼容性检查、发布包构建、SSH 部署、回滚，以及登录设备和豆瓣数据管理插件。

本项目不是独立 CMS。生产环境仍由 MacCMS 提供内容、用户、路由、播放器和后台能力，Squared Media 负责前台展示、交互体验以及与 MacCMS 运行时的兼容集成。

## 核心能力

### 影视站前台

- 响应式首页、热播轮播、年度榜单、分类标签和最新内容货架
- 默认、蓝粉紫、海报杂志三套可切换视觉主题
- 视频分类、筛选、搜索、详情、播放、下载、评论、收藏和观看记录页面
- 文章、专题、演员、角色、剧情、网址等 MacCMS 标准模块兼容页面
- RSS、Google/Baidu Sitemap、系统提示、密码验证和版权提示页面
- GSAP 动效、移动端抽屉导航、键盘焦点管理和减少动态效果适配

### 用户与访问控制

- 播放页面要求用户登录后访问
- 游客分类范围与搜索结果按站点策略收口
- 收藏、退出登录和观看历史具备失败反馈与安全降级
- `squareddevice` 提供登录设备管理、设备下线和会话同步，最多 3 台设备同时在线

> 当前播放和分类限制属于模板展示层门禁。如果播放源或业务接口需要严格防止绕过，仍应在 MacCMS 控制器或解析服务增加服务端鉴权。

### 内容运营插件

- `squareddevice`：登录设备管理和会话撤销，默认随发布流程打包
- `douban`：豆瓣 ID、资料同步、待核查任务和操作日志管理，默认随发布流程打包
- `videolint`：视频库字段、播放源、封面和重复内容质量检测；源码位于仓库中，目前不属于默认发布包

### 工程化能力

- PHP 8.4 Docker 本地预览环境
- 静态预览与 PHP 后端联动预览
- 模板结构、MacCMS 兼容性和预览路由自动验证
- 自动过滤开发文件并生成可部署压缩包
- SSH 自动部署、远端备份、缓存清理和一键回滚
- GitHub Actions 持续集成与发布产物上传

## 项目组成

| 路径 | 说明 |
| --- | --- |
| `template/squaredmedia/` | MacCMS 生产主题，最终部署到站点 `template` 目录 |
| `addons/squareddevice/` | 登录设备管理插件 |
| `addons/douban/` | 豆瓣数据管理插件 |
| `addons/videolint/` | 视频库质量检测插件源码 |
| `preview/` | 无需 MacCMS 数据库的静态数据预览 |
| `server/` | PHP 8.4 后端联动预览入口 |
| `scripts/` | 校验、打包、部署、回滚和数据库维护脚本 |
| `tests/` | 模板、插件、发布流程和兼容性回归测试 |
| `docs/` | MacCMS 开发规范、设计记录和维护文档 |

主题遵循 MacCMS V10 标准目录结构，入口信息位于 `template/squaredmedia/info.ini`，页面模板位于 `template/squaredmedia/html/`。

## 命名约定

| 场景 | 名称 |
| --- | --- |
| 项目展示名 | `Squared Media` |
| 主题目录与 MacCMS 模板标识 | `squaredmedia` |
| 登录设备插件标识 | `squareddevice` |
| npm 包名 | `squared-media-template` |
| 浏览器全局对象 | `SquaredMedia` |
| 本地存储与数据表前缀 | `squared_media_` |

这是一次覆盖主题、插件、脚本、缓存键和数据表的破坏性全量更名。已有安装升级前应备份数据库与站点文件，并把现有配置和业务数据迁移到上表中的新标识；仅覆盖主题目录不会自动迁移旧插件数据或浏览器本地状态。

## 运行要求

- MacCMS V10
- PHP 8.4；建议启用 `mysqli`、`pdo_mysql`、`gd`、`zip`、`opcache` 和 Apache Rewrite
- Node.js 与 npm，用于测试、校验和构建发布包
- Docker 与 Docker Compose，可选，用于本地 PHP 8.4 预览
- SSH 或 `sshpass`，可选，用于自动部署和回滚

## 快速开始

安装依赖并运行基础验证：

```bash
npm install
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

### 本地预览

无需 PHP 时，可打开 `preview/index.html` 查看静态数据预览。它读取 `preview/data.json`，支持首页、分类、搜索、详情和播放等页面流转。

需要验证 PHP 渲染链路时，启动 PHP 8.4 容器：

```bash
docker compose up --build php84
```

访问：

```text
http://localhost:8084/index.php
```

`server/index.php` 会读取本地预览数据并渲染常用路由。该目录仅用于开发验证，生产环境由真实 MacCMS 运行时渲染 `template/squaredmedia`。

## 安装到 MacCMS

1. 将 `template/squaredmedia` 复制到 MacCMS 的 `template` 目录。
2. 在 MacCMS 后台将前台模板切换为 `squaredmedia`。
3. 按需安装 `squareddevice`、`douban` 或 `videolint` 插件。
4. 清理 MacCMS 模板缓存。
5. 使用生产数据检查首页、分类、搜索、详情、播放、评论、反馈、RSS 和 Sitemap 页面。

不要把 `preview`、`server`、`docker`、`tests` 或 `scripts` 部署到生产主题目录。

## 开发与验证

修改主题前应阅读 [MacCMS 主题开发规范](docs/maccms-theme-development-spec.md)，并以 [MacCMS 官方主题文档](https://www.maccms.la/theme) 为模板标签和路由的事实来源。

日常修改至少运行：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

各命令职责：

- `npm test`：检查主题页面、插件、发布脚本和关键业务约束
- `npm run lint:template`：检查 include、标签闭合、资源路径和开发引用泄漏
- `npm run verify:compat`：检查 MacCMS 标准页面、路由和模块兼容面
- `npm run verify:preview`：通过 PHP CLI 渲染主要预览路由并检查运行时错误

生产主题不得引用 `localhost`、本地预览数据、Docker 或 npm 命令。模板资源必须使用 `{$maccms.path}`、`{$maccms.path_tpl}` 等 MacCMS 运行时路径。

## 页面覆盖

主题当前覆盖以下主要页面：

- `html/index/index.html`：首页轮播、年度热播榜和最新内容货架
- `html/vod/type.html`、`show.html`、`search.html`：分类、筛选和搜索
- `html/vod/detail.html`、`play.html`、`player.html`：详情与播放链路
- `html/vod/down.html`、`copyright.html`、`plot.html`：下载、版权和分集剧情
- `html/vod/*_pwd.html`、`confirm.html`：权限与密码验证
- `html/user/`：登录、注册、用户中心、收藏和播放记录
- `html/comment/`、`gbook/`、`book/`：评论、留言和举报兼容入口
- `html/art/`、`topic/`、`actor/`、`role/`、`plot/`、`website/`：标准内容模块
- `html/map/`、`rss/`、`vod/rss.html`：RSS 与站点地图
- `html/public/`：公共头尾、分页、提示、跳转、评分和共享视频卡片

分类与影片库使用固定的 `time`、`hits`、`score` 排序分支，不会把原始请求参数直接传入 MacCMS 标签属性。

## 构建发布产物

执行完整发布构建：

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

产物位于 `dist/`：

| 产物 | 用途 |
| --- | --- |
| `dist/squaredmedia.tar.gz` | 生产主题包，解压到 MacCMS `template` 目录 |
| `dist/squareddevice.tar.gz` | 登录设备管理插件包 |
| `dist/douban.tar.gz` | 豆瓣数据管理插件包 |

`npm run package` 会排除 `.DS_Store`、`.gitkeep` 等隐藏文件，并将静态资源版本占位符替换为当前内容哈希。`npm run verify:release` 会检查发布包结构、必需文件、SQL 安全约束以及开发目录泄漏。

## 自动部署

通过 SSH 将主题和默认插件部署到 MacCMS 服务器：

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=root \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run deploy
```

`DEPLOY_PATH` 必须指向远端 MacCMS 的 `template` 目录。部署脚本会：

1. 重新运行完整测试和发布校验。
2. 上传主题、`squareddevice` 和 `douban` 发布包。
3. 备份现有主题为 `squaredmedia.backup.*`。
4. 安装插件并执行各自的 `install.sql`。
5. 为设备管理插件注册 `app_begin` Hook。
6. 清理常见 MacCMS 缓存目录。

本仓库现有服务器的非敏感部署目标保存在 `scripts/deploy-ping2.env`：

```bash
source scripts/deploy-ping2.env
npm run deploy
```

默认推荐 SSH Key。必须使用密码时，在当前 Shell 设置 `DEPLOY_PASSWORD` 并安装 `sshpass`。设置 `DEPLOY_CLEAR_CACHE=0` 可以在受控维护窗口跳过缓存清理。

## 回滚

恢复远端最新备份：

```bash
DEPLOY_HOST=example.com \
DEPLOY_USER=root \
DEPLOY_PORT=22 \
DEPLOY_PATH=/www/wwwroot/example.com/template \
npm run rollback
```

指定备份目录：

```bash
ROLLBACK_BACKUP=squaredmedia.backup.20260627093000 npm run rollback
```

回滚脚本会把当前异常主题移动为 `squaredmedia.failed.*`，恢复选定备份，并按 `DEPLOY_CLEAR_CACHE` 设置处理缓存。

## 持续集成

GitHub Actions 会在 Push 和 Pull Request 时运行测试、模板检查、兼容性验证、预览验证、打包和发布包校验，并上传以下构建产物：

```text
dist/squaredmedia.tar.gz
dist/squareddevice.tar.gz
dist/douban.tar.gz
```

## 相关文档

- [MacCMS 主题开发规范](docs/maccms-theme-development-spec.md)
- [视频分类维护说明](docs/maccms-vod-category-maintenance.md)
- [豆瓣评分集成设计](docs/superpowers/specs/2026-07-10-douban-rating-integration-design.md)
- [豆瓣评分实施计划](docs/superpowers/plans/2026-07-10-douban-rating-integration.md)
