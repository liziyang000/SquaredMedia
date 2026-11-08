# 项目文档导航

从 [项目总览](overview.md) 了解目录和发布单元，再按任务查阅下列文档。

## 当前规范与模块说明

| 文档 | 内容 |
| --- | --- |
| [MacCMS 主题开发规范](maccms-theme-development-spec.md) | 模板结构、标签与修改门禁 |
| [主题与本地预览](theme-and-preview.md) | 生产主题、静态预览与 PHP 预览的边界 |
| [MacCMS 插件](addons.md) | 设备会话、VodOps 与豆瓣模块 |
| [开发、发布与数据运维](development-and-operations.md) | 环境、验证、打包、部署与回滚 |
| [工程脚本导航](../scripts/README.md) | 脚本目录和常用命令 |

## 操作手册：`runbooks/`

- [主题与插件手动部署](runbooks/manual-theme-addon-deployment.md)
- [服务器重置后恢复记录](runbooks/server-reset-recovery-runbook.md)
- [视频分类整理](runbooks/maccms-vod-category-maintenance.md)
- [视频海报修复](runbooks/maccms-vod-poster-repair.md)

操作手册中的命令以仓库根目录为工作目录，另有 `cd` 说明的步骤除外。

## 历史与审计资料

- `audits/`：带日期的审计快照，例如 [2026-07-16 海报采集站命中清单](audits/vod-poster-provider-matches-20260716.md)。快照只代表生成时的状态。
- `superpowers/specs/`、`superpowers/plans/`：历史设计和实施方案。
- [项目管理](../项目管理/README.md)：Obsidian 项目、任务、里程碑和 Codex 对话档案。

历史设计和对话中的路径保留当时的记录；查找当前文件以本导航、项目总览和源码为准。

## 生成文件

`dist/` 是发布包输出，`output/` 是本地验证截图和临时报告；两者均不进入 Git。
Figma 插件的 `scripts/figma-product-baseline/code.js` 也由源码生成，构建方式见该工具的 [说明](../scripts/figma-product-baseline/README.md)。
