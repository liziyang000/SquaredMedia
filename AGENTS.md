# Repository Instructions

For all MacCMS theme development in this repository, follow
`docs/maccms-theme-development-spec.md`.

The official source of truth is the MacCMS theme documentation at
https://www.maccms.la/theme. Before changing any template module, read the
matching official page and keep the implementation aligned with documented
template structure, tags, parameters, fields, URL helpers, and pagination
patterns.

Do not introduce production references to local preview files, localhost,
Docker, npm commands, or other development-only resources under
`template/pingfangvideo/**`.

Run the relevant verification before claiming a theme change is complete:

```bash
npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
```

## 仓库上下文索引

- [项目总览](docs/overview.md)：项目定位、顶层目录、模块边界、核心工作流与当前已知限制。
- [主题与本地预览](docs/theme-and-preview.md)：`template/pingfangvideo`、`preview`、`server` 与 `docker` 的职责、渲染关系和开发约束。
- [MacCMS 插件](docs/addons.md)：`pingfangdevice`、`videolint` 的入口、数据、安装链路、安全边界与测试定位。
- [开发、发布与数据运维](docs/development-and-operations.md)：测试、兼容验证、打包、部署、回滚、CI 和数据库维护工具。

`docs/superpowers/` 下的带日期方案用于追溯历史决策，不是当前实现索引；判断现状时以代码、上述上下文文档和对应操作手册为准。
