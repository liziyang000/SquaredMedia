import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Script } from "node:vm";

const root = process.cwd();
const themeRoot = path.join(root, "template", "pingfangvideo");
const addonRoot = path.join(root, "addons", "pingfangdevice");
const vodopsAddonRoot = path.join(root, "addons", "vodops");
const fullLetterFilter = "A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,0~9";
const nonAdultVodTypeScope = "42,47,48,57,111";
const styleVersionPlaceholder = "__PINGFANG_STYLE_VERSION__";
const appVersionPlaceholder = "__PINGFANG_APP_VERSION__";
const promptVersionPlaceholder = "__PINGFANG_PROMPT_VERSION__";
const gameVersionPlaceholder = "__PINGFANG_GAME_VERSION__";
const bambooCicadaVersionPlaceholder = "__PINGFANG_BAMBOO_CICADA_VERSION__";
const multiplayerVersionPlaceholder = "__PINGFANG_MULTIPLAYER_VERSION__";
const qixiVersionPlaceholder = "__PINGFANG_QIXI_VERSION__";
const qixiStyleVersionPlaceholder = "__PINGFANG_QIXI_STYLE_VERSION__";

const requiredFiles = [
  "info.ini",
  "css/style.css",
  "css/qixi-bouquet.css",
  "images/brand/favicon.ico",
  "images/brand/favicon.png",
  "images/brand/ios_fav.png",
  "images/dunhuang/caisson-frame.svg",
  "images/dunhuang/caisson-frame-mobile.svg",
  "images/dunhuang/channel-vault.svg",
  "images/dunhuang/emblem.svg",
  "images/dunhuang/pearl-band.svg",
  "images/dunhuang/rosette-divider.svg",
  "images/dunhuang/scrolling-vine-band.svg",
  "images/dunhuang/wave-cloud-corner.svg",
  "images/pixel/pixel-border.svg",
  "images/pixel/frog-emblem.svg",
  "images/pixel/icon-close.svg",
  "images/pixel/icon-enter.svg",
  "images/pixel/icon-eye.svg",
  "images/pixel/icon-lock.svg",
  "images/pixel/icon-play.svg",
  "images/pixel/icon-refresh.svg",
  "images/pixel/icon-search.svg",
  "images/pixel/icon-shield.svg",
  "images/pixel/icon-user.svg",
  "images/pixel/pixel-grid.svg",
  "images/site-logo.png",
  "css/fonts/FUSION-PIXEL-OFL-1.1.txt",
  "css/fonts/fusion-pixel-12px-proportional-zh-hans.woff2",
  "games/2048/LICENSE.txt",
  "games/2048/js/application.js",
  "games/2048/js/game_manager.js",
  "games/2048/js/grid.js",
  "games/2048/js/html_actuator.js",
  "games/2048/js/keyboard_input_manager.js",
  "games/2048/js/local_storage_manager.js",
  "games/2048/js/tile.js",
  "games/blockrain/Copyright",
  "games/blockrain/LICENSE.txt",
  "games/blockrain/blockrain.jquery.min.js",
  "games/blockrain/jquery-1.11.1.min.js",
  "games/bamboo-cicada.js",
  "games/README.md",
  "games/init.js",
  "js/gsap.min.js",
  "js/canvas-confetti.min.js",
  "js/CANVAS-CONFETTI-ISC.txt",
  "js/app.js",
  "js/multiplayer-games.js",
  "js/qixi-particle-rose.js",
  "js/qixi-particle-bouquet.js",
  "js/third-party/three/three.module.min.js",
  "js/third-party/three/three.core.min.js",
  "js/third-party/three/GLTFLoader.js",
  "js/third-party/three/MeshSurfaceSampler.js",
  "js/third-party/three/BufferGeometryUtils.js",
  "js/third-party/three/LICENSE.txt",
  "images/qixi/qixi-bouquet.glb",
  "images/qixi/LICENSE.md",
  "player/preload.html",
  "player/buffering.html",
  "player/prompt.css",
  "html/public/include.html",
  "html/public/head.html",
  "html/public/foot.html",
  "html/public/paging.html",
  "html/public/jump.html",
  "html/public/msg.html",
  "html/public/verify.html",
  "html/public/digg.html",
  "html/public/score.html",
  "html/public/star.html",
  "html/public/vod_card.html",
  "html/public/vod_filter_common.html",
  "html/public/vod_grid_results.html",
  "html/comment/index.html",
  "html/comment/ajax.html",
  "html/gbook/index.html",
  "html/book/index.html",
  "html/book/report.html",
  "html/index/index.html",
  "html/label/categories.html",
  "html/label/comics.html",
  "html/label/game-2048.html",
  "html/label/game-blockrain.html",
  "html/label/game-bamboo-cicada.html",
  "html/label/game-drawguess.html",
  "html/label/game-gomoku.html",
  "html/label/games.html",
  "html/label/history.html",
  "html/label/hot.html",
  "html/label/qixi.html",
  "html/label/videos.html",
  "html/pingfangdevice/index.html",
  "html/topic/index.html",
  "html/topic/detail.html",
  "html/art/index.html",
  "html/art/confirm.html",
  "html/art/detail.html",
  "html/art/detail_pwd.html",
  "html/art/rss.html",
  "html/art/search.html",
  "html/art/type.html",
  "html/art/show.html",
  "html/map/rss.html",
  "html/map/baidu.html",
  "html/map/google.html",
  "html/rss/rss.html",
  "html/rss/baidu.html",
  "html/rss/google.html",
  "html/vod/type.html",
  "html/vod/show.html",
  "html/vod/search.html",
  "html/vod/detail.html",
  "html/vod/confirm.html",
  "html/vod/detail_pwd.html",
  "html/vod/play.html",
  "html/vod/player.html",
  "html/vod/player_pwd.html",
  "html/vod/down.html",
  "html/vod/downer_pwd.html",
  "html/vod/copyright.html",
  "html/vod/plot.html",
  "html/vod/rss.html",
  "html/plot/uindex.html",
  "html/plot/udetail.html",
  "html/actor/index.html",
  "html/actor/detail.html",
  "html/actor/search.html",
  "html/actor/show.html",
  "html/actor/type.html",
  "html/role/index.html",
  "html/role/detail.html",
  "html/role/show.html",
  "html/website/index.html",
  "html/website/detail.html",
  "html/website/search.html",
  "html/website/show.html",
  "html/website/type.html",
  "html/user/head.html",
  "html/user/foot.html",
  "html/user/include.html",
  "html/user/favs.html",
  "html/user/index.html",
  "html/user/login.html",
  "html/user/plays.html",
  "html/user/reg.html",
  "html/user/findpass.html",
];

const requiredRootFiles = [
  ".prettierignore",
  "docker-compose.yml",
  "eslint.config.js",
  "docker/php/Dockerfile",
  "docker/php/php.ini",
  "ops/security/gptbot-ip-rules.json",
  "README.md",
  "package-lock.json",
  "prettier.config.js",
  "stylelint.config.js",
  ".github/workflows/ci.yml",
  "addons/pingfangdevice/Pingfangdevice.php",
  "addons/pingfangdevice/application/index/controller/Pingfangdevice.php",
  "addons/pingfangdevice/config.php",
  "addons/pingfangdevice/controller/DeviceActions.php",
  "addons/pingfangdevice/controller/Index.php",
  "addons/pingfangdevice/info.ini",
  "addons/pingfangdevice/install.sql",
  "addons/pingfangdevice/service/DeviceSession.php",
  "addons/pingfangdevice/service/GameAccessTicket.php",
  "addons/pingfangdevice/service/VodFilterOptions.php",
  "addons/pingfangdevice/view/index/index.html",
  "addons/vodops/Vodops.php",
  "addons/vodops/application/admin/controller/Douban.php",
  "addons/vodops/application/admin/controller/Vodops.php",
  "addons/vodops/application/admin/view_new/vodops/index.html",
  "addons/vodops/backend/DoubanController.php",
  "addons/vodops/bin/vodops-worker.php",
  "addons/vodops/config.php",
  "addons/vodops/info.ini",
  "addons/vodops/install.sql",
  "addons/vodops/service/DoubanAiReviewer.php",
  "addons/vodops/service/DoubanData.php",
  "addons/vodops/service/DoubanGateway.php",
  "addons/vodops/service/DoubanMatcher.php",
  "addons/vodops/service/VodLibrary.php",
  "addons/vodops/service/VodQualityAnalyzer.php",
  "addons/vodops/service/VodQualityRepair.php",
  "addons/vodops/service/VodQualityScanner.php",
  "addons/vodops/view/index/index.html",
  "addons/vodops/view/videos/index.html",
  "preview/data.json",
  "preview/qixi.html",
  "scripts/lint-template.mjs",
  "scripts/deploy-ping2.env",
  "scripts/deploy-theme.sh",
  "scripts/rollback-theme.sh",
  "scripts/package-player.mjs",
  "scripts/package-game-server.mjs",
  "scripts/package-theme.mjs",
  "scripts/verify-compat.mjs",
  "scripts/verify-preview.mjs",
  "scripts/verify-player-release.mjs",
  "scripts/verify-game-server-release.mjs",
  "scripts/verify-release.mjs",
  "server/index.php",
  "server/lib/data.php",
  "server/lib/render.php",
  "services/game-server/index.mjs",
  "services/game-server/package.json",
  "services/game-server/src/game-service.mjs",
  "services/game-server/src/server.mjs",
  "services/game-server/src/ticket.mjs",
];

for (const file of requiredRootFiles) {
  assert.ok(existsSync(path.join(root, file)), `${file} should exist`);
}
assert.ok(
  !existsSync(path.join(addonRoot, "bridge/Pingfangdevice.php")),
  "The frontend compatibility controller should use the standard addon application payload"
);
assert.ok(!existsSync(path.join(root, "addons", "douban")), "Douban should be absorbed into the single vodops addon");

for (const file of requiredFiles) {
  assert.ok(existsSync(path.join(themeRoot, file)), `${file} should exist`);
}

function readThemeFile(file) {
  return readFileSync(path.join(themeRoot, file), "utf8");
}

function readAddonFile(file) {
  return readFileSync(path.join(addonRoot, file), "utf8");
}

for (const file of requiredFiles.filter((file) => file.startsWith("html/"))) {
  const content = readThemeFile(file);
  assert.doesNotMatch(content, /\bskip-link\b/, `${file} should not render a skip link`);
  assert.doesNotMatch(content, /\buser-compat-note\b/, `${file} should not render user compatibility notes`);
}

function extractAnchorTexts(markup) {
  return [...markup.matchAll(/<a\b[^>]*>([^<]*)<\/a>/g)].map((match) => match[1]);
}

function extractCssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))?.[0] || "";
}

const info = readThemeFile("info.ini");
assert.match(info, /name\s*=\s*PingFang Video/i);
assert.match(info, /adsdir\s*=\s*ads/i);

const dockerfile = readFileSync(path.join(root, "docker/php/Dockerfile"), "utf8");
assert.match(dockerfile, /FROM php:8\.4-apache/);
assert.match(dockerfile, /pdo_mysql/);
assert.match(dockerfile, /php\.ini/);

const phpIni = readFileSync(path.join(root, "docker/php/php.ini"), "utf8");
assert.match(phpIni, /expose_php\s*=\s*Off/);
assert.match(phpIni, /display_errors\s*=\s*Off/);
assert.match(phpIni, /opcache\.enable\s*=\s*1/);

const compose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");
assert.match(compose, /php84/);
assert.match(compose, /template\/pingfangvideo/);
assert.match(compose, /PINGFANG_PREVIEW_DATA: \/var\/www\/html\/preview\/data\.json/);
assert.match(compose, /healthcheck:/);

const previewDataLoader = readFileSync(path.join(root, "server/lib/data.php"), "utf8");
assert.match(previewDataLoader, /getenv\('PINGFANG_PREVIEW_DATA'\)/);
assert.match(previewDataLoader, /dirname\(__DIR__, 2\) \. '\/preview\/data\.json'/);

const readme = readFileSync(path.join(root, "README.md"), "utf8");
assert.match(readme, /PHP 8\.4/);
assert.match(readme, /npm run lint/);
assert.match(readme, /npm run lint:template/);
assert.match(readme, /npm run package/);
assert.match(readme, /npm run verify:release/);
assert.match(readme, /npm run deploy/);
assert.match(readme, /npm run rollback/);
assert.match(readme, /DEPLOY_HOST/);
assert.match(readme, /DEPLOY_PATH/);
assert.match(readme, /DEPLOY_CLEAR_CACHE/);
assert.match(readme, /scripts\/deploy-ping2\.env/);
assert.match(readme, /ROLLBACK_BACKUP/);
assert.match(readme, /GitHub Actions/);
assert.match(readme, /登录设备管理/);
assert.match(readme, /pingfangdevice/);
assert.match(readme, /最多 3 台/);
assert.match(readme, /server\/index\.php/);
assert.match(readme, /MacCMS/);
assert.match(readme, /\/template\/pingfangvideo\/player\/preload\.html/);
assert.match(readme, /\/template\/pingfangvideo\/player\/buffering\.html/);

const include = readThemeFile("html/public/include.html");
assert.match(include, /<link rel="icon" href="\{\$maccms\.path_tpl\}images\/brand\/favicon\.ico">/);
assert.match(include, /<link rel="icon" type="image\/png" sizes="64x64" href="\{\$maccms\.path_tpl\}images\/brand\/favicon\.png">/);
assert.match(include, /<link rel="apple-touch-icon" sizes="512x512" href="\{\$maccms\.path_tpl\}images\/brand\/ios_fav\.png">/);
assert.match(include, /\{\$maccms\.path\}static\/js\/jquery\.js/);
assert.match(include, /\{\$maccms\.path\}static\/js\/home\.js/);
assert.match(include, /css\/style\.css\?v=/);
assert.match(include, /"path":"\{:\s*rtrim\(\$maccms\['path'\], '\/'\)\}"/);
assert.match(include, /"aid":"\{\$maccms\.aid\}"/);
assert.match(include, new RegExp(`css/style\\.css\\?v=${styleVersionPlaceholder}`));
assert.match(include, /window\.localStorage\.getItem\("pingfang_theme"\)/);
assert.match(include, /theme === "poster-magazine"/);
assert.match(include, /theme === "dunhuang-caisson"/);
assert.match(include, /theme === "digital-particles"/);
assert.match(include, /theme === "pixel-frog"/);
assert.match(include, /document\.documentElement\.setAttribute\("data-theme", theme\)/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260626"/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260621/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260615/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260616/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260617/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260618/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260619/);
assert.doesNotMatch(include, /css\/style\.css\?v=20260620/);
assert.doesNotMatch(include, /__ROOT__/);

const head = readThemeFile("html/public/head.html");
for (const field of ["title", "keywords", "description"]) {
  assert.ok(head.includes(`{if condition="isset($pingfang_seo_${field})"}`));
  assert.ok(head.includes(`{$pingfang_seo_${field}|htmlspecialchars=ENT_QUOTES,'UTF-8',false}`));
}

function assertRuntimeSeo(page, values) {
  const include = '{include file="public/head" seo_title="" seo_keywords="" seo_description="" /}';
  const includeIndex = page.indexOf(include);
  assert.ok(includeIndex >= 0, "Dynamic pages must not pass request values to the compile-time include");
  for (const [index, field] of ["title", "keywords", "description"].entries()) {
    const assignment = `{assign name="pingfang_seo_${field}" value="${values[index]}" /}`;
    const assignmentIndex = page.indexOf(assignment);
    assert.ok(assignmentIndex >= 0 && assignmentIndex < includeIndex, `${field} must be assigned at runtime before rendering the head`);
  }
}

assert.match(head, /\[seo_title\]/);
assert.match(head, /\[seo_keywords\]/);
assert.match(head, /\[seo_description\]/);
assert.match(head, /site-logo\.png/);
assert.match(head, /brand-logo/);
assert.match(head, /class="brand-logo"[^>]*width="58"[^>]*height="58"/);
assert.match(head, /class="brand-logo"[^>]*decoding="async"/);
assert.match(head, /class="brand-emblem" aria-hidden="true"/);
assert.match(head, /class="brand-wordmark"><strong>\{\$maccms\.site_name\}<\/strong><small>STREAMING EDITION<\/small>/);
assert.match(head, /class="brand-logo"[^>]*hidden aria-hidden="true"/);
assert.doesNotMatch(head, /brand-mark">PF/);
assert.doesNotMatch(head, /brand-text/);
assert.match(head, /class="theme-switcher" data-theme-switcher/);
assert.match(head, /<button class="theme-switcher-trigger" type="button" data-theme-switcher-trigger aria-expanded="false" aria-controls="themeSwitcherMenu">主题<\/button>/);
assert.match(head, /class="theme-switcher-menu" id="themeSwitcherMenu" data-theme-switcher-menu hidden/);
assert.doesNotMatch(head, /aria-haspopup=/);
assert.match(head, /data-theme-option="default" aria-pressed="true"[\s\S]*?<span>液态影院<\/span>/);
assert.match(head, /data-theme-option="blue-pink-purple" aria-pressed="false"[\s\S]*?<span>极光夜幕<\/span>/);
assert.match(head, /data-theme-option="poster-magazine" aria-pressed="false"[\s\S]*?<span>海报画廊<\/span>/);
assert.match(head, /data-theme-option="dunhuang-caisson" aria-pressed="false"[\s\S]*?<span>敦煌流光<\/span>/);
assert.match(head, /data-theme-option="digital-particles" aria-pressed="false"[\s\S]*?<span>数码粒子<\/span>/);
assert.match(head, /data-theme-option="pixel-frog" aria-pressed="false"[\s\S]*?<span>像素蛙<\/span>/);
assert.match(head, /class="mobile-drawer-section mobile-theme-section"/);
assert.match(head, /data-theme-switcher-mobile/);
const desktopNavLinks = head.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(desktopNavLinks), ["首页", "视频", "游戏"]);
assert.match(desktopNavLinks, /<a href="\{\$maccms\.path\}" data-nav-section="home">首页<\/a>/);
assert.match(desktopNavLinks, /<a href="\{:mac_url\('label\/categories'\)\}" data-nav-section="videos">视频<\/a>/);
assert.match(desktopNavLinks, /<a href="\{:mac_url\('label\/games'\)\}" data-nav-section="games">游戏<\/a>/);
assert.doesNotMatch(desktopNavLinks, /qixi|七夕花束/);
assert.doesNotMatch(desktopNavLinks, /nav-video-menu/);
assert.doesNotMatch(desktopNavLinks, /nav-video-panel/);
assert.doesNotMatch(desktopNavLinks, />漫画<\/a>|>文章<\/a>/);
assert.doesNotMatch(desktopNavLinks, />分类<\/a>/);
assert.doesNotMatch(desktopNavLinks, />收藏<\/a>/);
const mobileDrawerLinks = head.match(/<nav class="mobile-drawer-links"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(mobileDrawerLinks), ["首页", "视频", "游戏"]);
assert.match(mobileDrawerLinks, /data-nav-section="home">首页<\/a>/);
assert.match(mobileDrawerLinks, /data-nav-section="videos">视频<\/a>/);
assert.match(mobileDrawerLinks, /data-nav-section="games">游戏<\/a>/);
assert.doesNotMatch(mobileDrawerLinks, /qixi|七夕花束/);
assert.doesNotMatch(mobileDrawerLinks, />漫画<\/a>|>文章<\/a>/);
assert.match(head, /aria-controls="mobileDrawer"/);
assert.match(head, /class="mobile-drawer-backdrop" data-mobile-nav-close hidden/);
assert.match(head, /<aside class="mobile-drawer" id="mobileDrawer" role="dialog" aria-modal="true" aria-labelledby="mobileDrawerTitle" aria-hidden="true" inert>/);
assert.match(head, /<strong id="mobileDrawerTitle">分类导航<\/strong>/);
assert.match(head, /class="mobile-drawer-close"[^>]*data-mobile-nav-close/);
assert.match(head, /<form class="mobile-drawer-search" method="get" action="\{:mac_url\('vod\/search'\)\}" role="search">/);
assert.match(head, /<label class="sr-only" for="mobileDrawerSearch">站内搜索<\/label>/);
assert.match(head, /id="mobileDrawerSearch" type="search" name="wd"/);
assert.match(head, /<nav class="mobile-drawer-links" aria-label="移动端快捷导航">/);
assert.doesNotMatch(mobileDrawerLinks, /user\/favs/);
assert.doesNotMatch(mobileDrawerLinks, /user\/plays/);
assert.match(head, /class="mobile-drawer-section mobile-drawer-account"/);
assert.match(head, /<span>账号<\/span>/);
assert.match(head, /class="mobile-drawer-user"/);
assert.match(head, /class="mobile-drawer-login" href="\{:mac_url\('user\/login'\)\}">登录<\/a>/);
assert.match(head, /<a href="\{:mac_url\('user\/index'\)\}">用户中心<\/a>/);
assert.match(head, /<a href="\{:mac_url\('user\/favs'\)\}">我的收藏<\/a>/);
assert.match(head, /class="mobile-drawer-cats"/);
assert.match(head, /\{maccms:type ids="parent" mid="1" order="asc" by="sort" num="100" id="type"\}/);
assert.match(head, /href="\{:mac_url_type\(\$type\)\}">\{\$type\.type_name\}<\/a>/);
assert.match(head, /mac_url\('user\/plays'\)/);
assert.match(head, /mac_url\('user\/favs'\)/);
assert.match(head, /class="user-menu"/);
assert.doesNotMatch(head, /\$user\.user_id/);
assert.equal((head.match(/data-auth-member/g) || []).length, 3);
assert.equal((head.match(/data-auth-guest/g) || []).length, 2);
assert.match(head, /mac_url\('user\/login'\)/);
assert.match(head, /mac_url\('user\/index'\)/);
assert.match(head, /url\('pingfangdevice\/index'\)/);
assert.match(head, /url\('pingfangdevice\/logout'\)/);
assert.equal((head.match(/data-logout-link/g) || []).length, 2);
assert.equal((head.match(/data-logout-redirect="\{:mac_url\('user\/login'\)\}"/g) || []).length, 2);
assert.match(head, /data-avatar-random/);
assert.match(head, /data-avatar-name="用户"/);
assert.match(head, /class="user-avatar-letter"/);
assert.match(head, /class="user-avatar-letter">用<\/span>/);
assert.doesNotMatch(head, /user\.user_portrait/);
assert.match(head, /class="user-dropdown"/);
assert.match(head, />收藏</);
assert.match(head, />播放记录</);
assert.match(head, />登录设备</);
assert.match(head, />退出登录</);
assert.doesNotMatch(head, /class="hot-search-panel"/);
assert.doesNotMatch(head, /热搜榜/);
assert.doesNotMatch(head, /\$maccms\.search_hot/);
assert.doesNotMatch(head, /\{maccms:foreach name=":explode\(',',\$maccms\.search_hot\)" id="vo2"/);
assert.doesNotMatch(head, /mac_url\('vod\/search',\['wd'=>\$vo2\]\)/);
assert.doesNotMatch(head, /class="history-link mac_history" href="javascript:;"/);
assert.match(head, /<label class="sr-only" for="globalSearch">站内搜索<\/label>/);
assert.match(head, /id="globalSearch" type="search" name="wd"[^>]*placeholder="搜索影片、演员或导演…"[^>]*autocomplete="off"/);

const foot = readThemeFile("html/public/foot.html");
assert.doesNotMatch(foot, /class="site-footer"/);
assert.doesNotMatch(foot, /让每一次打开/);
assert.doesNotMatch(foot, /mac_url\('map\/google'\)/);
assert.doesNotMatch(foot, /mac_url\('gbook\/index'\)/);
assert.doesNotMatch(foot, /mac_url\('map\/rss'\)/);
assert.match(foot, /class="mac_timming"/);
assert.doesNotMatch(foot, /js\/gsap\.min\.js/);
assert.match(foot, /js\/canvas-confetti\.min\.js\?v=1\.9\.4[\s\S]*js\/app\.js/);
assert.doesNotMatch(foot, /https?:\/\/[^"']*canvas-confetti/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260621/);
assert.match(foot, new RegExp(`js/app\\.js\\?v=${appVersionPlaceholder}`));
assert.doesNotMatch(foot, /js\/app\.js\?v=20260615/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260616/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260618/);
assert.doesNotMatch(foot, /js\/app\.js\?v=20260619/);
assert.doesNotMatch(foot, /mac_url\('map\/index'\)/);
assert.doesNotMatch(foot, /mac_url\('rss\/index'\)/);

const gbookPage = readThemeFile("html/gbook/index.html");
assert.match(gbookPage, /seo_title="留言反馈"/);
assert.match(gbookPage, /mac_url\('gbook\/save'\)/);
assert.match(gbookPage, /name="gbook_content"/);
assert.match(gbookPage, /\{include file="public\/foot" \/\}/);

const bookPage = readThemeFile("html/book/index.html");
assert.match(bookPage, /seo_title="留言反馈"/);
assert.match(bookPage, /mac_url\('gbook\/save'\)/);
assert.match(bookPage, /name="gbook_content"/);
assert.match(bookPage, /\{include file="public\/foot" \/\}/);

const bookReportPage = readThemeFile("html/book/report.html");
assert.match(bookReportPage, /seo_title="报错反馈"/);
assert.match(bookReportPage, /mac_url\('gbook\/save'\)/);
assert.match(bookReportPage, /name="gbook_content"/);
assert.match(bookReportPage, /报错反馈/);

const commentIndexPage = readThemeFile("html/comment/index.html");
assert.match(commentIndexPage, /seo_title="评论"/);
assert.match(commentIndexPage, /comment-list/);
assert.match(commentIndexPage, /mac_url\('comment\/save'\)/);
assert.match(commentIndexPage, /name="comment_content"/);

const commentAjaxPage = readThemeFile("html/comment/ajax.html");
assert.match(commentAjaxPage, /comment-list/);
assert.match(commentAjaxPage, /maccms:comment/);
assert.doesNotMatch(commentAjaxPage, /include file="public\/head"/);

const pagingPage = readThemeFile("html/public/paging.html");
assert.match(pagingPage, /data-page-jump/);
assert.match(pagingPage, /data-page-template="\{\$__PAGING__\.page_url\|mac_url_page='__PAGE__'\}"/);
assert.match(pagingPage, /class="page-jump"/);
assert.match(pagingPage, /class="page-jump-input"/);
assert.match(pagingPage, /class="page-jump-submit"/);
assert.match(pagingPage, /type="number"/);
assert.match(pagingPage, /min="1"/);
assert.match(pagingPage, /max="\{\$__PAGING__\.page_total\}"/);
assert.match(pagingPage, />跳转</);

const jumpPage = readThemeFile("html/public/jump.html");
assert.match(jumpPage, /页面将在 <strong>1<\/strong> 秒后自动跳转/);
assert.match(jumpPage, /setTimeout[\s\S]*1000/);
assert.doesNotMatch(jumpPage, /<strong>\{\$wait\}<\/strong>/);
assert.doesNotMatch(jumpPage, /Number\("\{\$wait\}"\) \* 1000/);

const categoriesPage = readThemeFile("html/label/categories.html");
assert.match(categoriesPage, /seo_title="视频分类"/);
assert.match(categoriesPage, /category-index/);
assert.doesNotMatch(categoriesPage, /class="category-search"/);
assert.doesNotMatch(categoriesPage, /data-category-search/);
assert.doesNotMatch(categoriesPage, /data-category-search-input/);
assert.doesNotMatch(categoriesPage, /placeholder="搜索分类"/);
assert.doesNotMatch(categoriesPage, /data-category-search-empty/);
assert.doesNotMatch(categoriesPage, /data-category-name="\{\$type\.type_name\}"/);

const comicsPage = readThemeFile("html/label/comics.html");
assert.match(comicsPage, /seo_title="漫画"/);
assert.match(comicsPage, /module-fallback/);
assert.match(comicsPage, /漫画入口维护中/);
assert.match(comicsPage, /mac_url\('vod\/show'\)/);
assert.match(comicsPage, /\{include file="public\/foot" \/\}/);

const qixiPage = readThemeFile("html/label/qixi.html");
assert.match(qixiPage, /seo_title="七夕粒子玫瑰"/);
assert.match(qixiPage, /document\.documentElement\.classList\.add\("qixi-immersive"\)/);
assert.match(qixiPage, /viewport-fit=cover/);
assert.match(qixiPage, /meta\[name="theme-color"\]/);
assert.match(qixiPage, /themeColor\.content = "#100611"/);
assert.match(qixiPage, /class="qixi-rose-page" data-qixi-rose/);
assert.match(qixiPage, /data-qixi-canvas/);
assert.match(qixiPage, /data-qixi-bloom/);
assert.match(qixiPage, /data-qixi-share/);
assert.match(qixiPage, /折成一束玫瑰|不会凋谢/);
assert.match(qixiPage, /粉色与蓝色星光粒子从下向上聚成3D玫瑰花束/);
assert.doesNotMatch(qixiPage, /qixi-rose-gesture|拖动花束，让玫瑰随你转身/);
assert.doesNotMatch(qixiPage, /data-qixi-model|qixi-rose-model/);
assert.match(qixiPage, /3D Flower Bouquet by/);
assert.match(qixiPage, /sketchfab\.com\/3d-models\/flower-bouquet-48e92013548247a9ad486dc13110c9b4/);
assert.match(qixiPage, new RegExp(`type="module" src="\\{\\$maccms\\.path_tpl\\}js/qixi-particle-bouquet\\.js\\?v=${qixiVersionPlaceholder}"`));
assert.match(qixiPage, new RegExp(`href="\\{\\$maccms\\.path_tpl\\}css/qixi-bouquet\\.css\\?v=${qixiStyleVersionPlaceholder}"`));
assert.doesNotMatch(qixiPage, /src="[^"]*qixi-particle-rose\.js/);
assert.match(qixiPage, /\{include file="public\/foot" \/\}/);

const legacyQixiScript = readThemeFile("js/qixi-particle-rose.js");
assert.doesNotThrow(() => new Script(legacyQixiScript), "The Qixi script shared with Next must remain a classic script");
assert.match(legacyQixiScript, /getContext\("2d"\)/);
assert.match(legacyQixiScript, /createRoseDome/);
assert.match(legacyQixiScript, /ringCounts = \[1, 7, 13, 20\]/);
assert.match(legacyQixiScript, /createRoseBasis/);
assert.match(legacyQixiScript, /transformRosePoint/);
assert.match(legacyQixiScript, /addRoseCalyx/);
assert.match(legacyQixiScript, /roseSurfacePoint/);
assert.match(legacyQixiScript, /petalEnvelope/);
assert.match(legacyQixiScript, /petalSurfacePoint/);
assert.match(legacyQixiScript, /rosePetalBands/);
assert.match(legacyQixiScript, /roseRimShare/);
assert.match(legacyQixiScript, /openness:/);
assert.match(legacyQixiScript, /petalWidth:/);
assert.match(legacyQixiScript, /irregularity:/);
assert.match(legacyQixiScript, /petalShift:/);
assert.doesNotMatch(legacyQixiScript, /addPetalLayer|petalLayers = \[/);
assert.match(legacyQixiScript, /addWrappingParticles/);
assert.match(legacyQixiScript, /addWrappingCollar/);
assert.match(legacyQixiScript, /depthBuckets/);
assert.match(legacyQixiScript, /shadeColor/);
assert.match(legacyQixiScript, /entryDuration = 2800/);
assert.match(legacyQixiScript, /startEntrance/);
assert.match(legacyQixiScript, /completeEntrance/);
assert.match(legacyQixiScript, /entryDelay/);
assert.match(legacyQixiScript, /is-entering/);
assert.match(legacyQixiScript, /is-entered/);
assert.match(legacyQixiScript, /easeOutQuint/);
assert.doesNotMatch(legacyQixiScript, /createWrappingPanels|drawWrapping|drawRoseBases/);
assert.doesNotMatch(legacyQixiScript, /globalCompositeOperation = "lighter"/);
assert.match(legacyQixiScript, /requestAnimationFrame/);
assert.match(legacyQixiScript, /pointerdown/);
assert.match(legacyQixiScript, /IntersectionObserver/);
assert.match(legacyQixiScript, /prefers-reduced-motion/);
assert.match(legacyQixiScript, /navigator\.share/);
assert.doesNotMatch(legacyQixiScript, /\bTHREE\b|from "three"|unpkg|jsdelivr/);

const qixiScript = readThemeFile("js/qixi-particle-bouquet.js");
assert.match(qixiScript, /import \* as THREE from "\.\/third-party\/three\/three\.module\.min\.js"/);
assert.match(qixiScript, /import \{ GLTFLoader \} from "\.\/third-party\/three\/GLTFLoader\.js"/);
assert.match(qixiScript, /import \{ MeshSurfaceSampler \} from "\.\/third-party\/three\/MeshSurfaceSampler\.js"/);
assert.match(qixiScript, /import \{ mergeGeometries \} from "\.\/third-party\/three\/BufferGeometryUtils\.js"/);
assert.match(qixiScript, /new URL\("\.\.\/images\/qixi\/qixi-bouquet\.glb\?v=a931cafa7bfe", import\.meta\.url\)/);
assert.match(qixiScript, /const sourceBouquet = sourceScene/);
assert.match(qixiScript, /function toFloatAttribute/);
assert.match(qixiScript, /attribute\.getComponent/);
assert.match(qixiScript, /mergeGeometries/);
assert.match(qixiScript, /new MeshSurfaceSampler/);
assert.match(qixiScript, /function isPetalMaterial/);
assert.match(qixiScript, /function isLeafMaterial/);
assert.match(qixiScript, /function texturePixelsForMaterial/);
assert.match(qixiScript, /function textureShadeAt/);
assert.match(qixiScript, /getImageData/);
assert.match(qixiScript, /texture\.transformUv\(uv\)/);
assert.match(qixiScript, /const petalPalette = \["#ff76b3", "#ffacce", "#7295ff", "#a4c2ff"\]/);
assert.match(qixiScript, /function samplingWeightForMaterial/);
assert.match(qixiScript, /if \(isPetalMaterial\(material\)\) return 1\.4/);
assert.match(qixiScript, /weight: samplingWeightForMaterial\(entry\.sourceMaterial\)/);
assert.match(qixiScript, /isPetal: isPetalMaterial\(entry\.sourceMaterial\)/);
assert.match(qixiScript, /entry\.sourceMaterial\.name === "Leaves6"/);
assert.match(qixiScript, /particleCount = isLowPowerDevice \? 60000 : 112000/);
assert.match(qixiScript, /sizes\[particleIndex\] = \(1\.4 \+ Math\.pow\(Math\.random\(\), 1\.8\) \* 1\.25\) \* 1\.1/);
assert.match(qixiScript, /sampler\.sample\(target, normal, undefined, uv\)/);
assert.match(qixiScript, /textureShadeAt\(allocation\.surface\.texturePixels, uv, allocation\.surface\.isPetal\)/);
assert.match(qixiScript, /geometry\.setAttribute\("aNormal", new THREE\.Float32BufferAttribute\(normals, 3\)\)/);
assert.match(qixiScript, /geometry\.setAttribute\("aPetal", new THREE\.Float32BufferAttribute\(petals, 1\)\)/);
assert.match(qixiScript, /geometry\.setAttribute\("aSpin", new THREE\.Float32BufferAttribute\(spins, 1\)\)/);
assert.match(qixiScript, /surface\.area \* surface\.weight/);
assert.match(qixiScript, /attribute vec3 aNormal/);
assert.match(qixiScript, /attribute float aPetal/);
assert.match(qixiScript, /attribute float aSpin/);
assert.match(qixiScript, /normalMatrix \* aNormal/);
assert.match(qixiScript, /blending: THREE\.NormalBlending/);
assert.doesNotMatch(qixiScript, /THREE\.AdditiveBlending/);
assert.match(qixiScript, /delays\[particleIndex\] = 0\.05 \+ height \* 0\.43/);
assert.match(qixiScript, /particleSystem\.points\.visible = true/);
assert.doesNotMatch(qixiScript, /uSolidProgress|solidReveal|prepareMaterial|bouquetRoot\.add\(bouquet\.group\)/);
assert.match(qixiScript, /startBloom/);
assert.match(qixiScript, /finishBloom/);
assert.match(qixiScript, /is-entering/);
assert.match(qixiScript, /is-entered/);
assert.match(qixiScript, /requestAnimationFrame/);
assert.match(qixiScript, /webglcontextlost/);
assert.match(qixiScript, /ratioLimit = width < 700 \? 1\.35 : 1\.8/);
assert.match(qixiScript, /pointerdown/);
assert.match(qixiScript, /setPointerCapture/);
assert.match(qixiScript, /IntersectionObserver/);
assert.match(qixiScript, /prefers-reduced-motion/);
assert.match(qixiScript, /navigator\.share/);
assert.doesNotMatch(qixiScript, /getContext\("webgl"|unpkg|jsdelivr|createSolidBouquetRenderer|createRoseDome/);

const qixiModel = readFileSync(path.join(themeRoot, "images/qixi/qixi-bouquet.glb"));
assert.equal(qixiModel.subarray(0, 4).toString("ascii"), "glTF");
assert.ok(qixiModel.length < 4.5 * 1024 * 1024, "Qixi bouquet should stay below the mobile delivery budget");
const qixiLicense = readThemeFile("images/qixi/LICENSE.md");
assert.match(qixiLicense, /icecool/);
assert.match(qixiLicense, /flower-bouquet-48e92013548247a9ad486dc13110c9b4/);
assert.match(qixiLicense, /Creative Commons Attribution 4\.0/);
const qixiGltfLoader = readThemeFile("js/third-party/three/GLTFLoader.js");
assert.match(qixiGltfLoader, /from '\.\/three\.module\.min\.js'/);
assert.match(qixiGltfLoader, /from '\.\/BufferGeometryUtils\.js'/);
assert.doesNotMatch(qixiGltfLoader, /\.\.\/utils\/BufferGeometryUtils\.js/);

const gamesPage = readThemeFile("html/label/games.html");
assert.match(gamesPage, /seo_title="游戏大厅"/);
assert.doesNotMatch(gamesPage, /\$user\.user_id|\{else\/\}|\{\/if\}/);
assert.match(gamesPage, /class="[^"]*\bgame-hub\b[^>]*data-auth-member hidden/);
assert.match(gamesPage, /class="[^"]*\bgame-access-page\b[^>]*data-auth-guest hidden/);
assert.match(gamesPage, /class="[^"]*\bgame-hub\b/);
assert.match(gamesPage, /class="game-grid"/);
assert.match(gamesPage, /mac_url\('label\/game-2048'\)/);
assert.match(gamesPage, /mac_url\('label\/game-blockrain'\)/);
assert.match(gamesPage, /mac_url\('label\/game-bamboo-cicada'\)/);
assert.match(gamesPage, /mac_url\('label\/game-gomoku'\)/);
assert.match(gamesPage, /mac_url\('label\/game-drawguess'\)/);
assert.match(gamesPage, />2048</);
assert.match(gamesPage, />俄罗斯方块</);
assert.match(gamesPage, />竹知了</);
assert.match(gamesPage, />五子棋</);
assert.match(gamesPage, />你画我猜</);
assert.match(gamesPage, /class="game-login-gate"/);
assert.match(gamesPage, /登录后开启游戏大厅/);
assert.match(gamesPage, /mac_url\('user\/login'\)/);
assert.match(gamesPage, /\{include file="public\/foot" \/\}/);

const game2048Page = readThemeFile("html/label/game-2048.html");
assert.match(game2048Page, /seo_title="2048"/);
assert.doesNotMatch(game2048Page, /\$user\.user_id|\{else\/\}|\{\/if\}/);
assert.match(game2048Page, /data-game-authenticated[^>]*data-auth-member hidden/);
assert.match(game2048Page, /class="game-2048"/);
assert.match(game2048Page, /data-auth-script="\{\$maccms\.path_tpl\}games\/2048\/js\/game_manager\.js"/);
assert.match(game2048Page, /data-auth-script="\{\$maccms\.path_tpl\}games\/2048\/js\/application\.js"/);
assert.doesNotMatch(game2048Page, /<script[^>]+games\/2048/);
assert.match(game2048Page, /data-auth-guest hidden[\s\S]*登录后才能开始游戏/);
assert.match(game2048Page, /mac_url\('user\/login'\)/);
assert.match(game2048Page, /\{include file="public\/foot" \/\}/);

const gameBlockrainPage = readThemeFile("html/label/game-blockrain.html");
assert.match(gameBlockrainPage, /seo_title="俄罗斯方块"/);
assert.doesNotMatch(gameBlockrainPage, /\$user\.user_id|\{else\/\}|\{\/if\}/);
assert.match(gameBlockrainPage, /data-game-authenticated[^>]*data-auth-member hidden/);
assert.match(gameBlockrainPage, /data-blockrain-game/);
assert.match(gameBlockrainPage, /class="blockrain-shell"/);
assert.match(gameBlockrainPage, /data-blockrain-next/);
assert.equal((gameBlockrainPage.match(/data-blockrain-action=/g) || []).length, 5);
assert.match(gameBlockrainPage, /data-blockrain-action="drop"/);
assert.match(gameBlockrainPage, /data-auth-script="\{\$maccms\.path_tpl\}games\/blockrain\/blockrain\.jquery\.min\.js"/);
assert.match(gameBlockrainPage, new RegExp(`data-auth-script="\\{\\$maccms\\.path_tpl\\}games/init\\.js\\?v=${gameVersionPlaceholder}"`));
assert.doesNotMatch(gameBlockrainPage, /jquery-1\.11\.1\.min\.js/);
assert.doesNotMatch(gameBlockrainPage, /<script[^>]+games\/(?:blockrain|init)/);
assert.match(gameBlockrainPage, /data-auth-guest hidden[\s\S]*登录后才能开始游戏/);
assert.match(gameBlockrainPage, /mac_url\('user\/login'\)/);
assert.match(gameBlockrainPage, /\{include file="public\/foot" \/\}/);

const bambooCicadaPage = readThemeFile("html/label/game-bamboo-cicada.html");
assert.match(bambooCicadaPage, /seo_title="竹知了"/);
assert.doesNotMatch(bambooCicadaPage, /\$user\.user_id|\{else\/\}|\{\/if\}/);
assert.match(bambooCicadaPage, /data-bamboo-cicada-game[^>]*data-auth-member hidden/);
assert.match(bambooCicadaPage, /data-cicada-arena/);
assert.match(bambooCicadaPage, /data-cicada-score/);
assert.match(bambooCicadaPage, /data-cicada-sound/);
assert.equal((bambooCicadaPage.match(/data-cicada-phase=/g) || []).length, 3);
assert.match(bambooCicadaPage, /data-cicada-target/);
assert.match(bambooCicadaPage, /data-cicada-energy/);
assert.match(bambooCicadaPage, /data-cicada-event/);
assert.match(bambooCicadaPage, /data-cicada-result-rhythm/);
assert.match(
  bambooCicadaPage,
  new RegExp(`data-auth-script="\\{\\$maccms\\.path_tpl\\}games/bamboo-cicada\\.js\\?v=${bambooCicadaVersionPlaceholder}"`),
);
assert.doesNotMatch(bambooCicadaPage, /<script[^>]+games\/bamboo-cicada\.js/);
assert.match(bambooCicadaPage, /data-auth-guest hidden[\s\S]*登录后才能摇响竹知了/);
assert.match(bambooCicadaPage, /mac_url\('user\/login'\)/);
assert.match(bambooCicadaPage, /\{include file="public\/foot" \/\}/);

const bambooCicadaJs = readThemeFile("games/bamboo-cicada.js");
assert.match(bambooCicadaJs, /PointerEvent|pointerdown/);
assert.match(bambooCicadaJs, /requestAnimationFrame/);
assert.match(bambooCicadaJs, /AudioContext|webkitAudioContext/);
assert.match(bambooCicadaJs, /localStorage/);
assert.match(bambooCicadaJs, /prefers-reduced-motion/);
assert.match(bambooCicadaJs, /reverse-warning/);
assert.match(bambooCicadaJs, /judgeRevolution/);
assert.match(bambooCicadaJs, /IntersectionObserver/);
assert.doesNotMatch(bambooCicadaJs, /https?:\/\//);

for (const [file, game, marker, loginText] of [
  ["html/label/game-gomoku.html", "gomoku", "data-gomoku-board", "登录后才能联机对弈"],
  ["html/label/game-drawguess.html", "drawguess", "data-draw-canvas", "登录后才能加入画室"],
]) {
  const page = readThemeFile(file);
  assert.doesNotMatch(page, /\$user\.user_id|\{else\/\}|\{\/if\}/);
  assert.match(page, /data-multiplayer-game[^>]*data-auth-member hidden/);
  assert.match(page, new RegExp(`data-game-type="${game}"`));
  assert.match(page, new RegExp(marker));
  assert.match(page, /data-game-ticket-endpoint="\{:url\('pingfangdevice\/gameTicket'\)\}"/);
  assert.match(page, new RegExp(`data-auth-script="\\{\\$maccms\\.path_tpl\\}js/multiplayer-games\\.js\\?v=${multiplayerVersionPlaceholder}"`));
  assert.doesNotMatch(page, /<script[^>]+js\/multiplayer-games\.js/);
  assert.match(page, new RegExp(`data-auth-guest hidden[\\s\\S]*${loginText}`));
  assert.match(page, /mac_url\('user\/login'\)/);
  assert.match(page, /\{include file="public\/foot" \/\}/);
}

const multiplayerGameJs = readThemeFile("js/multiplayer-games.js");
assert.match(multiplayerGameJs, /new WebSocket/);
assert.match(multiplayerGameJs, /pfv-ticket\./);
assert.match(multiplayerGameJs, /client_id/);
assert.match(multiplayerGameJs, /sessionStorage/);
assert.match(multiplayerGameJs, /BroadcastChannel/);
assert.match(multiplayerGameJs, /searchParams\.get\("room"\)/);
assert.match(multiplayerGameJs, /searchParams\.set\("room"/);
assert.match(multiplayerGameJs, /复制邀请链接/);
assert.match(multiplayerGameJs, /data-gomoku-board/);
assert.match(multiplayerGameJs, /draw\.stroke/);
assert.match(multiplayerGameJs, /clearDrawFeed/);
assert.match(multiplayerGameJs, /textContent/);
assert.doesNotMatch(multiplayerGameJs, /localhost|127\.0\.0\.1/);

assert.ok(!existsSync(path.join(themeRoot, "games/2048/index.html")), "2048 should not expose an anonymous static HTML entry");
assert.ok(!existsSync(path.join(themeRoot, "games/blockrain/index.html")), "Blockrain should not expose an anonymous static HTML entry");
assert.match(readThemeFile("games/2048/LICENSE.txt"), /MIT License/);
assert.match(readThemeFile("games/blockrain/LICENSE.txt"), /MIT License/);
const gameInit = readThemeFile("games/init.js");
assert.match(gameInit, /data-blockrain-game/);
assert.match(gameInit, /getComputedStyle/);
assert.match(gameInit, /--accent/);
assert.match(gameInit, /backgroundGrid: color\("--bg"/);
assert.match(gameInit, /touchControls", false/);
assert.doesNotMatch(gameInit, /touchControls", true/);
assert.match(gameInit, /data-blockrain-action/);
assert.match(gameInit, /_board\.next/);
assert.match(gameInit, /blockType/);
assert.doesNotMatch(gameInit, /https?:\/\//);
assert.match(categoriesPage, /\{maccms:type ids="parent" mid="1" order="asc" by="sort"/);
assert.match(categoriesPage, /num="100"/);
assert.doesNotMatch(categoriesPage, /paging="yes"/);
assert.match(categoriesPage, /category-tile/);
assert.match(categoriesPage, /<a class="category-hit" href="\{:mac_url_type\(\$type\)\}"/);
assert.match(categoriesPage, /aria-label="进入\{\$type\.type_name\}"/);
assert.match(categoriesPage, /class="category-sort sort-latest"/);
assert.match(categoriesPage, /class="category-sort sort-hot"/);
assert.match(categoriesPage, /class="category-sort sort-score"/);
assert.match(categoriesPage, /by'=>'time'/);
assert.match(categoriesPage, /by'=>'hits'/);
assert.match(categoriesPage, /by'=>'score'/);
assert.doesNotMatch(categoriesPage, /\{include file="public\/paging" \/\}/);

const historyPage = readThemeFile("html/label/history.html");
assert.match(historyPage, /seo_title="观看记录"/);
assert.match(historyPage, /history-timeline/);
assert.match(historyPage, /timeline-item/);
assert.match(historyPage, /data-history-source/);

const hotLabelPage = readThemeFile("html/label/hot.html");
const currentYearVodAttr = String.raw`year="'\.date\('Y'\)\.'"`;
assert.match(hotLabelPage, /seo_title="年度热播榜"/);
assert.match(hotLabelPage, /本年最多播放/);
assert.match(hotLabelPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="label/hot" type="${nonAdultVodTypeScope}" ${currentYearVodAttr} order="desc" by="hits" id="vo"\\}`));
assert.doesNotMatch(hotLabelPage, /\{maccms:vod[^}]*type="all"[^}]*by="hits"/);
assert.match(hotLabelPage, /include file="public\/vod_card"/);
assert.match(hotLabelPage, /include file="public\/paging"/);
assert.match(hotLabelPage, /\{include file="public\/foot" \/\}/);

const videosLabelPage = readThemeFile("html/label/videos.html");
assert.match(videosLabelPage, /seo_title="影片库"/);
assert.match(videosLabelPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="label/videos" type="${nonAdultVodTypeScope}" order="desc" by="time" id="vo"\\}`));
assert.doesNotMatch(videosLabelPage, /\{maccms:vod[^}]*type="all"[^}]*by="time"/);
assert.match(videosLabelPage, /include file="public\/vod_card"/);
assert.match(videosLabelPage, /include file="public\/paging"/);
assert.match(videosLabelPage, /\{include file="public\/foot" \/\}/);

const userIndexPage = readThemeFile("html/user/index.html");
assert.match(userIndexPage, /mac_url\('user\/plays'\)/);
assert.match(userIndexPage, /mac_url\('user\/favs'\)/);
assert.match(userIndexPage, /url\('pingfangdevice\/index'\)/);
assert.match(userIndexPage, /登录设备管理/);
assert.doesNotMatch(userIndexPage, /mac_url\('user\/downs'\)/);

const userLoginPage = readThemeFile("html/user/login.html");
assert.match(userLoginPage, /action="\{:\s*url\('pingfangdevice\/login'\)\}"/);
assert.match(userLoginPage, /data-login-form/);
assert.match(userLoginPage, /data-success-redirect="\{\$maccms\.path\}"/);
assert.match(userLoginPage, /class="login-page"/);
assert.match(userLoginPage, /class="login-panel verify-form"/);
assert.match(userLoginPage, /data-login-glass/);
assert.match(userLoginPage, /class="login-glass-highlight" aria-hidden="true"/);
assert.match(userLoginPage, /class="login-edge-glow" aria-hidden="true"/);
assert.match(userLoginPage, /class="login-pixel-pass" aria-hidden="true"/);
assert.match(userLoginPage, /PFV ACCESS/);
assert.match(userLoginPage, /login-field-icon login-icon-user/);
assert.match(userLoginPage, /login-field-icon login-icon-lock/);
assert.match(userLoginPage, /login-field-icon login-icon-shield/);
assert.match(userLoginPage, /login-icon-eye/);
assert.match(userLoginPage, /login-icon-refresh/);
assert.match(userLoginPage, /id="loginTitle">欢迎回来</);
assert.match(userLoginPage, /data-password-toggle/);
assert.match(userLoginPage, /data-verify-refresh/);
assert.match(userLoginPage, /mac_url\('user\/findpass'\)/);
assert.match(userLoginPage, /mac_url\('user\/reg'\)/);
assert.match(userLoginPage, /login_verify/);
assert.match(userLoginPage, /name="verify"/);
assert.match(userLoginPage, /class="mac_verify_img"[^>]*src="\{:url\('verify\/index'\)\}"/);
assert.match(userLoginPage, /type="hidden" name="openid"/);
assert.match(userLoginPage, /type="hidden" name="col"/);

const devicePage = readThemeFile("html/pingfangdevice/index.html");
assert.match(devicePage, /\{include file="public\/head" seo_title="登录设备管理"/);
assert.match(devicePage, /登录设备管理/);
assert.match(devicePage, /最多 \{\$max_devices\} 台设备/);
assert.match(devicePage, /\{volist name="device_list" id="vo"\}/);
assert.match(devicePage, /当前设备/);
assert.match(devicePage, /最近登录时间/);
assert.match(devicePage, /device_label_display/);
assert.match(devicePage, /ip_address_display/);
assert.match(devicePage, /user_agent_display/);
assert.match(devicePage, /data-device-revoke/);
assert.match(devicePage, /url\('pingfangdevice\/revoke'\)/);
assert.match(devicePage, /"X-Requested-With": "XMLHttpRequest"/);
assert.match(devicePage, /window\.confirm\(/);
assert.match(devicePage, /确定要将/);
assert.ok(devicePage.indexOf("window.confirm") < devicePage.indexOf("button.disabled = true"), "device revoke confirmation should happen before the request starts");
assert.match(devicePage, /\{include file="public\/foot" \/\}/);

const userPlaysPage = readThemeFile("html/user/plays.html");
assert.match(userPlaysPage, /\{include file="user\/head" \/\}/);
assert.match(userPlaysPage, /seo_title="播放记录"|我的播放|播放记录/);
assert.match(userPlaysPage, /\{volist name="list" id="vo"\}/);
assert.match(userPlaysPage, /\{\$vo\.ulog_id\}/);
assert.match(userPlaysPage, /\{\$vo\.data\.link\}/);
assert.match(userPlaysPage, /\{\$vo\.data\.name\}/);
assert.match(userPlaysPage, /record-poster/);
assert.match(userPlaysPage, /\{\$vo\.data\.pic\|mac_url_img\}/);
assert.match(userPlaysPage, /alt="\{\$vo\.data\.name\}"/);
assert.match(userPlaysPage, /loading="lazy" decoding="async" width="160" height="240" sizes="76px"/);
assert.match(userPlaysPage, /data-record-video-id="\{\$vo\.ulog_rid\}"/);
assert.match(userPlaysPage, /data-record-id="\{\$vo\.ulog_id\}"/);
assert.match(userPlaysPage, /collapsePlaybackRecords/);
assert.match(userPlaysPage, /recordDeleteIds/);
assert.match(userPlaysPage, /seenByVideo/);
assert.match(userPlaysPage, /\{\$vo\.ulog_sid\}/);
assert.match(userPlaysPage, /\{\$vo\.ulog_nid\}/);
assert.match(userPlaysPage, /user\/ulog_del/);
assert.match(userPlaysPage, /type:\s*4/);
assert.doesNotMatch(userPlaysPage, /user\/downs|user\/buy|user\/pay/);

const userFavsPage = readThemeFile("html/user/favs.html");
assert.match(userFavsPage, /\{include file="user\/head" \/\}/);
assert.match(userFavsPage, /seo_title="收藏记录"|我的收藏|收藏记录/);
assert.match(userFavsPage, /favorite-page/);
assert.match(userFavsPage, /favorite-toolbar/);
assert.match(userFavsPage, /favorite-list/);
assert.match(userFavsPage, /favorite-card/);
assert.match(userFavsPage, /favorite-status/);
assert.match(userFavsPage, />已收藏</);
assert.match(userFavsPage, /favorite-empty/);
assert.match(userFavsPage, /\{volist name="list" id="vo"\}/);
assert.match(userFavsPage, /\{\$vo\.ulog_id\}/);
assert.match(userFavsPage, /\{\$vo\.data\.link\}/);
assert.match(userFavsPage, /\{\$vo\.data\.name\}/);
assert.match(userFavsPage, /record-poster/);
assert.match(userFavsPage, /\{\$vo\.data\.pic\|mac_url_img\}/);
assert.match(userFavsPage, /alt="\{\$vo\.data\.name\}"/);
assert.match(userFavsPage, /loading="lazy" decoding="async" width="160" height="240" sizes="104px"/);
assert.match(userFavsPage, /user\/ulog_del/);
assert.match(userFavsPage, /type:\s*2/);
assert.match(userFavsPage, /PingFangVideo\.clearFavoriteCache/);
assert.doesNotMatch(userFavsPage, /user\/downs|user\/buy|user\/pay/);

const fallbackPages = [
  ["html/topic/index.html", "专题"],
  ["html/topic/detail.html", "专题"],
  ["html/art/index.html", "文章"],
  ["html/art/confirm.html", "文章"],
  ["html/art/detail.html", "文章"],
  ["html/art/detail_pwd.html", "文章"],
  ["html/art/search.html", "文章"],
  ["html/art/type.html", "文章"],
  ["html/art/show.html", "文章"],
  ["html/plot/uindex.html", "剧情"],
  ["html/plot/udetail.html", "剧情"],
  ["html/actor/index.html", "演员"],
  ["html/actor/detail.html", "演员"],
  ["html/actor/search.html", "演员"],
  ["html/actor/show.html", "演员"],
  ["html/actor/type.html", "演员"],
  ["html/role/index.html", "角色"],
  ["html/role/detail.html", "角色"],
  ["html/role/show.html", "角色"],
  ["html/website/index.html", "游戏"],
  ["html/website/detail.html", "游戏"],
  ["html/website/search.html", "游戏"],
  ["html/website/show.html", "游戏"],
  ["html/website/type.html", "游戏"],
];

for (const [file, label] of fallbackPages) {
  const page = readThemeFile(file);
  assert.match(page, new RegExp(`seo_title="${label}`));
  assert.match(page, /module-fallback/);
  assert.match(page, /mac_url\('vod\/show'\)/);
}

const artRssPage = readThemeFile("html/art/rss.html");
assert.match(artRssPage, /maccms:art/);
assert.match(artRssPage, /mac_url_art_detail/);

for (const userPage of ["head", "index", "login", "reg", "findpass"]) {
  const page = readThemeFile(`html/user/${userPage}.html`);
  assert.match(page, /用户中心|会员|登录|注册|找回密码/);
}
assert.equal(readThemeFile("html/user/foot.html").trim(), '{include file="public/foot" /}');
assert.equal(readThemeFile("html/user/include.html").trim(), '{include file="public/include" /}');

const msgPage = readThemeFile("html/public/msg.html");
assert.doesNotMatch(msgPage, /href="javascript:/);
assert.match(msgPage, /mac_url\('vod\/show'\)/);

const index = readThemeFile("html/index/index.html");
assert.match(index, /<h1 class="sr-only">\{\$maccms\.site_name\}首页<\/h1>/);
assert.match(index, /\{include file="public\/head" seo_title=/);
assert.match(index, new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="6" ${currentYearVodAttr} order="desc" by="time" cachetime="300" id="vo"\\}`));
assert.doesNotMatch(index, /\{maccms:vod type="all" num="6" order="desc" by="time" id="vo"\}/);
for (const typeId of nonAdultVodTypeScope.split(",")) {
  assert.match(index, new RegExp(`\\{maccms:type ids="${typeId}" order="asc" by="sort" num="1" id="type"\\}`));
}
assert.match(index, /mac_data_count\(0,'today','vod'\)/);
assert.doesNotMatch(index, /mac_data_count\(0,'all','vod'\)/);
assert.doesNotMatch(index, /全站片库/);
assert.match(index, /hero-carousel/);
assert.match(index, /data-home-gsap-src="\{\$maccms\.path_tpl\}js\/gsap\.min\.js\?v=3\.15\.0"/);
assert.doesNotMatch(index, /hero-gradient-strips/);
assert.doesNotMatch(index, /data-gradient-strips?/);
assert.match(index, /hero-slide/);
assert.match(index, /banner-content/);
assert.match(index, /data-banner-bg="\{if condition="\$vo\.vod_pic_slide neq ''"\}\{\$vo\.vod_pic_slide\|mac_url_img\}\{else\/\}\{\$vo\.vod_pic\|mac_url_img\}\{\/if\}"/);
assert.doesNotMatch(index, /style="--banner-bg:/);
assert.match(index, /class="primary-btn" href="\{:mac_url_vod_play\(\$vo\)\}">立即播放<\/a>/);
assert.match(index, /class="ghost-btn" href="\{:mac_url_vod_detail\(\$vo\)\}">详情介绍<\/a>/);
assert.match(index, /vod_duration\|mac_default='时长待定'/);
assert.match(index, /vod_version\|mac_default='高清'/);
assert.match(index, /banner-dots/);
assert.match(index, /class="banner-autoplay-toggle" type="button" data-carousel-autoplay-toggle aria-pressed="false" aria-label="暂停自动轮播"/);
assert.doesNotMatch(index, /liquid-lens/);
assert.doesNotMatch(index, /hero-stats/);
assert.doesNotMatch(index, /banner-art/);
assert.doesNotMatch(index, /banner-poster/);
assert.doesNotMatch(index, /data-carousel-prev/);
assert.doesNotMatch(index, /data-carousel-next/);
assert.match(index, /rank-index/);
assert.match(index, /rank-thumb/);
assert.match(index, /data-rank-react-root/);
assert.doesNotMatch(index, /data-rank-visible-count/);
assert.match(index, /data-rank-react-list/);
assert.match(index, /data-rank-item/);
assert.match(index, new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" ${currentYearVodAttr} order="desc" by="hits" cachetime="300" id="vo" key="key"\\}`));
assert.doesNotMatch(index, /is-rank-extra/);
assert.match(index, /data-rank-title="\{\$vo\.vod_name\}"/);
assert.match(index, /data-rank-meta="\{\$vo\.vod_year\|mac_default='年份未知'\} · \{\$vo\.vod_class\|mac_default='类型待定'\}"/);
assert.match(index, /data-rank-score="\{\$vo\.vod_score\|mac_default='0\.0'\}"/);
assert.match(index, /data-rank-pic="\{\$vo\.vod_pic\|mac_url_img\}"/);
assert.match(index, /class="rank-thumb"[\s\S]*<img src="\{\$vo\.vod_pic\|mac_url_img\}" alt="\{\$vo\.vod_name\}" width="112" height="84" loading="lazy" decoding="async" sizes="72px">/);
assert.match(index, /rank-body/);
assert.match(index, /rank-meta/);
assert.match(index, /rank-score/);
assert.match(index, /class="rank-heading"><small>TOP 05<\/small><h2>年度热度榜<\/h2>/);
assert.doesNotMatch(index, /js\/react\.production\.min\.js/);
assert.doesNotMatch(index, /js\/react-dom\.production\.min\.js/);
assert.doesNotMatch(index, /js\/rank-react\.js/);
assert.doesNotMatch(index, /<script src="\{\$maccms\.path_tpl\}js\/gsap\.min\.js/);
assert.doesNotMatch(index, /unpkg|jsdelivr|localhost|127\.0\.0\.1/);
assert.match(index, /class="wrap genre-dock" aria-label="频道快捷入口"/);
assert.match(index, /data-channel="TOP"/);
assert.match(index, /data-channel="FILM"/);
assert.match(index, /data-channel="NEW"/);
assert.match(index, /home-shelf home-shelf-latest/);
assert.match(index, /data-home-empty-container data-empty-item="\.rank-item"/);
assert.match(index, /data-home-empty-container data-empty-item="\.home-shelf-card"/);
assert.match(index, /本年度暂无上榜内容/);
assert.match(index, /本年度暂无新上线内容/);
assert.match(index, /class="wrap home-shelf home-continue" data-home-continue hidden/);
assert.match(index, /data-home-continue-list/);
assert.match(index, /home-shelf-tabs/);
assert.match(index, /home-shelf-card" href="\{:\s*mac_url_vod_detail\(\$vo\)\}" title="\{\$vo\.vod_name\}">/);
assert.match(index, /home-shelf-poster/);
assert.match(index, /home-shelf-score/);
assert.match(index, /<h2>本年最新上线<\/h2>/);
assert.match(index, /class="shelf-title"><small>NEW THIS YEAR<\/small>/);
assert.match(index, /aria-label="最新分类"/);
assert.match(index, /data-home-tab="all"/);
assert.match(index, /data-home-tab="category-1"/);
assert.match(index, /data-home-tab="category-5"/);
assert.match(index, /<button class="is-active" type="button" data-home-tab="all" role="tab" aria-selected="true" aria-controls="latest-panel-all" tabindex="0">推荐<\/button>/);
assert.match(index, /<button type="button" data-home-tab="category-1" role="tab" aria-selected="false" aria-controls="latest-panel-category-1" tabindex="-1">/);
assert.match(index, /<button type="button" data-home-tab="category-5" role="tab" aria-selected="false" aria-controls="latest-panel-category-5" tabindex="-1">/);
assert.doesNotMatch(index, /href="#home-latest-/);
assert.doesNotMatch(index, /id="home-latest-/);
assert.match(index, /id="latest-panel-all"/);
const latestShelfMarkup = index.match(/<section class="wrap home-shelf home-shelf-latest"[\s\S]*?<\/section>/)?.[0] || "";
assert.ok((latestShelfMarkup.match(/loading="lazy"/g) || []).length >= 6);
assert.doesNotMatch(latestShelfMarkup, /loading="eager"|fetchpriority="high"/);
for (const [tabIndex, typeId] of [
  ["1", "42"],
  ["2", "47"],
  ["3", "48"],
  ["4", "57"],
  ["5", "111"],
]) {
  assert.match(index, new RegExp(`id="latest-panel-category-${tabIndex}"[\\s\\S]*?\\{maccms:vod type="${typeId}" num="6" ${currentYearVodAttr} order="desc" by="time" cachetime="300" id="vo"\\}`));
}
for (const vodTag of index.match(/\{maccms:vod[^}]+\}/g) || []) {
  assert.doesNotMatch(vodTag, /\stype="[^"]*\{/, `${vodTag} should not use dynamic template syntax in type attribute`);
}
assert.doesNotMatch(index, /include file="public\/vod_card"/);
assert.match(index, /<span class="rank-heading"><small>TOP 05<\/small><h2>年度热度榜<\/h2><\/span>/);
assert.match(index, /class="rank-refresh" href="\{:mac_url\('label\/hot'\)\}">查看更多<\/a>/);
assert.doesNotMatch(index, /换一换/);
assert.match(index, /mac_url\('label\/hot'\)/);
assert.match(index, /mac_url\('label\/videos'\)/);
assert.doesNotMatch(index, /class="wrap quick-types"/);
assert.doesNotMatch(index, /\{maccms:type ids="parent" order="asc" by="sort" num="10" id="type"\}/);
assert.doesNotMatch(index, /\{maccms:type ids="parent" order="asc" by="sort" num="4" id="type"\}/);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" order="desc" by="hits"`, "g")) || []).length, 1);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="5" ${currentYearVodAttr} order="desc" by="hits"`, "g")) || []).length, 1);
assert.equal((index.match(/data-carousel-dot/g) || []).length, 0);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="12" order="desc" by="rnd"`, "g")) || []).length, 0);
assert.equal((index.match(new RegExp(`\\{maccms:vod type="${nonAdultVodTypeScope}" num="6" order="desc" by="hits"`, "g")) || []).length, 0);
assert.doesNotMatch(index, /\{maccms:vod type="all"[^}]*by="hits"/);
assert.doesNotMatch(index, /mac_url\('vod\/show',\['by'=>'hits'\]\)/);
assert.doesNotMatch(index, /<a href="\{:mac_url\('vod\/show'\)\}">全部影片<\/a>/);

const detail = readThemeFile("html/vod/detail.html");
assertRuntimeSeo(detail, ["$obj.vod_name", "$obj.vod_tag|default=''", "$obj.vod_blurb|default=''"]);
assert.match(detail, /\{\$obj\.vod_pic\|mac_url_img\}/);
assert.match(detail, /class="detail-backdrop" aria-hidden="true"><img src="\{\$obj\.vod_pic\|mac_url_img\}" alt="">/);
assert.match(detail, /class="detail-poster"[\s\S]*<img src="\{\$obj\.vod_pic\|mac_url_img\}" alt="\{\$obj\.vod_name\}" width="380" height="570" loading="eager" decoding="async" fetchpriority="high" sizes="\(max-width: 760px\) 44vw, 250px">/);
assert.match(detail, /mac_url_vod_play/);
assert.match(detail, /mac_history_set/);
assert.match(detail, /obj\.vod_play_list/);
assert.match(detail, /detail-panel/);
assert.match(detail, /detail-title-row/);
assert.match(detail, /include file="public\/score"/);
assert.match(detail, /include file="public\/star"/);
assert.match(detail, /include file="public\/digg"/);
assert.match(detail, /data-favorite-action/);
assert.match(detail, /data-favorite-label/);
assert.match(detail, /data-favorite-saved-label="已收藏"/);
assert.match(detail, /aria-pressed="false"/);
assert.match(detail, /<dt>热度<\/dt><dd>\{\$obj\.vod_hits\|mac_default='0'\} 次<\/dd>/);
assert.match(detail, /loading="lazy" decoding="async" width="300" height="450" sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px"/);
assert.match(detail, /data-source-quality-panel/);
assert.match(detail, /data-source-quality-endpoint="\{:url\('pingfangdevice\/sourceQuality'\)\}"/);
assert.match(detail, /data-source-quality-vod-id="\{\$obj\.vod_id\}"/);
assert.match(detail, /data-source-quality-episode/);
assert.match(detail, /<option value="\{\$vo2\.nid\}">\{\$vo2\.name\}<\/option>/);
assert.match(detail, /data-source-quality-sid="\{\$vo\.sid\}"/);
assert.match(detail, /data-source-quality-primary/);
assert.match(detail, /data-source-quality-nid="\{\$vo2\.nid\}"/);
assert.match(detail, /data-source-quality-result/);
assert.doesNotMatch(detail, /\{\$vo2\.url\}/);

const vodCard = readThemeFile("html/public/vod_card.html");
assert.match(vodCard, /<img src="\{\$vo\.vod_pic\|mac_url_img\}" alt="\{\$vo\.vod_name\}" loading="lazy" decoding="async" width="300" height="450" sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px">/);

const searchImagePage = readThemeFile("html/vod/search.html");
assert.equal((searchImagePage.match(/sizes="96px"/g) || []).length, 2);

const play = readThemeFile("html/vod/play.html");
assertRuntimeSeo(play, ["$obj.vod_name", "$obj.vod_tag|default=''", "$obj.vod_blurb|default=''"]);
assert.match(play, /\{\$player_data\}/);
assert.match(play, /\{\$player_js\}/);
assert.doesNotMatch(play, /\{\$maccms\.path_tpl\}js\/hls\.min\.js/);
assert.doesNotMatch(play, /\{\$maccms\.path_tpl\}js\/pingfang-player\.js/);
assert.match(play, /mac_ulog_set/);
assert.match(play, /data-next-play-url="\{\$obj\.player_info\.link_next\}"/);
assert.match(play, /data-source-quality-vod-id="\{\$obj\.vod_id\}"/);
assert.match(play, /data-source-quality-sid="\{\$param\.sid\}"/);
assert.match(play, /data-source-quality-nid="\{\$param\.nid\}"/);
assert.match(play, /data-source-quality-sid="\{\$vo\.sid\}"/);
assert.match(play, /player-toolbar/);
assert.match(play, /class="player-shell" role="region" aria-label="视频播放器"[\s\S]*class="player-toolbar" role="group" aria-label="播放控制"/);
assert.match(play, /\{if condition="\$param\.nid gt 1"\}[\s\S]*\{\$obj\.player_info\.link_pre\}[\s\S]*上一集/);
assert.match(play, /href="#episodeList">选集<\/a>/);
assert.match(play, /\$obj\.player_info\.link_next[\s\S]*下一集/);
assert.match(play, /id="episodeList" aria-label="选集列表"/);
assert.match(play, /\$vo\.sid eq \$param\.sid and \$vo2\.nid eq \$param\.nid/);
assert.match(play, /aria-current="page"/);
assert.doesNotMatch(play, /data-player-fullscreen/);
assert.doesNotMatch(play, /横屏全屏/);
assert.match(play, /\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]/);
assert.match(play, /<h1>\{\$obj\.vod_name\} - \{\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]\}<\/h1>/);
assert.match(play, /<span>\{\$obj\.vod_name\} \/ \{\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]\}<\/span>/);
assert.doesNotMatch(play, /<h1>\{\$obj\.vod_name\}<\/h1>/);

const vodConfirmPage = readThemeFile("html/vod/confirm.html");
assert.match(vodConfirmPage, /seo_title="确认点播"/);
assert.match(vodConfirmPage, /mac_url_vod_detail/);
assert.match(vodConfirmPage, /确认继续/);

const vodDetailPwdPage = readThemeFile("html/vod/detail_pwd.html");
assert.match(vodDetailPwdPage, /seo_title="访问验证"/);
assert.match(vodDetailPwdPage, /name="pwd"/);
assert.match(vodDetailPwdPage, /验证码/);

const playerPage = readThemeFile("html/vod/player.html");
assertRuntimeSeo(playerPage, ["$obj.vod_name", "$obj.vod_tag|default=''", "$obj.vod_blurb|default=''"]);
assert.match(playerPage, /\{\$player_data\}/);
assert.match(playerPage, /\{\$player_js\}/);
assert.doesNotMatch(playerPage, /\{\$maccms\.path_tpl\}js\/hls\.min\.js/);
assert.doesNotMatch(playerPage, /\{\$maccms\.path_tpl\}js\/pingfang-player\.js/);
assert.match(playerPage, /试看播放/);
assert.match(playerPage, /class="player-shell" role="region" aria-label="试看播放器"[\s\S]*class="player-toolbar" role="group" aria-label="播放控制"/);
assert.doesNotMatch(playerPage, /data-player-fullscreen/);
assert.doesNotMatch(playerPage, /横屏全屏/);
assert.match(playerPage, /\$obj\['vod_play_list'\]\[\$param\['sid'\]\]\['urls'\]\[\$param\['nid'\]\]\['name'\]/);
assert.doesNotMatch(playerPage, /<h1>\{\$obj\.vod_name\}<\/h1>/);
assert.match(playerPage, /\{include file="public\/foot" \/\}/);

const preloadPrompt = readThemeFile("player/preload.html");
const bufferingPrompt = readThemeFile("player/buffering.html");
const playerPromptStyle = readThemeFile("player/prompt.css");

assert.match(preloadPrompt, /class="player-prompt player-prompt--preload"/);
assert.match(preloadPrompt, /role="status"/);
assert.match(preloadPrompt, /aria-live="polite"/);
assert.match(preloadPrompt, /正在准备播放/);
assert.match(preloadPrompt, new RegExp(`href="\\.\\/prompt\\.css\\?v=${promptVersionPlaceholder}"`));

assert.match(bufferingPrompt, /class="player-prompt player-prompt--buffering"/);
assert.match(bufferingPrompt, /role="status"/);
assert.match(bufferingPrompt, /aria-live="polite"/);
assert.match(bufferingPrompt, /正在续接画面/);
assert.match(bufferingPrompt, new RegExp(`href="\\.\\/prompt\\.css\\?v=${promptVersionPlaceholder}"`));

for (const prompt of [preloadPrompt, bufferingPrompt]) {
  assert.match(prompt, /<meta name="viewport"/);
  assert.doesNotMatch(prompt, /<script\b/);
  assert.doesNotMatch(prompt, /https?:\/\//);
}

assert.match(playerPromptStyle, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(playerPromptStyle, /@media \(max-width: 560px\)/);
assert.match(playerPromptStyle, /@keyframes preload-signal/);
assert.match(playerPromptStyle, /@keyframes buffer-orbit/);
assert.doesNotMatch(playerPromptStyle, /transition:\s*all/);

const playerPwdPage = readThemeFile("html/vod/player_pwd.html");
assert.match(playerPwdPage, /seo_title="播放验证"/);
assert.match(playerPwdPage, /name="pwd"/);
assert.match(playerPwdPage, /验证码/);

const downPage = readThemeFile("html/vod/down.html");
assertRuntimeSeo(downPage, ["$obj.vod_name", "$obj.vod_tag|default=''", "$obj.vod_blurb|default=''"]);
assert.match(downPage, /obj\.vod_down_list/);
assert.match(downPage, /download-list/);
assert.match(downPage, /mac_url_vod_down/);

const downerPwdPage = readThemeFile("html/vod/downer_pwd.html");
assert.match(downerPwdPage, /seo_title="下载验证"/);
assert.match(downerPwdPage, /name="pwd"/);
assert.match(downerPwdPage, /验证码/);

const copyrightPage = readThemeFile("html/vod/copyright.html");
assert.match(copyrightPage, /seo_title="版权提示"/);
assert.match(copyrightPage, /版权限制/);
assert.match(copyrightPage, /mac_url_vod_detail/);

const plotPage = readThemeFile("html/vod/plot.html");
assertRuntimeSeo(plotPage, ["$obj.vod_name", "$obj.vod_tag|default=''", "$obj.vod_blurb|default=''"]);
assert.match(plotPage, /plot-list/);
assert.match(plotPage, /obj\.vod_plot_list/);

for (const rssAlias of ["rss/rss.html", "rss/baidu.html", "rss/google.html"]) {
  const rssAliasPage = readThemeFile(`html/${rssAlias}`);
  assert.match(rssAliasPage, /maccms:vod/);
  assert.match(rssAliasPage, /mac_url_vod_detail/);
}

const vodFilterCommonPartial = readThemeFile("html/public/vod_filter_common.html");
const vodGridResultsPartial = readThemeFile("html/public/vod_grid_results.html");
function expandVodGridResults(pageurl, vodType) {
  return vodGridResultsPartial.replaceAll("[pageurl]", pageurl).replaceAll("[vod_type]", vodType);
}

const typePageSource = readThemeFile("html/vod/type.html");
assertRuntimeSeo(typePageSource, ["$obj.type_name", "$obj.type_key|default=''", "$obj.type_des|default=''"]);
const typePage = [typePageSource, vodFilterCommonPartial, expandVodGridResults("vod/type", "current")].join("\n");
assert.match(typePage, /\{include file="public\/head" seo_title=/);
assert.match(typePageSource, /\{include file="public\/vod_filter_common" \/\}/);
assert.match(typePageSource, /\{include file="public\/vod_grid_results" pageurl="vod\/type" vod_type="current" \/\}/);
assert.match(typePage, /\{maccms:vod num="24" paging="yes"/);
assert.match(typePage, /pageurl="vod\/type"/);
assert.doesNotMatch(typePage, /\$param\['by'\]/);
assert.match(typePage, /filter-panel category-filter/);
assert.match(typePage, /data-dynamic-vod-filters/);
assert.match(typePage, /data-filter-endpoint="\{:url\('pingfangdevice\/filters'\)\}"/);
assert.match(typePage, /data-filter-type-id="\{\$obj\.type_id\}"/);
assert.match(typePage, /data-current-area="\{\$param\.area\}"/);
assert.match(typePage, /data-current-year="\{\$param\.year\}"/);
assert.match(typePage, /data-current-lang="\{\$param\.lang\}"/);
assert.match(typePage, /data-filter-kind="area" data-filter-href-template="\{:mac_url_type\(\$obj,/);
assert.match(typePage, /data-filter-kind="year" data-filter-href-template="\{:mac_url_type\(\$obj,/);
assert.match(typePage, /data-filter-kind="lang" data-filter-href-template="\{:mac_url_type\(\$obj,/);
assert.match(typePage, /__PINGFANG_FILTER_VALUE__/);
assert.match(typePage, /class="channel-search"/);
assert.match(typePage, /class="filter-row filter-search-row"/);
assert.match(typePage, /action="\{:mac_url\('vod\/search'\)\}"/);
assert.match(typePage, /name="type" value="\{\$obj\.type_id\}"/);
assert.match(typePage, /placeholder="在\{\$obj\.type_name\}中搜索"/);
assert.match(typePage, /filter-row/);
assert.match(typePage, /filter-options/);
assert.match(typePage, /filter-actions/);
assert.match(typePage, /filter-reset/);
assert.match(typePage, />重置筛选</);
assert.match(typePage, /mac_url_type\(\$obj,\[\],'show'\)/);
assert.match(typePage, /\{maccms:type parent="'\.\$obj\['type_id'\]\.'" order="asc" by="sort" num="100" id="type"\}/);
assert.match(typePage, /mac_url_type\(\$type,\['area'=>\$param\['area'\][\s\S]*\],'show'\)/);
assert.match(typePage, /mac_url_type\(\$obj,\['area'=>\$param\['area'\][\s\S]*'by'=>'hits'\],'show'\)/);
assert.doesNotMatch(typePage, /<strong>子类<\/strong>/);
assert.equal((typePage.match(/<strong>类型<\/strong>/g) || []).length, 1);
assert.match(typePage, /<div class="filter-row">\s*<strong>类型<\/strong>/);
assert.doesNotMatch(typePage, /<div class="filter-row" data-filter-kind="area"[^\n]*>\s*<strong>类型<\/strong>/);
assert.match(typePage, /<strong>地区<\/strong>/);
assert.match(typePage, /<div class="filter-row" data-filter-kind="area"[^\n]*>\s*<strong>地区<\/strong>/);
assert.match(typePage, /data-filter-kind="area"/);
assert.match(typePage, /<strong>年份<\/strong>/);
assert.match(typePage, /data-filter-kind="year"/);
assert.match(typePage, /<strong>语言<\/strong>/);
assert.match(typePage, /data-filter-kind="lang"/);
assert.match(typePage, /<strong>字母<\/strong>/);
assert.match(typePage, /<strong>排序<\/strong>/);
assert.match(typePage, /\$obj\.type_extend\.area/);
assert.match(typePage, /\$obj\.parent\.type_extend\.area/);
assert.match(typePage, /\$maccms\.vod_extend_area/);
assert.match(typePage, /\$obj\.type_extend\.year/);
assert.match(typePage, /\$maccms\.vod_extend_year/);
assert.doesNotMatch(typePage, /\$obj\.type_extend\.class/);
assert.doesNotMatch(typePage, /\$obj\.parent\.type_extend\.class/);
assert.match(typePage, /\$obj\.type_extend\.lang/);
assert.match(typePage, /\$maccms\.vod_extend_lang/);
assert.match(typePage, /'area'=>\$vo2/);
assert.match(typePage, /data-filter-value="\{\$vo2\}"/);
assert.match(typePage, /'year'=>\$vo2/);
assert.doesNotMatch(typePage, /'class'=>\$vo2/);
assert.match(typePage, /'lang'=>\$vo2/);
assert.match(typePage, /\{if condition="\$param\['area'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.match(typePage, /\{if condition="\$param\['lang'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.ok(typePage.includes(`{maccms:foreach name=":explode(',','${fullLetterFilter}')" id="vo2"}`), "vod/type should render a complete letter filter");
assert.match(typePage, /\{if condition="\$param\['letter'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.match(typePage, /'letter'=>\$vo2/);
assert.doesNotMatch(typePage, /\$param\['letter'\] eq 'Y'/);
assert.doesNotMatch(typePage, /'area'=>'中国大陆'/);
assert.doesNotMatch(typePage, /'lang'=>'国语'/);
assert.doesNotMatch(typePage, /'class'=>'剧情'/);
assert.doesNotMatch(typePage, /'year'=>'2026'/);
assert.match(typePage, /area="'\.\$param\['area'\]\.'"/);
assert.match(typePage, /lang="'\.\$param\['lang'\]\.'"/);
assert.match(typePage, /year="'\.\$param\['year'\]\.'"/);
assert.match(typePage, /letter="'\.\$param\['letter'\]\.'"/);
assert.match(typePage, /class="'\.\$param\['class'\]\.'"/);
assert.match(typePage, /\$param\.by eq 'hits'/);
assert.match(typePage, /\$param\.by eq 'score'/);
assert.match(typePage, /by="hits"/);
assert.match(typePage, /by="score"/);
assert.match(typePage, /by="time"/);
assert.match(typePageSource, /<span>按当前条件更新<\/span>/);
assert.doesNotMatch(typePageSource, /mac_data_count\(/);
assert.match(typePageSource, /class="vod-grid" data-empty-container data-empty-item="\.vod-card"/);
assert.match(typePage, /\{include file="public\/paging" \/\}/);

const showPageSource = readThemeFile("html/vod/show.html");
assertRuntimeSeo(showPageSource, ["$obj.type_name|default='影片库'", "$obj.type_key|default=''", "$obj.type_des|default=''"]);
assert.match(showPageSource, /<h1>\{\$pingfang_seo_title\|htmlspecialchars=ENT_QUOTES,'UTF-8',false\}<\/h1>/);
const showPage = [showPageSource, vodFilterCommonPartial, expandVodGridResults("vod/show", nonAdultVodTypeScope)].join("\n");
assert.match(showPageSource, /\{include file="public\/vod_filter_common" \/\}/);
assert.match(showPageSource, new RegExp(`\\{include file="public/vod_grid_results" pageurl="vod/show" vod_type="${nonAdultVodTypeScope}" \\/\\}`));
assert.match(vodGridResultsPartial, /pageurl="\[pageurl\]"/);
assert.match(vodGridResultsPartial, /type="\[vod_type\]"/);
assert.match(showPage, /data-dynamic-vod-filters/);
assert.match(showPage, /data-filter-endpoint="\{:url\('pingfangdevice\/filters'\)\}"/);
assert.match(showPage, /data-filter-type-id="\{\$obj\.type_id\}"/);
assert.match(showPage, /data-current-area="\{\$param\.area\}"/);
assert.match(showPage, /data-current-year="\{\$param\.year\}"/);
assert.match(showPage, /data-current-lang="\{\$param\.lang\}"/);
assert.match(showPage, /data-filter-kind="area" data-filter-href-template="\{:mac_url_type\(\$obj,/);
assert.match(showPage, /data-filter-kind="year" data-filter-href-template="\{:mac_url_type\(\$obj,/);
assert.match(showPage, /data-filter-kind="lang" data-filter-href-template="\{:mac_url_type\(\$obj,/);
assert.match(showPage, /__PINGFANG_FILTER_VALUE__/);
assert.match(showPage, /class="channel-search"/);
assert.match(showPage, /class="filter-row filter-search-row"/);
assert.match(showPage, /action="\{:mac_url\('vod\/search'\)\}"/);
assert.match(showPage, /name="type" value="\{\$obj\.type_id\}"/);
assert.match(showPage, /placeholder="在影片库中搜索"/);
assert.match(showPage, /filter-actions/);
assert.match(showPage, /filter-reset/);
assert.match(showPage, />重置筛选</);
assert.match(showPage, /\$obj\.type_pid gt 0/);
assert.match(showPage, /mac_url_type\(\$obj\.parent,\[\],'show'\)/);
assert.match(showPage, /mac_url_type\(\$obj,\[\],'show'\)/);
assert.match(showPage, /\{maccms:type parent="'\.\$obj\['type_pid'\]\.'" order="asc" by="sort" num="100" id="type"\}/);
assert.match(showPage, /\{maccms:type parent="'\.\$obj\['type_id'\]\.'" order="asc" by="sort" num="100" id="type"\}/);
assert.match(showPage, /mac_url_type\(\$type,\['area'=>\$param\['area'\][\s\S]*\],'show'\)/);
assert.match(showPage, /mac_url_type\(\$obj,\['area'=>\$param\['area'\][\s\S]*'by'=>'hits'\],'show'\)/);
assert.doesNotMatch(showPage, /<strong>子类<\/strong>/);
assert.equal((showPage.match(/<strong>类型<\/strong>/g) || []).length, 1);
assert.match(showPage, /<div class="filter-row">\s*<strong>类型<\/strong>/);
assert.doesNotMatch(showPage, /<div class="filter-row" data-filter-kind="area"[^\n]*>\s*<strong>类型<\/strong>/);
assert.match(showPage, /<strong>地区<\/strong>/);
assert.match(showPage, /<div class="filter-row" data-filter-kind="area"[^\n]*>\s*<strong>地区<\/strong>/);
assert.match(showPage, /data-filter-kind="area"/);
assert.match(showPage, /<strong>年份<\/strong>/);
assert.match(showPage, /data-filter-kind="year"/);
assert.match(showPage, /<strong>语言<\/strong>/);
assert.match(showPage, /data-filter-kind="lang"/);
assert.match(showPage, /<strong>字母<\/strong>/);
assert.match(showPage, /\$obj\.type_extend\.area/);
assert.match(showPage, /\$obj\.parent\.type_extend\.area/);
assert.match(showPage, /\$maccms\.vod_extend_area/);
assert.match(showPage, /\$obj\.type_extend\.year/);
assert.match(showPage, /\$maccms\.vod_extend_year/);
assert.doesNotMatch(showPage, /\$obj\.type_extend\.class/);
assert.doesNotMatch(showPage, /\$obj\.parent\.type_extend\.class/);
assert.match(showPage, /\$obj\.type_extend\.lang/);
assert.match(showPage, /\$maccms\.vod_extend_lang/);
assert.match(showPage, /'area'=>\$vo2/);
assert.match(showPage, /data-filter-value="\{\$vo2\}"/);
assert.match(showPage, /'year'=>\$vo2/);
assert.doesNotMatch(showPage, /'class'=>\$vo2/);
assert.match(showPage, /'lang'=>\$vo2/);
assert.doesNotMatch(showPage, /'area'=>'中国大陆'/);
assert.doesNotMatch(showPage, /'lang'=>'国语'/);
assert.doesNotMatch(showPage, /'class'=>'剧情'/);
assert.doesNotMatch(showPage, /'year'=>'2026'/);
assert.match(showPage, /'area'=>\$param\['area'\]/);
assert.match(showPage, /'lang'=>\$param\['lang'\]/);
assert.match(showPage, /'year'=>\$param\['year'\]/);
assert.match(showPage, /'letter'=>\$param\['letter'\]/);
assert.match(showPage, /'class'=>\$param\['class'\]/);
assert.ok(showPage.includes(`{maccms:foreach name=":explode(',','${fullLetterFilter}')" id="vo2"}`), "vod/show should render a complete letter filter");
assert.match(showPage, /\{if condition="\$param\['letter'\] eq \$vo2"\} class="is-active" \{\/if\}/);
assert.match(showPage, /'letter'=>\$vo2/);
assert.doesNotMatch(showPage, /\$param\['letter'\] eq 'Y'/);
assert.doesNotMatch(showPage, /\$param\['by'\]/);
assert.match(showPage, /'by'=>'time'/);
assert.match(showPage, /'by'=>'hits'/);
assert.match(showPage, /'by'=>'score'/);
assert.match(showPage, /\$param\.by eq 'hits'/);
assert.match(showPage, /\$param\.by eq 'score'/);
assert.match(showPage, /area="'\.\$param\['area'\]\.'"/);
assert.match(showPage, /lang="'\.\$param\['lang'\]\.'"/);
assert.match(showPage, /year="'\.\$param\['year'\]\.'"/);
assert.match(showPage, /letter="'\.\$param\['letter'\]\.'"/);
assert.match(showPage, /class="'\.\$param\['class'\]\.'"/);
assert.match(showPage, /by="hits"/);
assert.match(showPage, /by="score"/);
assert.match(showPage, /by="time"/);
assert.match(showPage, /pageurl="vod\/show"/);
assert.match(showPageSource, /class="vod-grid" data-empty-container data-empty-item="\.vod-card"/);
assert.match(vodGridResultsPartial, /class="content-empty-state" data-empty-state hidden role="status"/);
assert.match(vodGridResultsPartial, /暂无符合条件的影片/);
for (const sortField of ["hits", "score", "time"]) {
  assert.match(showPage, new RegExp(`\\{maccms:vod num="24" paging="yes" pageurl="vod/show" type="${nonAdultVodTypeScope}"[\\s\\S]*order="desc" by="${sortField}" id="vo"\\}`));
}
assert.doesNotMatch(showPage, /\{maccms:vod[^}]*pageurl="vod\/show"[^}]*type="all"/);

const searchPage = readThemeFile("html/vod/search.html");
assertRuntimeSeo(searchPage, ["$param.wd|default='搜索结果'", "$param.wd|default=''", "$param.wd|default=''"]);
assert.match(searchPage, /<h1>\{\$pingfang_seo_title\|htmlspecialchars=ENT_QUOTES,'UTF-8',false\}<\/h1>/);
assert.match(searchPage, /\{maccms:vod num="20" paging="yes" pageurl="vod\/search"/);
assert.match(searchPage, /loading="lazy" decoding="async" width="160" height="240"/);
assert.equal((searchPage.match(/data-empty-container data-empty-item="\.list-item"/g) || []).length, 2);
assert.equal((searchPage.match(/data-empty-state hidden role="status"/g) || []).length, 2);
assert.match(searchPage, /没有找到相关影片/);
assert.doesNotMatch(searchPage, /class="hot-search-panel search-hot-panel"/);
assert.doesNotMatch(searchPage, /\$maccms\.search_hot/);
assert.doesNotMatch(searchPage, /mac_url\('vod\/search',\['wd'=>\$vo2\]\)/);

const performanceStyle = readThemeFile("css/style.css");
assert.match(performanceStyle, /@supports \(content-visibility: auto\)/);
assert.match(performanceStyle, /content-visibility: auto;/);
assert.match(performanceStyle, /contain-intrinsic-size: auto 520px;/);
assert.match(searchPage, /class="wrap filter-panel category-filter search-filter-panel"/);
assert.match(searchPage, /<strong>频道<\/strong>/);
assert.match(searchPage, /mac_url\('vod\/search',\['wd'=>\$param\['wd'\]\]\)/);
assert.match(searchPage, /\{maccms:type ids="parent" order="asc" by="sort" mid="1" num="20" id="type"\}/);
assert.match(searchPage, /mac_url\('vod\/search',\['wd'=>\$param\['wd'\],'type'=>\$type\['type_id'\]\]\)/);
assert.match(searchPage, /\{maccms:type ids="'\.\$param\['type'\]\.'" id="current"\}/);
assert.match(searchPage, /\$current\.type_id eq \$type\.type_id or \$current\.type_pid eq \$type\.type_id/);
assert.match(searchPage, /<strong>类型<\/strong>/);
assert.match(searchPage, /\{if condition="\$current\.type_pid gt 0"\}/);
assert.match(searchPage, /\{maccms:type parent="'\.\$current\['type_pid'\]\.'" order="asc" by="sort" id="child"\}/);
assert.match(searchPage, /\{maccms:type parent="'\.\$current\['type_id'\]\.'" order="asc" by="sort" id="child"\}/);
assert.match(searchPage, /mac_url\('vod\/search',\['wd'=>\$param\['wd'\],'type'=>\$child\['type_id'\]\]\)/);
assert.doesNotMatch(searchPage, /'parent'=>/);
assert.match(searchPage, /\{if condition="\$current\.type_id eq \$child\.type_id"\} class="is-active" \{\/if\}/);
assert.match(searchPage, /type="'\.\$current\['type_id'\]\.'"/);
assert.doesNotMatch(searchPage, /type="'\.\$param\['type/);

const vodCardPartial = readThemeFile("html/public/vod_card.html");
assert.match(vodCardPartial, /class="vod-card"/);
assert.match(vodCardPartial, /mac_url_vod_detail/);
assert.match(vodCardPartial, /score-badge/);
assert.match(vodCardPartial, /card-meta/);
assert.doesNotMatch(vodCardPartial, /vod_actor/);
assert.doesNotMatch(vodCardPartial, /主演待更新/);

const diggPartial = readThemeFile("html/public/digg.html");
assert.match(diggPartial, /digg-panel/);
assert.match(diggPartial, /vod_up/);
assert.match(diggPartial, /vod_down/);

const scorePartial = readThemeFile("html/public/score.html");
assert.match(scorePartial, /score-panel/);
assert.match(scorePartial, /vod_score/);
assert.match(scorePartial, /豆瓣评分/);
assert.doesNotMatch(scorePartial, /vod_score_num/);

const starPartial = readThemeFile("html/public/star.html");
assert.match(starPartial, /star-panel/);
assert.match(starPartial, /vod_score/);
assert.match(starPartial, /豆瓣/);

const style = readThemeFile("css/style.css");
assert.match(style, /\.multiplayer-page \[hidden\]\s*\{\s*display: none !important;/);
const appScript = readThemeFile("js/app.js");
const dunhuangAssets = [
  readThemeFile("images/dunhuang/caisson-frame.svg"),
  readThemeFile("images/dunhuang/caisson-frame-mobile.svg"),
  readThemeFile("images/dunhuang/channel-vault.svg"),
  readThemeFile("images/dunhuang/emblem.svg"),
  readThemeFile("images/dunhuang/pearl-band.svg"),
  readThemeFile("images/dunhuang/rosette-divider.svg"),
  readThemeFile("images/dunhuang/scrolling-vine-band.svg"),
  readThemeFile("images/dunhuang/wave-cloud-corner.svg")
];
const pixelAssets = [
  readThemeFile("images/pixel/pixel-border.svg"),
  readThemeFile("images/pixel/frog-emblem.svg"),
  readThemeFile("images/pixel/icon-close.svg"),
  readThemeFile("images/pixel/icon-enter.svg"),
  readThemeFile("images/pixel/icon-eye.svg"),
  readThemeFile("images/pixel/icon-lock.svg"),
  readThemeFile("images/pixel/icon-play.svg"),
  readThemeFile("images/pixel/icon-refresh.svg"),
  readThemeFile("images/pixel/icon-search.svg"),
  readThemeFile("images/pixel/icon-shield.svg"),
  readThemeFile("images/pixel/icon-user.svg"),
  readThemeFile("images/pixel/pixel-grid.svg")
];
const pixelFontLicense = readThemeFile("css/fonts/FUSION-PIXEL-OFL-1.1.txt");
const canvasConfettiLicense = readThemeFile("js/CANVAS-CONFETTI-ISC.txt");
const canvasConfettiScript = readThemeFile("js/canvas-confetti.min.js");
const visualRootRule = [...style.matchAll(/(?:^|\n):root\s*\{[\s\S]*?\}/g)]
  .map((match) => match[0])
  .find((rule) => /--cinema-canvas/.test(rule)) || "";
const pageStarsRule = extractCssRule(style, "body::before");
const headerSearchInputFocusRule = extractCssRule(style, ".header-search input:focus-visible");
const filterOptionsRule = extractCssRule(style, ".filter-options");
const dynamicFilterOptionsRule = extractCssRule(style, '.filter-row[data-filter-kind] .filter-options');
const sharedGlassSurfaceRule = style.match(/\.filter-panel,\n\.episode-box,\n\.detail-panel,\n\.system-box,\n\.device-panel,\n\.favorite-toolbar,\n\.record-toolbar,\n\.comment-layout \.system-box\s*\{[^}]*\}/)?.[0] || "";
const auroraCinemaRule = style.match(/html\[data-theme="blue-pink-purple"\],\nhtml\[data-theme="aurora-glass"\]\s*\{[^}]*\}/)?.[0] || "";
const posterRootRule = extractCssRule(style, 'html[data-theme="poster-magazine"]');
const posterHeroGridRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-grid');
const posterHeroCarouselRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-carousel');
const posterHeroRankRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-rank');
const posterHeroRankBeforeRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .hero-rank::before');
const posterRankListRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .rank-list');
const posterShelfRailRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-rail');
const posterShelfCardRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-card');
const posterShelfFirstCardRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-card:first-child');
const posterShelfPosterRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .home-shelf-poster');
const auroraLoginPanelRule = extractCssRule(style, 'html[data-theme="blue-pink-purple"] .login-panel');
const posterLoginPanelRule = extractCssRule(style, 'html[data-theme="poster-magazine"] .login-panel');
const digitalRootRule = extractCssRule(style, 'html[data-theme="digital-particles"]');
const digitalLoginPanelRule = extractCssRule(style, 'html[data-theme="digital-particles"] .login-panel');
const digitalBodyParticlesRule = extractCssRule(style, 'html[data-theme="digital-particles"] body::after');
const playerShellRule = [...style.matchAll(/(?:^|\n)\.player-shell\s*\{[^}]*\}/g)].map((match) => match[0]).find((rule) => /aspect-ratio/.test(rule)) || "";
const playerMediaRule = style.match(/\.player-shell #MacPlayer,[\s\S]*?\.player-shell object\s*\{[^}]*\}/)?.[0] || "";
const playerMacRule = extractCssRule(style, ".player-shell #MacPlayer");
const playerMacChildrenRule = extractCssRule(style, ".player-shell #MacPlayer > *");
const rootRule = style.match(/:root\s*\{[\s\S]*?\}/)?.[0] || "";
const siteHeaderRule = style.match(/\.site-header\s*\{[\s\S]*?\}/)?.[0] || "";
const userDropdownRule = style.match(/\.user-dropdown\s*\{[\s\S]*?\}/)?.[0] || "";
const navigationBorderRule = style.match(/\.site-nav a,\n\.history-link,[\s\S]*?\.filter-panel a\s*\{[\s\S]*?\}/)?.[0] || "";
const interactiveHoverRule = style.match(/\.site-nav a:hover,[\s\S]*?\.filter-panel a:hover\s*\{[\s\S]*?\}/)?.[0] || "";
const selectedBorderRule = style.match(/\.site-nav a\[aria-current="page"\],[\s\S]*?\.page-state\s*\{[\s\S]*?\}/)?.[0] || "";
const focusBorderRule = style.match(/a:focus-visible,[\s\S]*?\.user-dropdown a:focus-visible\s*\{[\s\S]*?\}/)?.[0] || "";
const fieldFocusRule = style.match(/\.header-search:focus-within,[\s\S]*?\.page-jump-input:focus-visible\s*\{[\s\S]*?\}/)?.[0] || "";
const heroGridRule = style.match(/\.hero-grid\s*\{[\s\S]*?\}/)?.[0] || "";
const heroCarouselRule = style.match(/\.hero-carousel\s*\{[\s\S]*?\}/)?.[0] || "";
const heroCarouselAfterRule = style.match(/\.hero-carousel::after\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerTrackRule = style.match(/\.banner-track\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerBgBeforeRule = style.match(/\.hero-carousel\[data-banner-iridescence="true"\] \.banner-bg::before\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerBgAfterRule = style.match(/\.banner-bg::after\s*\{[\s\S]*?\}/)?.[0] || "";
const heroRankRule = style.match(/\.hero-rank\s*\{[\s\S]*?\}/)?.[0] || "";
const heroRankBeforeRule = style.match(/\.hero-rank::before\s*\{[\s\S]*?\}/)?.[0] || "";
const heroRankHeadRule = style.match(/\.hero-rank \.section-head\s*\{[\s\S]*?\}/)?.[0] || "";
const rankRefreshRule = style.match(/\.rank-refresh\s*\{[\s\S]*?\}/)?.[0] || "";
const rankItemRule = style.match(/\.rank-item\s*\{[\s\S]*?\}/)?.[0] || "";
const rankFirstItemRule = style.match(/\.hero-rank \.rank-item:first-of-type\s*\{[\s\S]*?\}/)?.[0] || "";
const rankFirstIndexRule = style.match(/\.hero-rank \.rank-item:first-of-type \.rank-index\s*\{[\s\S]*?\}/)?.[0] || "";
const rankIndexRule = style.match(/(?:^|\n)\.rank-index\s*\{[\s\S]*?\}/)?.[0] || "";
const rankThumbRule = style.match(/\.rank-thumb\s*\{[\s\S]*?\}/)?.[0] || "";
const rankThumbImgRule = style.match(/\.rank-thumb img\s*\{[\s\S]*?\}/)?.[0] || "";
const rankBodyRule = style.match(/(?:^|\n)\.rank-body\s*\{[\s\S]*?\}/)?.[0] || "";
const rankMetaRule = style.match(/\.rank-meta\s*\{[\s\S]*?\}/)?.[0] || "";
const rankScoreRule = style.match(/\.rank-score\s*\{[\s\S]*?\}/)?.[0] || "";
const heroSlideRule = style.match(/\.hero-slide\s*\{[\s\S]*?\}/)?.[0] || "";
const activeHeroSlideRule = style.match(/\.hero-slide\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerContentRule = style.match(/\.banner-content\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerCopyRule = style.match(/\.banner-copy\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerTitleRule = style.match(/\.banner-copy strong\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerExcerptRule = style.match(/\.banner-copy small\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerControlsRule = style.match(/\.banner-controls\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerControlsBeforeRule = style.match(/\.banner-controls::before\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotRule = style.match(/\.banner-dot\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotAfterRule = style.match(/\.banner-dot::after\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotActiveRule = style.match(/\.banner-dot\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const bannerDotActiveAfterRule = style.match(/\.banner-dot\.is-active::after\s*\{[\s\S]*?\}/)?.[0] || "";
const pageHeadingRule = style.match(/\.hero-copy h1,[\s\S]*?\.player-head h1\s*\{[\s\S]*?\}/)?.[0] || "";
const rankListTitleRule = style.match(/\.rank-item strong,[\s\S]*?\.list-item strong\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardTitleRule = style.match(/\.vod-card strong\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardRule = style.match(/\.vod-card\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardMetaRule = style.match(/\.card-meta\s*\{[\s\S]*?\}/)?.[0] || "";
const vodCardMetaChipRule = style.match(/\.card-meta span\s*\{[\s\S]*?\}/)?.[0] || "";
const posterRemarkRule = style.match(/\.poster em,[\s\S]*?\.detail-poster span\s*\{[\s\S]*?\}/)?.[0] || "";
const categoryMainTitleRule = style.match(/\.category-main span\s*\{[\s\S]*?\}/)?.[0] || "";
const categoryChildLinkRule = style.match(/\.category-children a\s*\{[\s\S]*?\}/)?.[0] || "";
const timelineTitleRule = style.match(/\.timeline-card strong\s*\{[\s\S]*?\}/)?.[0] || "";
const episodeLinkRule = style.match(/\.episode-grid a\s*\{[\s\S]*?\}/)?.[0] || "";
const episodeActiveRule = style.match(/\.episode-grid a:hover,[\s\S]*?\.episode-grid a\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const playerToolbarTextRule = style.match(/\.player-toolbar span\s*\{[\s\S]*?\}/)?.[0] || "";
const downloadTitleRule = style.match(/\.download-list strong\s*\{[\s\S]*?\}/)?.[0] || "";
const recordTitleRule = [...style.matchAll(/(?:^|\n)\.record-title\s*\{[\s\S]*?\}/g)].map((match) => match[0]).find((rule) => /overflow/.test(rule)) || "";
const systemBoxTitleRule = style.match(/\.system-box h1\s*\{[\s\S]*?\}/)?.[0] || "";
const contentBodyWrapRule = style.match(/\.hero-copy p,[\s\S]*?\.summary\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfRule = style.match(/(?:^|\n)\.home-shelf\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfHeadRule = style.match(/\.home-shelf-head\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfTabsRule = style.match(/\.home-shelf-tabs\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfTabsActiveRule = style.match(/\.home-shelf-tabs button\.is-active\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfRailRule = style.match(/\.home-shelf-rail\s*\{[\s\S]*?\}/)?.[0] || "";
const hiddenHomeShelfRailRule = style.match(/\.home-shelf-rail\[hidden\]\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfCardRule = style.match(/(?:^|\n)\.home-shelf-card\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfCardBeforeRule = style.match(/\.home-shelf-card::before\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfCardHoverRule = style.match(/\.home-shelf-card:hover\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterRule = style.match(/\.home-shelf-poster\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterImgRule = style.match(/\.home-shelf-poster img\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterHoverRule = style.match(/\.home-shelf-card:hover \.home-shelf-poster\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfPosterImgHoverRule = style.match(/\.home-shelf-card:hover \.home-shelf-poster img\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfBadgeRule = style.match(/\.home-shelf-poster em\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfBodyRule = style.match(/\.home-shelf-body\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfTitleRule = style.match(/\.home-shelf-body strong\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfMetaRule = style.match(/\.home-shelf-body small\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfScoreRule = style.match(/\.home-shelf-score\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfFeaturedBodyRule = style.match(/\.home-shelf-card\.is-featured \.home-shelf-body\s*\{[\s\S]*?\}/)?.[0] || "";
const homeShelfFeaturedTextRule = style.match(/\.home-shelf-card\.is-featured \.home-shelf-body strong,\n\.home-shelf-card\.is-featured \.home-shelf-body small\s*\{[\s\S]*?\}/)?.[0] || "";
const mobilePlayerToolbarButtonRule = [...style.matchAll(/\.player-toolbar-actions \.ghost-btn\s*\{[^}]*\}/g)]
  .map((match) => match[0])
  .find((rule) => /text-align: center/.test(rule)) || "";
assert.match(appScript, /themeStorageKey = "pingfang_theme"/);
assert.match(appScript, /validThemes = \{[\s\S]*"blue-pink-purple": true/);
assert.match(appScript, /"poster-magazine": true/);
assert.match(appScript, /"dunhuang-caisson": true/);
assert.match(appScript, /"digital-particles": true/);
assert.match(appScript, /"pixel-frog": true/);
assert.match(appScript, /theme-transitioning/);
assert.match(appScript, /document\.documentElement\.setAttribute\("data-theme", theme\)/);
assert.match(appScript, /document\.documentElement\.removeAttribute\("data-theme"\)/);
assert.match(appScript, /window\.localStorage\.setItem\(themeStorageKey, theme\)/);
assert.match(appScript, /window\.localStorage\.removeItem\(themeStorageKey\)/);
assert.match(appScript, /window\.confetti/);
assert.match(appScript, /shapes: \["square"\]/);
assert.match(appScript, /disableForReducedMotion: true/);
assert.match(appScript, /gravity: 0/);
assert.match(appScript, /prefersReducedMotion\(\)/);
assert.match(appScript, /initThemeSwitchers\(document\)/);
assert.match(style, /\.theme-switcher/);
assert.match(style, /\.theme-switcher-menu/);
assert.match(style, /\.theme-switcher-menu\[hidden\]\s*\{[\s\S]*display: none/);
assert.match(style, /\.theme-option/);
assert.match(style, /\.theme-option-swatch/);
assert.match(style, /\.theme-option-swatch-poster/);
assert.match(style, /\.theme-option-swatch-dunhuang/);
assert.match(style, /\.theme-option-swatch-digital/);
assert.match(style, /\.theme-option-swatch-pixel/);
assert.match(style, /\.theme-option\.is-active/);
assert.match(style, /html\[data-theme="poster-magazine"\]/);
assert.match(style, /html\[data-theme="dunhuang-caisson"\]/);
assert.match(style, /html\[data-theme="digital-particles"\]/);
assert.match(style, /html\[data-theme="pixel-frog"\]/);
assert.match(style, /@keyframes digital-particles-depth/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*digital-particles/);
assert.match(auroraLoginPanelRule, /border-radius: 28px/);
assert.match(auroraLoginPanelRule, /--login-edge-paint:/);
assert.match(posterLoginPanelRule, /border-radius: 8px/);
assert.match(posterLoginPanelRule, /animation: login-panel-arrive/);
assert.match(digitalRootRule, /--radius: 6px/);
assert.match(digitalRootRule, /--radius-sm: 4px/);
assert.match(digitalLoginPanelRule, /border-radius: 6px/);
assert.match(digitalLoginPanelRule, /animation: login-panel-arrive/);
assert.match(digitalBodyParticlesRule, /animation: digital-particles-depth/);
assert.match(style, /html\[data-theme="blue-pink-purple"\] \.login-submit\s*\{/);
assert.match(style, /html\[data-theme="poster-magazine"\] \.login-submit\s*\{/);
assert.match(style, /html\[data-theme="digital-particles"\] \.login-submit\s*\{/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*html\[data-theme="digital-particles"\] body::after/);
assert.match(style, /images\/dunhuang\/emblem\.svg/);
assert.match(style, /images\/dunhuang\/caisson-frame\.svg/);
assert.match(style, /images\/dunhuang\/caisson-frame-mobile\.svg/);
assert.match(style, /images\/dunhuang\/channel-vault\.svg/);
assert.match(style, /images\/dunhuang\/pearl-band\.svg/);
assert.match(style, /images\/dunhuang\/rosette-divider\.svg/);
assert.match(style, /images\/dunhuang\/scrolling-vine-band\.svg/);
assert.match(style, /images\/dunhuang\/wave-cloud-corner\.svg/);
dunhuangAssets.forEach((asset) => {
  assert.match(asset, /<svg[^>]+viewBox=/);
  assert.doesNotMatch(asset, /<script|javascript:|(?:href|src)=["']https?:\/\//i);
});
assert.match(style, /images\/pixel\/frog-emblem\.svg/);
assert.match(style, /images\/pixel\/pixel-grid\.svg/);
assert.match(style, /images\/pixel\/pixel-border\.svg/);
assert.match(style, /images\/pixel\/icon-close\.svg/);
assert.match(style, /images\/pixel\/icon-enter\.svg/);
assert.match(style, /images\/pixel\/icon-eye\.svg/);
assert.match(style, /images\/pixel\/icon-lock\.svg/);
assert.match(style, /images\/pixel\/icon-play\.svg/);
assert.match(style, /images\/pixel\/icon-refresh\.svg/);
assert.match(style, /images\/pixel\/icon-search\.svg/);
assert.match(style, /images\/pixel\/icon-shield\.svg/);
assert.match(style, /images\/pixel\/icon-user\.svg/);
assert.match(style, /@font-face\s*\{[\s\S]*font-family: "Fusion Pixel PFV"/);
assert.match(style, /url\("fonts\/fusion-pixel-12px-proportional-zh-hans\.woff2"\) format\("woff2"\)/);
assert.match(style, /font-display: swap/);
assert.match(style, /border-image: url\("\.\.\/images\/pixel\/pixel-border\.svg"\) 4 \/ 4px \/ 0 round/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-panel\s*\{[^}]*min-height: 0/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-pixel-pass\s*\{/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-edge-glow,[\s\S]*\.login-glass-highlight\s*\{[^}]*display: none/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-icon-user\s*\{[^}]*icon-user\.svg/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-icon-lock\s*\{[^}]*icon-lock\.svg/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-icon-shield\s*\{[^}]*icon-shield\.svg/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-icon-eye\s*\{[^}]*icon-eye\.svg/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-icon-refresh\s*\{[^}]*icon-refresh\.svg/);
assert.match(style, /html\[data-theme="pixel-frog"\] \.login-submit::before\s*\{[^}]*icon-enter\.svg/);
assert.match(style, /html\[data-theme="pixel-frog"\]\.theme-transitioning::before\s*\{[\s\S]*animation: none/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*pixel-frog/);
pixelAssets.forEach((asset) => {
  assert.match(asset, /<svg[^>]+viewBox=/);
  assert.doesNotMatch(asset, /<script|javascript:|(?:href|src)=["']https?:\/\//i);
});
assert.match(pixelFontLicense, /SIL OPEN FONT LICENSE Version 1\.1/);
assert.match(canvasConfettiLicense, /ISC License/);
assert.match(canvasConfettiScript, /confetti/);
assert.ok(statSync(path.join(themeRoot, "css/fonts/fusion-pixel-12px-proportional-zh-hans.woff2")).size > 100_000);
assert.ok(statSync(path.join(themeRoot, "js/canvas-confetti.min.js")).size < 50_000);
assert.doesNotMatch(posterRootRule, /--wrap:/);
assert.match(visualRootRule, /--wrap: min\(1480px, calc\(100vw - 56px\)\)/);
assert.match(visualRootRule, /--cinema-header-wash:/);
assert.match(visualRootRule, /--login-canvas:/);
assert.match(auroraCinemaRule, /--cinema-canvas:/);
assert.match(auroraCinemaRule, /--cinema-glass:/);
assert.match(auroraCinemaRule, /--login-canvas:/);
assert.match(posterRootRule, /--cinema-canvas:/);
assert.match(posterRootRule, /--cinema-glass:/);
assert.match(posterRootRule, /--login-canvas:/);
assert.match(posterHeroGridRule, /grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 340px\)/);
assert.match(posterHeroCarouselRule, /min-height: clamp\(480px, 56vh, 610px\)/);
assert.doesNotMatch(posterHeroRankRule, /position: absolute/);
assert.match(posterHeroRankRule, /background: rgba\(9, 12, 31, 0\.72\)/);
assert.doesNotMatch(posterHeroRankBeforeRule, /background: linear-gradient\(90deg/);
assert.match(posterRankListRule, /grid-template-columns: minmax\(0, 1fr\)/);
assert.match(posterShelfRailRule, /grid-auto-flow: row/);
assert.match(posterShelfRailRule, /grid-auto-columns: auto/);
assert.match(posterShelfCardRule, /grid-template-rows: clamp\(178px, 14vw, 230px\) minmax\(54px, auto\) minmax\(0, 1fr\) auto/);
assert.match(posterShelfCardRule, /min-height: 360px/);
assert.doesNotMatch(posterShelfFirstCardRule, /grid-row: span 2/);
assert.match(posterShelfPosterRule, /height: 100%/);
assert.match(posterShelfPosterRule, /aspect-ratio: auto/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*html\[data-theme="poster-magazine"\]\s+\.hero-grid\s*\{[\s\S]*grid-template-columns: 1fr/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*html\[data-theme="poster-magazine"\] \.rank-list\s*\{[\s\S]*grid-template-columns: initial/);
assert.match(style, /html\.theme-transitioning::before/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*theme-transitioning/);
assert.match(rootRule, /--line-soft: rgba\(255, 255, 255, 0\.08\)/);
assert.match(rootRule, /--line-strong: rgba\(255, 255, 255, 0\.22\)/);
assert.match(rootRule, /--line-accent: rgba\(38, 212, 175, 0\.34\)/);
assert.match(rootRule, /--line-accent-strong: rgba\(38, 212, 175, 0\.5\)/);
assert.match(rootRule, /--line-warm: rgba\(255, 90, 61, 0\.42\)/);
assert.match(rootRule, /--selected-bg: rgba\(38, 212, 175, 0\.12\)/);
assert.match(rootRule, /--selected-compact-shadow: inset 0 0 0 1px rgba\(38, 212, 175, 0\.16\)/);
assert.match(rootRule, /--selected-shadow: 0 0 0 1px rgba\(38, 212, 175, 0\.2\), 0 10px 24px rgba\(38, 212, 175, 0\.08\)/);
assert.match(rootRule, /--focus-field-shadow: 0 0 0 1px rgba\(38, 212, 175, 0\.2\)/);
assert.match(navigationBorderRule, /border: 1px solid transparent/);
assert.match(navigationBorderRule, /transition: border-color 0\.18s ease, background 0\.18s ease, color 0\.18s ease, box-shadow 0\.18s ease, transform 0\.18s ease/);
assert.match(interactiveHoverRule, /border-color: var\(--line-strong\)/);
assert.match(selectedBorderRule, /\.filter-panel a\.is-active/);
assert.match(selectedBorderRule, /\.episode-grid a\.is-active/);
assert.match(selectedBorderRule, /\.favorite-btn\.is-favorited/);
assert.match(selectedBorderRule, /\.page-state/);
assert.match(selectedBorderRule, /border-color: var\(--line-accent-strong\)/);
assert.match(selectedBorderRule, /background: var\(--selected-bg\)/);
assert.match(selectedBorderRule, /box-shadow: var\(--selected-compact-shadow\)/);
assert.match(focusBorderRule, /border-color: var\(--line-accent-strong\)/);
assert.match(fieldFocusRule, /box-shadow: var\(--focus-field-shadow\)/);
assert.doesNotMatch(fieldFocusRule, /var\(--focus-ring\)/);
assert.match(headerSearchInputFocusRule, /border-color: transparent/);
assert.match(headerSearchInputFocusRule, /box-shadow: none/);
assert.match(style, /@media \(max-width: 760px\)/);
assert.match(style, /@media \(max-width: 1180px\)[\s\S]*\.rank-list\s*\{[\s\S]*scrollbar-width: thin/);
assert.match(style, /@media \(max-width: 1180px\)[\s\S]*\.rank-list::-webkit-scrollbar\s*\{[\s\S]*height: 4px/);
assert.match(style, /@media \(max-width: 360px\)\s*\{\s*\.banner-dots\s*\{\s*gap: 0;/);
assert.match(style, /\.home-shelf-tabs\s*\{[^}]*scrollbar-width: thin/);
assert.match(style, /\.home-shelf-tabs::-webkit-scrollbar\s*\{[^}]*display: block;[^}]*height: 4px/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.header-inner\s*\{[\s\S]*grid-template-columns: auto auto minmax\(0, 1fr\) auto/);
assert.doesNotMatch(style, /@media \(max-width: 1020px\)[\s\S]*\.header-inner\s*\{[\s\S]*grid-template-columns: auto auto 1fr/);
assert.match(style, /\.vod-grid/);
assert.match(style, /\.system-page/);
assert.match(style, /\.site-notice/);
assert.match(style, /\.site-notice\.is-visible/);
assert.match(style, /\.site-notice\.is-error/);
assert.match(style, /\.site-notice[\s\S]*z-index: 1200/);
assert.match(style, /\.verify-form textarea/);
assert.match(style, /\.filter-panel div[\s\S]*flex-wrap: wrap/);
assert.match(style, /\.filter-bar[\s\S]*flex-wrap: wrap/);
assert.match(style, /\.category-filter/);
assert.match(style, /\.filter-row/);
assert.match(style, /\.filter-options/);
assert.match(style, /\.filter-actions/);
assert.match(style, /\.filter-reset/);
assert.match(style, /\.page-jump/);
assert.match(style, /\.page-jump-input/);
assert.match(style, /\.page-jump-submit/);
assert.match(style, /\.page-link,[\s\S]*?\.page-jump-submit\s*\{[\s\S]*?min-height: 44px/);
assert.match(style, /\.filter-panel a\.is-active/);
assert.match(filterOptionsRule, /flex-wrap: wrap/);
assert.match(filterOptionsRule, /overflow-x: visible/);
assert.doesNotMatch(filterOptionsRule, /overflow-x: auto|scrollbar-width|scroll-snap|overscroll-behavior|-webkit-overflow-scrolling/);
assert.match(dynamicFilterOptionsRule, /max-height:/);
assert.match(dynamicFilterOptionsRule, /overflow-y: auto/);
assert.doesNotMatch(style, /\.filter-options::-webkit-scrollbar/);
assert.doesNotMatch(style, /\.filter-options\s*\{[^}]*margin-right:\s*-\d+px/);
assert.doesNotMatch(style, /\.filter-panel a\s*\{[^}]*scroll-snap-align/);
assert.doesNotMatch(style, /\.filter-panel[\s\S]{0,80}overflow-x: auto/);
assert.match(style, /\.filter-panel div:not\(\.filter-options\)/);
assert.match(style, /\.letter-options a\s*\{[\s\S]*?min-width: 44px/);
assert.doesNotMatch(style, /\.hero-stats|\.stat-card/);
assert.match(style, /\.hero-carousel/);
assert.match(style, /\.hero \.wrap\s*\{[\s\S]*width: var\(--wrap\)/);
assert.doesNotMatch(style, /width: min\(1500px, calc\(100vw - 48px\)\)/);
assert.doesNotMatch(style, /\.quick-types/);
assert.match(heroGridRule, /grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 360px\)/);
assert.match(heroGridRule, /align-items: stretch/);
assert.match(heroGridRule, /perspective: 1200px/);
assert.match(heroCarouselRule, /min-height: 0/);
assert.match(heroCarouselRule, /display: grid/);
assert.match(heroCarouselRule, /background: linear-gradient\(145deg, rgba\(24, 27, 34, 0\.88\), rgba\(8, 10, 14, 0\.94\)\)/);
assert.match(heroCarouselRule, /transform-style: preserve-3d/);
assert.match(heroCarouselRule, /box-shadow: 0 34px 110px rgba\(0, 0, 0, 0\.48\), 0 0 48px rgba\(38, 212, 175, 0\.14\), inset 0 1px 0 rgba\(255, 255, 255, 0\.08\)/);
assert.match(heroCarouselAfterRule, /pointer-events: none/);
assert.match(heroCarouselAfterRule, /linear-gradient\(90deg, transparent, rgba\(255, 255, 255, 0\.18\), transparent\)/);
assert.match(heroCarouselAfterRule, /mix-blend-mode: screen/);
assert.doesNotMatch(style, /hero-gradient-strips/);
assert.doesNotMatch(style, /hero-gradient-strip/);
assert.doesNotMatch(style, /gradient-strip-drift/);
assert.doesNotMatch(appScript, /initHeroGradientStrips/);
assert.doesNotMatch(appScript, /data-gradient-strips/);
assert.match(bannerTrackRule, /position: relative/);
assert.match(bannerTrackRule, /display: grid/);
assert.match(bannerTrackRule, /grid-area: 1 \/ 1/);
assert.match(bannerTrackRule, /min-height: 100%/);
assert.match(heroRankRule, /position: relative/);
assert.match(heroRankRule, /display: grid/);
assert.match(heroRankRule, /grid-auto-rows: max-content/);
assert.match(heroRankRule, /min-height: 0/);
assert.match(heroRankRule, /gap: 8px/);
assert.match(heroRankRule, /padding: 20px 18px/);
assert.match(heroRankRule, /border-color: var\(--line-accent-soft\)/);
assert.match(heroRankRule, /background: linear-gradient\(155deg, rgba\(25, 27, 31, 0\.9\), rgba\(13, 24, 25, 0\.94\)\)/);
assert.doesNotMatch(heroRankRule, /translateZ/);
assert.match(heroRankRule, /box-shadow: 0 30px 90px rgba\(0, 0, 0, 0\.38\), 0 0 42px rgba\(38, 212, 175, 0\.13\), inset 0 1px 0 rgba\(255, 255, 255, 0\.06\)/);
assert.match(heroRankBeforeRule, /background: linear-gradient\(180deg, rgba\(38, 212, 175, 0\.18\), transparent\)/);
assert.match(heroRankHeadRule, /position: relative/);
assert.match(heroRankHeadRule, /padding-bottom: 10px/);
assert.match(rankRefreshRule, /color: rgba\(244, 240, 232, 0\.62\)/);
assert.match(rankItemRule, /grid-template-columns: 72px minmax\(0, 1fr\) auto/);
assert.match(rankItemRule, /align-items: center/);
assert.match(rankItemRule, /min-height: 0/);
assert.match(rankItemRule, /border-bottom: 1px solid var\(--line-hairline\)/);
assert.match(rankItemRule, /padding: 9px 0/);
assert.match(rankFirstItemRule, /padding-top: 4px/);
assert.match(rankFirstIndexRule, /background: linear-gradient\(135deg, var\(--accent\), var\(--gold\)\)/);
assert.match(rankIndexRule, /position: absolute/);
assert.match(rankIndexRule, /width: 22px/);
assert.match(rankThumbRule, /position: relative/);
assert.match(rankThumbRule, /aspect-ratio: 4 \/ 3/);
assert.match(rankThumbRule, /overflow: hidden/);
assert.match(rankThumbImgRule, /object-fit: cover/);
assert.match(rankBodyRule, /display: grid/);
assert.match(rankBodyRule, /min-width: 0/);
assert.match(rankMetaRule, /color: rgba\(244, 240, 232, 0\.48\)/);
assert.match(rankScoreRule, /color: var\(--accent-2\)/);
assert.match(style, /\.home-shelf/);
assert.match(homeShelfRule, /padding: 34px 0 18px/);
assert.match(homeShelfHeadRule, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
assert.match(homeShelfHeadRule, /align-items: center/);
assert.match(homeShelfTabsRule, /display: flex/);
assert.match(homeShelfTabsRule, /justify-content: center/);
assert.match(homeShelfTabsRule, /overflow-x: auto/);
assert.match(homeShelfTabsActiveRule, /border-color: var\(--accent-2\)/);
assert.match(homeShelfTabsActiveRule, /color: var\(--text\)/);
assert.match(style, /\.home-shelf-tabs button\s*\{[\s\S]*appearance: none/);
assert.match(style, /\.home-shelf-tabs button\s*\{[\s\S]*font-family: inherit/);
assert.doesNotMatch(style, /\.home-shelf-tabs button\s*\{[^}]*min-height:\s*36px/);
assert.match(visualRootRule, /--cinema-canvas:/);
assert.match(visualRootRule, /--cinema-glass:/);
assert.match(visualRootRule, /--cinema-glass-soft:/);
assert.match(pageStarsRule, /rgba\(204, 220, 255, 0\.72\)/);
assert.match(pageStarsRule, /background-size: 173px 181px, 239px 223px, 307px 277px/);
assert.match(sharedGlassSurfaceRule, /background: var\(--cinema-glass\)/);
assert.match(sharedGlassSurfaceRule, /backdrop-filter: blur\(30px\) saturate\(1\.22\)/);
assert.match(homeShelfRailRule, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
assert.match(homeShelfRailRule, /grid-auto-flow: column/);
assert.match(homeShelfRailRule, /overflow-x: auto/);
assert.match(homeShelfRailRule, /scroll-snap-type: x proximity/);
assert.match(homeShelfRailRule, /perspective: 900px/);
assert.match(hiddenHomeShelfRailRule, /display: none/);
assert.match(homeShelfCardRule, /display: grid/);
assert.match(homeShelfCardRule, /grid-template-columns: minmax\(0, 1fr\) auto/);
assert.match(homeShelfCardRule, /grid-template-rows: auto minmax\(44px, auto\) auto/);
assert.match(homeShelfCardRule, /row-gap: 8px/);
assert.match(homeShelfCardRule, /padding: 10px/);
assert.match(homeShelfCardRule, /min-height: 0/);
assert.match(homeShelfCardRule, /border: 1px solid var\(--line-soft\)/);
assert.match(homeShelfCardRule, /background: linear-gradient/);
assert.match(homeShelfCardRule, /box-shadow: 0 18px 44px rgba\(0, 0, 0, 0\.22\), inset 0 1px 0 rgba\(255, 255, 255, 0\.055\)/);
assert.match(homeShelfCardRule, /transform: translateZ\(0\)/);
assert.match(homeShelfCardRule, /transform-style: preserve-3d/);
assert.match(homeShelfCardBeforeRule, /pointer-events: none/);
assert.match(homeShelfCardBeforeRule, /linear-gradient\(135deg, rgba\(255, 255, 255, 0\.14\), transparent 42%\)/);
assert.match(style, /\.home-shelf-card:hover\s*\{[\s\S]*border-color: var\(--line-accent\)/);
assert.match(homeShelfCardHoverRule, /transform: translateY\(-4px\) translateZ\(16px\)/);
assert.match(homeShelfCardHoverRule, /box-shadow: 0 28px 72px rgba\(0, 0, 0, 0\.32\), 0 0 26px rgba\(38, 212, 175, 0\.12\)/);
assert.match(homeShelfPosterRule, /height: auto/);
assert.match(homeShelfPosterRule, /aspect-ratio: 2 \/ 3/);
assert.match(homeShelfPosterRule, /border: 1px solid var\(--line-soft\)/);
assert.match(homeShelfPosterImgRule, /object-fit: cover/);
assert.match(homeShelfPosterImgRule, /transform: scale\(1\.012\)/);
assert.match(homeShelfPosterHoverRule, /box-shadow: 0 18px 40px rgba\(0, 0, 0, 0\.3\)/);
assert.match(homeShelfPosterImgHoverRule, /transform: scale\(1\.035\)/);
assert.match(homeShelfBadgeRule, /white-space: normal/);
assert.match(homeShelfBadgeRule, /overflow-wrap: anywhere/);
assert.match(homeShelfBodyRule, /display: contents/);
assert.match(homeShelfTitleRule, /overflow-wrap: anywhere/);
assert.match(homeShelfTitleRule, /display: block/);
assert.match(homeShelfTitleRule, /grid-column: 1 \/ -1/);
assert.match(homeShelfTitleRule, /grid-row: 2/);
assert.match(homeShelfTitleRule, /align-self: start/);
assert.match(homeShelfTitleRule, /overflow: visible/);
assert.doesNotMatch(homeShelfTitleRule, /-webkit-line-clamp/);
assert.match(homeShelfMetaRule, /display: block/);
assert.match(homeShelfMetaRule, /grid-column: 1/);
assert.match(homeShelfMetaRule, /grid-row: 3/);
assert.match(homeShelfMetaRule, /overflow: visible/);
assert.doesNotMatch(homeShelfMetaRule, /-webkit-line-clamp/);
assert.doesNotMatch(style, /-webkit-line-clamp:\s*[1-9]/);
assert.match(homeShelfScoreRule, /grid-column: 2/);
assert.match(homeShelfScoreRule, /grid-row: 3/);
assert.match(homeShelfScoreRule, /height: 20px/);
assert.match(homeShelfScoreRule, /font-size: 11px/);
assert.match(homeShelfScoreRule, /line-height: 1/);
assert.match(homeShelfScoreRule, /padding: 0 7px/);
assert.match(homeShelfScoreRule, /color: var\(--accent-2\)/);
assert.match(homeShelfScoreRule, /border: 1px solid var\(--line-accent-soft\)/);
assert.match(homeShelfScoreRule, /background: rgba\(38, 212, 175, 0\.1\)/);
assert.doesNotMatch(homeShelfPosterRule, /transform 0\.2s ease/);
assert.doesNotMatch(homeShelfPosterHoverRule, /transform: translateY\(-2px\)/);
assert.doesNotMatch(homeShelfPosterImgHoverRule, /transform: scale\(1\.04\)/);
assert.match(homeShelfFeaturedBodyRule, /display: grid/);
assert.match(homeShelfFeaturedTextRule, /grid-column: auto/);
assert.match(homeShelfFeaturedTextRule, /grid-row: auto/);
assert.match(style, /\.banner-track/);
assert.match(style, /\.hero-slide\.is-active/);
assert.match(style, /\.hero-carousel\[data-gsap-carousel="true"\] \.hero-slide\s*\{[\s\S]*transition: none/);
assert.match(heroSlideRule, /grid-template-columns: minmax\(0, 680px\)/);
assert.match(heroSlideRule, /grid-template-areas: "content"/);
assert.match(heroSlideRule, /position: absolute/);
assert.match(heroSlideRule, /min-height: clamp\(420px, 34vw, 520px\)/);
assert.match(heroSlideRule, /padding: clamp\(34px, 4vw, 58px\) clamp\(28px, 4vw, 52px\) 74px/);
assert.match(activeHeroSlideRule, /position: relative/);
assert.match(heroCarouselRule, /--banner-shine-x: 50%/);
assert.match(heroCarouselRule, /--banner-shine-y: 44%/);
assert.match(heroCarouselRule, /--banner-shine-rotate: 0deg/);
assert.match(heroCarouselRule, /--banner-shine-opacity: 0/);
assert.match(bannerBgBeforeRule, /pointer-events: none/);
assert.match(bannerBgBeforeRule, /mix-blend-mode: screen/);
assert.match(bannerBgBeforeRule, /var\(--banner-shine-x\) var\(--banner-shine-y\)/);
assert.match(bannerBgBeforeRule, /opacity: var\(--banner-shine-opacity\)/);
assert.match(bannerBgAfterRule, /rgba\(7, 9, 13, 0\.76\) 100%/);
assert.match(bannerContentRule, /grid-area: content/);
assert.match(bannerContentRule, /align-content: center/);
assert.doesNotMatch(style, /\.banner-art/);
assert.doesNotMatch(style, /\.banner-poster/);
assert.match(bannerCopyRule, /max-width: 640px/);
assert.match(bannerCopyRule, /min-width: 0/);
assert.match(bannerTitleRule, /overflow: visible/);
assert.match(bannerTitleRule, /line-height: 1\.08/);
assert.match(bannerTitleRule, /overflow-wrap: anywhere/);
assert.match(bannerExcerptRule, /white-space: normal/);
assert.match(bannerExcerptRule, /overflow-wrap: anywhere/);
assert.doesNotMatch(bannerExcerptRule, /-webkit-line-clamp/);
assert.doesNotMatch(bannerExcerptRule, /display: -webkit-box/);
assert.doesNotMatch(bannerExcerptRule, /overflow: hidden/);
assert.match(pageHeadingRule, /overflow-wrap: anywhere/);
assert.match(bannerControlsRule, /position: absolute/);
assert.match(bannerControlsRule, /left: 50%/);
assert.match(bannerControlsRule, /bottom: 22px/);
assert.match(bannerControlsRule, /border-radius: 999px/);
assert.match(bannerControlsRule, /min-height: 44px/);
assert.match(bannerControlsRule, /background: transparent/);
assert.match(bannerControlsRule, /padding: 0 10px/);
assert.match(bannerControlsBeforeRule, /inset: 0/);
assert.match(bannerControlsBeforeRule, /backdrop-filter: blur\(12px\)/);
assert.doesNotMatch(style, /\[data-gsap-reveal-ready="true"\]/);
assert.doesNotMatch(style, /\[data-gsap-revealed="true"\]/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(style, /\[data-gsap-carousel="true"\] \.hero-slide/);
assert.match(style, /\.banner-dot/);
assert.match(bannerDotRule, /min-width: 44px/);
assert.match(bannerDotRule, /min-height: 44px/);
assert.match(bannerDotRule, /width: 44px/);
assert.match(bannerDotRule, /height: 44px/);
assert.match(bannerDotRule, /max-height: 44px/);
assert.match(bannerDotAfterRule, /width: 28px/);
assert.match(bannerDotAfterRule, /height: 5px/);
assert.match(bannerDotActiveAfterRule, /width: 36px/);
assert.match(bannerDotActiveRule, /background: transparent/);
assert.doesNotMatch(style, /#d83cff|#2d74ff|#ff38d0|#8a5cff|#ff4edb/);
assert.doesNotMatch(style, /214, 72, 255|43, 19, 76|11, 18, 45|58, 93, 255|128, 155, 255|62, 91, 255/);
for (const chipRule of [
  posterRemarkRule,
  vodCardMetaChipRule,
  categoryChildLinkRule,
  homeShelfBadgeRule,
]) {
  assert.match(chipRule, /white-space: normal/);
  assert.match(chipRule, /overflow-wrap: anywhere/);
  assert.doesNotMatch(chipRule, /text-overflow: ellipsis/);
  assert.doesNotMatch(chipRule, /overflow: hidden/);
}
for (const titleRule of [
  rankListTitleRule,
  categoryMainTitleRule,
  timelineTitleRule,
  episodeLinkRule,
  playerToolbarTextRule,
  downloadTitleRule,
  recordTitleRule,
]) {
  assert.match(titleRule, /white-space: normal/);
  assert.match(titleRule, /overflow-wrap: anywhere/);
  assert.doesNotMatch(titleRule, /overflow: hidden/);
}
assert.match(systemBoxTitleRule, /overflow-wrap: anywhere/);
assert.match(contentBodyWrapRule, /white-space: normal/);
assert.match(contentBodyWrapRule, /overflow-wrap: anywhere/);
assert.match(style, /\.score-badge/);
assert.match(style, /\.card-meta/);
assert.match(style, /--surface-elevated/);
assert.match(style, /--shadow-soft/);
assert.match(style, /\.page-title::after/);
assert.match(style, /\.page-title h1[\s\S]*text-wrap: balance/);
assert.match(style, /\.category-filter[\s\S]*background: linear-gradient/);
assert.match(style, /\.filter-row \+ \.filter-row[\s\S]*border-top/);
assert.match(style, /\.detail-panel/);
assert.match(style, /\.detail-panel[\s\S]*min-width: 0/);
assert.match(style, /\.detail-actions[\s\S]*flex-wrap: wrap/);
assert.match(style, /\.detail-hero,\n\.player-page\s*\{[\s\S]*radial-gradient/);
assert.match(style, /\.detail-poster[\s\S]*box-shadow/);
assert.match(style, /\.detail-poster\s*\{[\s\S]*?align-self: start[\s\S]*?aspect-ratio: 2 \/ 3/);
assert.match(style, /\.detail-poster img\s*\{[\s\S]*?height: 100%/);
assert.match(style, /\.player-toolbar/);
assert.match(style, /\.player-toolbar-actions/);
assert.match(style, /\.player-shell #MacPlayer/);
assert.match(style, /\.player-shell embed/);
assert.match(style, /\.player-shell object/);
assert.match(playerShellRule, /min-height: clamp\(220px, 52vw, 500px\)/);
assert.match(playerMediaRule, /min-height: clamp\(220px, 52vw, 500px\)/);
assert.match(playerMacRule, /height: clamp\(220px, 52vw, 500px\)/);
assert.match(playerMacChildrenRule, /min-height: clamp\(220px, 52vw, 500px\)/);
assert.doesNotMatch(playerShellRule, /min-height: 500px/);
assert.doesNotMatch(playerMacChildrenRule, /min-height: 500px/);
assert.match(mobilePlayerToolbarButtonRule, /flex: 1 1 0/);
assert.match(mobilePlayerToolbarButtonRule, /min-width: 0/);
assert.doesNotMatch(style, /\.pf-player/);
assert.match(style, /\.download-list/);
assert.match(style, /\.download-list a[\s\S]*transition: border-color/);
assert.match(style, /\.copyright-box/);
assert.match(style, /\.comment-list/);
assert.match(style, /\.comment-layout \.system-box[\s\S]*position: sticky/);
assert.match(style, /\.plot-list/);
assert.match(style, /\.module-fallback/);
assert.match(style, /\.system-box[\s\S]*background: linear-gradient/);
assert.match(style, /\.verify-code img[\s\S]*max-width: 100%/);
assert.match(style, /\.primary-btn:hover,\n\.ghost-btn:hover/);
assert.match(style, /\.episode-grid a:focus-visible/);
assert.match(episodeLinkRule, /border: 1px solid var\(--line-soft\)/);
assert.match(episodeLinkRule, /transition: border-color 0\.18s ease, background 0\.18s ease, color 0\.18s ease, box-shadow 0\.18s ease, transform 0\.18s ease/);
assert.match(episodeActiveRule, /border-color: var\(--line-accent-strong\)/);
assert.match(episodeActiveRule, /box-shadow: var\(--selected-shadow\)/);
assert.match(style, /\.list-item:hover/);
assert.match(style, /\.poster::after/);
assert.match(style, /\.vod-card[\s\S]*background: var\(--surface\)/);
assert.match(style, /\.vod-card[\s\S]*box-shadow/);
assert.match(style, /\.vod-card[\s\S]*display: flex/);
assert.match(vodCardRule, /min-height: 0/);
assert.match(vodCardRule, /transition: border-color 0\.2s ease, background 0\.2s ease, box-shadow 0\.2s ease, color 0\.2s ease/);
assert.doesNotMatch(vodCardRule, /transform 0\.2s ease/);
assert.doesNotMatch(appScript, /revealSelectors = \[[\s\S]*"\.vod-card"/);
assert.doesNotMatch(appScript, /cards = scopedElements\(scope, "\.vod-card, \.home-shelf-card"\)/);
assert.doesNotMatch(appScript, /bindGsapHover\(scope, "\.vod-card"/);
assert.doesNotMatch(appScript, /var cards = scopedElements\(scope, "\.home-shelf-card"\)/);
assert.doesNotMatch(appScript, /initRevealMotion|data-gsap-reveal/);
assert.match(appScript, /function initSectionMotion/);
assert.match(appScript, /IntersectionObserver/);
assert.match(appScript, /var animatedSections = sections\.filter/);
assert.match(appScript, /gsap\.set\(animatedSections, \{ y: 16 \}\)/);
assert.match(appScript, /gsap\.set\(entry\.target, \{ willChange: "transform" \}\)/);
assert.match(appScript, /duration: 0\.36/);
assert.doesNotMatch(appScript, /gsap\.set\(sections, \{ autoAlpha: 0/);
assert.match(appScript, /ArrowRight/);
assert.match(appScript, /ArrowLeft/);
assert.match(appScript, /tabIndex = isActive \? 0 : -1/);
assert.doesNotMatch(style, /\.vod-card small/);
assert.match(vodCardTitleRule, /overflow: visible/);
assert.match(vodCardTitleRule, /overflow-wrap: anywhere/);
assert.doesNotMatch(vodCardTitleRule, /-webkit-line-clamp/);
assert.match(vodCardMetaRule, /margin: 12px 2px 0/);
assert.match(vodCardMetaRule, /flex-wrap: wrap/);
assert.match(vodCardMetaChipRule, /white-space: normal/);
assert.match(vodCardMetaChipRule, /overflow-wrap: anywhere/);
assert.doesNotMatch(vodCardMetaChipRule, /text-overflow: ellipsis/);
assert.match(style, /\.poster[\s\S]*isolation: isolate/);
assert.match(style, /\.brand-logo/);
assert.match(style, /object-fit: contain/);
assert.match(style, /\.brand-logo[\s\S]*filter: drop-shadow/);
assert.match(style, /\.site-header \.brand img[\s\S]*width: 58px/);
assert.match(style, /\.site-header \.brand img[\s\S]*height: 58px/);
assert.match(style, /\.site-header \.brand img[\s\S]*max-width: 58px/);
assert.match(siteHeaderRule, /z-index: 1000/);
assert.match(siteHeaderRule, /overflow: visible/);
assert.doesNotMatch(siteHeaderRule, /overflow: clip/);
assert.doesNotMatch(style, /\.brand-logo[\s\S]{0,160}box-shadow/);
assert.match(style, /\.user-menu/);
assert.match(style, /\.user-avatar/);
assert.match(style, /\[data-auth-member\]\[hidden\],\n\[data-auth-guest\]\[hidden\][\s\S]*display: none !important/);
assert.match(style, /\.user-avatar[\s\S]*color: #fff/);
assert.match(style, /--avatar-bg/);
assert.match(style, /\.user-avatar-letter/);
assert.match(style, /\.user-dropdown/);
assert.match(style, /\.device-panel/);
assert.match(style, /\.device-card/);
assert.match(style, /\.device-card:hover/);
assert.match(style, /\.device-current/);
assert.match(style, /\.device-meta/);
assert.match(style, /\.device-status/);
assert.match(style, /\.user-menu::after[\s\S]*height: 12px/);
assert.match(userDropdownRule, /z-index: 1001/);
assert.match(style, /\.user-menu:hover \.user-dropdown/);
assert.match(style, /\.record-poster/);
assert.match(style, /\.record-poster-img/);
assert.match(style, /\.record-poster[\s\S]*aspect-ratio: 2 \/ 3/);
assert.match(style, /\.record-item:hover/);
assert.match(style, /\.favorite-page/);
assert.match(style, /\.favorite-toolbar/);
assert.match(style, /\.favorite-list/);
assert.match(style, /\.favorite-card/);
assert.match(style, /\.favorite-card:hover/);
assert.match(style, /\.favorite-status/);
assert.match(style, /\.favorite-cover/);
assert.match(style, /\.favorite-empty/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.favorite-card/);
assert.match(style, /\.record-empty/);
assert.match(style, /\.record-item-actions[\s\S]*flex-wrap: wrap/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.record-toolbar/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.record-item/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-inner\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*?\.header-search-wrap\s*\{[^}]*display: none/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*?\.site-header \.nav-toggle\s*\{[\s\S]*?grid-column: 3/);
assert.match(appScript, /desktopNavQuery = window\.matchMedia \? window\.matchMedia\("\(min-width: 1181px\)"\)/);
assert.match(style, /@media \(max-width: 1180px\)[\s\S]*?\.header-search-wrap\s*\{[^}]*display: none/);
assert.match(style, /@media \(max-width: 1180px\)[\s\S]*?\.site-header \.nav-toggle\s*\{[\s\S]*?display: block[\s\S]*?grid-column: 3/);
assert.match(style, /@media \(max-width: 1180px\)[\s\S]*?\.mobile-drawer\s*\{[\s\S]*?display: block/);
assert.match(appScript, /function syncCompactMobileHeader\(\)/);
assert.match(appScript, /compactHeaderEnterY = 132/);
assert.match(appScript, /compactHeaderExitY = 48/);
assert.match(appScript, /siteHeader\.classList\.contains\("is-compact"\)[\s\S]*?window\.scrollY < compactHeaderExitY/);
assert.match(appScript, /window\.scrollY > compactHeaderEnterY/);
assert.doesNotMatch(appScript, /classList\.toggle\("is-compact", mobileHeaderQuery\.matches && window\.scrollY > 72\)/);
assert.doesNotMatch(style, /\.site-header\.is-compact:not\(:focus-within\) \.header-search-wrap\s*\{/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*?\.hero-carousel,[\s\S]*?\.hero-slide\s*\{[\s\S]*?min-height: min\(520px, 68dvh\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*?\.rank-list::-webkit-scrollbar,[\s\S]*?\.genre-dock::-webkit-scrollbar\s*\{[\s\S]*?display: block[\s\S]*?height: 4px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*?\.genre-chip\s*\{[\s\S]*?flex: 0 0 clamp\(160px, 42vw, 176px\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*?\.rank-meta\s*\{[\s\S]*?font-size: 12px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*?\.genre-chip small\s*\{[\s\S]*?font-size: 12px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*?\.home-shelf-body small\s*\{[\s\S]*?font-size: 12px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search\s*\{[\s\S]*grid-column: 1/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*?\.header-search input\s*\{[\s\S]*?font-size: 16px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search button\s*\{[\s\S]*min-width: 76px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.site-header \.brand img\s*\{[\s\S]*width: 56px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank\s*\{[\s\S]*margin-top: 4px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank \.rank-item:first-of-type\s*\{[\s\S]*padding-top: 4px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-rank \.rank-item:first-of-type \.rank-index\s*\{[\s\S]*width: 22px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.rank-item\s*\{[\s\S]*grid-template-columns: 62px minmax\(0, 1fr\) auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.rank-index\s*\{[\s\S]*width: 20px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.header-search\s*\{[\s\S]*display: grid/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.player-shell\s*\{[\s\S]*aspect-ratio: 16 \/ 9/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-auto-flow: row/);
assert.match(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*overflow: visible/);
assert.doesNotMatch(style, /@media \(max-width: 1020px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: none/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.system-page\s*\{[\s\S]*min-height: auto/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.system-box\s*\{[\s\S]*padding: 20px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.device-card\s*\{[\s\S]*grid-template-columns: 1fr/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.comment-layout \.system-box\s*\{[\s\S]*position: static/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.detail-actions \.primary-btn,\n  \.detail-actions \.ghost-btn\s*\{[\s\S]*flex: 1 1 132px/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.site-header\s*\{[\s\S]*?padding: 4px 0/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.site-header \.brand\s*\{[\s\S]*?height: 44px/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.header-search\s*\{[\s\S]*?height: 44px/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.player-page\s*\{[\s\S]*?padding: 0 0 16px/);
assert.match(style, /@media \(orientation: landscape\) and \(max-height: 520px\)[\s\S]*?\.player-shell\s*\{[\s\S]*?height: calc\(100dvh - 60px\)/);
assert.doesNotMatch(style, /height: calc\(100vh - 64px\)/);
assert.match(style, /\.mobile-category-entry\s*\{[\s\S]*display: none/);
assert.match(style, /\.mobile-shortcuts\s*\{[\s\S]*display: none/);
assert.match(style, /\.mobile-game-entry/);
assert.match(style, /\.mobile-drawer\s*\{[\s\S]*transform: translateX\(100%\)/);
assert.match(style, /\.mobile-drawer\.is-open\s*\{[\s\S]*transform: translateX\(0\)/);
assert.match(style, /\.mobile-drawer-backdrop\.is-visible\s*\{[\s\S]*opacity: 1/);
assert.match(style, /body\.mobile-nav-open\s*\{[\s\S]*overflow: hidden/);
assert.match(style, /\.mobile-drawer-user\s*\{[\s\S]*display: grid/);
assert.match(style, /\.mobile-drawer-search\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
assert.match(style, /\.mobile-drawer-search input\s*\{[\s\S]*min-height: 44px/);
assert.match(style, /\.mobile-drawer-search button\s*\{[\s\S]*min-height: 44px/);
assert.match(style, /\.mobile-drawer-user\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /\.mobile-drawer-login\s*\{[\s\S]*border-color: var\(--line-accent-strong\)/);
assert.match(style, /\.mobile-drawer-login\s*\{[\s\S]*grid-column: 1 \/ -1/);
assert.doesNotMatch(style, /\.nav-video-menu/);
assert.doesNotMatch(style, /\.nav-video-panel/);
assert.match(style, /\.mobile-drawer-links\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /\.mobile-drawer-links a\s*\{[\s\S]*justify-content: center/);
assert.match(style, /\.mobile-drawer-cats a\s*\{[\s\S]*font-size: 15px/);
assert.match(style, /\.mobile-drawer-links a,\n\.mobile-drawer-user a,\n\.mobile-drawer-cats a/);
assert.match(style, /\.mobile-drawer-cats\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /\.content-empty-state\s*\{/);
assert.match(style, /\.content-empty-state\[hidden\]\s*\{/);
assert.match(style, /\.vod-card \.card-meta span\s*\{[\s\S]*color: rgba\(203, 210, 232, 0\.72\)/);
assert.doesNotMatch(style, /\.site-footer|\.footer-grid|\.footer-links/);
assert.match(style, /\.login-page\s*\{[\s\S]*isolation: isolate/);
assert.match(style, /\.login-panel\s*\{[\s\S]*conic-gradient/);
const loginPageRule = extractCssRule(style, ".login-page");
const loginPanelRule = extractCssRule(style, ".login-panel");
const loginPanelEdgeRule = extractCssRule(style, ".login-panel::before");
const loginEdgePropertyRule = style.match(/@property --login-edge-angle\s*\{[^}]*\}/)?.[0] || "";
const loginEdgeLengthProperties = ["start", "core-start", "core-end", "end"].map((name) => style.match(new RegExp(`@property --login-edge-${name}\\s*\\{[^}]*\\}`))?.[0] || "");
const loginEdgeGlowRule = extractCssRule(style, ".login-edge-glow");
const loginEdgeGlowSourceRule = extractCssRule(style, ".login-edge-glow::before");
const loginEdgeGlowPlacementRule = extractCssRule(style, ".login-panel > .login-edge-glow");
const loginPanelMaterialRule = extractCssRule(style, ".login-panel::after");
const loginGlassHighlightRule = extractCssRule(style, ".login-glass-highlight");
const loginGlassHighlightActiveRule = extractCssRule(style, '.login-panel[data-login-pointer="active"] .login-glass-highlight');
const loginHorizonRule = extractCssRule(style, ".login-page::after");
const loginControlRule = extractCssRule(style, ".login-control");
const loginSubmitRule = extractCssRule(style, ".login-submit");
const loginBodyRule = extractCssRule(style, "body:has(.login-page)");
assert.match(loginPanelRule, /min-height: 780px/);
assert.match(loginPageRule, /background: transparent/);
assert.match(loginBodyRule, /background: var\(--login-canvas\)/);
assert.doesNotMatch(loginBodyRule, /--wrap:/);
assert.match(loginPanelRule, /rgba\(37, 52, 92, 0\.72\)/);
assert.match(loginPanelRule, /brightness\(0\.92\)/);
assert.match(loginPanelRule, /--login-edge-paint:\s*conic-gradient/);
assert.equal((loginPanelRule.match(/conic-gradient/g) || []).length, 1);
assert.match(loginPanelRule, /rgba\(255, 255, 255, 1\) var\(--login-edge-core-start\) var\(--login-edge-core-end\)/);
assert.match(loginPanelRule, /rgba\(200, 143, 255, 0\.52\)/);
assert.doesNotMatch(loginPanelRule, /rgba\(215, 242, 255/);
assert.match(loginPanelRule, /login-panel-arrive 0\.72s[^;]+,\s*login-edge-flow 10s linear 0\.72s infinite/);
assert.match(loginPanelRule, /login-edge-breathe 5\.2s ease-in-out 0\.72s infinite/);
assert.match(loginPanelEdgeRule, /filter: drop-shadow/);
assert.match(loginPanelEdgeRule, /background: var\(--login-edge-paint\)/);
assert.doesNotMatch(loginPanelEdgeRule, /animation:/);
assert.match(loginEdgePropertyRule, /inherits: true/);
for (const propertyRule of loginEdgeLengthProperties) {
  assert.match(propertyRule, /syntax: "<percentage>"/);
  assert.match(propertyRule, /inherits: true/);
}
assert.match(loginEdgeGlowRule, /filter: blur\(12px\) saturate\(1\.7\) drop-shadow\(0 0 32px rgba\(105, 84, 255, 0\.78\)\)/);
assert.match(loginEdgeGlowPlacementRule, /position: absolute/);
assert.match(loginEdgeGlowPlacementRule, /z-index: 1/);
assert.match(loginEdgeGlowSourceRule, /background: var\(--login-edge-paint\)/);
assert.match(loginEdgeGlowSourceRule, /padding: 10px/);
assert.match(loginEdgeGlowSourceRule, /mask-composite: exclude/);
assert.doesNotMatch(loginEdgeGlowSourceRule, /radial-gradient|animation:/);
assert.match(loginPanelMaterialRule, /inset: 0/);
assert.match(loginPanelMaterialRule, /rgba\(178, 97, 255, 0\.24\)/);
assert.match(loginGlassHighlightRule, /opacity: 0/);
assert.match(loginGlassHighlightRule, /transition: opacity 0\.14s ease-out/);
assert.doesNotMatch(loginGlassHighlightRule, /transition:[^;]*transform/);
assert.match(loginGlassHighlightActiveRule, /opacity: 0\.82/);
assert.match(loginGlassHighlightActiveRule, /transition-duration: 0s/);
assert.match(loginHorizonRule, /bottom: 108px/);
assert.match(loginControlRule, /rgba\(82, 101, 116, 0\.5\)/);
assert.match(loginSubmitRule, /#6464fa/);
assert.match(style, /\.login-captcha-image,[\s\S]*#d8dae6/);
assert.doesNotMatch(style, /\.(?:skip-link|user-compat-note)\b/);
assert.match(style, /@property --login-edge-angle/);
assert.match(style, /@keyframes login-edge-flow/);
assert.match(style, /@keyframes login-edge-breathe\s*\{[\s\S]*--login-edge-start: 53%;[\s\S]*--login-edge-core-start: 67%;[\s\S]*--login-edge-core-end: 79%;[\s\S]*--login-edge-end: 97%/);
assert.match(style, /\.login-glass-highlight\s*\{/);
assert.match(style, /\.login-panel\[data-login-motion="paused"\]/);
assert.match(style, /\.login-page\[data-login-motion="paused"\]::before/);
assert.match(style, /\.login-control\s*\{[\s\S]*min-height: 56px/);
assert.match(style, /\.login-submit\s*\{[\s\S]*width: 100%/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.login-panel\s*\{[\s\S]*padding:/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.login-panel/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.mobile-shortcuts\s*\{[\s\S]*display: none/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.site-nav\s*\{[\s\S]*display: none/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.user-menu\s*\{[\s\S]*display: none/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.nav-toggle\s*\{[\s\S]*display: block/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.site-header \.brand img\s*\{[\s\S]*width: 48px/);
assert.doesNotMatch(style, /\.hero-carousel \.hero-stats/);
assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*\.banner-copy small\s*\{[\s\S]*-webkit-line-clamp/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-copy strong\s*\{[\s\S]*-webkit-line-clamp: unset/);
assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*\.hero-carousel \.hero-stats/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*min-height: 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*left: 50%/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*bottom: 12px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.banner-controls\s*\{[\s\S]*transform: translateX\(-50%\)/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-carousel\s*\{[\s\S]*min-height: 0/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.hero-slide\s*\{[\s\S]*padding: 18px 14px 70px/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.banner-content\s*\{[\s\S]*min-height: 300px/);
assert.doesNotMatch(style, /@media \(max-width: 520px\)[\s\S]*\.hero-carousel \.hero-stats/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.banner-controls\s*\{[\s\S]*bottom: 12px/);
assert.doesNotMatch(style, /@media \(max-width: 520px\)[\s\S]*\.list-item small\s*\{[\s\S]*-webkit-line-clamp/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.card-meta\s*\{[\s\S]*flex-wrap: wrap/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.card-meta span\s*\{[\s\S]*min-width: 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(style, /@media \(max-width: 520px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(style, /@media \(max-width: 760px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-auto-columns: minmax\(220px, 78vw\)/);
assert.doesNotMatch(style, /@media \(max-width: 520px\)[\s\S]*\.home-shelf-rail\s*\{[\s\S]*grid-auto-columns: minmax\(210px, 82vw\)/);
assert.match(style, /\.site-nav[\s\S]*overflow: hidden/);
assert.doesNotMatch(style, /\.site-nav[\s\S]{0,80}overflow-x: auto/);
assert.match(style, /\.category-index/);
assert.doesNotMatch(style, /\.category-search/);
assert.doesNotMatch(style, /\.category-empty/);
assert.match(style, /\.filter-search-row/);
assert.match(style, /\.channel-search/);
assert.match(style, /\.channel-search input/);
assert.match(style, /\.channel-search[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
assert.match(style, /\.channel-search input\[type="search"\][\s\S]*background: transparent/);
assert.match(style, /\.channel-search button[\s\S]*background: var\(--accent\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.page-title\s*\{[\s\S]*padding: 24px 0 8px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.content-section\s*\{[\s\S]*padding: 22px 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.hero-carousel\s*\{[\s\S]*min-height: 0/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.filter-panel\s*\{[\s\S]*padding: 14px/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.filter-row\s*\{[\s\S]*grid-template-columns: 54px minmax\(0, 1fr\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.list-item\s*\{[\s\S]*grid-template-columns: 86px minmax\(0, 1fr\)/);
assert.match(style, /@media \(max-width: 760px\)[\s\S]*\.page-link,\n  \.page-state\s*\{[\s\S]*flex: 1 1 88px/);
assert.match(include, new RegExp(`style\\.css\\?v=${styleVersionPlaceholder}`));
assert.match(style, /\.search-filter-panel/);
assert.doesNotMatch(style, /\.search-type-filter/);
assert.doesNotMatch(style, /\.search-type-panel/);
assert.doesNotMatch(style, /\.search-type-section/);
assert.match(style, /\.category-tile/);
assert.match(style, /\.category-tile[\s\S]*position: relative/);
assert.match(style, /\.category-hit[\s\S]*position: absolute/);
assert.match(style, /\.category-main[\s\S]*pointer-events: none/);
assert.match(style, /\.category-children[\s\S]*z-index: 2/);
assert.match(style, /\.category-children[\s\S]*pointer-events: none/);
assert.match(style, /\.category-children a[\s\S]*pointer-events: auto/);
assert.match(style, /\.category-sort/);
assert.match(style, /\.sort-latest/);
assert.match(style, /\.sort-hot/);
assert.match(style, /\.sort-score/);
assert.doesNotMatch(style, /\.category-sort::before/);
assert.doesNotMatch(style, /\.sort-latest::before/);
assert.doesNotMatch(style, /\.sort-hot::before/);
assert.doesNotMatch(style, /\.sort-score::before/);
assert.match(style, /\.history-timeline/);
assert.match(style, /\.timeline-date/);
assert.match(style, /\.timeline-item/);
assert.match(style, /\.multiplayer-layout/);
assert.match(style, /\.gomoku-board/);
assert.match(style, /\.drawguess-canvas-frame/);
assert.match(style, /\.interaction-panel/);
assert.match(style, /\.qixi-rose-page/);
assert.match(style, /\.qixi-rose-canvas/);
assert.doesNotMatch(style, /\.qixi-rose-model|is-model-materializing|is-model-visible/);
const qixiBouquetStyle = readThemeFile("css/qixi-bouquet.css");
assert.match(qixiBouquetStyle, /\.qixi-rose-credit/);
assert.match(style, /\.qixi-bloom-button/);
assert.match(style, /html\.qixi-immersive \.site-header/);
assert.match(style, /html\.qixi-immersive \.qixi-rose-page[\s\S]*min-height: max\(720px, 100svh\)/);
assert.match(qixiBouquetStyle, /\.qixi-rose-page[\s\S]*env\(safe-area-inset-top, 0px\)[\s\S]*env\(safe-area-inset-bottom, 0px\)/);
assert.match(style, /\.qixi-rose-page\.is-entering \.qixi-rose-kicker/);
assert.match(style, /\.qixi-rose-page\.is-entering\.is-entered \.qixi-rose-copy/);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.qixi-rose-page\.is-entering/);
assert.match(style, /\.qixi-rose-gesture/, "Keep legacy gesture styling for the independent Next page");
assert.doesNotMatch(qixiBouquetStyle, /\.qixi-rose-gesture/);
assert.match(style, /\.star-meter/);
assert.doesNotMatch(style, /border(?:-color)?: [^;]*rgba\(40, 199, 167/);

const logo = readFileSync(path.join(themeRoot, "images/site-logo.png"));
assert.equal(logo.subarray(1, 4).toString("ascii"), "PNG");
assert.deepEqual([logo.readUInt32BE(16), logo.readUInt32BE(20)], [192, 192]);
assert.ok(logo.length < 150_000, "site logo should stay small enough for header loading");
const logoMode = statSync(path.join(themeRoot, "images/site-logo.png")).mode & 0o777;
assert.equal(logoMode & 0o044, 0o044, "site logo must be readable by the web server after deployment");

const packageScript = readFileSync(path.join(root, "scripts/package-theme.mjs"), "utf8");
assert.match(packageScript, /pingfangvideo/);
assert.match(packageScript, /pingfangdevice/);
assert.match(packageScript, /vodops/);
assert.match(packageScript, /dist/);
assert.match(packageScript, /addonArchive/);
assert.match(packageScript, /startsWith\("\."\)/);
assert.match(packageScript, /createHash/);
assert.match(packageScript, /assetVersionInputs/);
assert.match(packageScript, /__PINGFANG_STYLE_VERSION__/);
assert.match(packageScript, /__PINGFANG_APP_VERSION__/);
assert.match(packageScript, /__PINGFANG_PROMPT_VERSION__/);
assert.match(packageScript, /__PINGFANG_GAME_VERSION__/);
assert.match(packageScript, /__PINGFANG_BAMBOO_CICADA_VERSION__/);
assert.match(packageScript, /__PINGFANG_MULTIPLAYER_VERSION__/);
assert.match(packageScript, /__PINGFANG_QIXI_VERSION__/);
assert.match(packageScript, /__PINGFANG_QIXI_VERSION__: "js\/qixi-particle-bouquet\.js"/);
assert.match(packageScript, /__PINGFANG_QIXI_STYLE_VERSION__: "css\/qixi-bouquet\.css"/);
assert.match(packageScript, /excludedThemePackageFiles/);
assert.doesNotMatch(packageScript, /rank-react|pingfang-player|react\.production|hls\.min/);
assert.match(packageScript, /"player\/prompt\.css"/);
assert.match(packageScript, /replaceAssetVersionPlaceholders/);
assert.match(packageScript, /normalizePackagePermissions/);
assert.match(packageScript, /chmodSync\(filePath, 0o644\)/);
assert.match(packageScript, /chmodSync\(filePath, 0o755\)/);
assert.match(packageScript, /COPYFILE_DISABLE/);
assert.match(packageScript, /--no-xattrs/);

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.scripts.lint, "npm run lint:frontend");
assert.match(packageJson.scripts["lint:frontend"], /npm run lint:js/);
assert.match(packageJson.scripts["lint:frontend"], /npm run lint:css/);
assert.match(packageJson.scripts["lint:frontend"], /npm run format:check/);
assert.equal(packageJson.scripts["lint:template"], "node scripts/lint-template.mjs");
assert.equal(packageJson.scripts["verify:compat"], "node scripts/verify-compat.mjs");
assert.equal(packageJson.scripts["verify:preview"], "node scripts/verify-preview.mjs");
assert.equal(packageJson.scripts["package:player"], "node scripts/package-player.mjs");
assert.equal(packageJson.scripts["package:games"], "node scripts/package-game-server.mjs");
assert.equal(packageJson.scripts["verify:player-release"], "node scripts/verify-player-release.mjs");
assert.equal(packageJson.scripts["verify:game-server-release"], "node scripts/verify-game-server-release.mjs");
assert.equal(packageJson.scripts["start:games"], "node services/game-server/index.mjs");
assert.equal(packageJson.scripts["deploy:games"], "bash scripts/deploy-game-server.sh");
assert.match(packageJson.scripts.package, /package-theme\.mjs/);
assert.match(packageJson.scripts.package, /package:player/);
assert.match(packageJson.scripts.package, /package:games/);
assert.match(packageJson.scripts["verify:release"], /verify-release\.mjs/);
assert.match(packageJson.scripts["verify:release"], /verify:player-release/);
assert.match(packageJson.scripts["verify:release"], /verify:game-server-release/);
assert.equal(packageJson.dependencies.ws, "8.21.1");
assert.match(packageJson.scripts.deploy, /deploy-theme\.sh/);
assert.match(packageJson.scripts.deploy, /deploy-game-server\.sh/);
assert.equal(packageJson.scripts["deploy:vodops"], "DEPLOY_SCOPE=vodops bash scripts/deploy-theme.sh");
for (const testFile of [
  "douban-gateway.test.php",
  "douban-matcher.test.php",
  "douban-ai-reviewer.test.php",
  "douban-data.test.php",
  "douban-controller.test.php",
  "douban-worker.test.php",
]) {
  assert.match(packageJson.scripts.test, new RegExp(testFile.replace(".", "\\.")));
}
assert.equal(packageJson.scripts.rollback, "bash scripts/rollback-theme.sh");

const ping2DeployEnv = readFileSync(path.join(root, "scripts/deploy-ping2.env"), "utf8");
assert.match(ping2DeployEnv, /export DEPLOY_HOST=144\.34\.184\.95/);
assert.match(ping2DeployEnv, /export DEPLOY_USER=root/);
assert.match(ping2DeployEnv, /export DEPLOY_PATH=\/www\/wwwroot\/squaredMedia\/template/);
assert.match(ping2DeployEnv, /export DEPLOY_PORT=814/);
assert.match(
  ping2DeployEnv,
  /export DEPLOY_GAME_ALLOWED_ORIGINS=https:\/\/www\.ping2video\.xyz,https:\/\/ping2video\.xyz/,
);
assert.match(ping2DeployEnv, /pingfangvideo_deploy_ed25519/);
assert.match(ping2DeployEnv, /export DEPLOY_SITE_HOST=www\.ping2video\.xyz/);
assert.match(ping2DeployEnv, /export DEPLOY_SITE_SCHEME=https/);
assert.match(ping2DeployEnv, /export DEPLOY_SITE_MARKER=\/template\/pingfangvideo\//);
assert.doesNotMatch(ping2DeployEnv, /DEPLOY_PASSWORD/);

const deployScript = readFileSync(path.join(root, "scripts/deploy-theme.sh"), "utf8");
assert.match(deployScript, /^#!\/usr\/bin\/env bash/);
assert.match(deployScript, /set -euo pipefail/);
assert.match(deployScript, /npm test/);
assert.match(deployScript, /npm run lint/);
assert.match(deployScript, /npm run lint:template/);
assert.match(deployScript, /npm run verify:compat/);
assert.match(deployScript, /npm run verify:preview/);
assert.match(deployScript, /npm run package/);
assert.match(deployScript, /npm run verify:release/);
assert.match(deployScript, /dist\/pingfangvideo\.tar\.gz/);
assert.match(deployScript, /\$\{DEPLOY_HOST/);
assert.match(deployScript, /\$\{DEPLOY_USER/);
assert.match(deployScript, /\$\{DEPLOY_PORT/);
assert.match(deployScript, /\$\{DEPLOY_PATH/);
assert.match(deployScript, /SSHPASS/);
assert.match(deployScript, /DEPLOY_IDENTITY_FILE/);
assert.match(deployScript, /IdentitiesOnly=yes/);
assert.match(deployScript, /DEPLOY_SITE_HOST/);
assert.match(deployScript, /DEPLOY_SITE_SCHEME/);
assert.match(deployScript, /DEPLOY_SITE_MARKER/);
assert.match(deployScript, /--resolve "\$\{DEPLOY_SITE_HOST\}:\$\{port\}:127\.0\.0\.1"/);
assert.match(deployScript, /Verified deployed site/);
assert.match(deployScript, /for attempt in 1 2/);
assert.match(deployScript, /Deployed site warm-up request failed; retrying/);
assert.match(deployScript, /scp/);
assert.match(deployScript, /ssh/);
assert.match(deployScript, /tar -xzf/);
assert.match(deployScript, /pingfangvideo\.backup/);
assert.match(deployScript, /ADDON_NAME="pingfangdevice"/);
assert.match(deployScript, /pingfangdevice\.tar\.gz/);
assert.match(deployScript, /VODOPS_ADDON_NAME="vodops"/);
assert.match(deployScript, /dist\/vodops\.tar\.gz/);
assert.match(deployScript, /DEPLOY_SCOPE="\$\{DEPLOY_SCOPE:-all\}"/);
assert.match(deployScript, /if \[\[ "\$DEPLOY_SCOPE" == "vodops" \]\]/);
assert.match(deployScript, /application\/admin\/controller\/Vodops\.php/);
assert.match(deployScript, /application\/admin\/controller\/Douban\.php/);
assert.match(deployScript, /application\/admin\/view_new\/vodops\/index\.html/);
assert.match(deployScript, /legacy_douban_dir="\$maccms_root\/addons\/douban"/);
assert.match(deployScript, /\.vodops-deploy-state/);
assert.match(deployScript, /cp -a "\$legacy_douban_dir" "\$state_dir\/addons\/douban"/);
assert.match(deployScript, /rm -rf "\$legacy_douban_dir"/);
assert.match(deployScript, /application\/index\/controller\/Douban\.php/);
assert.match(deployScript, /rm -f "\$legacy_index_controller_target"/);
assert.match(deployScript, /application\/extra\/quickmenu\.php/);
assert.match(deployScript, /\$managedRoutes[\s\S]*?vodops\/videos[\s\S]*?vodops\/quality[\s\S]*?vodops\/douban[\s\S]*?douban\/index/);
assert.match(deployScript, /视频管理,vodops\/videos[\s\S]*?数据质量与修复,vodops\/quality[\s\S]*?豆瓣匹配与同步,vodops\/douban/);
assert.match(deployScript, /count\(array_keys\(\$verified, \$entry, true\)\) !== 1/);
assert.match(deployScript, /workspace eq 'videos'[\s\S]*?workspace eq 'douban'[\s\S]*?addons\/vodops\/view\/videos\/index[\s\S]*?Vodops admin page verification failed/);
assert.match(deployScript, /vodops_lock/);
assert.match(deployScript, /vodops_scan/);
assert.match(deployScript, /vodops_issue/);
assert.match(deployScript, /vodops_fingerprint/);
assert.match(deployScript, /vodops_repair_log/);
assert.match(deployScript, /douban_vod_meta/);
assert.match(deployScript, /douban_task/);
assert.match(deployScript, /douban_log/);
assert.match(deployScript, /douban_review_candidate/);
assert.match(deployScript, /douban_scan_issue/);
assert.match(deployScript, /response_end/);
assert.match(deployScript, /array_filter/);
assert.match(deployScript, /Vodops response_end hook removal failed/);
assert.match(deployScript, /bin\/vodops-worker\.php/);
assert.match(deployScript, /crontab -l/);
assert.match(deployScript, /flock/);
assert.match(deployScript, /install_vodops_worker_cron preflight/);
assert.match(deployScript, /execution_mode/);
assert.match(deployScript, /lease_until/);
assert.match(deployScript, /next_run_at/);
assert.match(deployScript, /application\/index\/controller\/Pingfangdevice\.php/);
assert.match(deployScript, /application_source="\$addon_dir\/application\/index\/controller\/Pingfangdevice\.php"/);
assert.doesNotMatch(deployScript, /bridge_(?:source|target|backup)/);
assert.match(deployScript, /application\/extra\/addons\.php/);
assert.match(deployScript, /install\.sql/);
assert.match(deployScript, /php -l "\$php_file"/);
assert.doesNotMatch(deployScript, /str_starts_with/);
assert.match(deployScript, /Addon app_begin hook verification failed/);
assert.match(deployScript, /opcache_invalidate\(\$path, true\)/);
assert.doesNotMatch(deployScript, /fwrite\(STDERR/);
assert.match(deployScript, /COLUMN_NAME = \?/);
assert.match(deployScript, /Device session schema verification failed/);
assert.match(deployScript, /DEPLOY_CLEAR_CACHE/);
assert.match(deployScript, /maccms_root="\$\(dirname "\$DEPLOY_PATH"\)"/);
assert.match(deployScript, /runtime\/cache/);
assert.match(deployScript, /runtime\/temp/);
assert.match(deployScript, /view\/_cache/);
assert.match(deployScript, /find "\$cache_dir" -mindepth 1/);
assert.match(deployScript, /existing.*config/i);
assert.doesNotMatch(deployScript, /DEPLOY_PASSWORD=/);

const remoteDeployScript = deployScript.match(/<<'REMOTE_SCRIPT'\n([\s\S]*?)\nREMOTE_SCRIPT/)?.[1] || "";
const autoRollbackFunction =
  remoteDeployScript.match(/restore_vodops_deploy_snapshot\(\) \{\n[\s\S]*?\n\}/)?.[0] || "";
assert.ok(autoRollbackFunction, "VodOps deployment should expose an automatic file rollback function");
const autoRollbackFixture = mkdtempSync(path.join(tmpdir(), "vodops-auto-rollback-test-"));
try {
  const siteRoot = path.join(autoRollbackFixture, "site");
  const addonsRoot = path.join(siteRoot, "addons");
  const backupRoot = path.join(addonsRoot, "vodops.backup.20260811120000");
  const stateRoot = path.join(backupRoot, ".vodops-deploy-state");
  const adminControllerRoot = path.join(siteRoot, "application", "admin", "controller");
  const adminViewRoot = path.join(siteRoot, "application", "admin", "view_new", "vodops");
  const indexControllerRoot = path.join(siteRoot, "application", "index", "controller");
  const extraRoot = path.join(siteRoot, "application", "extra");
  const cronCapture = path.join(autoRollbackFixture, "restored.crontab");
  for (const directory of [
    path.join(addonsRoot, "vodops"),
    path.join(addonsRoot, "douban"),
    path.join(stateRoot, "addons", "douban"),
    path.join(stateRoot, "application", "admin", "controller"),
    path.join(stateRoot, "application", "admin", "view_new", "vodops"),
    path.join(stateRoot, "application", "index", "controller"),
    path.join(stateRoot, "application", "extra"),
    adminControllerRoot,
    adminViewRoot,
    indexControllerRoot,
    extraRoot,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(path.join(backupRoot, "info.ini"), "name = vodops\nold addon\n");
  writeFileSync(path.join(backupRoot, "old-vodops.txt"), "old vodops\n");
  writeFileSync(path.join(stateRoot, "vodops-addon-present"), "");
  writeFileSync(path.join(stateRoot, "addons", "douban", "info.ini"), "name = douban\n");
  writeFileSync(path.join(stateRoot, "addons", "douban", "old-douban.txt"), "old douban\n");
  writeFileSync(path.join(stateRoot, "application", "admin", "controller", "Vodops.php"), "old vodops controller\n");
  writeFileSync(path.join(stateRoot, "application", "admin", "controller", "Douban.php"), "old douban controller\n");
  writeFileSync(path.join(stateRoot, "application", "admin", "view_new", "vodops", "index.html"), "old view\n");
  writeFileSync(path.join(stateRoot, "application", "index", "controller", "Douban.php"), "old public bridge\n");
  writeFileSync(path.join(stateRoot, "application", "extra", "quickmenu.php"), "old quickmenu\n");
  writeFileSync(path.join(stateRoot, "application", "extra", "addons.php"), "old hooks\n");
  writeFileSync(path.join(stateRoot, "crontab"), "old cron\n");
  writeFileSync(path.join(addonsRoot, "vodops", "new-vodops.txt"), "new vodops\n");
  writeFileSync(path.join(addonsRoot, "douban", "new-douban.txt"), "new douban\n");
  writeFileSync(path.join(adminControllerRoot, "Vodops.php"), "new vodops controller\n");
  writeFileSync(path.join(adminControllerRoot, "Douban.php"), "new douban controller\n");
  writeFileSync(path.join(adminViewRoot, "index.html"), "new view\n");
  writeFileSync(path.join(indexControllerRoot, "Douban.php"), "new public bridge\n");
  writeFileSync(path.join(extraRoot, "quickmenu.php"), "new quickmenu\n");
  writeFileSync(path.join(extraRoot, "addons.php"), "new hooks\n");

  const autoRollbackResult = spawnSync("bash", [], {
    encoding: "utf8",
    input: `set -euo pipefail\n${autoRollbackFunction}\ncrontab() { cp "$1" ${JSON.stringify(cronCapture)}; }\nrestore_vodops_deploy_snapshot ${JSON.stringify(backupRoot)} ${JSON.stringify(siteRoot)} vodops 1\n`,
  });
  assert.equal(autoRollbackResult.status, 0, autoRollbackResult.stderr || autoRollbackResult.stdout);
  assert.ok(existsSync(path.join(addonsRoot, "vodops", "old-vodops.txt")));
  assert.ok(existsSync(path.join(addonsRoot, "douban", "old-douban.txt")));
  assert.equal(readFileSync(path.join(adminControllerRoot, "Vodops.php"), "utf8"), "old vodops controller\n");
  assert.equal(readFileSync(path.join(adminControllerRoot, "Douban.php"), "utf8"), "old douban controller\n");
  assert.equal(readFileSync(path.join(adminViewRoot, "index.html"), "utf8"), "old view\n");
  assert.equal(readFileSync(path.join(indexControllerRoot, "Douban.php"), "utf8"), "old public bridge\n");
  assert.equal(readFileSync(path.join(extraRoot, "quickmenu.php"), "utf8"), "old quickmenu\n");
  assert.equal(readFileSync(path.join(extraRoot, "addons.php"), "utf8"), "old hooks\n");
  assert.equal(readFileSync(cronCapture, "utf8"), "old cron\n");
  const failedVodops = readdirSync(addonsRoot).find((name) => name.startsWith("vodops.failed."));
  const failedDouban = readdirSync(addonsRoot).find((name) => name.startsWith("douban.failed."));
  assert.ok(failedVodops && existsSync(path.join(addonsRoot, failedVodops, "new-vodops.txt")));
  assert.ok(failedDouban && existsSync(path.join(addonsRoot, failedDouban, "new-douban.txt")));
} finally {
  rmSync(autoRollbackFixture, { recursive: true, force: true });
}

const gameDeployScript = readFileSync(path.join(root, "scripts/deploy-game-server.sh"), "utf8");
const gameDeployMode = statSync(path.join(root, "scripts/deploy-game-server.sh")).mode & 0o777;
assert.equal(gameDeployMode & 0o111, 0o111, "game deployment script must remain executable");
assert.match(gameDeployScript, /^#!\/usr\/bin\/env bash/);
assert.match(gameDeployScript, /set -euo pipefail/);
assert.match(gameDeployScript, /dist\/pingfanggames-server\.tar\.gz/);
assert.match(gameDeployScript, /GAME_TICKET_SECRET/);
assert.match(gameDeployScript, /GAME_ALLOWED_ORIGINS/);
assert.match(gameDeployScript, /pingfanggames\.service/);
assert.match(gameDeployScript, /pingfanggames\.conf/);
assert.match(gameDeployScript, /systemctl restart/);
assert.match(gameDeployScript, /healthz/);
assert.match(gameDeployScript, /nginx -t/);
assert.match(gameDeployScript, /\/etc\/init\.d\/nginx reload/);
assert.match(gameDeployScript, /pingfangdevice\/config\.php/);
assert.doesNotMatch(gameDeployScript, /fwrite\(STDERR/);
assert.doesNotMatch(gameDeployScript, /source "\$service_env"/);
assert.doesNotMatch(gameDeployScript, /DEPLOY_PASSWORD=/);

const invalidGameDeploySiteHost = spawnSync("bash", ["scripts/deploy-game-server.sh"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DEPLOY_HOST: "example.invalid",
    DEPLOY_USER: "deploy",
    DEPLOY_PATH: "/tmp/maccms/template",
    DEPLOY_SITE_HOST: "https://www.example.com/",
  },
});
assert.notEqual(invalidGameDeploySiteHost.status, 0);
assert.match(invalidGameDeploySiteHost.stderr, /DEPLOY_SITE_HOST must be a hostname/);

const invalidGameDeploySiteScheme = spawnSync("bash", ["scripts/deploy-game-server.sh"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DEPLOY_HOST: "example.invalid",
    DEPLOY_USER: "deploy",
    DEPLOY_PATH: "/tmp/maccms/template",
    DEPLOY_SITE_HOST: "www.example.com",
    DEPLOY_SITE_SCHEME: "ftp",
  },
});
assert.notEqual(invalidGameDeploySiteScheme.status, 0);
assert.match(invalidGameDeploySiteScheme.stderr, /DEPLOY_SITE_SCHEME must be http or https/);

const invalidGameDeployOrigin = spawnSync("bash", ["scripts/deploy-game-server.sh"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DEPLOY_HOST: "example.invalid",
    DEPLOY_USER: "deploy",
    DEPLOY_PATH: "/tmp/maccms/template",
    DEPLOY_SITE_HOST: "www.example.com",
    DEPLOY_GAME_ALLOWED_ORIGINS: "https://www.example.com/path",
  },
});
assert.notEqual(invalidGameDeployOrigin.status, 0);
assert.match(invalidGameDeployOrigin.stderr, /DEPLOY_GAME_ALLOWED_ORIGINS must contain exact HTTP origins/);

const invalidDeploySiteHost = spawnSync("bash", ["scripts/deploy-theme.sh"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DEPLOY_HOST: "example.invalid",
    DEPLOY_USER: "deploy",
    DEPLOY_PATH: "/tmp/maccms/template",
    DEPLOY_SITE_HOST: "https://www.example.com/",
  },
});
assert.notEqual(invalidDeploySiteHost.status, 0);
assert.match(invalidDeploySiteHost.stderr, /DEPLOY_SITE_HOST must be a hostname/);

const invalidDeploySiteScheme = spawnSync("bash", ["scripts/deploy-theme.sh"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DEPLOY_HOST: "example.invalid",
    DEPLOY_USER: "deploy",
    DEPLOY_PATH: "/tmp/maccms/template",
    DEPLOY_SITE_HOST: "www.example.com",
    DEPLOY_SITE_SCHEME: "ftp",
  },
});
assert.notEqual(invalidDeploySiteScheme.status, 0);
assert.match(invalidDeploySiteScheme.stderr, /DEPLOY_SITE_SCHEME must be http or https/);

const invalidDeployScope = spawnSync("bash", ["scripts/deploy-theme.sh"], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DEPLOY_HOST: "example.invalid",
    DEPLOY_USER: "deploy",
    DEPLOY_PATH: "/tmp/maccms/template",
    DEPLOY_SCOPE: "theme-only",
  },
});
assert.notEqual(invalidDeployScope.status, 0);
assert.match(invalidDeployScope.stderr, /DEPLOY_SCOPE must be all or vodops/);

const rollbackScript = readFileSync(path.join(root, "scripts/rollback-theme.sh"), "utf8");
assert.match(rollbackScript, /^#!\/usr\/bin\/env bash/);
assert.match(rollbackScript, /set -euo pipefail/);
assert.match(rollbackScript, /\$\{DEPLOY_HOST/);
assert.match(rollbackScript, /\$\{DEPLOY_USER/);
assert.match(rollbackScript, /\$\{DEPLOY_PORT/);
assert.match(rollbackScript, /\$\{DEPLOY_PATH/);
assert.match(rollbackScript, /ROLLBACK_BACKUP/);
assert.match(rollbackScript, /ROLLBACK_SCOPE/);
assert.match(rollbackScript, /ROLLBACK_SCOPE must be theme or vodops/);
assert.match(rollbackScript, /rollback_vodops/);
assert.match(rollbackScript, /vodops\.backup/);
assert.match(rollbackScript, /application\/admin\/controller\/Douban\.php/);
assert.match(rollbackScript, /vodops-rollback-payload/);
assert.match(rollbackScript, /\.vodops-deploy-state/);
assert.match(rollbackScript, /state_dir\/addons\/douban/);
assert.match(rollbackScript, /legacy_index_controller_target/);
assert.match(rollbackScript, /restore_optional_file/);
assert.match(rollbackScript, /SSHPASS/);
assert.match(rollbackScript, /DEPLOY_IDENTITY_FILE/);
assert.match(rollbackScript, /IdentitiesOnly=yes/);
assert.match(rollbackScript, /find \. -maxdepth 1 -type d -name "\$\{THEME_NAME\}\.backup\.\*"/);
assert.match(rollbackScript, /pingfangvideo\.failed/);
assert.match(rollbackScript, /cp -a "\$backup" "\$THEME_NAME"/);
assert.match(rollbackScript, /DEPLOY_CLEAR_CACHE/);
assert.match(rollbackScript, /runtime\/cache/);
assert.doesNotMatch(rollbackScript, /DEPLOY_PASSWORD=/);

const remoteRollbackScript = rollbackScript.match(/<<'REMOTE_SCRIPT'\n([\s\S]*?)\nREMOTE_SCRIPT/)?.[1] || "";
assert.ok(remoteRollbackScript, "rollback script should expose a remote payload");
const rollbackFixture = mkdtempSync(path.join(tmpdir(), "vodops-rollback-test-"));
try {
  const siteRoot = path.join(rollbackFixture, "site");
  const backupRoot = path.join(siteRoot, "addons", "vodops.backup.20260810120000");
  const stateRoot = path.join(backupRoot, ".vodops-deploy-state");
  const adminControllerRoot = path.join(siteRoot, "application", "admin", "controller");
  const adminViewRoot = path.join(siteRoot, "application", "admin", "view_new", "vodops");
  const indexControllerRoot = path.join(siteRoot, "application", "index", "controller");
  for (const directory of [
    path.join(siteRoot, "template"),
    path.join(siteRoot, "addons", "vodops"),
    path.join(siteRoot, "addons", "douban"),
    path.join(siteRoot, "runtime"),
    path.join(stateRoot, "addons", "douban", "application", "admin", "controller"),
    path.join(stateRoot, "application", "admin", "controller"),
    path.join(stateRoot, "application", "admin", "view_new", "vodops"),
    path.join(stateRoot, "application", "index", "controller"),
    adminControllerRoot,
    adminViewRoot,
    indexControllerRoot,
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(path.join(backupRoot, "info.ini"), "name = vodops\ntitle = legacy vodops\n");
  writeFileSync(path.join(backupRoot, "legacy-vodops.txt"), "legacy vodops\n");
  writeFileSync(path.join(stateRoot, "vodops-addon-present"), "");
  writeFileSync(path.join(stateRoot, "addons", "douban", "info.ini"), "name = douban\n");
  writeFileSync(path.join(stateRoot, "addons", "douban", "legacy-douban.txt"), "legacy douban\n");
  writeFileSync(
    path.join(stateRoot, "addons", "douban", "application", "admin", "controller", "Douban.php"),
    "<?php\nnamespace app\\admin\\controller;\nclass Douban {}\n",
  );
  writeFileSync(
    path.join(stateRoot, "application", "admin", "controller", "Vodops.php"),
    "<?php\nnamespace app\\admin\\controller;\nclass Vodops {}\n",
  );
  writeFileSync(
    path.join(stateRoot, "application", "admin", "controller", "Douban.php"),
    "<?php\nnamespace app\\admin\\controller;\nclass Douban {}\n",
  );
  writeFileSync(path.join(stateRoot, "application", "admin", "view_new", "vodops", "index.html"), "X-CSRF-Token legacy\n");
  writeFileSync(path.join(siteRoot, "addons", "vodops", "current-vodops.txt"), "current\n");
  writeFileSync(path.join(siteRoot, "addons", "douban", "current-douban.txt"), "current\n");
  writeFileSync(path.join(adminControllerRoot, "Vodops.php"), "<?php\nclass CurrentVodops {}\n");
  writeFileSync(path.join(adminControllerRoot, "Douban.php"), "<?php\nclass CurrentDouban {}\n");
  writeFileSync(path.join(adminViewRoot, "index.html"), "X-CSRF-Token current\n");
  writeFileSync(path.join(indexControllerRoot, "Douban.php"), "<?php\nclass ObsoletePublicDouban {}\n");

  const rollbackResult = spawnSync("bash", [], {
    encoding: "utf8",
    input: remoteRollbackScript,
    env: {
      ...process.env,
      DEPLOY_PATH: path.join(siteRoot, "template"),
      THEME_NAME: "pingfangvideo",
      DEPLOY_CLEAR_CACHE: "0",
      ROLLBACK_SCOPE: "vodops",
      ROLLBACK_BACKUP: "vodops.backup.20260810120000",
      VODOPS_ADDON_NAME: "vodops",
    },
  });
  assert.equal(rollbackResult.status, 0, rollbackResult.stderr || rollbackResult.stdout);
  assert.ok(existsSync(path.join(siteRoot, "addons", "vodops", "legacy-vodops.txt")));
  assert.ok(existsSync(path.join(siteRoot, "addons", "douban", "legacy-douban.txt")));
  assert.doesNotMatch(readFileSync(path.join(adminControllerRoot, "Vodops.php"), "utf8"), /CurrentVodops/);
  assert.doesNotMatch(readFileSync(path.join(adminControllerRoot, "Douban.php"), "utf8"), /CurrentDouban/);
  assert.ok(!existsSync(path.join(indexControllerRoot, "Douban.php")), "an absent pre-merge public bridge should stay absent");
} finally {
  rmSync(rollbackFixture, { recursive: true, force: true });
}

const ciWorkflow = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
assert.match(ciWorkflow, /name: Theme, Addons, Player, and Games CI/);
assert.match(ciWorkflow, /pull_request:/);
assert.match(ciWorkflow, /actions\/checkout@v4/);
assert.match(ciWorkflow, /actions\/setup-node@v4/);
assert.match(ciWorkflow, /node-version: 22/);
assert.match(ciWorkflow, /shivammathur\/setup-php@v2/);
assert.match(ciWorkflow, /php-version: "8\.4"/);
assert.match(ciWorkflow, /npm ci/);
assert.match(ciWorkflow, /npm test/);
assert.match(ciWorkflow, /npm run lint/);
assert.match(ciWorkflow, /npm run lint:template/);
assert.match(ciWorkflow, /npm run verify:compat/);
assert.match(ciWorkflow, /npm run verify:preview/);
assert.match(ciWorkflow, /npm run package/);
assert.match(ciWorkflow, /npm run verify:release/);
assert.match(ciWorkflow, /actions\/upload-artifact@v4/);
assert.match(ciWorkflow, /name: pingfangvideo-theme[\s\S]*path: dist\/pingfangvideo\.tar\.gz/);
assert.match(ciWorkflow, /name: pingfangdevice-addon[\s\S]*path: dist\/pingfangdevice\.tar\.gz/);
assert.match(ciWorkflow, /name: vodops-addon[\s\S]*path: dist\/vodops\.tar\.gz/);
assert.match(ciWorkflow, /name: pingfangplayer-player[\s\S]*path: dist\/pingfangplayer-player\.tar\.gz/);
assert.match(ciWorkflow, /name: pingfanggames-server[\s\S]*path: dist\/pingfanggames-server\.tar\.gz/);

const deviceAddonInfo = readAddonFile("info.ini");
assert.match(deviceAddonInfo, /name = pingfangdevice/);
assert.match(deviceAddonInfo, /state = 1/);

const deviceAddonConfig = readAddonFile("config.php");
assert.match(deviceAddonConfig, /max_devices/);
assert.match(deviceAddonConfig, /'value'\s*=>\s*'3'/);
assert.match(deviceAddonConfig, /pfv_device_token/);
assert.match(deviceAddonConfig, /session_lifetime_days/);
assert.match(deviceAddonConfig, /game_ticket_secret/);
assert.match(deviceAddonConfig, /game_websocket_path/);

const deviceAddonHook = readAddonFile("Pingfangdevice.php");
assert.match(deviceAddonHook, /namespace addons\\pingfangdevice/);

const vodopsController = readFileSync(path.join(vodopsAddonRoot, "application/admin/controller/Vodops.php"), "utf8");
assert.match(vodopsController, /class Vodops extends Base/);
assert.match(vodopsController, /admin\/view_new/);
const vodopsHook = readFileSync(path.join(vodopsAddonRoot, "Vodops.php"), "utf8");
assert.doesNotMatch(vodopsHook, /responseEnd|runTrafficChunk/);
const vodopsView = readFileSync(path.join(vodopsAddonRoot, "application/admin/view_new/vodops/index.html"), "utf8");
assert.match(vodopsView, /X-CSRF-Token/);
assert.match(vodopsView, /不会自动修复、删除、合并或优化/);
assert.match(vodopsView, /id="vodopsScopeTypeId"/);
assert.match(vodopsView, /id="vodopsWorkerMode"/);
assert.match(vodopsView, /worker_mode/);
assert.match(vodopsView, /scope_label/);
assert.match(vodopsView, /runner_state_label/);
assert.match(vodopsView, /确认修改并复检/);
assert.match(vodopsView, /vodops\/rollbackRepair/);
assert.match(vodopsView, /workspace/);
assert.match(vodopsView, /addons\/vodops\/view\/index\/index/);
assert.match(vodopsView, /addons\/vodops\/view\/videos\/index/);
const vodLibrary = readFileSync(path.join(vodopsAddonRoot, "service/VodLibrary.php"), "utf8");
assert.match(vodLibrary, /v\.vod_id,v\.vod_name,v\.vod_status[\s\S]*?v\.vod_play_from/);
assert.doesNotMatch(vodLibrary, /->field\(["']\*["']\)|->count\(\)/);
const vodLibraryView = readFileSync(path.join(vodopsAddonRoot, "view/videos/index.html"), "utf8");
assert.match(vodLibraryView, /data-vod-library/);
assert.match(vodLibraryView, /history\.pushState/);
assert.match(vodLibraryView, /AI_CONCURRENCY = 2/);
assert.doesNotMatch(vodLibraryView, /location\.reload/);
const doubanBridge = readFileSync(path.join(vodopsAddonRoot, "application/admin/controller/Douban.php"), "utf8");
assert.match(doubanBridge, /addons\\vodops\\backend\\DoubanController/);
assert.doesNotMatch(doubanBridge, /->route\(/);
const doubanBackend = readFileSync(path.join(vodopsAddonRoot, "backend/DoubanController.php"), "utf8");
assert.match(doubanBackend, /namespace addons\\vodops\\backend/);
assert.match(doubanBackend, /class DoubanController extends Base/);
assert.match(doubanBackend, /public function startAudit\(\)/);
assert.match(doubanBackend, /public function calibrateByType\(\)/);
assert.match(doubanBackend, /redirect\(url\('vodops\/douban'/);
assert.doesNotMatch(doubanBackend, /fetch\(['"]index\/index/);
assert.doesNotMatch(doubanBackend, /view_path/);
const doubanData = readFileSync(path.join(vodopsAddonRoot, "service/DoubanData.php"), "utf8");
assert.match(doubanData, /namespace addons\\vodops\\service/);
assert.match(doubanData, /MATCH_DOUBAN_ID/);
assert.match(doubanData, /SYNC_DOUBAN/);
assert.match(doubanData, /CALIBRATE_SCORE/);
assert.match(doubanData, /conditionalVodUpdate/);
const doubanView = readFileSync(path.join(vodopsAddonRoot, "view/index/index.html"), "utf8");
assert.match(doubanView, /豆瓣匹配与同步/);
assert.doesNotMatch(doubanView, /<!doctype|<html|<body|豆瓣匹配工作台/i);
assert.doesNotMatch(doubanView, /url\('douban\/index'/);
assert.match(doubanView, /X-CSRF-Token/);
assert.match(doubanView, /\.douban-workspace \.system-box/);
assert.match(doubanView, /@keyframes douban-status-pulse/);
const integratedSql = readFileSync(path.join(vodopsAddonRoot, "install.sql"), "utf8");
for (const table of ["douban_config", "douban_vod_meta", "douban_task", "douban_log", "douban_review_candidate", "douban_scan", "douban_scan_issue"]) {
  assert.match(integratedSql, new RegExp("CREATE TABLE IF NOT EXISTS `__PREFIX__" + table + "`"));
}
const vodopsWorker = readFileSync(path.join(vodopsAddonRoot, "bin/vodops-worker.php"), "utf8");
assert.match(vodopsWorker, /App::initCommon/);
assert.match(vodopsWorker, /ensureScheduledScan/);
assert.match(vodopsWorker, /runWorker/);
const vodopsConfig = readFileSync(path.join(vodopsAddonRoot, "config.php"), "utf8");
assert.match(vodopsConfig, /scheduled_scan_hours/);
assert.match(vodopsConfig, /scheduled_scope_type_id/);
assert.match(vodopsConfig, /scheduled_batch_size/);
assert.match(deviceAddonHook, /extends Addons/);
assert.match(deviceAddonHook, /public function appBegin/);
assert.match(deviceAddonHook, /DeviceSession::syncActiveCookie/);

const deviceApplicationController = readAddonFile("application/index/controller/Pingfangdevice.php");
assert.match(deviceApplicationController, /namespace app\\index\\controller/);
assert.match(deviceApplicationController, /class Pingfangdevice extends Base/);
assert.match(deviceApplicationController, /use DeviceActions/);
assert.match(deviceApplicationController, /DeviceSession::listSessions/);
assert.match(deviceApplicationController, /DeviceSession::maxDeviceCount/);
assert.doesNotMatch(deviceApplicationController, /public function login\(\)/);

const deviceActions = readAddonFile("controller/DeviceActions.php");
assert.match(deviceActions, /trait DeviceActions/);
assert.match(deviceActions, /DeviceSession::registerLogin/);
assert.match(deviceActions, /DeviceSession::revokeSession/);
assert.match(deviceActions, /DeviceSession::logoutCurrentDevice/);
assert.match(deviceActions, /\$param \+= \['verify' => '', 'openid' => '', 'col' => ''\]/);
assert.match(deviceActions, /isPost\(\) \|\| !Request\(\)->isAjax\(\)/);
assert.match(deviceActions, /VodFilterOptions::filters\(input\(\)\)/);
assert.match(deviceActions, /public function filters\(\)/);
assert.match(deviceActions, /public function gameTicket\(\)/);
assert.match(deviceActions, /GameAccessTicket::issue\(\$user, \$game, \$clientId\)/);

const deviceAddonController = readAddonFile("controller/Index.php");
assert.match(deviceAddonController, /use DeviceActions/);
assert.match(deviceAddonController, /DeviceSession::listSessions/);
assert.match(deviceAddonController, /DeviceSession::maxDeviceCount/);
assert.match(deviceAddonController, /addon_url\('pingfangdevice\/index\/index'\)/);
assert.doesNotMatch(deviceAddonController, /public function login\(\)/);

const deviceSessionService = readAddonFile("service/DeviceSession.php");
assert.match(deviceSessionService, /const DEFAULT_MAX_DEVICES = 3/);
assert.match(deviceSessionService, /const TOKEN_COOKIE = 'pfv_device_token'/);
assert.match(deviceSessionService, /const MAX_DEVICES_LIMIT = 20/);
assert.match(deviceSessionService, /const DEFAULT_SESSION_LIFETIME_DAYS = 30/);
assert.match(deviceSessionService, /public static function registerLogin/);
assert.match(deviceSessionService, /public static function syncActiveCookie/);
assert.match(deviceSessionService, /public static function enforceDeviceLimit/);
assert.match(deviceSessionService, /public static function revokeSession/);
assert.match(deviceSessionService, /hash_equals/);
assert.match(deviceSessionService, /syncCookie\('user_check'/);
assert.match(deviceSessionService, /revoked_reason' => 'device_limit'/);
assert.match(deviceSessionService, /revoked_reason' => 'session_expired'/);
assert.match(deviceSessionService, /Db::startTrans\(\)/);
assert.match(deviceSessionService, /device_token_cookie/);
assert.match(deviceSessionService, /htmlspecialchars/);
assert.match(deviceSessionService, /last_seen_time/);

const vodFilterOptionsService = readAddonFile("service/VodFilterOptions.php");
assert.match(vodFilterOptionsService, /class VodFilterOptions/);
assert.match(vodFilterOptionsService, /const VOD_TABLE = 'vod'/);
assert.match(vodFilterOptionsService, /public static function filters\(array \$input\)/);
assert.match(vodFilterOptionsService, /const CACHE_VERSION = 'v6'/);
assert.match(vodFilterOptionsService, /const MAX_OPTIONS = 1000/);
assert.match(vodFilterOptionsService, /responseParams/);
assert.match(vodFilterOptionsService, /'area' => 'vod_area'/);
assert.match(vodFilterOptionsService, /'year' => 'vod_year'/);
assert.match(vodFilterOptionsService, /'lang' => 'vod_lang'/);
assert.match(vodFilterOptionsService, /Db::name\(self::VOD_TABLE\)/);
assert.match(vodFilterOptionsService, /distinct\(true\)/);
assert.match(vodFilterOptionsService, /configuredPriority/);
assert.match(vodFilterOptionsService, /namedOptions/);
assert.match(vodFilterOptionsService, /labelsForRawValue/);
assert.match(vodFilterOptionsService, /aliasQuery/);
assert.match(vodFilterOptionsService, /vod_extend_/);
assert.match(vodFilterOptionsService, /field\(\$field \. ' as value'\)/);
assert.doesNotMatch(vodFilterOptionsService, /where\('vod_status', 1\)|count\(\*\) as total|typeScope|withoutDimension/);
assert.match(vodFilterOptionsService, /isValidYearValue/);
assert.match(vodFilterOptionsService, /preg_match\('\/\^\[0-9\]\{4\}\$\/'/);
assert.match(vodFilterOptionsService, /array_slice\(\$options, 0, \$limit\)/);
assert.doesNotMatch(vodFilterOptionsService, /where\(\$field, 'regexp'/);
assert.match(vodFilterOptionsService, /date\('Y'\)/);

const deviceAddonSql = readAddonFile("install.sql");
assert.match(deviceAddonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_device_session`/);
assert.match(deviceAddonSql, /`token_hash` char\(64\) NOT NULL/);
assert.match(deviceAddonSql, /`login_check_hash` char\(64\) NOT NULL/);
assert.match(deviceAddonSql, /information_schema\.COLUMNS/);
assert.match(deviceAddonSql, /PREPARE pingfang_login_check_hash_stmt/);
assert.match(deviceAddonSql, /UNIQUE KEY `uniq_token_hash`/);
assert.match(deviceAddonSql, /KEY `idx_user_active`/);
assert.doesNotMatch(deviceAddonSql, /DROP\s+TABLE/i);

const deviceAddonView = readAddonFile("view/index/index.html");
assert.match(deviceAddonView, /登录设备管理/);
assert.match(deviceAddonView, /当前设备/);
assert.match(deviceAddonView, /最近登录时间/);
assert.match(deviceAddonView, /踢下线/);
assert.match(deviceAddonView, /data-device-revoke/);
assert.match(deviceAddonView, /\{\$max_devices\}/);
assert.match(deviceAddonView, /device_label_display/);
assert.match(deviceAddonView, /"X-Requested-With": "XMLHttpRequest"/);

const categoryMaintenanceSql = readFileSync(path.join(root, "scripts/sql/maccms-vod-category-maintenance.sql"), "utf8");
assert.match(categoryMaintenanceSql, /MacCMS V10 vod category maintenance/i);
assert.match(categoryMaintenanceSql, /SELECT type_id, type_pid, type_name/);
assert.match(categoryMaintenanceSql, /START TRANSACTION/);
assert.match(categoryMaintenanceSql, /UPDATE mac_vod v\s+JOIN mac_type t ON v\.type_id = t\.type_id/);
assert.match(categoryMaintenanceSql, /SET v\.type_id_1 = CASE/);
assert.match(categoryMaintenanceSql, /COALESCE\(v\.type_id_1, 0\)/);
assert.match(categoryMaintenanceSql, /ROLLBACK/);
assert.match(categoryMaintenanceSql, /COMMIT/);
assert.doesNotMatch(categoryMaintenanceSql, /DROP\s+TABLE/i);
assert.doesNotMatch(categoryMaintenanceSql, /TRUNCATE/i);

const categoryMaintenanceDoc = readFileSync(path.join(root, "docs/maccms-vod-category-maintenance.md"), "utf8");
assert.match(categoryMaintenanceDoc, /mac_vod/);
assert.match(categoryMaintenanceDoc, /type_id_1/);
assert.match(categoryMaintenanceDoc, /mysqldump/);
assert.match(categoryMaintenanceDoc, /scripts\/sql\/maccms-vod-category-maintenance\.sql/);

const templateLinter = readFileSync(path.join(root, "scripts/lint-template.mjs"), "utf8");
assert.match(templateLinter, /maccms:vod/);
assert.match(templateLinter, /include file/);
assert.match(templateLinter, /forbiddenProductionPatterns/);
assert.match(templateLinter, /assertSafeAssetReference/);
assert.match(templateLinter, /value\.startsWith\("\{:url\("\)/);
assert.match(templateLinter, /preview\\\/data\\\.json/);
assert.match(templateLinter, /localhost/);
assert.match(templateLinter, /public\/digg\.html/);
assert.match(templateLinter, /public\/score\.html/);
assert.match(templateLinter, /public\/star\.html/);
assert.match(templateLinter, /maccms\.path without a trailing slash/);
assert.match(templateLinter, /Template lint passed/);

const compatVerifier = readFileSync(path.join(root, "scripts/verify-compat.mjs"), "utf8");
assert.match(compatVerifier, /requiredThemeDirs/);
assert.match(compatVerifier, /html\/label\/comics\.html/);
assert.match(compatVerifier, /html\/label\/qixi\.html/);
assert.match(compatVerifier, /html\/comment\/index\.html/);
assert.match(compatVerifier, /html\/comment\/ajax\.html/);
assert.match(compatVerifier, /html\/rss\/rss\.html/);
assert.match(compatVerifier, /html\/book\/index\.html/);
assert.match(compatVerifier, /html\/book\/report\.html/);
assert.match(compatVerifier, /html\/vod\/copyright\.html/);
assert.match(compatVerifier, /html\/vod\/player\.html/);
assert.match(compatVerifier, /html\/vod\/down\.html/);
assert.match(compatVerifier, /html\/vod\/detail_pwd\.html/);
assert.match(compatVerifier, /html\/vod\/plot\.html/);
assert.match(compatVerifier, /href="#"/);
assert.match(compatVerifier, /javascript:history/);
assert.match(compatVerifier, /Compatibility verification passed/);

const previewVerifier = readFileSync(path.join(root, "scripts/verify-preview.mjs"), "utf8");
assert.match(previewVerifier, /php/);
assert.match(previewVerifier, /route=videos/);
assert.match(previewVerifier, /route=comics/);
assert.match(previewVerifier, /route=articles/);
assert.match(previewVerifier, /route=player/);
assert.match(previewVerifier, /route=down/);
assert.match(previewVerifier, /route=copyright/);
assert.match(previewVerifier, /route=gbook/);
assert.match(previewVerifier, /route=book/);
assert.match(previewVerifier, /route=report/);
assert.match(previewVerifier, /width="300" height="450"/);
assert.match(previewVerifier, /preload="metadata" playsinline/);
assert.match(previewVerifier, /id="episodeList"/);
assert.match(previewVerifier, /完整播放/);
assert.match(previewVerifier, /player-shell[\s\S]*player-toolbar/);
assert.match(previewVerifier, /Preview verification passed/);

const releaseVerifier = readFileSync(path.join(root, "scripts/verify-release.mjs"), "utf8");
assert.match(releaseVerifier, /pingfangvideo\.tar\.gz/);
assert.match(releaseVerifier, /pingfangdevice\.tar\.gz/);
assert.match(releaseVerifier, /vodops\.tar\.gz/);
assert.match(releaseVerifier, /html\/public\/include\.html/);
assert.match(releaseVerifier, /html\/comment\/index\.html/);
assert.match(releaseVerifier, /html\/rss\/rss\.html/);
assert.match(releaseVerifier, /html\/vod\/play\.html/);
assert.match(releaseVerifier, /html\/vod\/detail_pwd\.html/);
assert.match(releaseVerifier, /html\/vod\/plot\.html/);
assert.match(releaseVerifier, /No hidden dotfiles/);
assert.match(releaseVerifier, /maccms\\\['path'\\\]/);
assert.match(releaseVerifier, /htmlEntries/);
assert.match(releaseVerifier, /forbiddenProductionPatterns/);
assert.match(releaseVerifier, /assertSafeAssetReference/);
assert.match(releaseVerifier, /preview\\\/data\\\.json/);
assert.match(releaseVerifier, /assetVersionPlaceholders/);
assert.match(releaseVerifier, /assetVersionPattern/);
assert.match(releaseVerifier, /html\/label\/qixi\.html/);
assert.match(releaseVerifier, /js\/qixi-particle-rose\.js/);
assert.match(releaseVerifier, /js\/qixi-particle-bouquet\.js/);
assert.match(releaseVerifier, /css\/qixi-bouquet\.css/);
assert.match(releaseVerifier, /__PINGFANG_QIXI_VERSION__/);
assert.match(releaseVerifier, /requiredAddonEntries/);
assert.match(releaseVerifier, /requiredVodopsEntries/);
assert.match(releaseVerifier, /vodops\/application\/admin\/view_new\/vodops\/index\.html/);
assert.match(releaseVerifier, /vodops\/application\/admin\/controller\/Douban\.php/);
assert.match(releaseVerifier, /vodops\/service\/DoubanData\.php/);
assert.match(releaseVerifier, /Douban must be packaged inside vodops/);
assert.match(releaseVerifier, /scope_json/);
assert.match(releaseVerifier, /pingfangdevice\/service\/VodFilterOptions\.php/);
assert.match(releaseVerifier, /pingfangdevice\/service\/GameAccessTicket\.php/);
assert.match(releaseVerifier, /excludedEntries/);
assert.doesNotMatch(releaseVerifier, /react\.production|pingfang-player|rank-react|pingfangvideo\/js\/hls\.min/);
assert.match(releaseVerifier, /pingfang_device_session/);
assert.match(releaseVerifier, /LIBARCHIVE\\\.xattr/);
assert.equal((releaseVerifier.match(/\.split\(\/\\r\?\\n\/\)/g) || []).length, 3);

const preview = readFileSync(path.join(root, "preview/index.html"), "utf8");
const qixiPreview = readFileSync(path.join(root, "preview/qixi.html"), "utf8");
assert.match(qixiPreview, /class="qixi-rose-page" data-qixi-rose/);
assert.doesNotMatch(qixiPreview, /data-qixi-model|qixi-rose-model/);
assert.match(qixiPreview, /template\/pingfangvideo\/css\/style\.css/);
assert.match(qixiPreview, /type="module" src="\.\.\/template\/pingfangvideo\/js\/qixi-particle-bouquet\.js"/);
assert.match(qixiPreview, /href="\.\.\/template\/pingfangvideo\/css\/qixi-bouquet\.css"/);
assert.doesNotMatch(qixiPreview, /src="[^"]*qixi-particle-rose\.js/);
assert.match(qixiPreview, /3D Flower Bouquet by/);
assert.match(qixiPreview, /粉色与蓝色星光粒子从下向上聚成3D玫瑰花束/);
assert.match(qixiPreview, /viewport-fit=cover/);
assert.match(qixiPreview, /meta name="theme-color" content="#100611"/);
assert.doesNotMatch(qixiPreview, /qixi-rose-gesture|拖动花束，让玫瑰随你转身/);
assert.doesNotMatch(preview, /\bskip-link\b/);
assert.doesNotMatch(preview, /class="site-footer"/);
assert.doesNotMatch(preview, /让每一次打开/);
assert.doesNotMatch(preview, /href="#"/);
assert.match(preview, /class="filter-options letter-options"/);
assert.match(preview, /class="filter-row"[\s\S]*class="filter-options"/);
assert.match(preview, /css\/style\.css\?v=/);
assert.match(preview, new RegExp(`css/style\\.css\\?v=${styleVersionPlaceholder}`));
assert.doesNotMatch(preview, /css\/style\.css\?v=20260626"/);
assert.doesNotMatch(preview, /css\/style\.css\?v=20260621/);
assert.match(preview, /js\/app\.js\?v=/);
assert.match(preview, /js\/canvas-confetti\.min\.js\?v=1\.9\.4[\s\S]*js\/app\.js/);
assert.doesNotMatch(preview, /https?:\/\/[^"']*canvas-confetti/);
assert.match(preview, /data-home-gsap-src="\.\.\/template\/pingfangvideo\/js\/gsap\.min\.js\?v=3\.15\.0"/);
assert.doesNotMatch(preview, /<script src="\.\.\/template\/pingfangvideo\/js\/gsap\.min\.js/);
assert.doesNotMatch(preview, /js\/react\.production\.min\.js\?v=18\.3\.1/);
assert.doesNotMatch(preview, /js\/react-dom\.production\.min\.js\?v=18\.3\.1/);
assert.doesNotMatch(preview, /js\/rank-react\.js/);
assert.match(preview, new RegExp(`js/app\\.js\\?v=${appVersionPlaceholder}`));
assert.doesNotMatch(preview, /js\/app\.js\?v=20260621/);
assert.match(preview, /sizes="\(max-width: 560px\) 46vw, \(max-width: 920px\) 30vw, 180px"/);
assert.match(preview, /class="rank-thumb"[\s\S]*sizes="72px"/);
assert.match(preview, /class="rank-score"/);
assert.match(preview, /data-banner-bg="\$\{escapeHtml\(backdrop\)\}"/);
assert.doesNotMatch(preview, /bannerBgStyle/);
assert.doesNotMatch(preview, /banner-poster/);
assert.match(preview, /sizes="96px"/);
assert.doesNotMatch(preview, /v=20260615/);
assert.doesNotMatch(preview, /v=20260618/);
assert.doesNotMatch(preview, /style\.css\?v=20260619/);
assert.doesNotMatch(preview, /style\.css\?v=20260620/);
assert.match(preview, /data-page-jump/);
assert.match(preview, /page: "__PAGE__"/);
assert.match(preview, /page-jump-input/);
assert.match(preview, /preview\/data\.json/);
assert.match(preview, /data-route="detail"/);
assert.match(preview, /data-route="play"/);
assert.doesNotMatch(preview, /data-player-fullscreen/);
assert.doesNotMatch(preview, /横屏全屏/);
assert.doesNotMatch(preview, /initPlayerFullscreen/);
assert.match(preview, /aria-controls="mobileDrawer"/);
assert.match(preview, /class="theme-switcher" data-theme-switcher/);
assert.match(preview, /class="theme-switcher-menu" id="themeSwitcherMenu" data-theme-switcher-menu hidden/);
assert.match(preview, /class="mobile-drawer-section mobile-theme-section" data-theme-switcher-mobile/);
assert.match(preview, /class="brand-logo"[^>]*width="58"[^>]*height="58"[^>]*decoding="async"/);
assert.match(preview, /<nav class="site-nav" id="siteNav" aria-label="主导航">/);
assert.match(preview, /data-theme-switcher-trigger aria-expanded="false" aria-controls="themeSwitcherMenu"/);
assert.match(preview, /class="theme-switcher-menu" id="themeSwitcherMenu" data-theme-switcher-menu hidden/);
assert.doesNotMatch(preview, /aria-haspopup=/);
assert.equal((preview.match(/data-theme-option="default"/g) || []).length, 2);
assert.equal((preview.match(/data-theme-option="blue-pink-purple"/g) || []).length, 2);
assert.equal((preview.match(/data-theme-option="poster-magazine"/g) || []).length, 2);
assert.equal((preview.match(/data-theme-option="dunhuang-caisson"/g) || []).length, 2);
assert.equal((preview.match(/data-theme-option="digital-particles"/g) || []).length, 2);
assert.equal((preview.match(/data-theme-option="pixel-frog"/g) || []).length, 2);
assert.match(preview, /class="mobile-drawer-backdrop" data-mobile-nav-close hidden/);
assert.match(preview, /<aside class="mobile-drawer" id="mobileDrawer" role="dialog" aria-modal="true" aria-labelledby="mobileDrawerTitle" aria-hidden="true" inert>/);
assert.match(preview, /class="mobile-drawer-section mobile-drawer-account"/);
assert.match(preview, /<span>账号<\/span>/);
assert.match(preview, /class="mobile-drawer-login" href="\?route=login" data-route="login">登录<\/a>/);
assert.match(preview, /<form class="mobile-drawer-search" role="search">/);
assert.match(preview, /id="previewMobileSearch" type="search" name="wd"/);
const previewStaticDrawerLinks = preview.match(/<nav class="mobile-drawer-links"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(previewStaticDrawerLinks), ["首页", "视频", "游戏"]);
assert.match(previewStaticDrawerLinks, /data-route="games" data-nav-section="games">游戏<\/a>/);
assert.doesNotMatch(previewStaticDrawerLinks, /qixi|七夕花束/);
assert.doesNotMatch(previewStaticDrawerLinks, />漫画<\/a>|>文章<\/a>/);
assert.match(preview, /id="mobileDrawerCats"/);
assert.match(preview, /function renderMobileDrawerCategories/);
assert.match(preview, /mobileDrawerCats\.innerHTML = store\.categories\.slice\(0, 12\)\.map/);
assert.match(preview, /filter-panel/);
assert.match(preview, /search-filter-panel/);
assert.match(preview, /channel-search/);
assert.match(preview, /filter-search-row/);
assert.match(preview, /selectedClass/);
assert.match(preview, /searchClassOptions/);
assert.match(preview, /type: selectedType, class: item/);
assert.match(preview, /data-empty-container data-empty-item="\.vod-card"/);
assert.match(preview, /data-empty-container data-empty-item="\.list-item"/);
assert.match(preview, /PingFangVideo\?\.markCurrentNav\?\.\(\)/);
assert.match(preview, /PingFangVideo\?\.syncActiveSelectionSemantics\?\.\(app\)/);
assert.doesNotMatch(preview, /<strong>子类<\/strong>/);
assert.doesNotMatch(preview, /data-search-type-filter/);
assert.doesNotMatch(preview, /data-search-type-section/);
assert.doesNotMatch(preview, /data-category-search/);
assert.doesNotMatch(preview, /data-category-search-input/);
assert.match(preview, /hero-carousel/);
assert.doesNotMatch(preview, /class="wrap quick-types"/);
assert.doesNotMatch(preview, /store\.categories\.slice\(0, 10\)/);
assert.match(preview, /banner-dots/);
assert.match(preview, /data-carousel-autoplay-toggle/);
assert.doesNotMatch(preview, /liquid-lens/);
assert.doesNotMatch(preview, /hero-stats/);
assert.doesNotMatch(preview, /片库内容/);
assert.doesNotMatch(preview, /hot-search-panel|热搜榜/);
assert.match(preview, /data-rank-react-root/);
assert.doesNotMatch(preview, /data-rank-visible-count/);
assert.match(preview, /data-rank-react-list/);
assert.match(preview, /data-rank-item/);
assert.match(preview, /currentYearVideos = store\.videos\.filter/);
assert.match(preview, /<h1 class="sr-only">平方影视首页<\/h1>/);
assert.match(preview, /rankVideos = sortVideos\(\[\.\.\.currentYearVideos\], "hot"\)\.slice\(0, 5\)/);
assert.match(preview, /class="rank-heading"><small>TOP 05<\/small><h2>年度热度榜<\/h2>/);
assert.doesNotMatch(preview, /shuffleVideos/);
assert.doesNotMatch(preview, /is-rank-extra/);
assert.match(preview, /class="rank-refresh" href="\$\{url\("category", \{ sort: "hot" \}\)\}">查看更多<\/a>/);
assert.doesNotMatch(preview, /换一换/);
assert.doesNotMatch(preview, /PingFangRankReact/);
assert.doesNotMatch(preview, /id="hotSearchPanel"/);
assert.doesNotMatch(preview, /renderHeaderHotSearch/);
assert.match(preview, /url\("category", \{ sort: "hot" \}\)/);
assert.match(preview, /score-badge/);
assert.match(preview, /card-meta/);
assert.match(preview, /function homeShelfCard\(video, featured = false\)/);
assert.match(preview, /title="\$\{escapeHtml\(video\.title\)\}"/);
assert.match(preview, /const image = featured \? \(video\.backdrop \|\| video\.poster\) : video\.poster/);
assert.match(preview, /width="300" height="450"/);
assert.match(preview, /function homeShelfTabs\(tabs\)/);
assert.match(preview, /genreDockItems/);
assert.match(preview, /class="wrap genre-dock" aria-label="频道快捷入口"/);
assert.match(preview, /class="shelf-title"><small>NEW THIS YEAR<\/small><h2>本年最新上线<\/h2>/);
assert.match(preview, /home-shelf home-shelf-latest/);
assert.doesNotMatch(preview, /home-shelf home-shelf-hot/);
assert.match(preview, /aria-label="最新分类"/);
assert.match(preview, /<button type="button" data-home-tab="\$\{escapeHtml\(tab\.key\)\}" role="tab" aria-selected="\$\{tab\.isActive \? "true" : "false"\}" aria-controls="latest-panel-\$\{escapeHtml\(tab\.key\)\}" tabindex="\$\{tab\.isActive \? "0" : "-1"\}"/);
assert.doesNotMatch(preview, /href="#home-latest-/);
assert.match(preview, /home-shelf-rail"\s+data-home-tab="\$\{escapeHtml\(tab\.key\)\}"\s+id="latest-panel-\$\{escapeHtml\(tab\.key\)\}"\s+role="tabpanel"\s+aria-hidden="\$\{tab\.isActive \? "false" : "true"\}"\$\{tab\.isActive \? "" : " hidden"\}/);
assert.doesNotMatch(preview, /homeShelfCard\(video, true\)/);
assert.match(preview, /latestTabs\.map\(\(tab\) => homeShelfPanel\(tab\)\)\.join\(""\)/);
assert.doesNotMatch(preview, /<div class="vod-grid">\$\{latest\.map\(card\)\.join\(""\)\}<\/div>/);
const previewCardFunction = preview.match(/function card\(video\) \{[\s\S]*?function rankItem/)?.[0] || "";
assert.doesNotMatch(previewCardFunction, /<small>\$\{escapeHtml\(video\.actor\)\}<\/small>/);
assert.match(preview, /detail-panel/);
assert.match(preview, /class="detail-backdrop" aria-hidden="true"><img src="\$\{escapeHtml\(video\.poster\)\}" alt="">/);
assert.match(preview, /site-logo\.png/);
assert.match(preview, /class="brand-emblem"/);
assert.match(preview, /class="brand-wordmark"/);
assert.doesNotMatch(preview, /brand-text/);
assert.match(preview, /route === "categories"/);
assert.match(preview, /route === "videos"/);
assert.match(preview, /route === "comics"/);
assert.match(preview, /route === "articles"/);
assert.match(preview, /route === "games"/);
assert.match(preview, /route === "history"/);
assert.match(preview, /route === "login"/);
assert.match(preview, /function renderPlay\(id, episodeNo\)/);
assert.match(preview, /<video controls preload="metadata" playsinline/);
assert.match(preview, /id="episodeList" aria-label="选集列表"/);
assert.match(preview, /aria-current="\$\{item\.no === episode\.no \? "page" : "false"\}"/);
assert.match(preview, /if \(next\.hash && next\.pathname === window\.location\.pathname && next\.search === window\.location\.search\) return/);
assert.match(preview, /function renderLoginPage/);
const previewLoginFunction = preview.match(/function renderLoginPage\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.match(previewLoginFunction, /class="login-page"/);
assert.match(previewLoginFunction, /class="login-panel verify-form"/);
assert.match(previewLoginFunction, /data-login-glass/);
assert.match(previewLoginFunction, /login-glass-highlight/);
assert.match(previewLoginFunction, /login-edge-glow/);
assert.match(previewLoginFunction, /class="login-pixel-pass" aria-hidden="true"/);
assert.match(previewLoginFunction, /login-field-icon login-icon-user/);
assert.match(previewLoginFunction, /login-field-icon login-icon-lock/);
assert.match(previewLoginFunction, /login-field-icon login-icon-shield/);
assert.match(previewLoginFunction, /login-icon-eye/);
assert.match(previewLoginFunction, /login-icon-refresh/);
assert.match(previewLoginFunction, /欢迎回来/);
assert.match(previewLoginFunction, /data-password-toggle/);
assert.match(previewLoginFunction, /login-captcha-preview/);
assert.match(preview, /initLoginControls\?\.\(app\)/);
assert.match(preview, /initLoginGlass\?\.\(app\)/);
assert.match(preview, /function renderGamesPage/);
assert.match(preview, /function renderGame2048Page/);
assert.match(preview, /function renderGameBlockrainPage/);
assert.match(preview, /function previewMemberEnabled/);
assert.match(preview, /member=1/);
assert.match(preview, /登录后开启游戏大厅/);
assert.match(preview, /data-game-authenticated/);
assert.match(preview, /data-blockrain-game/);
assert.match(preview, /function renderComicsPage/);
assert.match(preview, /function renderArticlesPage/);
assert.match(preview, /store\.categories\.map\(\(category\) =>/);
assert.doesNotMatch(preview, /function renderVideoNavCategories/);
assert.doesNotMatch(preview, /nav-video-panel/);
assert.doesNotMatch(preview, /nav-video-trigger/);
const previewRenderNavFunction = preview.match(/function renderNav\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(previewRenderNavFunction), ["首页", "视频", "游戏"]);
assert.match(previewRenderNavFunction, /href="\$\{url\("home"\)\}" data-route="home" data-nav-section="home">首页/);
assert.match(previewRenderNavFunction, /href="\$\{url\("categories"\)\}" data-route="categories" data-nav-section="videos">视频/);
assert.match(previewRenderNavFunction, /href="\$\{url\("games"\)\}" data-route="games" data-nav-section="games">游戏/);
assert.doesNotMatch(previewRenderNavFunction, /qixi|七夕花束/);
assert.doesNotMatch(previewRenderNavFunction, /data-route="comics"|data-route="articles"/);
assert.doesNotMatch(previewRenderNavFunction, /data-route="categories">分类/);
assert.match(preview, /<a href="\?route=categories" data-route="categories" data-nav-section="videos">视频<\/a>/);
assert.match(preview, /category-index/);
assert.match(preview, /<a class="category-hit" href="\$\{url\("category", \{ name: category \}\)\}" data-route="category"/);
assert.match(preview, /aria-label="进入\$\{escapeHtml\(category\)\}"/);
assert.match(preview, /sortUrl\(category, "latest"\)/);
assert.match(preview, /sortUrl\(category, "hot"\)/);
assert.match(preview, /function renderCategory\(name, sort = "latest", area = "", year = "", genre = "", page = 1, lang = "", letter = "", routeName = "category"\)/);
assert.match(preview, /return url\(routeName, params\)/);
assert.match(preview, /renderPagination\(routeName, pageParams/);
assert.match(preview, /sortUrl\(category, "score"\)/);
assert.match(preview, /filterVideos\(name, area, year, genre, lang, letter\)/);
assert.match(preview, /filterUrl\(\{ area: item \}\)/);
assert.match(preview, /filterUrl\(\{ year: item \}\)/);
assert.doesNotMatch(preview, /filterUrl\(\{ class: item \}\)/);
assert.match(preview, /filterUrl\(\{ lang: item \}\)/);
assert.match(preview, /filterUrl\(\{ letter: item \}\)/);
assert.match(preview, /const letters = \["A", "B", "C", "D", "E", "F"/);
assert.match(preview, /"M", "N", "O", "P"/);
assert.match(preview, /"X", "Y", "Z", "0~9"\]/);
assert.match(preview, /const categoryPageSize = 12/);
assert.match(preview, /function renderPagination/);
assert.match(preview, /renderPagination\("categories"/);
assert.match(preview, /sortVideos\(filterVideos\(name, area, year, genre, lang, letter\), currentSort\)/);
assert.match(preview, /history-timeline/);
assert.match(preview, /timeline-item/);
assert.doesNotMatch(preview, /renderNav\(\)[\s\S]{0,180}store\.categories\.slice/);

const previewData = JSON.parse(readFileSync(path.join(root, "preview/data.json"), "utf8"));
assert.ok(Array.isArray(previewData.videos), "preview data should include videos");
assert.ok(previewData.videos.length >= 6, "preview data should include enough videos");
assert.ok(previewData.videos.every((video) => video.id && video.title && video.category && video.episodes?.length), "preview videos should be navigable");
assert.ok(previewData.videos.every((video) => typeof video.score === "number"), "preview videos should include scores");
assert.ok(previewData.videos.every((video) => video.area && video.year && video.class && video.lang && video.letter), "preview videos should include filter metadata");
assert.ok(Array.isArray(previewData.history), "preview data should include history");
assert.ok(previewData.history.length >= 4, "preview history should include timeline entries");
assert.ok(previewData.history.every((entry) => entry.videoId && entry.watchedAt && entry.progress), "preview history should include usable timeline metadata");

const phpEntry = readFileSync(path.join(root, "server/index.php"), "utf8");
assert.match(phpEntry, /declare\(strict_types=1\)/);
assert.match(phpEntry, /render_page/);
assert.match(phpEntry, /PHP_VERSION_ID/);

const phpRender = readFileSync(path.join(root, "server/lib/render.php"), "utf8");
assert.doesNotMatch(phpRender, /\bskip-link\b/);
assert.doesNotMatch(phpRender, /class="site-footer"/);
assert.doesNotMatch(phpRender, /让每一次打开/);
assert.match(phpRender, /\$route === 'login'/);
assert.match(phpRender, /class="login-page"/);
assert.match(phpRender, /class="login-panel verify-form"/);
assert.match(phpRender, /data-login-glass/);
assert.match(phpRender, /login-glass-highlight/);
assert.match(phpRender, /login-edge-glow/);
assert.match(phpRender, /class="login-pixel-pass" aria-hidden="true"/);
assert.match(phpRender, /login-field-icon login-icon-user/);
assert.match(phpRender, /login-field-icon login-icon-lock/);
assert.match(phpRender, /login-field-icon login-icon-shield/);
assert.match(phpRender, /login-icon-eye/);
assert.match(phpRender, /login-icon-refresh/);
assert.doesNotMatch(phpRender, /hero-stats/);
assert.doesNotMatch(phpRender, /片库内容/);
assert.doesNotMatch(phpRender, /hot-search-panel|热搜榜|render_hot_search_panel/);
assert.match(phpRender, /path_for\('categories'\)/);
assert.match(phpRender, /path_for\('videos'\)/);
assert.match(phpRender, /\$route === 'videos'/);
assert.match(phpRender, /\$route === 'comics'/);
assert.match(phpRender, /\$route === 'articles'/);
assert.match(phpRender, /\$route === 'games'/);
assert.match(phpRender, /游戏大厅/);
assert.match(phpRender, /preview_member_enabled/);
assert.match(phpRender, /render_game_login_gate/);
assert.match(phpRender, /\$route === 'game-2048'/);
assert.match(phpRender, /\$route === 'game-blockrain'/);
assert.match(phpRender, /\$route === 'game-bamboo-cicada'/);
assert.match(phpRender, /data-game-authenticated/);
assert.match(phpRender, /漫画入口/);
assert.match(phpRender, /文章入口/);
assert.doesNotMatch(phpRender, /\$navVideoCategories = implode/);
assert.doesNotMatch(phpRender, /class="nav-video-menu"/);
assert.doesNotMatch(phpRender, /class="nav-video-trigger"/);
assert.doesNotMatch(phpRender, /class="nav-video-panel"/);
const phpNavSnippet = phpRender.match(/\$nav = [\s\S]*?\$drawerCategories = implode/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(phpNavSnippet), ["首页", "视频", "游戏"]);
assert.match(phpNavSnippet, /path_for\('categories'\)[\s\S]*>视频<\/a>/);
assert.match(phpNavSnippet, /path_for\('games'\)[\s\S]*data-nav-section="games">游戏<\/a>/);
assert.doesNotMatch(phpNavSnippet, /qixi|七夕花束/);
assert.match(phpNavSnippet, /data-nav-section="home"/);
assert.match(phpNavSnippet, /data-nav-section="videos"/);
assert.doesNotMatch(phpNavSnippet, />漫画<\/a>|>文章<\/a>/);
assert.doesNotMatch(phpNavSnippet, />分类<\/a>/);
const phpMobileDrawerLinksSnippet = phpRender.match(/<nav class="mobile-drawer-links"[\s\S]*?<\/nav>/)?.[0] || "";
assert.deepEqual(extractAnchorTexts(phpMobileDrawerLinksSnippet), ["首页", "视频", "游戏"]);
assert.match(phpMobileDrawerLinksSnippet, /path_for\('categories'\)[\s\S]*>视频<\/a>/);
assert.doesNotMatch(phpMobileDrawerLinksSnippet, /path_for\('videos'\)[\s\S]*>视频<\/a>/);
assert.match(phpMobileDrawerLinksSnippet, /path_for\('games'\)[\s\S]*>游戏<\/a>/);
assert.doesNotMatch(phpMobileDrawerLinksSnippet, /qixi|七夕花束/);
assert.doesNotMatch(phpMobileDrawerLinksSnippet, />漫画<\/a>|>文章<\/a>/);
assert.match(phpRender, /class="theme-switcher" data-theme-switcher/);
assert.match(phpRender, /class="brand-logo"[^>]*width="58"[^>]*height="58"[^>]*decoding="async"/);
assert.match(phpRender, /<nav class="site-nav" aria-label="主导航">/);
assert.match(phpRender, /data-theme-switcher-trigger aria-expanded="false" aria-controls="themeSwitcherMenu"/);
assert.match(phpRender, /class="theme-switcher-menu" id="themeSwitcherMenu" data-theme-switcher-menu hidden/);
assert.doesNotMatch(phpRender, /aria-haspopup=/);
assert.match(phpRender, /class="mobile-drawer-section mobile-theme-section" data-theme-switcher-mobile/);
assert.equal((phpRender.match(/data-theme-option="default"/g) || []).length, 2);
assert.equal((phpRender.match(/data-theme-option="blue-pink-purple"/g) || []).length, 2);
assert.equal((phpRender.match(/data-theme-option="poster-magazine"/g) || []).length, 2);
assert.equal((phpRender.match(/data-theme-option="dunhuang-caisson"/g) || []).length, 2);
assert.equal((phpRender.match(/data-theme-option="digital-particles"/g) || []).length, 2);
assert.equal((phpRender.match(/data-theme-option="pixel-frog"/g) || []).length, 2);
assert.match(phpRender, /path_for\('category', \['sort' => 'hot'\]\)/);
assert.match(phpRender, /<h1 class="sr-only">' \. e\(\$data\['siteName'\]\) \. '首页<\/h1>/);
assert.match(phpRender, /hero-carousel/);
assert.match(phpRender, /data-home-gsap-src="\/template\/pingfangvideo\/js\/gsap\.min\.js\?v=3\.15\.0"/);
assert.match(phpRender, /js\/canvas-confetti\.min\.js\?v=1\.9\.4[\s\S]*js\/app\.js/);
assert.doesNotMatch(phpRender, /https?:\/\/[^"']*canvas-confetti/);
assert.doesNotMatch(phpRender, /<script src="\/template\/pingfangvideo\/js\/gsap\.min\.js/);
assert.match(phpRender, /banner-dots/);
assert.match(phpRender, /data-carousel-autoplay-toggle/);
assert.doesNotMatch(phpRender, /liquid-lens/);
assert.match(phpRender, /score-badge/);
assert.match(phpRender, /function render_home_shelf_card\(array \$video, bool \$featured = false\): string/);
assert.match(phpRender, /title="' \. e\(\$video\['title'\]\) \. '"/);
assert.match(phpRender, /\$image = \$featured \? \(\$video\['backdrop'\] \?\? \$video\['poster'\]\) : \$video\['poster'\]/);
assert.match(phpRender, /width="300" height="450"/);
assert.match(phpRender, /\$homeTabs = \[/);
assert.match(phpRender, /\$tabRails \.= render_home_latest_panel\(\$tab\['key'\], \$tab\['videos'\], \$index === 0\)/);
assert.match(phpRender, /\$tabLinks \.= '<button type="button" data-home-tab="' \. e\(\$tab\['key'\]\)/);
assert.match(phpRender, /tabindex="' \. \$tabIndexValue \. '"/);
assert.doesNotMatch(phpRender, /href="#home-latest-/);
assert.match(phpRender, /\$currentYear = date\('Y'\)/);
assert.match(phpRender, /\$currentYearVideos = filter_videos\(\$data, null, null, null, \$currentYear\)/);
assert.match(phpRender, /\$latestShelf = '<section class="wrap home-shelf home-shelf-latest" aria-label="本年最新上线">[\s\S]*<span class="shelf-title"><small>NEW THIS YEAR<\/small><h2>本年最新上线<\/h2><\/span>' \. \$tabLinks \. '<a class="home-shelf-more" href="' \. e\(path_for\('category'\)\) \. '">全部影片<\/a>/);
assert.match(phpRender, /class="wrap home-shelf home-continue" data-home-continue hidden/);
assert.match(phpRender, /data-home-empty-container data-empty-item="\.home-shelf-card"/);
assert.match(phpRender, /\$genreDock = '<nav class="wrap genre-dock" aria-label="频道快捷入口"/);
assert.match(phpRender, /class="rank-heading"><small>TOP 05<\/small><h2>年度热度榜<\/h2>/);
assert.match(phpRender, /array_slice\(sort_videos\(filter_videos\(\$currentYearData, \$category\), 'latest'\), 0, 6\)/);
assert.match(phpRender, /detail-panel/);
assert.match(phpRender, /class="detail-backdrop" aria-hidden="true"><img src="/);
const phpRenderCardsFunction = phpRender.match(/function render_cards\(array \$videos\): string[\s\S]*?function hero_slides/)?.[0] || "";
assert.doesNotMatch(phpRenderCardsFunction, /<small>' \. e\(\$video\['actor'\]\) \. '<\/small>/);
assert.match(phpRender, /site-logo\.png/);
assert.match(phpRender, /images\/brand\/favicon\.ico/);
assert.match(phpRender, /images\/brand\/favicon\.png/);
assert.match(phpRender, /class="brand-emblem"/);
assert.match(phpRender, /class="brand-wordmark"/);
assert.doesNotMatch(phpRender, /brand-text/);
assert.match(phpRender, /mobile-drawer/);
assert.match(phpRender, /mobile-drawer-backdrop/);
assert.match(phpRender, /mobile-drawer-account/);
assert.match(phpRender, /mobile-drawer-login/);
assert.match(phpRender, /class="mobile-drawer-search" method="get" action="\/index\.php" role="search"/);
assert.match(phpRender, /id="phpMobileSearch" type="search" name="wd"/);
assert.match(phpRender, /path_for\('login'\)/);
assert.match(phpRender, /\$drawerCategories = implode/);
assert.match(phpRender, /array_slice\(\$data\['categories'\], 0, 12\)/);
assert.match(phpRender, /search-filter-panel/);
assert.match(phpRender, /channel-search/);
assert.match(phpRender, /filter-search-row/);
assert.match(phpRender, /id="phpCategorySearch"/);
assert.match(phpRender, /<div class="filter-row"><strong>类型<\/strong><div class="filter-options">/);
assert.match(phpRender, /data-empty-container data-empty-item="\.vod-card"/);
assert.match(phpRender, /data-empty-container data-empty-item="\.list-item"/);
assert.match(phpRender, /class="content-empty-state" data-empty-state hidden role="status"/);
assert.match(phpRender, /\$searchClasses/);
assert.match(phpRender, /\$classFilterLinks/);
assert.match(phpRender, /path_for\('search', \['wd' => \$keyword, 'type' => \$type, 'class' => \$item\]\)/);
assert.doesNotMatch(phpRender, /<strong>子类<\/strong>/);
assert.doesNotMatch(phpRender, /data-search-type-filter/);
assert.doesNotMatch(phpRender, /data-search-type-section/);
assert.doesNotMatch(phpRender, /data-category-search/);
assert.doesNotMatch(phpRender, /data-category-search-input/);
assert.match(phpRender, /route === 'categories'/);
assert.match(phpRender, /route === 'history'/);
assert.match(phpRender, /route === 'player'/);
assert.match(phpRender, /function render_player_preview\(array \$data, array \$video, array \$episode, string \$eyebrow, bool \$trial = false\): string/);
assert.match(phpRender, /preload="metadata" playsinline/);
assert.match(phpRender, /id="episodeList" aria-label="选集列表"/);
assert.match(phpRender, /aria-current="page"/);
assert.match(phpRender, /完整播放/);
assert.match(phpRender, /route === 'down'/);
assert.match(phpRender, /route === 'copyright'/);
assert.doesNotMatch(phpRender, /data-player-fullscreen/);
assert.doesNotMatch(phpRender, /横屏全屏/);
assert.match(phpRender, /route === 'gbook'/);
assert.match(phpRender, /route === 'book'/);
assert.match(phpRender, /route === 'report'/);
assert.match(phpRender, /category-index/);
assert.match(phpRender, /<a class="category-hit" href="/);
assert.match(phpRender, /aria-label="进入' \. e\(\$category\) \. '"/);
assert.match(phpRender, /\$categoryPageSize = 12/);
assert.match(phpRender, /render_pagination\('categories'/);
assert.match(phpRender, /data-page-jump/);
assert.match(phpRender, /page-jump-input/);
assert.match(phpRender, /page-jump-submit/);
assert.match(phpRender, /\$area = \(string\) \(\$query\['area'\] \?\? ''\)/);
assert.match(phpRender, /\$year = \(string\) \(\$query\['year'\] \?\? ''\)/);
assert.match(phpRender, /\$class = \(string\) \(\$query\['class'\] \?\? ''\)/);
assert.match(phpRender, /\$lang = \(string\) \(\$query\['lang'\] \?\? ''\)/);
assert.match(phpRender, /\$letter = \(string\) \(\$query\['letter'\] \?\? ''\)/);
assert.match(phpRender, /\$letters = \['A', 'B', 'C', 'D', 'E', 'F'/);
assert.match(phpRender, /'M', 'N', 'O', 'P'/);
assert.match(phpRender, /'X', 'Y', 'Z', '0~9'\]/);
assert.match(phpRender, /sort_videos\(filter_videos\(\$data, \$name !== '' \? \$name : null, null, \$area, \$year, \$class, \$lang, \$letter\), \$sort\)/);
assert.match(phpRender, /'sort' => 'latest'/);
assert.match(phpRender, /'sort' => 'hot'/);
assert.match(phpRender, /'sort' => 'score'/);
assert.match(phpRender, /'area' => \$area/);
assert.match(phpRender, /'year' => \$year/);
assert.match(phpRender, /'class' => \$class/);
assert.match(phpRender, /'lang' => \$lang/);
assert.match(phpRender, /'letter' => \$letter/);
assert.match(phpRender, /history-timeline/);
assert.match(phpRender, /download-list/);
assert.match(phpRender, /copyright-box/);
assert.match(phpRender, /gbook_content/);
assert.doesNotMatch(phpRender, /array_slice\(\$data\['categories'\], 0, 6\)/);

const appJs = readThemeFile("js/app.js");
assert.match(appJs, /document\.querySelector\("\.mobile-drawer"\)/);
assert.match(appJs, /document\.querySelector\("\.mobile-drawer-backdrop"\)/);
assert.match(appJs, /mobile-nav-open/);
assert.match(appJs, /drawer\.inert = !isOpen/);
assert.match(appJs, /function setPageInert\(isInert\)/);
assert.match(appJs, /function trapDrawerFocus\(event\)/);
assert.match(appJs, /event\.key !== "Tab"/);
assert.match(appJs, /aria-controls", "mobileDrawer"/);
assert.match(appJs, /\[data-mobile-nav-close\]/);
assert.match(appJs, /drawer\.classList\.toggle\("is-open", isOpen\)/);
assert.match(appJs, /backdrop\.hidden = false/);
assert.match(appJs, /backdrop\.classList\.remove\("is-visible"\)/);
assert.match(appJs, /backdrop\.addEventListener\("transitionend", finishBackdropClose\)/);
assert.doesNotMatch(appJs, /backdrop\.hidden = !isOpen/);
assert.match(appJs, /window\.matchMedia\("\(min-width: 1181px\)"\)/);
assert.match(appJs, /\.site-nav a\[data-nav-section\], \.mobile-drawer-links a\[data-nav-section\]/);
assert.match(appJs, /function currentNavSection\(\)/);
assert.match(appJs, /data-nav-section/);
assert.match(appJs, /game-2048/);
assert.match(appJs, /game-blockrain/);
assert.match(appJs, /game-bamboo-cicada/);
assert.match(appJs, /if \(route === "qixi"\) return "qixi"/);
assert.match(appJs, /\\\/label\\\/qixi/);
assert.doesNotMatch(appJs, /var fallback = links\[0\]/);
assert.match(appJs, /window\.PingFangVideo\.markCurrentNav = markCurrentNav/);
assert.match(appJs, /function hasMemberSession\(\)/);
assert.match(appJs, /MAC\.Cookie\.Get\("user_id"\)/);
assert.match(appJs, /document\.querySelectorAll\("\[data-auth-member\]"\)/);
assert.match(appJs, /document\.querySelectorAll\("\[data-auth-guest\]"\)/);
assert.match(appJs, /document\.querySelectorAll\("\[data-auth-script\]"\)/);
assert.match(appJs, /script\.async = false/);
assert.match(appJs, /initLoginForms/);
assert.match(appJs, /data-login-form/);
assert.match(appJs, /function initLoginControls/);
assert.match(appJs, /function initLoginGlass/);
assert.match(appJs, /IntersectionObserver/);
assert.match(appJs, /requestAnimationFrame/);
assert.match(appJs, /\(hover: hover\) and \(pointer: fine\)/);
assert.match(appJs, /window\.addEventListener\("pointermove", trackPointer, \{ passive: true \}\)/);
assert.match(appJs, /document\.documentElement\.addEventListener\("pointerleave", hideHighlight\)/);
assert.match(appJs, /event\.pointerType && event\.pointerType !== "mouse"/);
assert.match(appJs, /pointerPosition\.x\s*-\s*bounds\.left\s*-\s*panel\.clientLeft\s*-\s*(?:\(\s*)?highlightSize\s*\/\s*2(?:\s*\))?/);
assert.match(appJs, /pointerPosition\.y\s*-\s*bounds\.top\s*-\s*panel\.clientTop\s*-\s*(?:\(\s*)?highlightSize\s*\/\s*2(?:\s*\))?/);
assert.doesNotMatch(appJs, /panel\.addEventListener\("pointerleave"/);
assert.doesNotMatch(appJs, /highlight\.style\.removeProperty\("transform"\)/);
assert.match(appJs, /data-password-toggle/);
assert.match(appJs, /data-verify-refresh/);
assert.match(appJs, /fetch\(form\.action/);
assert.match(appJs, /new FormData\(form\)/);
assert.match(appJs, /X-Requested-With/);
assert.match(appJs, /showSiteNotice/);
assert.match(appJs, /window\.PingFangVideo\.initLoginGlass = initLoginGlass/);
assert.match(appJs, /initSearchForms/);
assert.match(appJs, /input\.setCustomValidity\("请输入搜索内容"\)/);
assert.match(appJs, /input\.reportValidity\(\)/);
assert.match(appJs, /if \(form\.closest\("\.mobile-drawer"\)\) \{\s*setNavOpen\(false\);/);
assert.doesNotMatch(appJs, /search[\s\S]{0,180}setTimeout/);
assert.doesNotMatch(appJs, /initPlayerFullscreen/);
assert.doesNotMatch(appJs, /data-player-fullscreen/);
assert.doesNotMatch(appJs, /requestFullscreen/);
assert.doesNotMatch(appJs, /webkitEnterFullscreen/);
assert.doesNotMatch(appJs, /screen\.orientation\.lock\("landscape"\)/);
assert.match(appJs, /function syncBannerAutoplay\(\)/);
assert.match(appJs, /iridescenceObserver = new IntersectionObserver/);
assert.match(appJs, /autoplay\.pause\(\)/);
assert.match(appJs, /autoplay\.resume\(\)/);
assert.match(appJs, /document\.addEventListener\("visibilitychange", syncBannerAutoplay\)/);
assert.match(appJs, /var carouselInViewport = !\("IntersectionObserver" in window\)/);
assert.match(appJs, /var autoplayToggle = carousel\.querySelector\("\[data-carousel-autoplay-toggle\]"\)/);
assert.match(appJs, /var userPaused = prefersReducedMotion\(\)/);
assert.match(appJs, /function syncAutoplayControl\(\)/);
assert.match(appJs, /var controlMap = \{\};/);
assert.match(appJs, /control\.id = control\.id \|\| "latest-tab-" \+ tabIndex/);
assert.match(appJs, /panel\.setAttribute\("aria-labelledby", control\.id\)/);
assert.match(appJs, /userPaused \|\| !carouselInViewport/);
assert.match(appJs, /carouselAutoplayObserver = new IntersectionObserver/);
assert.match(appJs, /document\.hidden \|\| prefersReducedMotion\(\) \|\| carouselHasFocus \|\| userPaused \|\| !carouselInViewport/);
assert.match(appJs, /activate\(nextIndex, false\)/);
assert.match(appJs, /setThemeSwitcherOpen\(switcher, false, true\)/);
assert.match(style, /\.mobile-drawer\.is-animating\s*\{[\s\S]*?will-change: transform/);
assert.doesNotMatch(extractCssRule(style, ".mobile-drawer"), /will-change/);
assert.doesNotMatch(style, /\.liquid-lens/);
assert.doesNotMatch(bannerBgBeforeRule, /will-change/);
assert.match(appJs, /window\.location\.href = redirect/);
assert.match(appJs, /initFavoriteButtons/);
assert.match(appJs, /data-favorite-action/);
assert.match(appJs, /pingfang_favorite_/);
assert.match(appJs, /is-favorited/);
assert.match(appJs, /收藏成功/);
assert.match(appJs, /getFavoriteLabel\(button\)\.textContent = "收藏中…"/);
assert.match(appJs, /pendingFavoriteTimer = window\.setTimeout\(function \(\) \{\s*failFavorite\(button, "收藏请求超时，请稍后重试"\);\s*\}, 10000\)/);
assert.doesNotMatch(appJs, /\}, 1600\)/);
assert.match(appJs, /clearFavoriteCache/);
assert.match(appJs, /ajaxSuccess/);
assert.match(appJs, /initPageJumpForms/);
assert.match(appJs, /data-page-jump/);
assert.match(appJs, /data-page-template/);
assert.match(appJs, /__PAGE__/);
assert.match(appJs, /window\.location\.href = target/);
assert.match(appJs, /button\[data-home-tab\]/);
assert.match(appJs, /aria-selected", isActive \? "true" : "false"/);
assert.match(appJs, /searchParams\.get\("latest"\)/);
assert.match(appJs, /searchParams\.set\("latest", target\)/);
assert.match(appJs, /nextUrl\.hash/);
assert.doesNotMatch(appJs, /window\.location\.pathname \+ window\.location\.search\)/);
assert.match(appJs, /function initHomeEmptyStates/);
assert.match(appJs, /\[data-home-empty-container\], \[data-empty-container\]/);
assert.match(appJs, /\[data-home-empty-state\], \[data-empty-state\]/);
assert.match(appJs, /function syncActiveSelectionSemantics\(root\)/);
assert.match(appJs, /window\.PingFangVideo\.syncActiveSelectionSemantics = syncActiveSelectionSemantics/);
assert.match(appJs, /function initHomeContinueWatching/);
assert.match(appJs, /MAC\.Cookie\.Get\("user_id"\)/);
assert.match(appJs, /MAC\.Ulog\.Get\.length >= 6/);
assert.match(appJs, /MAC\.Ulog\.Get\(1, 0, 4, 1, 12, handleResponse\)/);
assert.match(appJs, /MAC\.Ulog\.Get\(4, 1, 12, handleResponse\)/);
assert.doesNotMatch(appJs, /MAC\.Ulog\.Get\(4, 1, 12, function/);
assert.match(appJs, /function initAutoNextPlayback/);
assert.match(appJs, /\[data-next-play-url\]/);
assert.match(appJs, /MacPlayer\.PlayLinkNext/);
assert.match(appJs, /addEventListener\(\s*"ended"/);
assert.match(appJs, /contentDocument/);
assert.match(appJs, /window\.top\.location\.href = nextUrl/);
assert.match(appJs, /function hasAlternatePlaybackLine/);
assert.match(appJs, /function switchToAlternatePlaybackLine/);
assert.match(appJs, /function consumeAlternatePlaybackResume/);
assert.match(appJs, /window\.PingFangVideo\.hasAlternatePlaybackLine = hasAlternatePlaybackLine/);
assert.match(appJs, /window\.PingFangVideo\.switchToAlternatePlaybackLine = switchToAlternatePlaybackLine/);
assert.match(appJs, /window\.PingFangVideo\.consumeAlternatePlaybackResume = consumeAlternatePlaybackResume/);
assert.match(appJs, /function initLogoutLinks/);
assert.match(appJs, /\[data-logout-link\]/);
assert.match(appJs, /data-logout-redirect/);
assert.match(appJs, /fetch\(logoutUrl,\s*\{\s*method: "POST"/);
assert.match(appJs, /X-Requested-With": "XMLHttpRequest"/);
assert.match(appJs, /queueSiteNotice\("已退出登录", "success"\)/);
assert.match(appJs, /window\.PingFangVideo\.initLogoutLinks = initLogoutLinks/);
assert.match(appJs, /initLogoutLinks\(document\)/);
assert.match(appJs, /initGsapMotion/);
assert.match(appJs, /function initHomeMotion/);
assert.match(appJs, /data-home-gsap-src/);
assert.match(appJs, /\(hover: hover\) and \(pointer: fine\) and \(min-width: 761px\)/);
assert.match(appJs, /homeMotionMedia\.addEventListener\("change", handleMotionMediaChange\)/);
assert.match(appJs, /function clearHomeMotion/);
assert.match(appJs, /window\.gsap/);
assert.match(appJs, /gsap\.matchMedia\(\)/);
assert.match(appJs, /prefers-reduced-motion: reduce/);
assert.match(appJs, /gsap\.timeline/);
assert.match(appJs, /initBannerIridescence/);
assert.match(appJs, /data-banner-iridescence/);
assert.match(appJs, /--banner-shine-x/);
assert.match(appJs, /--banner-shine-y/);
assert.match(appJs, /--banner-shine-rotate/);
assert.match(appJs, /--banner-shine-opacity/);
assert.match(appJs, /DeviceOrientationEvent/);
assert.match(appJs, /requestPermission/);
assert.match(appJs, /deviceorientation/);
assert.match(appJs, /repeat: -1/);
assert.doesNotMatch(appJs, /initRevealMotion/);
assert.doesNotMatch(appJs, /initLiquidLens|gsap\.quickTo/);
assert.match(appJs, /function initPageEntrance/);
assert.match(appJs, /function initSectionMotion/);
assert.match(appJs, /IntersectionObserver/);
assert.doesNotMatch(appJs, /data-gsap-reveal-ready/);
assert.doesNotMatch(appJs, /data-gsap-revealed/);
assert.match(appJs, /function initDynamicVodFilters/);
assert.match(appJs, /data-dynamic-vod-filters/);
assert.match(appJs, /data-filter-endpoint/);
assert.match(appJs, /data-filter-kind/);
assert.match(appJs, /data-filter-value/);
assert.match(appJs, /function dynamicFilterHref/);
assert.match(appJs, /function createDynamicFilterLink/);
assert.match(appJs, /function filterOptionIsActive/);
assert.match(appJs, /option\.query/);
assert.match(appJs, /option\.label/);
assert.match(appJs, /__PINGFANG_FILTER_VALUE__/);
assert.match(appJs, /limit: "1000"/);
const dynamicFilterHelperStart = appJs.indexOf("  function normalizeFilterOptions");
const dynamicFilterHelperEnd = appJs.indexOf("  function applyDynamicVodFilters", dynamicFilterHelperStart);
assert.ok(dynamicFilterHelperStart >= 0 && dynamicFilterHelperEnd > dynamicFilterHelperStart);
const dynamicFilterHelpers = new Function(
  `${appJs.slice(dynamicFilterHelperStart, dynamicFilterHelperEnd)}\nreturn { normalizeFilterOptions, dynamicFilterHref, filterOptionIsActive };`
)();
const normalizedDynamicOptions = dynamicFilterHelpers.normalizeFilterOptions([
  { value: "美国", label: "美国", query: "美国,USA" },
  { value: "美国", label: "重复项", query: "USA" }
]);
assert.deepEqual(normalizedDynamicOptions, [{ value: "美国", label: "美国", query: "美国,USA", total: 0 }]);
assert.equal(dynamicFilterHelpers.filterOptionIsActive(normalizedDynamicOptions[0], "USA"), true);
assert.equal(dynamicFilterHelpers.filterOptionIsActive(normalizedDynamicOptions[0], "美国,USA"), true);
assert.equal(dynamicFilterHelpers.filterOptionIsActive(normalizedDynamicOptions[0], "英国"), false);
const dynamicFilterRow = {
  getAttribute(name) {
    return name === "data-filter-href-template" ? "/vod/show/area/__PINGFANG_FILTER_VALUE__" : "";
  }
};
assert.equal(
  dynamicFilterHelpers.dynamicFilterHref(dynamicFilterRow, "美国,USA"),
  `/vod/show/area/${encodeURIComponent("美国,USA")}`
);
assert.match(appJs, /pingfangFilterReady/);
assert.match(appJs, /X-Requested-With/);
assert.match(appJs, /function initSourceQuality/);
assert.match(appJs, /data-source-quality-panel/);
assert.match(appJs, /method: "POST"/);
assert.match(appJs, /sourceQualityBody\.append\("vod_id"/);
assert.match(appJs, /sourceQualityBody\.append\("nid"/);
assert.match(appJs, /source\.sample_count/);
assert.match(appJs, /source\.tested_width/);
assert.match(appJs, /source\.max_width/);
assert.match(appJs, /清单声明/);
assert.match(appJs, /分辨率未知/);
assert.match(appJs, /function storeSourceQualityPreference/);
assert.match(appJs, /function reportPlaybackQoe/);
assert.match(appJs, /function rankPlaybackSourcesByQoe/);
assert.match(appJs, /function comparePlaybackQoe/);
assert.match(appJs, /pingfang_playback_qoe_v1_/);
assert.match(appJs, /pending_playback_switch_v1/);
assert.match(appJs, /window\.PingFangVideo\.reportPlaybackQoe = reportPlaybackQoe/);
assert.match(appJs, /window\.PingFangVideo\.rankPlaybackSourcesByQoe = rankPlaybackSourcesByQoe/);
assert.match(appJs, /episode\.addEventListener\("change"/);
assert.match(appJs, /runSourceQuality\(false\)/);
assert.match(appJs, /function autoSwitchToAlternatePlaybackLine/);
assert.match(appJs, /window\.PingFangVideo\.autoSwitchToAlternatePlaybackLine = autoSwitchToAlternatePlaybackLine/);
assert.match(appJs, /status === "timeout"/);
assert.match(appJs, /1 分钟内缓存结果/);
assert.match(appJs, /window\.PingFangVideo\.initSourceQuality = initSourceQuality/);
assert.match(appJs, /initSourceQuality\(document\)/);
assert.match(style, /\.source-quality-panel/);
assert.match(style, /\.source-quality-result\.is-available/);
assert.match(style, /\.source-quality-result\.is-failed/);
assert.match(style, /\.source-quality-result\.is-timeout/);
assert.match(style, /\.episode-box\.is-source-recommended/);
assert.match(style, /\.episode-grid a\.is-source-recommended/);
assert.doesNotMatch(appJs, /bindGsapHover|bindGsapPressFeedback/);
assert.match(appJs, /\.hero-slide\.is-active/);
assert.doesNotMatch(appJs, /revealBatchSize/);
assert.match(appJs, /observer\.unobserve/);
assert.match(appJs, /data-gsap-carousel/);
assert.match(appJs, /delete carousel\.dataset\.gsapCarousel/);
assert.match(appJs, /clearProps: "transform,opacity,visibility,willChange,zIndex"/);
assert.match(appJs, /function animateHeroSlide/);
assert.match(appJs, /onComplete: function \(\) \{\s*clearMotionStyles\(gsap, slides\);\s*\}/);
assert.match(appJs, /\.banner-copy strong/);
assert.doesNotMatch(appJs, /vod-card/);
assert.match(appJs, /\.hero-rank \.rank-item/);
assert.match(appJs, /\.genre-dock, \.home-shelf/);
assert.match(appJs, /PingFangVideo\.initGsapMotion/);
assert.doesNotMatch(appJs, /initSearchTypeFilters/);
assert.doesNotMatch(appJs, /data-search-type-filter/);
assert.doesNotMatch(appJs, /data-search-type-section/);
assert.doesNotMatch(appJs, /initCategorySearch/);
assert.doesNotMatch(appJs, /data-category-search-input/);
assert.doesNotMatch(appJs, /data-category-name/);
assert.match(appJs, /initHeroCarousel/);
assert.match(appJs, /data-carousel/);
assert.match(appJs, /function ensureCarouselDots\(carousel, slides\)/);
assert.match(appJs, /document\.createElement\("button"\)/);
assert.match(appJs, /function ensureHeroSlideBackground\(slide, priority\)/);
assert.match(appJs, /data-banner-bg/);
assert.match(appJs, /new window\.Image\(\)/);
assert.match(appJs, /image\s*\.decode\(\)/);
assert.match(appJs, /function scheduleHeroBackgroundPreload/);
assert.match(appJs, /requestIdleCallback/);
assert.match(appJs, /image\.onerror/);
assert.match(appJs, /has-missing-background/);
assert.match(appJs, /function initMediaFallbacks\(root\)/);
assert.match(appJs, /image\.hidden = true/);
assert.match(appJs, /PingFangVideo\.initMediaFallbacks/);
assert.match(appJs, /mediaFallbackReady/);
assert.match(style, /\.is-image-missing > img\s*\{[\s\S]*?display: none !important/);
assert.match(preview, /PingFangVideo\?\.initMediaFallbacks\?\.\(app\)/);
assert.match(appJs, /var carouselHasFocus = false/);
assert.match(appJs, /prefersReducedMotion\(\) \|\| carouselHasFocus/);
assert.match(appJs, /carousel\.addEventListener\("focusin", function \(\) \{[\s\S]*carouselHasFocus = true;[\s\S]*stop\(\)/);
assert.match(appJs, /carousel\.addEventListener\("focusout", function \(event\) \{[\s\S]*carouselHasFocus = false;[\s\S]*start\(\)/);
assert.match(appJs, /carousel\.addEventListener\(\s*"touchstart"/);
assert.match(appJs, /carousel\.addEventListener\(\s*"touchend"/);
assert.match(appJs, /Math\.abs\(deltaX\) > 44/);
assert.match(appJs, /document\.addEventListener\("visibilitychange"/);
assert.match(appJs, /initRandomAvatars/);
assert.match(appJs, /data-avatar-random/);
assert.match(appJs, /data-avatar-name/);
assert.match(appJs, /letter\.textContent = name\.slice\(0, 1\) \|\| "用"/);
assert.match(appJs, /--avatar-bg/);
assert.match(appJs, /fallbackHistoryUrl/);
assert.doesNotMatch(appJs, /javascript:;/);

function renderPreview(query) {
  const code = `
parse_str(${JSON.stringify(query)}, $_GET);
require "server/lib/data.php";
require "server/lib/render.php";
$data = load_data();
echo render_page($data, (string)($_GET["route"] ?? "home"), $_GET);
`;

  return execFileSync("php", ["-r", code], { encoding: "utf8" });
}

const videosPreview = renderPreview("route=videos");
const videosPreviewMain = videosPreview.match(/<main>[\s\S]*<\/main>/)?.[0] || "";
assert.match(videosPreview, /<title>影片库 - 平方影视<\/title>/);
assert.match(videosPreview, /<h1>影片库<\/h1>/);
assert.match(videosPreview, /\/index\.php\?route=videos[^"]*sort=hot/);
assert.doesNotMatch(videosPreview, /<title>全部影片 - 平方影视<\/title>/);
assert.doesNotMatch(videosPreview, /<h1>全部影片<\/h1>/);
assert.doesNotMatch(videosPreviewMain, /\/index\.php\?route=category(?:&amp;|")/);

const categoryIndexPreview = renderPreview("route=category");
assert.match(categoryIndexPreview, /<title>影片库 - 平方影视<\/title>/);
assert.match(categoryIndexPreview, /<h1>影片库<\/h1>/);
assert.doesNotMatch(categoryIndexPreview, /<title>全部影片 - 平方影视<\/title>/);
assert.doesNotMatch(categoryIndexPreview, /<h1>全部影片<\/h1>/);

const areaFiltered = renderPreview("route=category&area=中国香港");
assert.match(areaFiltered, /午夜档案/);
assert.doesNotMatch(areaFiltered, /云端回声/);

const yearFiltered = renderPreview("route=category&year=2025");
assert.match(yearFiltered, /南城旧事/);
assert.doesNotMatch(yearFiltered, /云端回声/);

const classFiltered = renderPreview("route=category&class=悬疑");
assert.match(classFiltered, /午夜档案/);
assert.doesNotMatch(classFiltered, /远山计划/);

const langFiltered = renderPreview("route=category&lang=粤语");
assert.match(langFiltered, /午夜档案/);
assert.doesNotMatch(langFiltered, /云端回声/);

const letterFiltered = renderPreview("route=category&letter=Y");
assert.match(letterFiltered, /云端回声/);
assert.match(letterFiltered, /远山计划/);
assert.doesNotMatch(letterFiltered, /暮色航线/);

const letterMFiltered = renderPreview("route=category&letter=M");
assert.match(letterMFiltered, /暮色航线/);
assert.doesNotMatch(letterMFiltered, /云端回声/);

const emptyCategoryPreview = renderPreview("route=category&year=1900");
assert.match(emptyCategoryPreview, /data-empty-container data-empty-item="\.vod-card"/);
assert.match(emptyCategoryPreview, /class="content-empty-state" data-empty-state hidden role="status"/);
assert.match(emptyCategoryPreview, /暂无符合条件的影片/);
assert.doesNotMatch(emptyCategoryPreview, /<div><strong>地区<\/strong>/);

const emptySearchPreview = renderPreview("route=search&wd=不存在的影片关键词");
assert.match(emptySearchPreview, /data-empty-container data-empty-item="\.list-item"/);
assert.match(emptySearchPreview, /没有找到相关影片/);

const homePreview = renderPreview("route=home");
const homeShelfImage = homePreview.match(/<span class="home-shelf-poster"><img[^>]+>/)?.[0] || "";
assert.match(homeShelfImage, /\/seed\/pfv\d+\/360\/540/);
assert.doesNotMatch(homeShelfImage, /wide\/1280\/720/);
assert.match(homeShelfImage, /width="300" height="450"/);
assert.match(homePreview, /class="wrap genre-dock" aria-label="频道快捷入口"/);
assert.doesNotMatch(homePreview, /liquid-lens/);
assert.match(homePreview, /data-carousel-autoplay-toggle/);
assert.match(homePreview, /NEW THIS YEAR/);
assert.match(homePreview, /本年最新上线/);
const yearlyHomeContent = homePreview.slice(homePreview.indexOf("data-rank-react-list"), homePreview.indexOf("</main>"));
assert.doesNotMatch(yearlyHomeContent, /南城旧事/);
assert.match(homePreview, /role="tab" aria-selected="true" aria-controls="latest-panel-all" tabindex="0" class="is-active"/);
assert.match(homePreview, /role="tab" aria-selected="false" aria-controls="latest-panel-category-1" tabindex="-1"/);

const playPreview = renderPreview("route=play&id=2&episode=2");
assert.ok(playPreview.indexOf('class="player-shell"') < playPreview.indexOf('class="player-toolbar"'), "PHP play preview should render the player before controls");
assert.match(playPreview, /class="player-shell" role="region" aria-label="视频播放器"/);
assert.match(playPreview, /<video controls preload="metadata" playsinline/);
assert.match(playPreview, /rel="prev">上一集<\/a>/);
assert.match(playPreview, /href="#episodeList">选集<\/a>/);
assert.match(playPreview, /rel="next">下一集<\/a>/);
assert.match(playPreview, /id="episodeList" aria-label="选集列表"/);
assert.match(playPreview, /class="is-active" aria-current="page"[^>]*>第2集<\/a>/);

const firstEpisodePreview = renderPreview("route=play&id=2&episode=1");
assert.doesNotMatch(firstEpisodePreview, /rel="prev">上一集<\/a>/);
assert.match(firstEpisodePreview, /rel="next">下一集<\/a>/);

const lastEpisodePreview = renderPreview("route=play&id=2&episode=3");
assert.match(lastEpisodePreview, /rel="prev">上一集<\/a>/);
assert.doesNotMatch(lastEpisodePreview, /rel="next">下一集<\/a>/);

const trialPreview = renderPreview("route=player&id=2&episode=2");
assert.ok(trialPreview.indexOf('class="player-shell"') < trialPreview.indexOf('class="player-toolbar"'), "PHP trial preview should render the player before controls");
assert.match(trialPreview, /class="player-shell" role="region" aria-label="试看播放器"/);
assert.match(trialPreview, />完整播放<\/a>/);
assert.doesNotMatch(trialPreview, /id="episodeList"/);
