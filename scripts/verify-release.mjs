import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const scope = process.env.DEPLOY_SCOPE || "all";
if (!["all", "backend", "api", "vodops"].includes(scope)) {
  throw new Error("DEPLOY_SCOPE must be all, backend, api, or vodops");
}
const includeTheme = scope === "all";
const includeDevice = scope === "all" || scope === "backend";
const includeApi = scope === "all" || scope === "backend" || scope === "api";
const includeVodops = scope === "all" || scope === "vodops";
const archive = path.join(root, "dist", "pingfangvideo.tar.gz");
const addonArchive = path.join(root, "dist", "pingfangdevice.tar.gz");
const apiAddonArchive = path.join(root, "dist", "pingfangapi.tar.gz");
const vodopsArchive = path.join(root, "dist", "vodops.tar.gz");
const assetVersionPlaceholders = [
  "__PINGFANG_STYLE_VERSION__",
  "__PINGFANG_APP_VERSION__",
  "__PINGFANG_PROMPT_VERSION__",
  "__PINGFANG_GAME_VERSION__",
  "__PINGFANG_BAMBOO_CICADA_VERSION__",
  "__PINGFANG_MULTIPLAYER_VERSION__",
  "__PINGFANG_QIXI_VERSION__"
];
const assetVersionPattern = /\?v=[a-f0-9]{12}/;
const requiredEntries = [
  "pingfangvideo/info.ini",
  "pingfangvideo/css/style.css",
  "pingfangvideo/games/2048/LICENSE.txt",
  "pingfangvideo/games/2048/js/application.js",
  "pingfangvideo/games/2048/js/game_manager.js",
  "pingfangvideo/games/blockrain/Copyright",
  "pingfangvideo/games/blockrain/LICENSE.txt",
  "pingfangvideo/games/blockrain/blockrain.jquery.min.js",
  "pingfangvideo/games/bamboo-cicada.js",
  "pingfangvideo/games/README.md",
  "pingfangvideo/games/init.js",
  "pingfangvideo/js/gsap.min.js",
  "pingfangvideo/js/app.js",
  "pingfangvideo/js/multiplayer-games.js",
  "pingfangvideo/js/qixi-particle-rose.js",
  "pingfangvideo/images/site-logo.png",
  "pingfangvideo/player/preload.html",
  "pingfangvideo/player/buffering.html",
  "pingfangvideo/player/prompt.css",
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
  "pingfangvideo/html/label/comics.html",
  "pingfangvideo/html/label/game-2048.html",
  "pingfangvideo/html/label/game-blockrain.html",
  "pingfangvideo/html/label/game-bamboo-cicada.html",
  "pingfangvideo/html/label/game-drawguess.html",
  "pingfangvideo/html/label/game-gomoku.html",
  "pingfangvideo/html/label/games.html",
  "pingfangvideo/html/label/history.html",
  "pingfangvideo/html/label/hot.html",
  "pingfangvideo/html/label/qixi.html",
  "pingfangvideo/html/label/videos.html",
  "pingfangvideo/html/pingfangdevice/index.html",
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
  "pingfangvideo/html/map/google.html"
];
const excludedEntries = [
  "pingfangvideo/games/2048/index.html",
  "pingfangvideo/games/blockrain/index.html",
  "pingfangvideo/games/blockrain/jquery-1.11.1.min.js"
];
const forbiddenProductionPatterns = [
  /preview\/data\.json/,
  /preview\/index\.html/,
  /server\/index\.php/,
  /docker-compose/,
  /localhost/,
  /127\.0\.0\.1/,
  /npm run/,
  /dist\/pingfangvideo/
];
const requiredAddonEntries = [
  "pingfangdevice/Pingfangdevice.php",
  "pingfangdevice/application/index/controller/Pingfangdevice.php",
  "pingfangdevice/config.php",
  "pingfangdevice/controller/DeviceActions.php",
  "pingfangdevice/controller/Index.php",
  "pingfangdevice/info.ini",
  "pingfangdevice/install.sql",
  "pingfangdevice/service/DeviceSession.php",
  "pingfangdevice/service/GameAccessTicket.php",
  "pingfangdevice/service/VodFilterOptions.php",
  "pingfangdevice/service/VodSourceQuality.php",
  "pingfangdevice/view/index/index.html"
];
const requiredApiAddonEntries = [
  "pingfangapi/Pingfangapi.php",
  "pingfangapi/application/index/controller/Pingfangapi.php",
  "pingfangapi/config.php",
  "pingfangapi/info.ini",
  "pingfangapi/service/AccountService.php",
  "pingfangapi/service/ApiException.php",
  "pingfangapi/service/ApiRequest.php",
  "pingfangapi/service/ContentService.php",
  "pingfangapi/service/DeploymentCheck.php"
];
const requiredVodopsEntries = [
  "vodops/Vodops.php",
  "vodops/application/admin/controller/Douban.php",
  "vodops/application/admin/controller/Vodops.php",
  "vodops/application/admin/view_new/vodops/index.html",
  "vodops/backend/DoubanController.php",
  "vodops/bin/vodops-worker.php",
  "vodops/config.php",
  "vodops/info.ini",
  "vodops/install.sql",
  "vodops/schema.php",
  "vodops/service/DoubanAiReviewer.php",
  "vodops/service/DoubanActionException.php",
  "vodops/service/DoubanData.php",
  "vodops/service/DoubanGateway.php",
  "vodops/service/DoubanMatcher.php",
  "vodops/service/VodPosterCandidate.php",
  "vodops/service/VodQualityAnalyzer.php",
  "vodops/service/VodQualityRepair.php",
  "vodops/service/VodQualityScanner.php",
  "vodops/view/index/index.html",
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
    value.startsWith("{:url(") ||
    value.includes("|mac_url_img") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:");

  assert.ok(allowed, `${file} should use MacCMS runtime variables for ${tag} asset ${value}`);
}

if (includeApi) assert.ok(existsSync(apiAddonArchive), "dist/pingfangapi.tar.gz should exist. Run npm run package first.");
if (includeVodops) {
  assert.ok(existsSync(vodopsArchive), "dist/vodops.tar.gz should exist. Run npm run package first.");
  assert.ok(!existsSync(path.join(root, "dist", "douban.tar.gz")), "Douban must be packaged inside vodops, not as a second addon");
}

if (includeTheme) {
  assert.ok(existsSync(archive), "dist/pingfangvideo.tar.gz should exist. Run npm run package first.");
  const tarList = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
  assert.equal(tarList.status, 0, tarList.stderr || "Release archive should be readable");
  assert.doesNotMatch(tarList.stderr, /LIBARCHIVE\.xattr/, "Release archive should not include macOS extended attribute metadata");

  const entries = tarList.stdout.trim().split(/\r?\n/).filter(Boolean);

  for (const entry of requiredEntries) {
    assert.ok(entries.includes(entry), `${entry} should be included in the release archive`);
  }
  for (const entry of excludedEntries) {
    assert.ok(!entries.includes(entry), `${entry} should stay out of the production release archive`);
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

    for (const placeholder of assetVersionPlaceholders) {
      assert.doesNotMatch(content, new RegExp(placeholder, "g"), `${entry} should have generated asset version values`);
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
  assert.match(includeHtml, new RegExp(`css/style\\.css${assetVersionPattern.source}`));

  const footHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/public/foot.html"], { encoding: "utf8" });
  assert.match(footHtml, new RegExp(`js/app\\.js${assetVersionPattern.source}`));
  const styleVersion = includeHtml.match(/css\/style\.css\?v=([a-f0-9]{12})/)?.[1];
  const appVersion = footHtml.match(/js\/app\.js\?v=([a-f0-9]{12})/)?.[1];
  assert.ok(styleVersion && appVersion, "Active assets should include generated versions");
  assert.notEqual(styleVersion, appVersion, "CSS and app.js should use independent content versions");

  const blockrainHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/label/game-blockrain.html"], { encoding: "utf8" });
  assert.match(blockrainHtml, new RegExp(`games/init\\.js${assetVersionPattern.source}`));
  const bambooCicadaHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/label/game-bamboo-cicada.html"], { encoding: "utf8" });
  assert.match(bambooCicadaHtml, new RegExp(`games/bamboo-cicada\\.js${assetVersionPattern.source}`));
  const gomokuHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/label/game-gomoku.html"], { encoding: "utf8" });
  assert.match(gomokuHtml, new RegExp(`js/multiplayer-games\\.js${assetVersionPattern.source}`));
  const drawguessHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/label/game-drawguess.html"], { encoding: "utf8" });
  assert.match(drawguessHtml, new RegExp(`js/multiplayer-games\\.js${assetVersionPattern.source}`));
  const qixiHtml = execFileSync("tar", ["-xOf", archive, "pingfangvideo/html/label/qixi.html"], { encoding: "utf8" });
  assert.match(qixiHtml, new RegExp(`js/qixi-particle-rose\\.js${assetVersionPattern.source}`));

  const appJs = execFileSync("tar", ["-xOf", archive, "pingfangvideo/js/app.js"], { encoding: "utf8" });
  assert.match(appJs, /fallbackHistoryUrl/);
  assert.doesNotMatch(appJs, /javascript:;/);

  const preloadPrompt = execFileSync("tar", ["-xOf", archive, "pingfangvideo/player/preload.html"], { encoding: "utf8" });
  const bufferingPrompt = execFileSync("tar", ["-xOf", archive, "pingfangvideo/player/buffering.html"], { encoding: "utf8" });
  const playerPromptStyle = execFileSync("tar", ["-xOf", archive, "pingfangvideo/player/prompt.css"], { encoding: "utf8" });
  for (const prompt of [preloadPrompt, bufferingPrompt]) {
    assert.match(prompt, new RegExp(`prompt\\.css${assetVersionPattern.source}`));
    assert.doesNotMatch(prompt, /<script\b/);
    for (const placeholder of assetVersionPlaceholders) {
      assert.doesNotMatch(prompt, new RegExp(placeholder, "g"));
    }
  }
  assert.match(playerPromptStyle, /prefers-reduced-motion: reduce/);
}

if (includeDevice) {
  assert.ok(existsSync(addonArchive), "dist/pingfangdevice.tar.gz should exist. Run npm run package first.");
  const addonTarList = spawnSync("tar", ["-tzf", addonArchive], { encoding: "utf8" });
  assert.equal(addonTarList.status, 0, addonTarList.stderr || "Addon release archive should be readable");
  assert.doesNotMatch(addonTarList.stderr, /LIBARCHIVE\.xattr/, "Addon release archive should not include macOS extended attribute metadata");

  const addonEntries = addonTarList.stdout.trim().split(/\r?\n/).filter(Boolean);

  for (const entry of requiredAddonEntries) {
    assert.ok(addonEntries.includes(entry), `${entry} should be included in the addon archive`);
  }
  assert.ok(!addonEntries.some((entry) => entry.startsWith("pingfangdevice/bridge/")), "Legacy bridge files should not be included in the addon archive");

  for (const entry of addonEntries.filter((entry) => entry.endsWith(".php"))) {
    const content = execFileSync("tar", ["-xOf", addonArchive, entry], { encoding: "utf8" });
    const lint = spawnSync("php", ["-l"], { input: content, encoding: "utf8" });
    assert.equal(lint.status, 0, `${entry} must contain valid PHP: ${lint.stderr || lint.stdout}`);
  }

  const addonSql = execFileSync("tar", ["-xOf", addonArchive, "pingfangdevice/install.sql"], { encoding: "utf8" });
  assert.match(addonSql, /CREATE TABLE IF NOT EXISTS `__PREFIX__pingfang_device_session`/);
  assert.match(addonSql, /`login_check_hash` char\(64\) NOT NULL/);
  assert.match(addonSql, /PREPARE pingfang_login_check_hash_stmt/);
  assert.doesNotMatch(addonSql, /DROP\s+TABLE/i);
}

if (includeApi) {
const apiAddonTarList = spawnSync("tar", ["-tzf", apiAddonArchive], { encoding: "utf8" });
assert.equal(apiAddonTarList.status, 0, apiAddonTarList.stderr || "API addon release archive should be readable");
assert.doesNotMatch(apiAddonTarList.stderr, /LIBARCHIVE\.xattr/, "API addon archive should not include macOS extended attribute metadata");

const apiAddonEntries = apiAddonTarList.stdout.trim().split(/\r?\n/).filter(Boolean);
assert.ok(
  apiAddonEntries.every((entry) => (entry === "pingfangapi" || entry.startsWith("pingfangapi/")) && !entry.split("/").includes("..")),
  "API addon archive must stay under its single top-level directory"
);
const apiAddonVerboseList = spawnSync("tar", ["-tvzf", apiAddonArchive], { encoding: "utf8" });
assert.equal(apiAddonVerboseList.status, 0, apiAddonVerboseList.stderr || "API addon verbose archive listing should be readable");
assert.deepEqual(
  apiAddonVerboseList.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((entry) => entry[0] !== "-" && entry[0] !== "d"),
  [],
  "API addon archive must contain only regular files and directories"
);
for (const entry of requiredApiAddonEntries) {
  assert.ok(apiAddonEntries.includes(entry), `${entry} should be included in the API addon archive`);
}
assert.deepEqual(
  apiAddonEntries.filter((entry) => entry.split("/").some((part) => part.startsWith(".") && part !== ".")),
  [],
  "API addon archive should not include hidden dotfiles"
);
const apiPhpEntries = apiAddonEntries.filter((entry) => entry.endsWith(".php"));
const apiPhpContents = apiPhpEntries.map((entry) => {
  const content = execFileSync("tar", ["-xOf", apiAddonArchive, entry], { encoding: "utf8" });
  const lint = spawnSync("php", ["-l"], { input: content, encoding: "utf8" });
  assert.equal(lint.status, 0, `${entry} must contain valid PHP: ${lint.stderr || lint.stdout}`);
  return content;
});
const apiPhp = apiPhpContents.join("\n");
for (const pattern of [/preview\/data\.json/, /server\/react-api\.php/, /demo123/, /localhost/, /127\.0\.0\.1/]) {
  assert.doesNotMatch(apiPhp, pattern, "API addon must not contain local preview or demo dependencies");
}
assert.match(apiPhp, /private, no-store/);
assert.match(apiPhp, /X-CSRF-Token/);
assert.match(apiPhp, /url\('pingfangapi\/stream'/);
assert.doesNotMatch(apiPhp, /url\('pingfangapi\/player'/);
assert.doesNotMatch(apiPhp, /url\('vod\/player'/);
assert.match(apiPhp, /check_user_popedom/);
assert.match(apiPhp, /label_vod_play/);
assert.match(apiPhp, /label_user\(\)/);
assert.match(apiPhp, /label_maccms\(\)/);
assert.match(apiPhp, /class Pingfangapi extends All/);
assert.doesNotMatch(apiPhp, /class Pingfangapi extends Base/);
assert.match(apiPhp, /'ulog_points' => 0/);
assert.doesNotMatch(apiPhp, /Access-Control-Allow-Origin/i);
}

if (includeVodops) {
const vodopsTarList = spawnSync("tar", ["-tzf", vodopsArchive], { encoding: "utf8" });
assert.equal(vodopsTarList.status, 0, vodopsTarList.stderr || "Vodops release archive should be readable");
assert.doesNotMatch(vodopsTarList.stderr, /LIBARCHIVE\.xattr/, "Vodops release archive should not include macOS extended attribute metadata");

const vodopsEntries = vodopsTarList.stdout
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

for (const entry of requiredVodopsEntries) {
  assert.ok(vodopsEntries.includes(entry), `${entry} should be included in the vodops archive`);
}
assert.ok(
  !vodopsEntries.some((entry) => entry.startsWith("vodops/controller/")),
  "Vodops should not expose a public addon controller",
);

const vodopsController = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/application/admin/controller/Vodops.php"], { encoding: "utf8" });
assert.match(vodopsController, /class Vodops extends Base/);
assert.match(vodopsController, /admin\/view_new/);
assert.match(vodopsController, /public function deleteScan\(\)/);
assert.match(vodopsController, /catch \(VodQualityActionException \$e\)/);
assert.match(vodopsController, /catch \(VodQualityExportException \$e\)/);
assert.match(vodopsController, /导出扫描结果失败，请查看服务端日志/);
assert.match(vodopsController, /workspace[\s\S]*?DoubanData::dashboard\(\)/);
const doubanBridge = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/application/admin/controller/Douban.php"], { encoding: "utf8" });
assert.match(doubanBridge, /use addons\\vodops\\backend\\DoubanController/);
assert.doesNotMatch(doubanBridge, /->route\(/);
const doubanController = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/backend/DoubanController.php"], { encoding: "utf8" });
assert.match(doubanController, /class DoubanController extends Base/);
assert.match(doubanController, /豆瓣操作失败，请查看服务端日志/);
assert.match(doubanController, /redirect\(url\('vodops\/index',[\s\S]*?workspace[\s\S]*?douban/);
assert.doesNotMatch(doubanController, /fetch\(['"]index\/index/);
assert.doesNotMatch(doubanController, /view_path/);
for (const action of [
  "index",
  "saveConfig",
  "enqueue",
  "previewTargeted",
  "enqueueTargeted",
  "run",
  "retryFailed",
  "fetchVod",
  "sync",
  "rollbackPic",
  "calibrate",
  "previewCalibration",
  "calibrateByType",
  "setDoubanId",
  "lock",
  "ignore",
  "startAudit",
  "runAuditBatch",
  "pauseAudit",
  "resumeAudit",
  "exportAudit",
]) {
  assert.match(doubanController, new RegExp(`public function ${action}\\(\\)`));
}
const doubanData = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/service/DoubanData.php"], { encoding: "utf8" });
assert.match(doubanData, /namespace addons\\vodops\\service/);
assert.match(doubanData, /MATCH_DOUBAN_ID/);
assert.match(doubanData, /SYNC_DOUBAN/);
assert.match(doubanData, /CALIBRATE_SCORE/);
assert.match(doubanData, /conditionalVodUpdate/);
assert.doesNotMatch(doubanData, /UPDATE \{\$vodTable\} SET vod_(?:douban_)?score/);
assert.doesNotMatch(doubanData.match(/private static function buildVodUpdates[\s\S]*?return \$updates;/)?.[0] || "", /'vod_pic'\s*=>/);
const vodopsHook = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/Vodops.php"], { encoding: "utf8" });
assert.doesNotMatch(vodopsHook, /responseEnd|runTrafficChunk/);
const vodopsView = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/application/admin/view_new/vodops/index.html"], { encoding: "utf8" });
assert.match(vodopsView, /X-CSRF-Token/);
assert.match(vodopsView, /不会自动修复、删除、合并或优化/);
assert.match(vodopsView, /只删除 VodOps 扫描结果，不会修改 mac_vod/);
assert.match(vodopsView, /源记录未被读取/);
assert.match(vodopsView, /扫描完成或结束后可导出结果/);
assert.match(vodopsView, /id="vodopsScopeTypeId"/);
assert.match(vodopsView, /id="vodopsWorkerMode"/);
assert.match(vodopsView, /worker_mode/);
assert.match(vodopsView, /scope_label/);
assert.match(vodopsView, /runner_state_label/);
assert.match(vodopsView, /url\('vod\/info',[\s\S]*?vod_id/);
assert.match(vodopsView, /detail_label/);
assert.match(vodopsView, /确认修改并复检/);
assert.match(vodopsView, /vodops\/rollbackRepair/);
assert.match(vodopsView, /workspace/);
assert.match(vodopsView, /addons\/vodops\/view\/index\/index/);
const doubanView = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/view/index/index.html"], { encoding: "utf8" });
assert.match(doubanView, /豆瓣匹配与同步/);
assert.doesNotMatch(doubanView, /<!doctype|<html|<body|豆瓣匹配工作台/i);
assert.doesNotMatch(doubanView, /url\('douban\/index'/);
assert.match(doubanView, /同步不会修改现有图片/);
assert.match(doubanView, /X-CSRF-Token/);
assert.match(doubanView, /\.douban-workspace \.system-box/);
assert.match(doubanView, /@keyframes douban-status-pulse/);
const vodopsScanner = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/service/VodQualityScanner.php"], { encoding: "utf8" });
assert.match(vodopsScanner, /class VodQualityExportException extends \\RuntimeException/);
assert.match(vodopsScanner, /class VodQualityActionException extends \\RuntimeException/);
assert.match(vodopsScanner, /PUBLIC_SCAN_ERROR/);
assert.match(vodopsScanner, /where\('type_id', 'in', \$scopeTypeIds\)/);
assert.match(vodopsScanner, /public static function runWorker/);
assert.match(vodopsScanner, /public static function runWorkerChunk/);
assert.match(vodopsScanner, /WORKER_LEASE_SECONDS/);
assert.match(vodopsScanner, /public static function ensureScheduledScan/);
assert.match(vodopsScanner, /扫描仍在进行，请等待完成或先结束任务后再导出/);
assert.doesNotMatch(vodopsScanner, /'error_message'\s*=>\s*VodQualityAnalyzer::sanitizeValue\(\$e->getMessage/);
const vodopsRepair = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/service/VodQualityRepair.php"], { encoding: "utf8" });
assert.match(vodopsRepair, /private const REPAIR_TABLE = 'vodops_repair_log'/);
assert.match(vodopsRepair, /createAudit\([\s\S]*?conditionalVodUpdate/);
assert.match(vodopsRepair, /foreach \(\$expected as \$field => \$value\)[\s\S]*?->where\(\$field, \$value\)/);
const vodopsConfig = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/config.php"], { encoding: "utf8" });
for (const setting of ["scheduled_scan_hours", "scheduled_scope_type_id", "scheduled_batch_size"]) {
  assert.match(vodopsConfig, new RegExp(`'name'\\s*=>\\s*'${setting}'`));
}
const vodopsWorker = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/bin/vodops-worker.php"], { encoding: "utf8" });
assert.match(vodopsWorker, /PHP_SAPI[\s\S]*?cli/);
assert.match(vodopsWorker, /thinkphp[\s\S]*?base\.php[\s\S]*?App::initCommon/);
assert.match(vodopsWorker, /ensureScheduledScan[\s\S]*?runWorker/);
const vodopsSql = execFileSync("tar", ["-xOf", vodopsArchive, "vodops/install.sql"], { encoding: "utf8" });
for (const table of [
  "vodops_lock",
  "vodops_scan",
  "vodops_issue",
  "vodops_fingerprint",
  "vodops_repair_log",
  "douban_config",
  "douban_vod_meta",
  "douban_task",
  "douban_log",
  "douban_review_candidate",
  "douban_scan",
  "douban_scan_issue",
]) {
  assert.match(vodopsSql, new RegExp("CREATE TABLE IF NOT EXISTS `__PREFIX__" + table + "`[\\s\\S]*?ENGINE=InnoDB"));
}
assert.match(vodopsSql, /INSERT IGNORE INTO `__PREFIX__vodops_lock`[\s\S]*?scan_start/);
assert.match(vodopsSql, /douban_enqueue/);
assert.match(vodopsSql, /INSERT IGNORE INTO `__PREFIX__douban_config`/);
assert.match(vodopsSql, /PREPARE douban_task_stats_index_stmt/);
assert.doesNotMatch(vodopsSql, /DROP\s+TABLE/i);
assert.match(vodopsSql, /`guard_json` text NULL/);
assert.match(vodopsSql, /`scope_json` text NULL/);
assert.match(vodopsSql, /`execution_mode` varchar\(16\) NOT NULL DEFAULT 'manual'/);
assert.match(vodopsSql, /`lease_until` int\(10\) unsigned NOT NULL DEFAULT 0/);
assert.match(vodopsSql, /`next_run_at` int\(10\) unsigned NOT NULL DEFAULT 0/);
assert.match(vodopsSql, /information_schema\.COLUMNS[\s\S]*?COLUMN_NAME = 'scope_json'/);
assert.equal((vodopsSql.match(/ADD COLUMN `/g) || []).length, 4, "Vodops upgrades should only add four documented columns");
for (const migration of [
  "ADD COLUMN `scope_json` text NULL AFTER `error_message`",
  "ADD COLUMN `execution_mode` varchar(16) NOT NULL DEFAULT ''manual'' AFTER `scope_json`",
  "ADD COLUMN `lease_until` int(10) unsigned NOT NULL DEFAULT 0 AFTER `execution_mode`",
  "ADD COLUMN `next_run_at` int(10) unsigned NOT NULL DEFAULT 0 AFTER `lease_until`",
]) {
  assert.match(vodopsSql, new RegExp(migration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
const legacyEndpointMigration = [
  "UPDATE `__PREFIX__douban_config`",
  "SET `config_value` = 'internal', `updated_at` = UNIX_TIMESTAMP()",
  "WHERE `config_key` = 'douban_endpoint'",
  "  AND `config_value` = '/extend/douban.php';",
].join("\n");
assert.equal(
  vodopsSql.split(legacyEndpointMigration).length - 1,
  1,
  "VodOps should retain exactly one bounded legacy endpoint migration",
);
const vodopsSqlWithoutEndpointMigration = vodopsSql.replace(legacyEndpointMigration, "");
assert.doesNotMatch(
  vodopsSqlWithoutEndpointMigration,
  /\b(?:DROP|DELETE|UPDATE|OPTIMIZE|REPAIR|RENAME|TRUNCATE)\b/i,
);
}

if (includeTheme) console.log(`Verified ${archive}`);
if (includeDevice) console.log(`Verified ${addonArchive}`);
if (includeApi) console.log(`Verified ${apiAddonArchive}`);
if (includeVodops) console.log(`Verified ${vodopsArchive}`);
