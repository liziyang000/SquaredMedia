# 2026-07-30 当前工作区快照

快照时间：2026-07-30

文档状态：带日期的易变事实

本文件记录开始本轮知识库整理时的 Git 基线和未提交迭代，方便以后区分“相对 `master` 已提交的内容”“当前工作区新增内容”和“线上是否已部署”。它不是持续自动更新的状态页；再次使用前应重新运行文末命令。

## Git 基线

| 项目                      | 快照值                                              |
| ------------------------- | --------------------------------------------------- |
| 分支                      | `codex/feat_switch_template_to_react`               |
| HEAD                      | `7e6633f`                                           |
| 与 `master` 的 merge-base | `3d9eec3`                                           |
| `master...HEAD`           | behind 0 / ahead 12                                 |
| 已提交差异                | 146 files changed, 36,976 insertions, 493 deletions |
| 审计开始时工作区          | 38 个 tracked 修改/删除，17 个 untracked 路径       |

上表中的已提交差异不包含未提交工作区。工作区计数发生在本知识库文档写入之前，因此后续 `git status` 数量会自然增加。

## 相对 `master` 的 12 个提交

| 顺序 | 提交      | 主题                                 |
| ---: | --------- | ------------------------------------ |
|    1 | `476877a` | 将 MacCMS 前台迁移到 Next.js         |
|    2 | `71ca865` | 优化浏览与播放体验                   |
|    3 | `fdeed23` | 建立私人视频产品优化基线与 TODO 边界 |
|    4 | `37164e7` | 对齐 React 前台与 MacCMS runtime     |
|    5 | `cc48ef7` | 部署时保留 addon 配置                |
|    6 | `12a7cdb` | 更新 React 播放器和 API 指引         |
|    7 | `57bbb7f` | 增加云端播放进度                     |
|    8 | `4e3ed12` | 收藏与历史分页                       |
|    9 | `3ceb65a` | 加固发布可观测性和回滚               |
|   10 | `fa07ba3` | 准备旧路由退场                       |
|   11 | `5faf379` | 展示继续观看进度                     |
|   12 | `7e6633f` | 改进 React 账号与原生播放            |

这些提交共同形成当前已提交基线：

- Next.js App Router 前台；HEAD 的迁移矩阵有 26 个 React 页面归属、文件树有 27 个 `page.tsx`。当前未提交游戏迭代才把两种口径扩展到 31 个模板页面归属和 32 个 `page.tsx`。
- `pingfangapi` 生产 BFF、账号/内容/播放接口。
- Next staging Nginx、systemd、构建缓存、部署与回滚链。
- 既有会员、收藏、历史、设备、互动和播放进度。
- 旧 URL 的 `301/410` 迁移规则。
- 产品优化、API、运维和迁移矩阵文档。

## 审计开始时的未提交迭代

未提交内容不是一个单一功能，主要分为以下几组：

| 迭代组             | 代表路径                                                                     | 当前含义                                        |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| React 首屏与性能   | `AppShell.tsx`、`layout.tsx`、`next.config.ts`、`verify-next-prerender.mjs`  | Session-first 静态壳、预渲染验证和构建调整      |
| Lighthouse 门禁    | `.github/workflows/ci.yml`、`lighthouserc.cjs`、fixture/start 脚本           | 固定 fixture 下的体积硬预算和实验室指标 warning |
| 线路质量           | `sourceQuality.ts`、`SourceQualityPanel.tsx`、偏好与测试                     | React 读取服务端线路抽样并辅助选线              |
| React 游戏页       | `src/app/games/**`、`GamesPages.tsx`、`multiplayer-games.js`                 | 干净 URL、会员分支和联机 bridge                 |
| 账号、播放器与导航 | `AccountPages.tsx`、`ContentPages.tsx`、`MacCmsPlayer.tsx`、`SiteHeader.tsx` | 当前迭代的会话、原生播放和五主题行为            |
| 部署与路由         | `ops/nginx/react.ping2.my.conf`、`deploy-next-web.sh`                        | staging 游戏桥、sourceQuality 和 API smoke 扩展 |
| 发布输入           | `release-input-fingerprint.mjs` 与测试                                       | 把新增运行时/配置纳入构建指纹                   |
| 文档               | `overview`、`addons`、`pingfangapi`、迁移矩阵、运维、主题说明                | 对齐当前工作区能力和边界                        |

审计开始时的完整 `git status --short` 包含：

```text
M  .github/workflows/ci.yml
M  .gitignore
M  apps/web/deploy/package-lock.json
M  apps/web/deploy/package.json
M  apps/web/e2e/react-migration.spec.ts
M  apps/web/next.config.ts
M  apps/web/package.json
M  apps/web/src/app/App.test.tsx
M  apps/web/src/app/AppShell.tsx
M  apps/web/src/app/layout.tsx
M  apps/web/src/app/routing.tsx
M  apps/web/src/components/CaptchaField.tsx
M  apps/web/src/components/ContentBoundary.test.tsx
M  apps/web/src/components/ContentBoundary.tsx
M  apps/web/src/components/MacCmsPlayer.test.tsx
M  apps/web/src/components/MacCmsPlayer.tsx
M  apps/web/src/components/SiteHeader.test.tsx
M  apps/web/src/components/SiteHeader.tsx
M  apps/web/src/migrationRoutes.test.ts
M  apps/web/src/migrationRoutes.ts
M  apps/web/src/screens/AccountPages.tsx
M  apps/web/src/screens/CatalogPages.tsx
M  apps/web/src/screens/ContentPages.tsx
M  apps/web/src/styles/index.css
M  docs/addons.md
M  docs/development-and-operations.md
M  docs/overview.md
M  docs/pingfangapi.md
M  docs/react-template-migration-matrix.md
M  docs/theme-and-preview.md
M  ops/nginx/react.ping2.my.conf
M  package-lock.json
M  package.json
M  scripts/deploy-next-web.sh
M  scripts/release-input-fingerprint.mjs
M  template/pingfangvideo/js/multiplayer-games.js
M  tests/release-input-fingerprint.test.mjs
M  tests/template.test.mjs
?? apps/web/src/api/sourceQuality.test.ts
?? apps/web/src/api/sourceQuality.ts
?? apps/web/src/app/games/
?? apps/web/src/app/routing.test.tsx
?? apps/web/src/components/SourceQualityPanel.test.tsx
?? apps/web/src/components/SourceQualityPanel.tsx
?? apps/web/src/screens/GamesPages.module.css
?? apps/web/src/screens/GamesPages.test.tsx
?? apps/web/src/screens/GamesPages.tsx
?? apps/web/src/sourceQualityPreference.test.ts
?? apps/web/src/sourceQualityPreference.ts
?? docs/knowledge-base/
?? docs/superpowers/plans/2026-07-30-react-performance-optimization.md
?? lighthouserc.cjs
?? scripts/create-lighthouse-fixture.php
?? scripts/start-lighthouse-web.sh
?? scripts/verify-next-prerender.mjs
```

## 已核验但不能越界的事实

本轮并行只读核验确认：

- 当前文件系统有 84 个 MacCMS HTML 模板。
- 当前文件系统有 32 个 Next `page.tsx` 和 3 个 Route Handler。
- 生产 BFF 有 28 个 JSON action，另有 `player`、`stream` 两个入口。
- React 与 MacCMS 主题都已有五套主题。
- 默认打包有五个归档，Next standalone 另走独立发布链。
- Figma 基线仍绑定旧 MacCMS source roots，不能证明当前 React 覆盖。

主题/播放器核验任务实际运行并通过：

```text
npm run lint:template
npm run verify:compat
npm run verify:preview
node tests/player-runtime.test.mjs
node tests/template.test.mjs
```

当前机器没有 Docker CLI，因此没有执行 `docker compose config` 或容器 HTTP 验收。其他结论来自源码和配置审查；不能据此声称整个未提交工作区已经通过 `npm test`、lint、typecheck、E2E、build、Lighthouse 或发布门禁。

本轮知识库整理没有执行部署、回滚、数据库修改、Git stage、commit、push 或 PR。

## 提交和发布前仍需完成

1. 明确这 38 个 tracked 变化和 17 个 untracked 路径是否属于同一个发布范围。
2. 重新运行完整单元、lint、类型、E2E、build、模板、兼容和预览门禁。
3. 单独确认 Lighthouse 的 warning 与 hard budget 结果。
4. 核对 Nginx、PHP FPM socket、Node、systemd、TLS 和真实域名环境。
5. 若发布 API 与 React，先保持 API 向后兼容，再切换 Web。
6. 分开记录 MacCMS、Next、游戏和数据库的回滚目标。
7. 获得明确授权后再部署；当前工作区内容存在不等于已授权发布。

## 刷新命令

```bash
git branch --show-current
git rev-parse --short HEAD
git merge-base master HEAD
git rev-list --left-right --count master...HEAD
git log --oneline master..HEAD
git diff --stat master...HEAD
git status --short
```

更新本快照时应创建新的带日期文档，不要覆盖旧快照来伪装历史没有变化。
