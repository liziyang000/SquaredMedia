import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const archive = path.join(root, "dist", "pingfangvideo.tar.gz");
const requiredEntries = [
  "pingfangvideo/info.ini",
  "pingfangvideo/css/style.css",
  "pingfangvideo/js/gsap.min.js",
  "pingfangvideo/js/app.js",
  "pingfangvideo/images/site-logo.png",
  "pingfangvideo/html/public/include.html",
  "pingfangvideo/html/public/head.html",
  "pingfangvideo/html/public/foot.html",
  "pingfangvideo/html/public/digg.html",
  "pingfangvideo/html/public/score.html",
  "pingfangvideo/html/public/star.html",
  "pingfangvideo/html/public/vod_card.html",
  "pingfangvideo/html/comment/index.html",
  "pingfangvideo/html/comment/ajax.html",
  "pingfangvideo/html/gbook/index.html",
  "pingfangvideo/html/book/index.html",
  "pingfangvideo/html/book/report.html",
  "pingfangvideo/html/index/index.html",
  "pingfangvideo/html/label/categories.html",
  "pingfangvideo/html/label/history.html",
  "pingfangvideo/html/label/hot.html",
  "pingfangvideo/html/label/videos.html",
  "pingfangvideo/html/topic/index.html",
  "pingfangvideo/html/topic/detail.html",
  "pingfangvideo/html/art/index.html",
  "pingfangvideo/html/art/confirm.html",
  "pingfangvideo/html/art/detail.html",
  "pingfangvideo/html/art/detail_pwd.html",
  "pingfangvideo/html/art/rss.html",
  "pingfangvideo/html/art/search.html",
  "pingfangvideo/html/art/type.html",
  "pingfangvideo/html/art/show.html",
  "pingfangvideo/html/rss/rss.html",
  "pingfangvideo/html/rss/baidu.html",
  "pingfangvideo/html/rss/google.html",
  "pingfangvideo/html/vod/show.html",
  "pingfangvideo/html/vod/type.html",
  "pingfangvideo/html/vod/search.html",
  "pingfangvideo/html/vod/detail.html",
  "pingfangvideo/html/vod/confirm.html",
  "pingfangvideo/html/vod/detail_pwd.html",
  "pingfangvideo/html/vod/play.html",
  "pingfangvideo/html/vod/player.html",
  "pingfangvideo/html/vod/player_pwd.html",
  "pingfangvideo/html/vod/down.html",
  "pingfangvideo/html/vod/downer_pwd.html",
  "pingfangvideo/html/vod/copyright.html",
  "pingfangvideo/html/vod/plot.html",
  "pingfangvideo/html/vod/rss.html",
  "pingfangvideo/html/plot/uindex.html",
  "pingfangvideo/html/plot/udetail.html",
  "pingfangvideo/html/actor/index.html",
  "pingfangvideo/html/actor/detail.html",
  "pingfangvideo/html/actor/search.html",
  "pingfangvideo/html/actor/show.html",
  "pingfangvideo/html/actor/type.html",
  "pingfangvideo/html/role/index.html",
  "pingfangvideo/html/role/detail.html",
  "pingfangvideo/html/role/show.html",
  "pingfangvideo/html/website/index.html",
  "pingfangvideo/html/website/detail.html",
  "pingfangvideo/html/website/search.html",
  "pingfangvideo/html/website/show.html",
  "pingfangvideo/html/website/type.html",
  "pingfangvideo/html/user/head.html",
  "pingfangvideo/html/user/foot.html",
  "pingfangvideo/html/user/include.html",
  "pingfangvideo/html/user/index.html",
  "pingfangvideo/html/user/login.html",
  "pingfangvideo/html/user/reg.html",
  "pingfangvideo/html/user/findpass.html",
  "pingfangvideo/html/map/rss.html",
  "pingfangvideo/html/map/baidu.html",
  "pingfangvideo/html/map/google.html",
];
const forbiddenProductionPatterns = [
  /preview\/data\.json/,
  /preview\/index\.html/,
  /server\/index\.php/,
  /docker-compose/,
  /localhost/,
  /127\.0\.0\.1/,
  /npm run/,
  /dist\/pingfangvideo/,
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

assert.ok(existsSync(archive), "dist/pingfangvideo.tar.gz should exist. Run npm run package first.");

const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
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

const htmlEntries = entries.filter((entry) => entry.startsWith("pingfangvideo/html/") && entry.endsWith(".html"));
assert.ok(htmlEntries.length >= 70, "Release archive should include the full MacCMS HTML template surface");

for (const entry of htmlEntries) {
  const content = execFileSync("tar", ["-xOf", archive, entry], { encoding: "utf8" });

  for (const pattern of forbiddenProductionPatterns) {
    assert.doesNotMatch(content, pattern, `${entry} should not reference local development or preview resources`);
  }

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

const includeHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/public/include.html"], { encoding: "utf8" });
assert.match(includeHtml, /"path":"\{:\s*rtrim\(\$maccms\['path'\], '\/'\)\}"/);
assert.match(includeHtml, /"aid":"\{\$maccms\.aid\}"/);

const appJs = execFileSync("tar", ["-xOf", archive, "pingfangvideo/js/app.js"], { encoding: "utf8" });
assert.match(appJs, /fallbackHistoryUrl/);
assert.doesNotMatch(appJs, /javascript:;/);

console.log(`Verified ${archive}`);
