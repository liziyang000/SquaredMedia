import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const routes = [
  ["route=home", ["hero-carousel", "data-home-gsap-src", "data-carousel-autoplay-toggle", "data-home-empty-state", "data-home-continue", "本年最新上线", "NEW THIS YEAR", "width=\"300\" height=\"450\"", "tabindex=\"0\""]],
  ["route=videos", ["影片库", "vod-grid"]],
  ["route=comics", ["漫画入口维护中", "module-fallback"]],
  ["route=articles", ["文章入口维护中", "module-fallback"]],
  ["route=games", ["game-login-gate", "登录后开启游戏大厅"]],
  ["route=games&member=1", ["game-hub", "2048", "俄罗斯方块", "竹知了", "五子棋", "你画我猜"]],
  ["route=game-2048", ["game-login-gate", "登录后才能开始游戏"]],
  ["route=game-2048&member=1", ["data-game-authenticated", "game-2048", "games/2048/js/application.js"]],
  ["route=game-blockrain", ["game-login-gate", "登录后才能开始游戏"]],
  [
    "route=game-blockrain&member=1",
    [
      "data-game-authenticated",
      "data-blockrain-game",
      "data-blockrain-next",
      'data-blockrain-action="drop"',
      "games/blockrain/blockrain.jquery.min.js",
    ],
  ],
  ["route=game-bamboo-cicada", ["game-login-gate", "登录后才能摇响竹知了"]],
  [
    "route=game-bamboo-cicada&member=1",
    [
      "data-bamboo-cicada-game",
      "data-cicada-arena",
      "data-cicada-score",
      "data-cicada-phase",
      "data-cicada-energy",
      "data-cicada-result-rhythm",
      "games/bamboo-cicada.js",
    ],
  ],
  ["route=game-gomoku", ["game-login-gate", "登录后才能联机对弈"]],
  ["route=game-gomoku&member=1", ["data-multiplayer-game", 'data-game-type="gomoku"', "data-gomoku-board", "js/multiplayer-games.js"]],
  ["route=game-drawguess", ["game-login-gate", "登录后才能加入画室"]],
  [
    "route=game-drawguess&member=1",
    ["data-multiplayer-game", 'data-game-type="drawguess"', "data-draw-canvas", "data-draw-guess-form", "js/multiplayer-games.js"],
  ],
  ["route=categories", ["category-index", "视频分类"]],
  ["route=categories&page=2", ["category-index", "page-state"]],
  ["route=category&name=电影&sort=score", ["分类浏览", "vod-grid"]],
  ["route=category&page=2", ["分类浏览", "page-state", "远山计划"]],
  ["route=category&area=中国香港", ["午夜档案", "共 1 部内容"]],
  ["route=category&year=2025", ["南城旧事", "共 1 部内容"]],
  ["route=category&class=悬疑", ["午夜档案", "共 2 部内容"]],
  ["route=search&wd=云端", ["搜索结果", "云端"]],
  ["route=detail&id=1", ["detail-panel", "立即播放"]],
  ["route=play&id=2&episode=2", ["player-shell", "正在播放", "preload=\"metadata\" playsinline", "id=\"episodeList\"", "上一集", "下一集"]],
  ["route=player&id=2&episode=2", ["player-shell", "试看播放", "preload=\"metadata\" playsinline", "完整播放"]],
  ["route=down&id=1", ["download-list", "点击下载"]],
  ["route=copyright&id=1", ["copyright-box", "版权限制"]],
  ["route=history", ["history-timeline", "时间轴"]],
  ["route=gbook", ["gbook_content", "留言反馈"]],
  ["route=book", ["gbook_content", "留言反馈"]],
  ["route=report&id=1", ["gbook_content", "片源报错"]],
];

function render(query) {
  const code = `
parse_str(${JSON.stringify(query)}, $_GET);
require "server/lib/data.php";
require "server/lib/render.php";
$data = load_data();
echo render_page($data, (string)($_GET["route"] ?? "home"), $_GET);
`;

  return execFileSync("php", ["-r", code], { encoding: "utf8" });
}

function assertBefore(html, first, second, route) {
  const firstIndex = html.indexOf(first);
  const secondIndex = html.indexOf(second);
  assert.ok(firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex, `${route} should render ${first} before ${second}`);
}

for (const [query, expected] of routes) {
  const html = render(query);
  assert.match(html, /<!doctype html>/, `${query} should render a full HTML document`);
  assert.match(html, /<main(?:\s[^>]*)?>/, `${query} should include the main layout`);
  assert.doesNotMatch(html, /class="site-footer"/, `${query} should not render the retired visible footer`);
  assert.doesNotMatch(html, /Fatal error|Parse error|Warning:/, `${query} should render without PHP runtime errors`);
  assert.match(html, /class="theme-switcher" data-theme-switcher/, `${query} should include the desktop theme switcher`);
  assert.match(html, /class="mobile-drawer-section mobile-theme-section" data-theme-switcher-mobile/, `${query} should include the mobile theme switcher`);
  assert.equal((html.match(/data-theme-option="default"/g) || []).length, 2, `${query} should include both default theme options`);
  assert.equal((html.match(/data-theme-option="blue-pink-purple"/g) || []).length, 2, `${query} should include both aurora theme options`);
  assert.equal((html.match(/data-theme-option="poster-magazine"/g) || []).length, 2, `${query} should include both poster theme options`);
  assert.equal((html.match(/data-theme-option="dunhuang-caisson"/g) || []).length, 2, `${query} should include both Dunhuang theme options`);
  assert.equal((html.match(/data-theme-option="pixel-frog"/g) || []).length, 2, `${query} should include both pixel frog theme options`);

  for (const marker of expected) {
    assert.ok(html.includes(marker), `${query} should include ${marker}`);
  }

  if (query === "route=game-2048") {
    assert.doesNotMatch(html, /games\/2048\/js\//, "guest 2048 page should not load game scripts");
  }

  if (query === "route=game-blockrain") {
    assert.doesNotMatch(html, /games\/blockrain\//, "guest blockrain page should not load game scripts");
  }

  if (query === "route=game-bamboo-cicada") {
    assert.doesNotMatch(html, /games\/bamboo-cicada\.js/, "guest bamboo cicada page should not load the game script");
  }

  if (query === "route=game-gomoku" || query === "route=game-drawguess") {
    assert.doesNotMatch(html, /js\/multiplayer-games\.js/, "guest multiplayer pages should not load game scripts");
    assert.doesNotMatch(html, /data-game-ticket-endpoint/, "guest multiplayer pages should not expose the ticket endpoint");
  }

  if (query === "route=home") {
    assert.doesNotMatch(html, /<script src="\/template\/pingfangvideo\/js\/gsap\.min\.js/, "home preview should load GSAP on demand");
    const shelfImage = html.match(/<span class="home-shelf-poster"><img[^>]+>/)?.[0] || "";
    assert.match(shelfImage, /\/360\/540/);
    assert.doesNotMatch(shelfImage, /wide\/1280\/720/);
    assert.match(shelfImage, /width="300" height="450"/);
    const yearlyContent = html.slice(html.indexOf("data-rank-react-list"), html.indexOf("</main>"));
    assert.doesNotMatch(yearlyContent, /南城旧事/, "home preview should only use the current year for yearly shelves and ranking");
  }

  if (query.startsWith("route=play&")) {
    assertBefore(html, 'class="player-shell"', 'class="player-toolbar"', query);
    assert.match(html, /<video controls preload="metadata" playsinline/);
    assert.match(html, /class="is-active" aria-current="page"[^>]*>第2集<\/a>/);
  }

  if (query.startsWith("route=player&")) {
    assertBefore(html, 'class="player-shell"', 'class="player-toolbar"', query);
    assert.doesNotMatch(html, /id="episodeList"/);
  }
}

console.log("Preview verification passed");
