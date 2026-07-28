# PingFang 联机游戏服务

该服务为五子棋和你画我猜提供短连接鉴权、内存房间和服务端权威规则。它默认只监听 `127.0.0.1:8787`，由站点 Nginx 把同源 `/game-socket` 升级请求反向代理到本进程。

## 配置

必须设置：

- `GAME_TICKET_SECRET`：至少 32 个字符，必须与 MacCMS 后台 `pingfangdevice` 插件中的“联机游戏签名密钥”一致。
- `GAME_ALLOWED_ORIGINS`：允许的站点 Origin，多个值用逗号分隔，例如 `https://www.example.com`。

可选设置：

- `GAME_HOST`：默认 `127.0.0.1`。
- `GAME_PORT`：默认 `8787`。
- `GAME_SOCKET_PATH`：默认 `/game-socket`，必须与插件配置和 Nginx location 一致。

可用 `openssl rand -base64 48` 生成密钥。密钥只写入服务器的受限环境文件和 MacCMS 插件配置，不要提交到仓库。

## 本地启动

从仓库根目录执行：

```bash
GAME_TICKET_SECRET='replace-with-at-least-32-characters' \
GAME_ALLOWED_ORIGINS='http://127.0.0.1:8080' \
npm run start:games
```

健康检查为 `http://127.0.0.1:8787/healthz`。联机页面还需要 MacCMS 的登录会话和 `pingfangdevice/gameTicket` 接口，仅启动 Node 进程不会绕过会员鉴权。

浏览器会为每个游戏标签页生成并随票据签名的随机 `client_id`。同一账号可以在不同标签页占据不同席位；同一标签页的网络重连继续使用原身份。房间链接只携带六位 `room` 参数，不包含登录 Cookie 或联机票据。

## 生产安装

`npm run package` 会生成自包含的 `dist/pingfanggames-server.tar.gz`，其中包括固定版本的 `ws` 运行依赖。完整发布使用 `npm run deploy`；仅更新服务可使用 `npm run deploy:games`。部署脚本把版本解压到 `/opt/pingfanggames/releases/<时间戳>`，原子切换 `current`，同步插件密钥、systemd 与 Nginx，并在健康检查失败时恢复上一版本。

房间仅保存在进程内存中：服务重启后房间会结束。单条消息上限为 16 KiB，WebSocket 压缩关闭；断线席位保留 45 秒用于重连，超时后自动清理，空房间同样在 45 秒后回收。当前版本不保存聊天、画作、战绩或排行榜。
