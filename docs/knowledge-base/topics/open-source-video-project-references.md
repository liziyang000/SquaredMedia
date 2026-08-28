# 开源影视项目参考分析

最后核验：2026-08-24

文档状态：外部项目参考，不代表 SquaredMedia 当前实现或已批准路线

适用范围：React 前台、多播放源、采集与数据治理、部署形态和后续产品规划

## 事实边界

- 本文按下表中的固定提交核验，后续项目实现、许可证和维护状态可能变化，正式采用前必须重新检查。
- 仓库许可证只约束代码复用，不代表其中配置的影视源、海报、字幕或影片内容已经获得授权。
- “可参考”优先表示复用产品思路、数据流程或接口边界；是否可以复制代码仍需单独核对许可证、依赖许可证和版权来源。
- 当前 SquaredMedia 仍以 MacCMS 作为内容、账号和权限核心，并由同源 BFF 隐藏原始 `vod_play_url`。外部项目不能覆盖这一现有安全边界。

## 核心结论

四个项目并不是四套等价方案，各自最适合参考的部分不同：

1. **GoFilm** 对当前“完善元数据、识别重复影片、一个影片保留多条播放线路”的目标最有价值，重点参考采集任务、主从来源和多线路聚合思路。
2. **LunaTV** 最适合参考多源搜索的渐进反馈、来源配置、跨设备历史与收藏、PWA 和移动端体验。
3. **LibreTV** 最适合参考轻量播放器降级、来源适配器和不同托管平台的部署入口，但其浏览器直连与代理边界不适合直接进入现有生产架构。
4. **OrangeTV** 展示了短剧、弹幕、聊天、好友、主题等扩展方向，更适合作为需求候选库，不适合作为当前数据治理或前台架构基线。

没有一个项目在本次核验快照中提供完整的 TMDB 元数据归一、人工复核、审计和可回滚合并链路。因此，四者都不能直接解决“可靠补齐年份、语言、类型、地区、简介和演员”的全部问题；这部分仍应由 SquaredMedia 的 VodOps 加上独立的可信元数据网关完成。

## 项目与固定快照

| 项目     | 仓库                                                        | 核验提交                                                                                           | 主要技术形态                                            | 根许可证                                                                                                       | 对本项目的参考价值                   |
| -------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| LunaTV   | [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV) | [`388089d`](https://github.com/MoonTechLab/LunaTV/commit/388089d2a1799c2b2ef7c17357dc7c5b19d8f26f) | Next.js、TypeScript、Tailwind、Redis 兼容存储           | [CC BY-NC-SA 4.0](https://github.com/MoonTechLab/LunaTV/blob/388089d2a1799c2b2ef7c17357dc7c5b19d8f26f/LICENSE) | 多源搜索、配置、跨设备状态和 PWA     |
| OrangeTV | [djteang/OrangeTV](https://github.com/djteang/OrangeTV)     | [`2194a3d`](https://github.com/djteang/OrangeTV/commit/2194a3d6adf6cc169a32a18cea5b37bc2f93b2e7)   | Next.js、TypeScript、自定义 Node/WebSocket 服务         | [CC BY-NC-SA 4.0](https://github.com/djteang/OrangeTV/blob/2194a3d6adf6cc169a32a18cea5b37bc2f93b2e7/LICENSE)   | 短剧、弹幕、社交和主题候选功能       |
| LibreTV  | [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV) | [`78ee8bb`](https://github.com/LibreSpark/LibreTV/commit/78ee8bbacc6494b58d0d03e4a1d3879f4cf5ccee) | 原生 HTML/CSS/JavaScript、Artplayer/HLS、多平台适配器   | [Apache-2.0](https://github.com/LibreSpark/LibreTV/blob/78ee8bbacc6494b58d0d03e4a1d3879f4cf5ccee/LICENSE)      | 轻量播放器、部署适配与故障降级       |
| GoFilm   | [ProudMuBai/GoFilm](https://github.com/ProudMuBai/GoFilm)   | [`7a578dd`](https://github.com/ProudMuBai/GoFilm/commit/7a578dd64287dc767a67b19aefc5a870016e0de1)  | Vue/Vite 前台、Go/Gin/GORM/Colly/Cron 后台、MySQL/Redis | [MIT](https://github.com/ProudMuBai/GoFilm/blob/7a578dd64287dc767a67b19aefc5a870016e0de1/LICENSE)              | 采集、来源管理、定时更新和多线路聚合 |

> LunaTV 和 OrangeTV 的说明文字存在 MIT 表述，但固定快照的根 `LICENSE` 文件是 CC BY-NC-SA 4.0。评估代码复用时应以根许可证和权利人的进一步确认为准，不能按 README 中的旧表述直接复制到商用项目。

## 分项目分析

### LunaTV：参考多源检索与渐进反馈

值得参考：

- 用统一配置描述多个 AppleCMS V10 来源，并允许启用、停用和调整来源顺序。
- 搜索接口按来源逐步返回结果，让用户先看到已完成的来源，而不是等待最慢来源全部结束。
- 历史、收藏和用户配置可以落到 Redis 兼容存储，实现跨设备同步；无服务端存储时再降级到本地状态。
- PWA、响应式导航、键盘操作和播放器状态延续适合吸收进 React 前台的体验路线。

对 SquaredMedia 的正确落法：

- 多源检索应由服务端受控来源注册表发起，并返回统一事件，例如 `source_started`、`source_result`、`source_failed` 和 `complete`。
- React 只展示来源名称、耗时、状态和规范化结果，不接收来源密钥、采集接口或原始播放地址。
- 搜索结果先生成候选，不直接写入 `mac_vod`；写入仍经过 VodOps 的预览、确认、审计和冲突校验。

不建议照搬：

- 浏览器直接保存任意上游地址或原始媒体链接。
- 自动跳过片头广告等依赖媒体内容识别的实验能力，稳定性、误判和合规成本都高于当前收益。
- 在未确认非商业许可证兼容性前复制实现代码。

证据入口：[项目说明](https://github.com/MoonTechLab/LunaTV/blob/388089d2a1799c2b2ef7c17357dc7c5b19d8f26f/README.md)、[渐进搜索路由](https://github.com/MoonTechLab/LunaTV/blob/388089d2a1799c2b2ef7c17357dc7c5b19d8f26f/src/app/api/search/ws/route.ts)、[下游请求封装](https://github.com/MoonTechLab/LunaTV/blob/388089d2a1799c2b2ef7c17357dc7c5b19d8f26f/src/lib/downstream.ts)

### OrangeTV：参考功能清单，不参考整体复杂度

值得参考：

- 在 LunaTV 类能力上继续扩展短剧、弹幕、聊天、好友和主题，能作为后续产品评审的候选清单。
- WebSocket 的断线重连、心跳和可见连接状态，是未来确实引入实时能力时需要具备的基础行为。
- 弹幕、聊天和短剧被拆成独立路由，说明这些能力可以单独立项，不必与核心点播同时上线。

对 SquaredMedia 的正确落法：

- 只把它当作 P2/P3 产品候选库；先完成元数据质量、播放线路治理和 React 切换，再评估实时功能。
- 如果以后增加弹幕或聊天，需要先定义身份、限流、审核、举报、屏蔽、留存和管理后台，不能只完成消息收发。
- 主题只能来自受控 Token 和组件变体，不允许把任意 CSS 当作普通用户配置直接注入生产页面。

不建议照搬：

- 为少量实时功能立刻切换到自定义 Next.js 服务，这会增加部署、扩容和故障恢复复杂度。
- 上游失败时返回随机模拟内容；生产系统应显示来源失败或使用明确标记的缓存结果。
- 仅靠简单硬编码词表承担弹幕审核。
- 把聊天、弹幕、短剧和主题同时塞进当前迁移范围。

证据入口：[项目说明](https://github.com/djteang/OrangeTV/blob/2194a3d6adf6cc169a32a18cea5b37bc2f93b2e7/README.md)、[WebSocket Hook](https://github.com/djteang/OrangeTV/blob/2194a3d6adf6cc169a32a18cea5b37bc2f93b2e7/src/hooks/useWebSocket.ts)、[弹幕接口](https://github.com/djteang/OrangeTV/blob/2194a3d6adf6cc169a32a18cea5b37bc2f93b2e7/src/app/api/danmu/route.ts)、[主题管理器](https://github.com/djteang/OrangeTV/blob/2194a3d6adf6cc169a32a18cea5b37bc2f93b2e7/src/components/ThemeManager.tsx)

### LibreTV：参考适配边界与轻量降级

值得参考：

- 通过较薄的适配层支持 Cloudflare、Vercel、Netlify、Docker 和普通 Node 部署，部署入口清晰。
- 固定快照的实际页面使用 Artplayer/HLS，便于理解播放器最小闭环，可用于检查 React 播放页是否具备错误、重试和降级反馈；README 中的 DPlayer 表述已经落后于源码。
- 来源配置和 UI 的耦合较少，适合参考成 SquaredMedia 的“来源驱动器”接口，而不是为每个来源写一套页面逻辑。

对 SquaredMedia 的正确落法：

- 提取统一的来源能力协议：`search`、`detail`、`health`、`enabled`、`priority` 和分类映射。
- 部署差异只放在适配层；内容权限、播放授权和审计仍由 MacCMS/BFF 保持一致。
- 播放器降级应复用当前同源授权入口，只补充超时、线路失败、换线和可读错误状态。

不建议照搬：

- 把密码摘要或授权判断交给浏览器。
- 建立接受任意 URL 的通用 HLS/CORS 代理；这会引入 SSRF、内网探测、带宽滥用和版权风险。
- 把内容接口与媒体地址写入 URL 参数或 `localStorage`。这与当前 BFF 隐藏 `vod_play_url` 的边界相冲突。

证据入口：[项目说明](https://github.com/LibreSpark/LibreTV/blob/78ee8bbacc6494b58d0d03e4a1d3879f4cf5ccee/README.md)、[播放器实现](https://github.com/LibreSpark/LibreTV/blob/78ee8bbacc6494b58d0d03e4a1d3879f4cf5ccee/js/player.js)、[Node 服务与代理适配](https://github.com/LibreSpark/LibreTV/blob/78ee8bbacc6494b58d0d03e4a1d3879f4cf5ccee/server.mjs)

### GoFilm：重点参考采集、任务化和多线路关联

值得参考：

- 来源站点、分类映射、启停状态、更新周期和失败任务由后台管理，而不是散落在前端配置中。
- 采集链路区分远端抓取、字段转换、Redis 暂存和 MySQL 同步，适合改造成可观察、可重试的批处理任务。
- 通过主来源保存影片主体、从来源补充额外播放列表，方向上符合“总条目不增加，但同一影片保留多个播放源”。
- 设计意图上优先使用豆瓣 ID 关联来源，没有 ID 时才退回片名归一化，体现了“外部稳定 ID 优于标题”的正确顺序；其具体判空和查询实现仍有缺陷，不能照搬。

对 SquaredMedia 的正确落法：

- 保留一个规范影片实体和多个来源实体。现阶段规范实体仍是 `mac_vod`，来源实体可先保存在 VodOps 的候选与审计数据中。
- 把 GoFilm 的自动同步改造成 `抓取 -> 原始快照 -> 规范化 -> 匹配候选 -> 人工复核 -> 应用 -> 审计/回滚`。
- 合并播放线路时必须把 `vod_play_from`、`vod_play_url`、`vod_play_server` 和 `vod_play_note` 作为同一原子播放组解析和序列化，保持来源、线路、解析服务器与备注一一对齐；同来源、同集、同 URL 才可去重。
- 元数据补全只填空值；当现有值与外部值冲突时进入复核，不按“最后到达的数据”覆盖。

不建议照搬：

- 仅把片名去符号、转换数字后做哈希，就自动认定为同一影片。重拍版、同名片、季数和不同年份都会造成误合并。
- 固定快照会让 `dbId=0` 继续参与缓存和数据库查询，且存在性检查使用 `mid OR db_id`；这可能把没有外部 ID 的影片错误关联。只有经过格式校验的正数外部 ID 才能进入 ID 匹配。
- 让采集任务直接覆盖主表且缺少逐字段旧值约束、操作人、批次和回滚证据。
- 把豆瓣 ID 当作所有类型内容都一定存在的唯一键。

证据入口：[项目说明](https://github.com/ProudMuBai/GoFilm/blob/7a578dd64287dc767a67b19aefc5a870016e0de1/README.md)、[影片与多线路模型](https://github.com/ProudMuBai/GoFilm/blob/7a578dd64287dc767a67b19aefc5a870016e0de1/server/model/system/Movies.go)、[采集任务](https://github.com/ProudMuBai/GoFilm/blob/7a578dd64287dc767a67b19aefc5a870016e0de1/server/plugin/spider/Spider.go)、[定时更新](https://github.com/ProudMuBai/GoFilm/blob/7a578dd64287dc767a67b19aefc5a870016e0de1/server/plugin/spider/SpiderCron.go)、[片名归一化](https://github.com/ProudMuBai/GoFilm/blob/7a578dd64287dc767a67b19aefc5a870016e0de1/server/plugin/common/conver/Collect.go)

## 与当前 SquaredMedia 的能力映射

| 能力             | 主要参考            | 当前基础                                                      | 建议动作                                               | 优先级 |
| ---------------- | ------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| 元数据补全       | GoFilm 的任务化采集 | VodOps 已支持质量扫描、豆瓣候选、预览确认、审计与旧值冲突保护 | 增加可插拔元数据网关和字段置信度，不绕开 VodOps        | P0     |
| 重复影片合并     | GoFilm 的主从来源   | VodOps 目前只报告严格重复候选，不自动合并                     | 先做只读候选评分、差异预览和播放线路合并预览           | P0     |
| 来源注册与健康   | LunaTV、LibreTV     | MacCMS 保存播放来源，设备插件已有线路质量数据                 | 增加来源启停、优先级、分类映射、延迟与失败率后台视图   | P0     |
| 渐进多源搜索     | LunaTV              | React 已通过同源 BFF 搜索 MacCMS                              | 只对管理员采集/补全入口试验服务端流式聚合              | P1     |
| 播放器错误与换线 | LibreTV             | React 已有受控播放入口和线路质量反馈                          | 补齐超时、失败原因、换线建议和可观测指标               | P1     |
| PWA 与跨设备状态 | LunaTV              | 账号历史、收藏和 React 前台已经存在                           | 在生产切换稳定后补安装能力与离线外壳，不缓存受保护内容 | P2     |
| 短剧、弹幕、聊天 | OrangeTV            | 当前不是核心能力                                              | 单独立项并先设计治理与运维闭环                         | P3     |

当前项目事实以 [当前项目深度总览](current-project-deep-dive.md)、[Web 前台](../../web-frontend.md)、[PingFang API](../../pingfangapi.md) 和 [VodOps 插件说明](../../addons.md) 为准。

表中的“当前基础”只表示此仓库实现已经具备相应代码，生产部署、数据状态和实际运行结果仍需现场确认。当前 VodOps 修复白名单只覆盖父分类、年份、地区、语言和海报；简介、演员、播放数据和重复影片仍不能由质量修复侧栏自动写入或合并。

## 重复数据与多播放源的建议规则

### 1. 把“相同影片”分成证据等级

| 等级 | 匹配证据                                                     | 默认处理                               |
| ---- | ------------------------------------------------------------ | -------------------------------------- |
| A    | 相同且已验证的 TMDB、豆瓣或其他权威外部 ID                   | 可生成高置信候选，仍显示字段与线路差异 |
| B    | 规范标题、年份、内容类型、季数一致，地区或主要演员可交叉确认 | 进入人工复核，不自动应用               |
| C    | 仅标题相似，或标题相同但年份、类型、季数缺失/冲突            | 保持独立，只提示可能重复               |

禁止仅凭片名或片名哈希自动合并。外部 ID 也要记录来源和核验时间，防止上游错误或 ID 被人工填错。

### 2. 合并后仍只有一个规范条目

- 选定一条 `mac_vod` 作为保留记录，其他记录先进入待归档状态，不立即删除。
- 归档前先盘点所有与影片 ID 关联的数据，至少覆盖 `mac_ulog` 中的收藏/历史、VodOps/豆瓣任务与元数据、线路质量和其他业务表；为旧 ID 建立迁移或别名映射，验证关联数据全部落到保留 ID 后才能归档或删除。
- 年份、语言、类型、地区、简介和演员只补空值；冲突值按来源可信度和人工选择处理。
- 所有播放组先用项目现有解析器拆分，把 `vod_play_from`、`vod_play_url`、`vod_play_server` 和 `vod_play_note` 作为同一原子播放组，再按“来源 + 剧集 + URL”去重和重新序列化，禁止直接拼接字符串。
- 同一来源的不同 URL、不同清晰度或不同线路是否保留，必须由明确规则决定，不能误删成一条。
- `vod_total` 表示总集数，不表示数据库条目总数，也不用于记录合并了多少重复项。
- 应用前保存候选记录、保留记录、字段差异、播放线路差异和备份定位；应用后保存操作者、批次、时间和逐字段前后值。
- 落地前现场确认生产表引擎；若仍是 MyISAM，不能假设事务可以完整回滚，每个写入批次都要先生成可验证备份。

### 3. 建议的最小执行链路

1. 只读扫描：发现缺字段、严格重复和可能重复候选。
2. 元数据查询：从受控来源获取原始响应，并保存来源、时间和请求键。
3. 规范化：统一标题、年份、地区、语言、类型、人物和简介格式，但保留原值。
4. 候选评分：按外部 ID、年份、类型、季数和人物证据生成原因可解释的评分。
5. 管理员预览：并排显示保留条目、候选条目、字段取值和各自播放线路。
6. 关联迁移预览：列出收藏、历史、任务、元数据和其他外键/逻辑关联的迁移数量与冲突规则。
7. 确认应用：使用读取到的旧值作为条件更新，遇到并发修改返回冲突。
8. 审计与回滚：可以按单条或批次恢复字段、播放线路和关联映射；完成观察期后再决定是否删除冗余记录。

## 推荐实施顺序

### P0：先做数据和来源基础

1. 为 VodOps 增加“可能重复”只读候选，不改变当前严格重复扫描和不自动写主表的边界。
2. 定义来源注册表：来源 ID、类型、接口地址、启停、优先级、分类映射、速率限制和健康状态。
3. 定义规范化和匹配评分规则，并用已确认的重复/非重复样本建立回归测试。
4. 增加播放线路与关联数据合并预览；成功标准是保留条目数符合管理员选择、四个播放字段始终对齐、原线路无意外丢失、收藏和历史等关联记录仍指向可用影片。

### P1：再提高操作效率

1. 为管理员的元数据搜索做 LunaTV 式渐进结果，不先改公开站搜索。
2. 展示每个来源的延迟、失败原因、最后成功时间和候选命中率。
3. 增加批次暂停、继续、失败重试和明确的部分成功状态。

### P2/P3：最后评估体验扩展

- PWA、快捷键和移动端安装可以在 React 生产切换稳定后独立评估。
- 短剧、弹幕、聊天和主题扩展必须单独立项，不能与数据合并工程绑定发布。

## 暂不采用

- 不把四个项目中的任何一个整体替换现有 MacCMS、React 或 BFF。
- 不允许前端直接配置任意采集地址、媒体地址或通用代理目标。
- 不按标题哈希自动合并数据库记录。
- 不在上游失败时用随机模拟数据伪装成功。
- 不在缺少审核与举报闭环时上线弹幕或聊天。
- 不因仓库可访问就默认代码、影片源和内容均可商用。
