> 历史记录：2026-09-29，VodMerge 1.1.0。本文保留当时的部署与验证状态；当前安装、升级和操作以 [VodMerge 使用说明](../../../addons/vodmerge/README.md) 为准，本文不作为 1.8 或当前线上状态的验收依据。

# VodMerge 1.1 服务器部署记录

部署日期：2026-09-29。服务器：`144.34.184.95:814`；站点：`/www/wwwroot/squaredMedia`。

## 已安装

- 归档：`vodmerge-1.1.0.zip`，SHA-256：`b8abd02ea8d58d82c6736d297a207ec99e22e40c579091d75e2ae3f408bcc51c`。21 个文件与上一轮已验证源码一致，三个应用载荷已核对内容一致。
- 插件目录：`addons/vodmerge/`；通过 CLI 安装两个 InnoDB 表 `mac_vodmerge_job`、`mac_vodmerge_binding`。
- 后台：[采集去重与合并](https://www.ping2video.xyz/squaredMediaAdmin.php/admin/vodmerge/index.html)，已追加后台快捷入口。
- 采集接口：`POST https://www.ping2video.xyz/api.php/vodmerge/submit`，遵循插件 README 的 HMAC 签名协议。
- 每分钟以 `www` 用户运行 Worker：`/etc/cron.d/vodmerge-squaredmedia`；日志：`runtime/log/vodmerge-worker.log`，每周轮转并保留 4 份。
- 自动首次绑定、来源自动补集均保持关闭。采集脚本尚未切换至新接口。
- 独立采集签名密钥在服务器生成；`application/extra/vodmerge.php` 权限为 `www:www 0640`。密钥未写入本记录或聊天。

## 备份与回退

备份位于 `/www/backup/vodmerge-20260929.XiRcdM/`，目录仅 root 可访问；包含约 243 MB 的数据库压缩备份、校验和、原快捷菜单和原 crontab，以及部署记录。压缩完整性校验通过。

数据库采用非阻塞导出，MyISAM 表不具备事务快照一致性保证。本次安装与验收没有修改已有视频，不能把该备份描述为跨表一致性快照。

普通代码回退应先停用本插件的 Cron，保留当前插件、三个应用载荷及密钥配置到备份目录，再撤下新增文件，撤回快捷菜单中的 VodMerge 项。保留插件表和审计记录；不要为代码回退直接覆盖整个数据库，也不要覆盖部署后的其他菜单修改。具体路径见服务器备份中的 `deployment.txt`。

## 服务器验证

- PHP 8.2.33、PDO MySQL、cURL、mbstring 可用；原生 MacCMS 初始化成功，读取到 34 个播放器配置。
- 两个独立 MySQL 会话验证同名 `GET_LOCK` 的互斥和释放，结果为 `1 / 0 / 1`。
- PHP-FPM 接口：GET 返回 405；未签名 POST 返回 401；已签名非法载荷返回 422。
- 已签名虚构资源首次提交返回 202，重试返回 200 且复用任务 #1。
- CLI Worker 和真实 Cron 均将测试任务转为 `review/no_candidates`；`vod_id=0`，视频表无测试视频、来源绑定表为 0 行。
- 测试任务完成后标记为 `rejected`，保留审计，不删除记录。
- 公网接口的 405/401 行为正常；未登录后台返回 302 并跳转原生登录页。
- 首页复测返回 200。期间出现一次 SSH 建连超时和一次首页请求超时，后续均恢复，没有重新部署主题或修改网络配置。

## 待完成

- Jev 密钥：自动审批拒绝将本机 TypeSafe API 密钥发送并持久化到服务器，要求用户明确授权这一凭据与目的地。当前服务器配置中该项为空，未绕过审批。
- 后台登录后页面、连续操作及 CSRF 实际请求验收：已打开登录页，请用户自行登录；没有伪造登录或读取账号密码。
- 真实资源的首次绑定、补集、回滚及播放验收仍需在选定测试资源上完成；本次不以虚构入队测试替代真实视频验收。

服务器原有 PHP 启动时提示 `mbstring` 重复加载；本次不修改 PHP 配置。
