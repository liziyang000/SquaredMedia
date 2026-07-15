import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const archive = path.join(root, "dist", "squaredmedia.tar.gz");
const addonArchive = path.join(root, "dist", "squareddevice.tar.gz");
const doubanAddonArchive = path.join(root, "dist", "douban.tar.gz");
const assetVersionPlaceholder = "__SQUARED_MEDIA_ASSET_VERSION__";
const assetVersionPattern = /\?v=[a-f0-9]{12}/;
const requiredEntries = [
  "squaredmedia/info.ini",
  "squaredmedia/css/style.css",
  "squaredmedia/js/gsap.min.js",
  "squaredmedia/js/react.production.min.js",
  "squaredmedia/js/react-dom.production.min.js",
  "squaredmedia/js/rank-react.js",
  "squaredmedia/js/app.js",
  "squaredmedia/html/public/include.html",
  "squaredmedia/html/public/head.html",
  "squaredmedia/html/public/foot.html",
  "squaredmedia/html/public/digg.html",
  "squaredmedia/html/public/score.html",
  "squaredmedia/html/public/star.html",
  "squaredmedia/html/public/vod_card.html",
  "squaredmedia/html/comment/index.html",
  "squaredmedia/html/comment/ajax.html",
  "squaredmedia/html/gbook/index.html",
  "squaredmedia/html/book/index.html",
  "squaredmedia/html/book/report.html",
  "squaredmedia/html/index/index.html",
  "squaredmedia/html/label/categories.html",
  "squaredmedia/html/label/comics.html",
  "squaredmedia/html/label/history.html",
  "squaredmedia/html/label/hot.html",
  "squaredmedia/html/label/videos.html",
  "squaredmedia/html/squareddevice/index.html",
  "squaredmedia/html/topic/index.html",
  "squaredmedia/html/topic/detail.html",
  "squaredmedia/html/art/index.html",
  "squaredmedia/html/art/confirm.html",
  "squaredmedia/html/art/detail.html",
  "squaredmedia/html/art/detail_pwd.html",
  "squaredmedia/html/art/rss.html",
  "squaredmedia/html/art/search.html",
  "squaredmedia/html/art/type.html",
  "squaredmedia/html/art/show.html",
  "squaredmedia/html/rss/rss.html",
  "squaredmedia/html/rss/baidu.html",
  "squaredmedia/html/rss/google.html",
  "squaredmedia/html/vod/show.html",
  "squaredmedia/html/vod/type.html",
  "squaredmedia/html/vod/search.html",
  "squaredmedia/html/vod/detail.html",
  "squaredmedia/html/vod/confirm.html",
  "squaredmedia/html/vod/detail_pwd.html",
  "squaredmedia/html/vod/play.html",
  "squaredmedia/html/vod/player.html",
  "squaredmedia/html/vod/player_pwd.html",
  "squaredmedia/html/vod/down.html",
  "squaredmedia/html/vod/downer_pwd.html",
  "squaredmedia/html/vod/copyright.html",
  "squaredmedia/html/vod/plot.html",
  "squaredmedia/html/vod/rss.html",
  "squaredmedia/html/plot/uindex.html",
  "squaredmedia/html/plot/udetail.html",
  "squaredmedia/html/actor/index.html",
  "squaredmedia/html/actor/detail.html",
  "squaredmedia/html/actor/search.html",
  "squaredmedia/html/actor/show.html",
  "squaredmedia/html/actor/type.html",
  "squaredmedia/html/role/index.html",
  "squaredmedia/html/role/detail.html",
  "squaredmedia/html/role/show.html",
  "squaredmedia/html/website/index.html",
  "squaredmedia/html/website/detail.html",
  "squaredmedia/html/website/search.html",
  "squaredmedia/html/website/show.html",
  "squaredmedia/html/website/type.html",
  "squaredmedia/html/user/head.html",
  "squaredmedia/html/user/foot.html",
  "squaredmedia/html/user/include.html",
  "squaredmedia/html/user/index.html",
  "squaredmedia/html/user/login.html",
  "squaredmedia/html/user/reg.html",
  "squaredmedia/html/user/findpass.html",
  "squaredmedia/html/map/rss.html",
  "squaredmedia/html/map/baidu.html",
  "squaredmedia/html/map/google.html",
];
const forbiddenProductionPatterns = [
  /preview\/data\.json/,
  /preview\/index\.html/,
  /server\/index\.php/,
  /docker-compose/,
  /localhost/,
  /127\.0\.0\.1/,
  /npm run/,
  /dist\/squaredmedia/,
];
const requiredAddonEntries = [
  "squareddevice/Squareddevice.php",
  "squareddevice/bridge/Squareddevice.php",
  "squareddevice/config.php",
  "squareddevice/controller/Index.php",
  "squareddevice/info.ini",
  "squareddevice/install.sql",
  "squareddevice/service/DeviceSession.php",
  "squareddevice/service/VodFilterOptions.php",
  "squareddevice/view/index/index.html",
];
const requiredDoubanAddonEntries = [
  "douban/Douban.php",
  "douban/config.php",
  "douban/controller/Index.php",
  "douban/info.ini",
  "douban/install.sql",
  "douban/service/DoubanData.php",
  "douban/view/index/index.html",
];

function assertBalanced(content, openPattern, closePattern, label, file) {
  const opens = content.match(openPattern)?.length || 0;
  const closes = content.match(closePattern)?.length || 0;
  assert.equal(opens, closes, `${file} should have balanced ${label} tags`);
}

function assertSafeAssetReference(value, file, tag) {
  const allowed =
    value.startsWith("{$maccms.path}") ||
    value.startsWith("{$maccms.path_tpl}") ||
    value.includes("|mac_url_img") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:");

  assert.ok(allowed, `${file} should use MacCMS runtime variables for ${tag} asset ${value}`);
}

assert.ok(existsSync(archive), "dist/squaredmedia.tar.gz should exist. Run npm run package first.");
assert.ok(existsSync(addonArchive), "dist/squareddevice.tar.gz should exist. Run npm run package first.");
assert.ok(existsSync(doubanAddonArchive), "dist/douban.tar.gz should exist. Run npm run package first.");

const tarList = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
assert.equal(tarList.status, 0, tarList.stderr || "Release archive should be readable");
assert.doesNotMatch(tarList.stderr, /LIBARCHIVE\.xattr/, "Release archive should not include macOS extended attribute metadata");

const entries = tarList.stdout
  .trim()
  .split("\n")
  .filter(Boolean);

for (const entry of requiredEntries) {
  assert.ok(entries.includes(entry), `${entry} should be included in the release archive`);
}

const hiddenDotfiles = entries.filter((entry) => entry.split("/").some((part) => part.startsWith(".") && part !== "."));
assert.deepEqual(hiddenDotfiles, [], "No hidden dotfiles should be included in the release archive");

const forbiddenRoots = ["preview/", "server/", "docker/", "tests/", "scripts/"];
const forbiddenEntries = entries.filter((entry) => forbiddenRoots.some((rootName) => entry.startsWith(rootName) || entry.includes(`/${rootName}`)));
assert.deepEqual(forbiddenEntries, [], "Release archive should contain only the MacCMS theme directory");

const htmlEntries = entries.filter((entry) => entry.startsWith("squaredmedia/html/") && entry.endsWith(".html"));
assert.ok(htmlEntries.length >= 70, "Release archive should include the full MacCMS HTML template surface");

for (const entry of htmlEntries) {
  const content = execFileSync("tar", ["-xOf", archive, entry], { encoding: "utf8" });

  for (const pattern of forbiddenProductionPatterns) {
    assert.doesNotMatch(content, pattern, `${entry} should not reference local development or preview resources`);
  }

  assert.doesNotMatch(content, new RegExp(assetVersionPlaceholder, "g"), `${entry} should have generated asset version values`);
  assert.doesNotMatch(content, /href="#"/, `${entry} should not contain dead href links`);
  assert.doesNotMatch(content, /href="javascript:history/, `${entry} should not depend on history javascript links`);
  assert.doesNotMatch(content, /action="#"/, `${entry} should not use dead form action links`);
  assert.doesNotMatch(content, /action="javascript:/, `${entry} should not use javascript form actions`);
  assert.doesNotMatch(content, /__ROOT__/, `${entry} should use MacCMS runtime path variables`);

  for (const match of content.matchAll(/<(link|script|img)\b[^>]*(?:href|src)="([^"]+)"/g)) {
    assertSafeAssetReference(match[2], entry, match[1]);
  }

  assertBalanced(content, /\{maccms:vod\b/g, /\{\/maccms:vod\}/g, "maccms:vod", entry);
  assertBalanced(content, /\{maccms:type\b/g, /\{\/maccms:type\}/g, "maccms:type", entry);
  assertBalanced(content, /\{maccms:comment\b/g, /\{\/maccms:comment\}/g, "maccms:comment", entry);
  assertBalanced(content, /\{maccms:foreach\b/g, /\{\/maccms:foreach\}/g, "maccms:foreach", entry);
}

const includeHtml = execFileSync("tar", ["-xOf", archive, "squaredmedia/html/public/include.html"], { encoding: "utf8" });
assert.match(includeHtml, /"path":"\{:\s*rtrim\(\$maccms\['path'\], '\/'\)\}"/);
assert.match(includeHtml, /"aid":"\{\$maccms\.aid\}"/);
assert.match(includeHtml, new RegExp(`css/style\\.css${assetVersionPattern.source}`));

const footHtml = execFileSync("tar", ["-xOf", archive, "squaredmedia/html/public/foot.html"], { encoding: "utf8" });
assert.match(footHtml, new RegExp(`js/app\\.js${assetVersionPattern.source}`));

const appJs = execFileSync("tar", ["-xOf", archive, "squaredmedia/js/app.js"], { encoding: "utf8" });
assert.match(appJs, /fallbackHistoryUrl/);
assert.doesNotMatch(appJs, /javascript:;/);

const addonTarList = spawnSync("tar", ["-tzf", addonArchive], { encoding: "utf8" });
assert.equal(addonTarList.status, 0, addonTarList.stderr || "Addon release archive should be readable");
assert.doesNotMatch(addonTarList.stderr, /LIBARCHIVE\.xattr/, "Addon release archive should not include macOS extended attribute metadata");

const addonEntries = addonTarList.stdout
  .trim()
  .split("\n")
  .filter(Boolean);

for (const entry of requiredAddonEntries) {
  assert.ok(addonEntries.includes(entry), `${entry} should be included in the addon archive`);
}

const addonSql = execFileSync("tar", ["-xOf", addonArchive, "squareddevice/install.sql"], { encoding: "utf8" });
assert.match(addonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__squared_media_device_session`/);
assert.doesNotMatch(addonSql, /DROP\s+TABLE/i);

const doubanAddonTarList = spawnSync("tar", ["-tzf", doubanAddonArchive], { encoding: "utf8" });
assert.equal(doubanAddonTarList.status, 0, doubanAddonTarList.stderr || "Douban addon release archive should be readable");
assert.doesNotMatch(doubanAddonTarList.stderr, /LIBARCHIVE\.xattr/, "Douban addon release archive should not include macOS extended attribute metadata");

const doubanAddonEntries = doubanAddonTarList.stdout
  .trim()
  .split("\n")
  .filter(Boolean);

for (const entry of requiredDoubanAddonEntries) {
  assert.ok(doubanAddonEntries.includes(entry), `${entry} should be included in the douban addon archive`);
}

const doubanAddonSql = execFileSync("tar", ["-xOf", doubanAddonArchive, "douban/install.sql"], { encoding: "utf8" });
assert.match(doubanAddonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__douban_vod_meta`/);
assert.match(doubanAddonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__douban_task`/);
assert.match(doubanAddonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__douban_log`/);
assert.doesNotMatch(doubanAddonSql, /DROP\s+TABLE/i);

console.log(`Verified ${archive}`);
console.log(`Verified ${addonArchive}`);
console.log(`Verified ${doubanAddonArchive}`);
