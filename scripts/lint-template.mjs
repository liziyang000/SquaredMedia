import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const themeRoot = path.join(root, "template", "pingfangvideo");
const htmlRoot = path.join(themeRoot, "html");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath.endsWith(".html") ? [fullPath] : [];
  });
}

function themeRelative(file) {
  return path.relative(htmlRoot, file).replaceAll(path.sep, "/");
}

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

const files = walk(htmlRoot);
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
const partials = new Set([
  "public/include.html",
  "public/head.html",
  "public/foot.html",
  "public/paging.html",
  "public/vod_card.html",
  "public/vod_filter_common.html",
  "public/vod_grid_results.html",
  "public/digg.html",
  "public/score.html",
  "public/star.html",
  "comment/ajax.html",
  "user/head.html",
  "user/foot.html",
  "user/include.html",
]);
const xmlPages = new Set([
  "art/rss.html",
  "map/rss.html",
  "map/baidu.html",
  "map/google.html",
  "rss/rss.html",
  "rss/baidu.html",
  "rss/google.html",
  "vod/rss.html",
]);

for (const filePath of files) {
  const file = themeRelative(filePath);
  const content = readFileSync(filePath, "utf8");

  for (const pattern of forbiddenProductionPatterns) {
    assert.doesNotMatch(content, pattern, `${file} should not reference local development or preview resources`);
  }

  assert.doesNotMatch(content, /by="'\.\$param\['by'\]\.'"/, `${file} should not pass raw sort params into maccms tags`);
  assert.doesNotMatch(content, /href="javascript:history/, `${file} should not depend on history javascript links`);
  assert.doesNotMatch(content, /action="#"/, `${file} should not use dead form action links`);
  assert.doesNotMatch(content, /action="javascript:/, `${file} should not use javascript form actions`);
  assert.doesNotMatch(content, /__ROOT__/, `${file} should use MacCMS runtime path variables instead of __ROOT__`);

  if (file === "public/include.html") {
    assert.match(
      content,
      /"path":"\{:\s*rtrim\(\$maccms\['path'\], '\/'\)\}"/,
      `${file} should expose maccms.path without a trailing slash for player script URL joins`,
    );
  }

  for (const match of content.matchAll(/<(link|script|img)\b[^>]*(?:href|src)="([^"]+)"/g)) {
    assertSafeAssetReference(match[2], file, match[1]);
  }

  assertBalanced(content, /\{maccms:vod\b/g, /\{\/maccms:vod\}/g, "maccms:vod", file);
  assertBalanced(content, /\{maccms:type\b/g, /\{\/maccms:type\}/g, "maccms:type", file);
  assertBalanced(content, /\{maccms:comment\b/g, /\{\/maccms:comment\}/g, "maccms:comment", file);
  assertBalanced(content, /\{maccms:foreach\b/g, /\{\/maccms:foreach\}/g, "maccms:foreach", file);

  const ifOpenCount = (content.match(/\{if condition=/g)?.length || 0) + (content.match(/\{elseif condition=/g)?.length || 0);
  const ifCloseCount = content.match(/\{\/if\}/g)?.length || 0;
  assert.ok(ifCloseCount <= ifOpenCount, `${file} should not close more if tags than it opens`);

  for (const match of content.matchAll(/\{include file="([^"]+)"(?:\s+[^{}]*)?\/\}/g)) {
    const includePath = path.join(htmlRoot, `${match[1]}.html`);
    assert.ok(existsSync(includePath), `${file} includes missing template ${match[1]}`);
  }

  if (!partials.has(file) && !xmlPages.has(file)) {
    if (file.startsWith("user/")) {
      assert.match(content, /\{include file="user\/head" \/\}/, `${file} should include user/head`);
      assert.match(content, /\{include file="user\/foot" \/\}/, `${file} should include user/foot`);
    } else {
      assert.match(content, /\{include file="public\/head"/, `${file} should include public/head`);
      assert.match(content, /\{include file="public\/foot" \/\}/, `${file} should include public/foot`);
    }
  }
}

console.log(`Template lint passed for ${files.length} files`);
