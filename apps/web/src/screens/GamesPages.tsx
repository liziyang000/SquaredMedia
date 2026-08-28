"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAccount } from "../app/AccountContext";
import { Link, useNavigate, useSearchParams } from "../app/routing";
import { PageStatus } from "../components/PagePrimitives";
import { bambooCicadaOfficialUrl, bambooCicadaRepositoryUrl } from "../gameLinks";
import styles from "./GamesPages.module.css";

type GameSlug = "2048" | "blockrain" | "bamboo-cicada" | "gomoku" | "drawguess";
type PlayableGameSlug = Exclude<GameSlug, "bamboo-cicada">;

type GameDefinition = {
  slug: GameSlug;
  eyebrow: string;
  title: string;
  description: string;
  cardDescription: string;
  category: string;
  controls: string;
  action: string;
  multiplayer: boolean;
  loginTitle: string;
  loginDescription: string;
};

const gameDefinitions = {
  "2048": {
    slug: "2048",
    eyebrow: "NUMBER PUZZLE",
    title: "2048",
    description: "使用方向键或在棋盘上滑动，让相同数字合并。",
    cardDescription: "合并相同数字，在有限棋盘里冲击 2048。",
    category: "数字益智",
    controls: "键盘 · 滑动",
    action: "开始游戏",
    multiplayer: false,
    loginTitle: "登录后才能开始游戏",
    loginDescription: "登录会员账号后即可进入 2048，未登录状态不会加载游戏脚本。"
  },
  blockrain: {
    slug: "blockrain",
    eyebrow: "BLOCK PUZZLE",
    title: "俄罗斯方块",
    description: "完成整行即可消除。支持方向键、WASD 和棋盘下方触控按钮。",
    cardDescription: "旋转、移动、快速下落，在节奏加快前完成整行消除。",
    category: "经典消除",
    controls: "键盘 · 触控",
    action: "开始游戏",
    multiplayer: false,
    loginTitle: "登录后才能开始游戏",
    loginDescription: "登录会员账号后即可进入俄罗斯方块，未登录状态不会加载游戏脚本。"
  },
  "bamboo-cicada": {
    slug: "bamboo-cicada",
    eyebrow: "OFFICIAL EXPERIENCE",
    title: "竹知了",
    description: "由 imsai-sh 制作的竹知了 Web 模拟，试玩由作者官方网站提供。",
    cardDescription: "前往作者官方站，体验手机优先、支持触摸和体感操作的竹知了 Web 模拟。",
    category: "传统声响玩具",
    controls: "官方站 · 触摸体感",
    action: "官方试玩",
    multiplayer: false,
    loginTitle: "竹知了官方试玩",
    loginDescription: "竹知了由作者官方网站提供。"
  },
  gomoku: {
    slug: "gomoku",
    eyebrow: "LIVE BOARD",
    title: "联机五子棋",
    description: "创建房间后把六位房间码发给好友，黑方先手，胜负由房间服务统一判定。",
    cardDescription: "创建六位房间码邀请好友，轮流落子，率先连成五子获胜。",
    category: "双人对弈",
    controls: "实时联机",
    action: "创建对局",
    multiplayer: true,
    loginTitle: "登录后才能联机对弈",
    loginDescription: "五子棋房间仅向已登录会员开放，未登录状态不会请求联机票据或加载游戏脚本。"
  },
  drawguess: {
    slug: "drawguess",
    eyebrow: "DRAW TOGETHER",
    title: "联机你画我猜",
    description: "2–8 人轮流作画，每人一轮；答案只发送给当前画手，猜中越快得分越高。",
    cardDescription: "轮流作画、实时猜题，答案仅对当前画手可见。",
    category: "聚会互动",
    controls: "2–8 人联机",
    action: "创建房间",
    multiplayer: true,
    loginTitle: "登录后才能加入画室",
    loginDescription: "你画我猜房间仅向已登录会员开放，未登录状态不会请求联机票据或加载游戏脚本。"
  }
} satisfies Record<GameSlug, GameDefinition>;

const gameOrder: GameSlug[] = ["2048", "blockrain", "bamboo-cicada", "gomoku", "drawguess"];
const ticketEndpoint = "/index.php/pingfangdevice/gameTicket";
const roomPattern = /^[A-Z2-9]{6}$/;

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function normalizedRoom(value: string | null) {
  const room = String(value || "")
    .trim()
    .toUpperCase();
  return roomPattern.test(room) ? room : "";
}

function frameBridgeScript() {
  return `
<script>
(function () {
  "use strict";
  var parentOrigin = "*";
  var observer = null;
  try {
    parentOrigin = new URL(document.referrer).origin;
  } catch (error) {}

  function post(payload) {
    if (window.parent !== window) window.parent.postMessage(payload, parentOrigin);
  }

  function applyTheme(theme) {
    if (typeof theme === "string" && /^[a-z0-9-]{1,40}$/.test(theme)) {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function reportHeight() {
    post({
      type: "pingfang:game-frame-height",
      height: Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))
    });
  }

  function receive(event) {
    if (event.source !== window.parent || (parentOrigin !== "*" && event.origin !== parentOrigin)) return;
    if (!event.data || event.data.type !== "pingfang:game-theme") return;
    applyTheme(event.data.theme);
    window.requestAnimationFrame(reportHeight);
  }

  try {
    applyTheme(window.parent.document.documentElement.dataset.theme || "");
  } catch (error) {}
  window.addEventListener("message", receive);
  window.addEventListener("load", reportHeight, { once: true });
  if ("ResizeObserver" in window) {
    observer = new ResizeObserver(reportHeight);
    observer.observe(document.documentElement);
  }
  window.addEventListener("pagehide", function () {
    window.removeEventListener("message", receive);
    if (observer) observer.disconnect();
  }, { once: true });
})();
</script>`;
}

function gameDocument(body: string, scripts: string, title: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeAttribute(title)}</title>
  ${frameBridgeScript()}
  <link rel="stylesheet" href="/template/pingfangvideo/css/style.css">
  <style>
    html, body { min-height: 100%; }
    body { overflow: hidden; }
    .react-game-frame-root { width: 100%; padding: 2px; }
    .react-game-frame-root .game-stage-panel { min-height: 620px; }
    .react-game-frame-root .multiplayer-layout { margin: 0; }
    @media (max-width: 760px) {
      .react-game-frame-root .game-stage-panel { min-height: 700px; }
    }
  </style>
</head>
<body>
  <div class="react-game-frame-root">${body}</div>
  ${scripts}
</body>
</html>`;
}

function game2048Document() {
  const body = `
<div class="game-stage-panel">
  <div class="game-2048">
    <div class="game-2048-toolbar">
      <div class="scores-container" aria-label="游戏分数">
        <div class="score-container">0</div>
        <div class="best-container">0</div>
      </div>
      <button class="restart-button" type="button">重新开始</button>
    </div>
    <div class="game-container" role="application" aria-label="2048 游戏棋盘">
      <div class="game-message" aria-live="polite">
        <p></p>
        <div class="lower">
          <button class="keep-playing-button" type="button">继续挑战</button>
          <button class="retry-button" type="button">再来一局</button>
        </div>
      </div>
      <div class="grid-container" aria-hidden="true">
        <div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div>
        <div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div>
        <div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div>
        <div class="grid-row"><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div><div class="grid-cell"></div></div>
      </div>
      <div class="tile-container" aria-hidden="true"></div>
    </div>
    <p class="game-control-tip"><span>电脑：方向键 / WASD</span><span>手机：在棋盘上滑动</span></p>
    <a class="game-source-link" href="https://github.com/gabrielecirulli/2048" target="_blank" rel="noopener noreferrer">基于 Gabriele Cirulli 的 2048 · MIT License</a>
  </div>
</div>`;
  const scripts = ["keyboard_input_manager.js", "html_actuator.js", "grid.js", "tile.js", "local_storage_manager.js", "game_manager.js", "application.js"]
    .map((file) => `<script src="/template/pingfangvideo/games/2048/js/${file}"></script>`)
    .join("\n");
  return gameDocument(body, scripts, "2048");
}

function blockrainDocument() {
  const body = `
<div class="game-stage-panel game-blockrain-stage">
  <div class="blockrain-shell">
    <div class="blockrain-board-column">
      <div class="blockrain-game" data-blockrain-game role="application" aria-label="俄罗斯方块游戏区域"></div>
      <div class="blockrain-controls" role="group" aria-label="俄罗斯方块触控按钮">
        <button class="blockrain-control" type="button" data-blockrain-action="left"><span aria-hidden="true">←</span><small>左移</small></button>
        <button class="blockrain-control" type="button" data-blockrain-action="rotate-left"><span aria-hidden="true">↶</span><small>左转</small></button>
        <button class="blockrain-control" type="button" data-blockrain-action="drop"><span aria-hidden="true">↓</span><small>下落</small></button>
        <button class="blockrain-control" type="button" data-blockrain-action="rotate-right"><span aria-hidden="true">↷</span><small>右转</small></button>
        <button class="blockrain-control" type="button" data-blockrain-action="right"><span aria-hidden="true">→</span><small>右移</small></button>
      </div>
    </div>
    <aside class="blockrain-next-panel" data-blockrain-next aria-label="下一个方块：准备中">
      <span class="blockrain-next-label">下一个</span>
      <span class="blockrain-next-grid" data-blockrain-next-grid aria-hidden="true"></span>
      <strong data-blockrain-next-name>准备中</strong>
    </aside>
  </div>
  <p class="game-control-tip"><span>电脑：方向键 / WASD</span><span>手机：使用棋盘下方触控按钮</span></p>
  <a class="game-source-link" href="https://github.com/Aerolab/blockrain.js" target="_blank" rel="noopener noreferrer">基于 Aerolab Blockrain.js · MIT License</a>
</div>`;
  const scripts = `
<script src="/template/pingfangvideo/games/blockrain/jquery-1.11.1.min.js"></script>
<script src="/template/pingfangvideo/games/blockrain/blockrain.jquery.min.js"></script>
<script src="/template/pingfangvideo/games/init.js"></script>`;
  return gameDocument(body, scripts, "俄罗斯方块");
}

function multiplayerDocument(game: "gomoku" | "drawguess", initialRoom: string) {
  const definition = gameDefinitions[game];
  const attributes = `data-multiplayer-game data-game-type="${game}" data-game-ticket-endpoint="${ticketEndpoint}" data-game-parent-bridge="true" data-game-invite-base="/games/${game}" data-game-room="${escapeAttribute(initialRoom)}"`;
  const roomPanel = `
<aside class="online-room-panel" aria-label="联机房间">
  <div class="online-connection" data-game-connection data-state="connecting"><i aria-hidden="true"></i><span>正在连接</span></div>
  <div class="online-room-entry" data-room-entry>
    <span class="online-kicker">开始联机</span>
    <h2>${game === "gomoku" ? "创建或加入房间" : "召集你的朋友"}</h2>
    <p>${game === "gomoku" ? "每个房间最多两人，同一账号的不同标签页也可分别加入。" : "房主分享邀请链接，至少两人即可开始；同一账号也可多页面测试。"}</p>
    <button class="primary-btn online-create-button" type="button" data-room-create disabled>${game === "gomoku" ? "创建新房间" : "创建新画室"}</button>
    <span class="online-divider">或</span>
    <form class="online-join-form" data-room-join-form>
      <label for="${game}RoomCode">输入房间码</label>
      <div>
        <input id="${game}RoomCode" type="text" inputmode="text" maxlength="6" autocomplete="off" spellcheck="false" placeholder="ABC234" data-room-code-input>
        <button class="ghost-btn" type="submit" disabled data-room-join>加入</button>
      </div>
    </form>
  </div>
  <div class="online-room-details" data-room-details hidden>
    <span class="online-kicker">当前房间</span>
    <div class="online-room-code">
      <strong data-room-code>------</strong>
      <button type="button" data-room-copy>复制邀请链接</button>
    </div>
    <ul class="online-player-list" data-player-list aria-label="房间玩家${game === "drawguess" ? "与分数" : ""}"></ul>
    ${game === "drawguess" ? '<button class="primary-btn online-start-button" type="button" data-draw-start hidden>开始游戏</button>' : ""}
    <button class="ghost-btn online-leave-button" type="button" data-room-leave>离开房间</button>
  </div>
  <button class="ghost-btn online-reconnect-button" type="button" data-game-reconnect hidden>重新连接</button>
  <p class="online-error" data-game-message role="alert" aria-live="polite"></p>
</aside>`;
  const gameSurface =
    game === "gomoku"
      ? `
<main class="online-game-surface gomoku-surface">
  <div class="online-game-toolbar">
    <div><span class="online-kicker">对局状态</span><strong data-game-round-status>正在连接联机服务…</strong></div>
    <span class="online-turn-badge" data-gomoku-turn>等待开局</span>
  </div>
  <div class="gomoku-board" data-gomoku-board role="grid" aria-label="十五路五子棋棋盘"></div>
  <div class="online-game-actions">
    <button class="primary-btn" type="button" data-gomoku-rematch hidden>申请再来一局</button>
    <span class="online-game-tip">最后一手会以光环标记</span>
  </div>
</main>`
      : `
<main class="online-game-surface drawguess-surface">
  <div class="drawguess-heading">
    <div><span class="online-kicker">本轮题目</span><strong data-draw-word>等待开局</strong></div>
    <time class="drawguess-timer" data-draw-timer aria-live="polite">--</time>
  </div>
  <div class="drawguess-canvas-frame">
    <canvas data-draw-canvas width="960" height="600" aria-label="你画我猜画布"></canvas>
    <span class="drawguess-canvas-lock" data-draw-canvas-lock>等待画手开始</span>
  </div>
  <div class="drawguess-tools" data-draw-tools aria-label="画笔工具">
    <div class="drawguess-colors" role="group" aria-label="画笔颜色">
      <button class="is-selected" type="button" data-draw-color="#111111" aria-label="黑色"></button>
      <button type="button" data-draw-color="#ef4444" aria-label="红色"></button>
      <button type="button" data-draw-color="#2563eb" aria-label="蓝色"></button>
      <button type="button" data-draw-color="#16a34a" aria-label="绿色"></button>
      <button type="button" data-draw-color="#f59e0b" aria-label="橙色"></button>
      <button type="button" data-draw-color="#7c3aed" aria-label="紫色"></button>
    </div>
    <label>粗细 <input type="range" min="2" max="18" value="4" data-draw-width></label>
    <button class="ghost-btn" type="button" data-draw-clear>清空画布</button>
  </div>
  <div class="drawguess-guess-panel">
    <ol class="drawguess-feed" data-draw-feed aria-live="polite"></ol>
    <form class="drawguess-guess-form" data-draw-guess-form>
      <label for="drawGuessInput">输入你的答案</label>
      <div>
        <input id="drawGuessInput" type="text" maxlength="40" autocomplete="off" placeholder="看懂了就快猜…" data-draw-guess-input>
        <button class="primary-btn" type="submit" data-draw-guess>发送答案</button>
      </div>
    </form>
  </div>
</main>`;
  const body = `<div class="multiplayer-page"><div class="multiplayer-layout${game === "drawguess" ? " multiplayer-layout-draw" : ""}" ${attributes}>${gameSurface}${roomPanel}</div></div>`;
  return gameDocument(body, '<script src="/react-runtime/multiplayer-games.js"></script>', definition.title);
}

function buildGameDocument(game: PlayableGameSlug, initialRoom: string) {
  if (game === "2048") return game2048Document();
  if (game === "blockrain") return blockrainDocument();
  return multiplayerDocument(game, initialRoom);
}

function LoginGate({ title, description, from }: { title: string; description: string; from: string }) {
  return (
    <section className="wrap game-access-page" aria-labelledby="gameLoginTitle">
      <div className="game-login-gate">
        <span className="game-lock-orbit" aria-hidden="true">
          <i />
        </span>
        <span className="eyebrow">MEMBER ARCADE</span>
        <h1 id="gameLoginTitle">{title}</h1>
        <p>{description}</p>
        <div className="detail-actions">
          <Link className="primary-btn" to={`/login?from=${encodeURIComponent(from)}`}>
            前往登录
          </Link>
          <Link className="ghost-btn" to={from === "/games" ? "/" : "/games"}>
            {from === "/games" ? "返回首页" : "返回游戏大厅"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function GameAccess({ children, title, description, from }: { children: ReactNode; title: string; description: string; from: string }) {
  const account = useAccount();

  if (account.isPending) return <PageStatus title="正在确认登录状态" description="正在读取本地会话…" />;
  if (account.error) return <PageStatus title="登录状态加载失败" description={account.error.message} error onRetry={() => void account.refreshSession()} />;
  if (!account.session.authenticated) return <LoginGate title={title} description={description} from={from} />;
  return children;
}

function GameCardArt({ game }: { game: GameSlug }) {
  if (game === "2048") {
    return (
      <div className="game-card-art game-card-art-2048" aria-hidden="true">
        <span>2</span>
        <span>0</span>
        <span>4</span>
        <span>8</span>
      </div>
    );
  }
  if (game === "blockrain") {
    return (
      <div className="game-card-art game-card-art-blockrain" aria-hidden="true">
        <span className="block-shape block-shape-a" />
        <span className="block-shape block-shape-b" />
        <span className="block-shape block-shape-c" />
        <span className="block-floor" />
      </div>
    );
  }
  if (game === "gomoku") {
    return (
      <div className="game-card-art game-card-art-gomoku" aria-hidden="true">
        <span className="gomoku-art-grid" />
        <i className="gomoku-art-piece gomoku-art-piece-black" />
        <i className="gomoku-art-piece gomoku-art-piece-white" />
        <i className="gomoku-art-piece gomoku-art-piece-win" />
      </div>
    );
  }
  if (game === "bamboo-cicada") {
    return (
      <div className="game-card-art game-card-art-bamboo-cicada" aria-hidden="true">
        <span className="bamboo-card-orbit" />
        <span className="bamboo-card-line" />
        <span className="bamboo-card-handle" />
        <span className="bamboo-card-toy">
          <i />
          <b />
        </span>
      </div>
    );
  }
  return (
    <div className="game-card-art game-card-art-drawguess" aria-hidden="true">
      <span className="draw-art-paper">
        <i className="draw-art-sun" />
        <i className="draw-art-hill" />
        <i className="draw-art-line" />
      </span>
      <span className="draw-art-pencil" />
    </div>
  );
}

function GamesHub() {
  return (
    <section className="wrap game-hub" aria-labelledby="gameHubTitle">
      <header className="game-hub-hero">
        <div>
          <span className="eyebrow">MEMBER ARCADE</span>
          <h1 id="gameHubTitle">片刻放松，随时开局</h1>
          <p>为观影间隙准备的轻量小游戏；站内游戏本地加载，竹知了由作者官方站提供。</p>
        </div>
        <span className="game-hub-status">
          <i aria-hidden="true" />
          会员已解锁
        </span>
      </header>
      <div className="game-grid">
        {gameOrder.map((slug) => {
          const game = gameDefinitions[slug];
          return (
            <article className={`game-card game-card-${slug}`} key={slug}>
              <GameCardArt game={slug} />
              <div className="game-card-copy">
                <div className="game-card-meta">
                  <span>{game.category}</span>
                  <span>{game.controls}</span>
                </div>
                <h2>{game.title.replace("联机", "")}</h2>
                <p>{game.cardDescription}</p>
                <div className="game-card-actions">
                  {slug === "bamboo-cicada" ? (
                    <a className="primary-btn" href={bambooCicadaOfficialUrl} target="_blank" rel="noopener noreferrer">
                      {game.action}
                    </a>
                  ) : (
                    <Link className="primary-btn" to={`/games/${slug}`}>
                      {game.action}
                    </Link>
                  )}
                  {slug === "2048" && (
                    <a className="game-source-link" href="https://github.com/gabrielecirulli/2048" target="_blank" rel="noopener noreferrer">
                      MIT · GitHub
                    </a>
                  )}
                  {slug === "blockrain" && (
                    <a className="game-source-link" href="https://github.com/Aerolab/blockrain.js" target="_blank" rel="noopener noreferrer">
                      MIT · GitHub
                    </a>
                  )}
                  {game.multiplayer && (
                    <span className="game-online-label">
                      <i aria-hidden="true" />
                      {slug === "gomoku" ? "2 人联机" : "实时同步"}
                    </span>
                  )}
                  {slug === "bamboo-cicada" && (
                    <a className="game-source-link" href={bambooCicadaRepositoryUrl} target="_blank" rel="noopener noreferrer">
                      官方项目 · GitHub
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="game-hub-note">站内单机游戏进度保存在当前浏览器；联机房间仅保留在游戏服务内存中，服务重启后自动结束。</p>
    </section>
  );
}

function GameFrame({ game, initialRoom }: { game: GameDefinition & { slug: PlayableGameSlug }; initialRoom: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();
  const [height, setHeight] = useState(game.multiplayer ? 980 : 760);
  const [srcDoc] = useState(() => buildGameDocument(game.slug, initialRoom));

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const syncTheme = () => {
      iframe.contentWindow?.postMessage({ type: "pingfang:game-theme", theme: document.documentElement.dataset.theme || "" }, window.location.origin);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === "pingfang:game-frame-height") {
        const nextHeight = Number(event.data.height);
        if (Number.isFinite(nextHeight)) setHeight(Math.min(2400, Math.max(480, Math.ceil(nextHeight))));
        return;
      }
      if (event.data.type !== "pingfang:multiplayer-room" || event.data.game !== game.slug) return;
      const room = normalizedRoom(event.data.room);
      navigate(room ? `/games/${game.slug}?room=${room}` : `/games/${game.slug}`, { replace: true });
    };
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    iframe.addEventListener("load", syncTheme);
    window.addEventListener("message", receive);

    return () => {
      themeObserver.disconnect();
      iframe.removeEventListener("load", syncTheme);
      window.removeEventListener("message", receive);
    };
  }, [game.slug, navigate]);

  return (
    <div className={styles.frameShell}>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        data-game-runtime={game.slug}
        title={`${game.title}游戏区域`}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
        allow="clipboard-write"
        referrerPolicy="origin"
        style={{ height }}
      />
    </div>
  );
}

function GamePlayPage({ slug }: { slug: PlayableGameSlug }) {
  const game = gameDefinitions[slug];
  const [searchParams] = useSearchParams();
  const initialRoom = game.multiplayer ? normalizedRoom(searchParams.get("room")) : "";
  const returnTo = initialRoom ? `/games/${slug}?room=${initialRoom}` : `/games/${slug}`;

  return (
    <GameAccess title={game.loginTitle} description={game.loginDescription} from={returnTo}>
      <section className={`wrap game-play-page game-play-page-${slug}`} data-game-authenticated aria-labelledby={`${slug}Title`}>
        <header className="game-play-head">
          <div>
            <span className="eyebrow">{game.eyebrow}</span>
            <h1 id={`${slug}Title`}>{game.title}</h1>
            <p>{game.description}</p>
          </div>
          <Link className="ghost-btn" to="/games">
            返回游戏大厅
          </Link>
        </header>
        <GameFrame game={game} initialRoom={initialRoom} />
      </section>
    </GameAccess>
  );
}

export function GamesPage() {
  return (
    <GameAccess title="登录后开启游戏大厅" description="小游戏仅向已登录会员开放。登录后即可使用键盘、触控或滑动操作开始游戏。" from="/games">
      <GamesHub />
    </GameAccess>
  );
}

export function Game2048Page() {
  return <GamePlayPage slug="2048" />;
}

export function GameBlockrainPage() {
  return <GamePlayPage slug="blockrain" />;
}

export function GameGomokuPage() {
  return <GamePlayPage slug="gomoku" />;
}

export function GameDrawguessPage() {
  return <GamePlayPage slug="drawguess" />;
}
