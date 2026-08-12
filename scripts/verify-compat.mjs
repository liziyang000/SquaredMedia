import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const themeName = "pingfangvideo";
const themeRoot = path.join(root, "template", themeName);
const htmlRoot = path.join(themeRoot, "html");

const requiredThemeDirs = [
  "ads",
  "css",
  "games",
  "games/2048",
  "games/2048/js",
  "games/blockrain",
  "images",
  "images/qixi",
  "js",
  "js/third-party",
  "js/third-party/three",
  "html",
  "html/public",
  "html/index",
  "html/label",
  "html/pingfangdevice",
  "html/map",
  "html/rss",
  "html/topic",
  "html/art",
  "html/plot",
  "html/actor",
  "html/role",
  "html/website",
  "html/user",
  "html/comment",
  "html/gbook",
  "html/book",
  "html/vod",
];

const requiredThemeFiles = [
  "info.ini",
  "css/style.css",
  "games/2048/LICENSE.txt",
  "games/2048/js/application.js",
  "games/2048/js/game_manager.js",
  "games/blockrain/Copyright",
  "games/blockrain/LICENSE.txt",
  "games/blockrain/blockrain.jquery.min.js",
  "games/bamboo-cicada.js",
  "games/README.md",
  "games/init.js",
  "js/gsap.min.js",
  "js/app.js",
  "js/multiplayer-games.js",
  "js/qixi-particle-rose.js",
  "js/third-party/three/three.module.min.js",
  "js/third-party/three/three.core.min.js",
  "js/third-party/three/GLTFLoader.js",
  "js/third-party/three/MeshSurfaceSampler.js",
  "js/third-party/three/BufferGeometryUtils.js",
  "js/third-party/three/LICENSE.txt",
  "images/qixi/qixi-bouquet.glb",
  "images/qixi/LICENSE.md",
  "images/site-logo.png",
  "html/public/include.html",
  "html/public/head.html",
  "html/public/foot.html",
  "html/public/paging.html",
  "html/public/jump.html",
  "html/public/msg.html",
  "html/public/verify.html",
  "html/public/vod_card.html",
  "html/public/vod_filter_common.html",
  "html/public/vod_grid_results.html",
  "html/public/digg.html",
  "html/public/score.html",
  "html/public/star.html",
  "html/comment/index.html",
  "html/comment/ajax.html",
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
  "html/gbook/index.html",
  "html/book/index.html",
  "html/book/report.html",
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

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function readThemeFile(file) {
  return readFileSync(path.join(themeRoot, file), "utf8");
}

assert.ok(existsSync(themeRoot), `template/${themeName} should exist`);

for (const dir of requiredThemeDirs) {
  assert.ok(existsSync(path.join(themeRoot, dir)), `${dir} should exist for MacCMS structure compatibility`);
}

for (const file of requiredThemeFiles) {
  assert.ok(existsSync(path.join(themeRoot, file)), `${file} should exist for MacCMS route compatibility`);
}

const include = readThemeFile("html/public/include.html");
assert.match(include, /\{\$maccms\.path\}static\/js\/jquery\.js/);
assert.match(include, /\{\$maccms\.path\}static\/js\/home\.js/);
assert.match(include, /var maccms=/);

const head = readThemeFile("html/public/head.html");
assert.match(head, /\[seo_title\]/);
assert.match(head, /\[seo_keywords\]/);
assert.match(head, /\[seo_description\]/);

const foot = readThemeFile("html/public/foot.html");
assert.doesNotMatch(foot, /class="site-footer"/);
assert.doesNotMatch(foot, /mac_url\('map\/google'\)/);
assert.doesNotMatch(foot, /mac_url\('map\/rss'\)/);
assert.doesNotMatch(foot, /mac_url\('gbook\/index'\)/);
assert.match(foot, /class="mac_timming"/);
assert.match(foot, /js\/app\.js\?v=__PINGFANG_APP_VERSION__/);

for (const filePath of walk(htmlRoot).filter((file) => file.endsWith(".html"))) {
  const content = readFileSync(filePath, "utf8");
  const file = path.relative(themeRoot, filePath).replaceAll(path.sep, "/");

  assert.doesNotMatch(content, /href="#"/, `${file} should not contain dead href="#" links`);
  assert.doesNotMatch(content, /javascript:history/, `${file} should not depend on javascript:history navigation`);
  assert.doesNotMatch(content, /__ROOT__/, `${file} should use MacCMS runtime path variables`);
  assert.doesNotMatch(content, /by="'\.\$param\['by'\]\.'"/, `${file} should not pass raw sort params into MacCMS tags`);
}

console.log("Compatibility verification passed");
