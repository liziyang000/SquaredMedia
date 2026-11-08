import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const theme = "template/pingfangvideo/";
const include = readFileSync(theme + "html/public/include.html", "utf8");
const foot = readFileSync(theme + "html/public/foot.html", "utf8");
const scriptMode = (source, synchronous) => source.replace(
  /\{if condition="!isset\(\$pingfang_sync_core_scripts\)"\}([\s\S]*?)\{\/if\}/g,
  synchronous ? "" : "$1"
);
for (const synchronous of [false, true]) {
  const markup = scriptMode(include + foot, synchronous);
  const scripts = [...markup.matchAll(/<script\b([^>]*?)\bsrc="([^"]+)"[^>]*>/g)];
  assert.deepEqual(scripts.map((match) => match[2].split("?")[0].split("/").at(-1)), ["jquery.js", "home.js", "app.js"]);
  for (const script of scripts) {
    assert.equal(/\bdefer\b/.test(script[1]), !synchronous, "core scripts must preserve ordered loading and the player escape hatch");
    assert.doesNotMatch(script[1], /\basync\b/);
  }
}
for (const page of ["play", "player"]) {
  const markup = readFileSync(theme + `html/vod/${page}.html`, "utf8");
  const flagIndex = markup.indexOf('{assign name="pingfang_sync_core_scripts" value="1" /}');
  assert.ok(flagIndex >= 0 && flagIndex < markup.indexOf('{include file="public/head"'));
  assert.match(markup, /\{\$player_data\}[\s\S]*\{\$player_js\}/);
}
for (const [page, type] of [["plays", 4], ["favs", 2]]) {
  const markup = readFileSync(theme + `html/user/${page}.html`, "utf8");
  const source = markup.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const events = new Map();
  const handlers = new Map();
  const posts = [];
  const runtime = {
    document: { addEventListener: (name, callback) => events.set(name, callback), querySelectorAll: () => [] },
    window: {}, confirm: () => true, alert() {}, location: { reload() {} }
  };
  new Script(source).runInNewContext(runtime);
  assert.equal(handlers.size, 0, "member pages must not use jQuery before deferred dependencies execute");
  assert.equal(typeof events.get("DOMContentLoaded"), "function");
  runtime.$ = (selector) => ({ click: (callback) => handlers.set(selector, callback) });
  runtime.$.post = (url, data) => posts.push({ url, data });
  runtime.MAC = runtime.window.MAC = { CheckBox: { Ids: () => "12,13" } };
  events.get("DOMContentLoaded")();
  assert.equal(handlers.size, 3);
  handlers.get("#btnDel")();
  handlers.get("#btnClear")();
  assert.deepEqual(posts.map(({ data }) => [data.ids, data.type, data.all]), [["12,13", type, 0], ["", type, 1]]);
}
const appJs = readFileSync(theme + "js/app.js", "utf8");
const motionSource = appJs.slice(appJs.indexOf("  function initGsapMotion("), appJs.indexOf("  var homeGsapLoadPromise"));
for (const painted of [false, true]) {
  let entrances = 0;
  const document = { querySelectorAll() {}, documentElement: {} };
  const runtime = {
    document,
    window: {
      gsap: { matchMedia: () => ({ add: (queries, callback) => callback({ conditions: { reduceMotion: false, coarsePointer: false } }) }) },
      performance: { getEntriesByName: () => painted ? [{ startTime: 100 }] : [] }
    },
    scopedElements: () => [], initBannerIridescence: () => null, initSectionMotion: () => null,
    initPageEntrance: () => { entrances += 1; return null; }
  };
  new Script(motionSource).runInNewContext(runtime);
  runtime.initGsapMotion(document);
  assert.equal(entrances, painted ? 0 : 1, "late animation must not hide content that has already painted");
}
const favoriteRuntime = { URLSearchParams };
new Script(appJs.slice(appJs.indexOf("  function isFavoriteAjax("), appJs.indexOf("  function attachFavoriteAjaxFeedback("))).runInNewContext(favoriteRuntime);
for (const settings of [
  { url: "/index.php/user/ajax_ulog/?ac=set&type=2" },
  { url: "/index.php/user/ajax_ulog/?ac=set", data: "mid=1&id=693443&type=2" },
  { url: "/index.php/user/ajax_ulog/?ac=set", data: { mid: 1, id: 693443, type: 2 } }
]) assert.equal(favoriteRuntime.isFavoriteAjax(settings), true, "favorite feedback must recognize MacCMS POST payloads");
for (const settings of [
  { url: "/index.php/user/ajax_ulog/?ac=set", data: "mid=1&type=4" },
  { url: "/unrelated", data: "type=2" }
]) assert.equal(favoriteRuntime.isFavoriteAjax(settings), false);
execFileSync("php", ["tests/theme-assets.test.php"], { stdio: "inherit" });
console.log("Initial render ordering and member-page checks passed.");
