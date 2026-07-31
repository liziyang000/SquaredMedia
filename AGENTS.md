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
npm run lint
npm run lint:template
npm run verify:compat
npm run verify:preview
```

## 仓库上下文索引

- [项目总览](docs/overview.md)：项目定位、顶层目录、模块边界、核心工作流与当前已知限制。
- [Next.js 前台](docs/web-frontend.md)：`apps/web` 的路由、渲染、API、播放、游戏、构建发布和证据边界。
- [主题与本地预览](docs/theme-and-preview.md)：`template/pingfangvideo`、`preview`、`server` 与 `docker` 的职责、渲染关系和开发约束。
- [MacCMS 插件](docs/addons.md)：`pingfangdevice`、`videolint` 的入口、数据、安装链路、安全边界与测试定位。
- [生产 API](docs/pingfangapi.md)：`pingfangapi` 的 action、DTO、权限、播放授权和 MacCMS OpenAPI 复用边界。
- [React 模板迁移矩阵](docs/react-template-migration-matrix.md)：84 个旧模板到 React、后端保留或退场路径的逐项归属。
- [开发、发布与数据运维](docs/development-and-operations.md)：测试、兼容验证、打包、部署、回滚、CI 和数据库维护工具。
- [项目知识库](docs/knowledge-base/README.md)：当前项目深度总览、带日期工作区快照和商用参考架构。

`docs/superpowers/` 下的带日期方案用于追溯历史决策，不是当前实现索引；判断现状时以代码、上述上下文文档和对应操作手册为准。
