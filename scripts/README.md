# 工程脚本导航

所有命令都从仓库根目录运行，常用操作优先使用 `package.json` 中已有的 npm 命令。
目录调整后 npm 命令名称保持一致。

| 目录 | 脚本 | 入口 |
| --- | --- | --- |
| `build/` | `package-theme.mjs`、`package-player.mjs`、`package-game-server.mjs` | `npm run package`、`npm run package:player`、`npm run package:games` |
| `verify/` | `lint-template.mjs`、`verify-compat.mjs`、`verify-preview.mjs` | `npm run lint:template`、`npm run verify:compat`、`npm run verify:preview` |
| `verify/` | `verify-release.mjs`、`verify-player-release.mjs`、`verify-game-server-release.mjs` | `npm run verify:release` 及各单独检查命令 |
| `deploy/` | `deploy-theme.sh`、`deploy-game-server.sh`、`rollback-theme.sh` | `npm run deploy`、`npm run deploy:vodops`、`npm run deploy:games`、`npm run rollback` |
| `deploy/` | `deploy-ping2.env` | `source scripts/deploy/deploy-ping2.env`，只保存非密码连接参数 |
| `data/` | `repair-vod-posters.php`、`maccms-vod-category-maintenance.sql` | 按操作手册显式执行 |
| `figma-product-baseline/` | 独立的 Figma 设计基线工具 | [构建与使用说明](figma-product-baseline/README.md) |

`build/player-manifest.mjs` 保存播放器打包与验证共用的文件白名单和固定依赖版本；发布测试独立定义预期产物。

## 本地验证与打包

```bash
npm test
npm run lint
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release
```

`npm run package` 重建 `dist/`；浏览器截图和临时报告放入 `output/`。这些目录均被 Git 忽略。

## 部署与数据维护

- [主题与插件手动部署](../docs/runbooks/manual-theme-addon-deployment.md)：部署环境参数、主题及插件发布范围、备份和回滚。
- [开发、发布与数据运维](../docs/development-and-operations.md)：完整发布流程与联机游戏服务部署。
- [分类整理](../docs/runbooks/maccms-vod-category-maintenance.md)与[海报修复](../docs/runbooks/maccms-vod-poster-repair.md)：数据库备份、预演及显式写入流程。

本地验证和打包不调用部署或数据库维护脚本。数据维护工具不加入普通发布链。
