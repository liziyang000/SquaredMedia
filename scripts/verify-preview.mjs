import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const routes = [
  ["route=home", ["hero-carousel", "最新上线"]],
  ["route=categories", ["category-index", "全部分类"]],
  ["route=categories&page=2", ["category-index", "page-state"]],
  ["route=category&name=电影&sort=score", ["分类浏览", "vod-grid"]],
  ["route=category&area=中国香港", ["午夜档案", "共 1 部内容"]],
  ["route=category&year=2025", ["南城旧事", "共 1 部内容"]],
  ["route=category&class=悬疑", ["午夜档案", "共 2 部内容"]],
  ["route=search&wd=云端", ["搜索结果", "云端"]],
  ["route=detail&id=1", ["detail-panel", "立即播放"]],
  ["route=play&id=1&episode=1", ["player-shell", "正在播放"]],
  ["route=player&id=1&episode=1", ["player-shell", "试看播放"]],
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

for (const [query, expected] of routes) {
  const html = render(query);
  assert.match(html, /<!doctype html>/, `${query} should render a full HTML document`);
  assert.match(html, /<main>/, `${query} should include the main layout`);
  assert.doesNotMatch(html, /Fatal error|Parse error|Warning:/, `${query} should render without PHP runtime errors`);

  for (const marker of expected) {
    assert.ok(html.includes(marker), `${query} should include ${marker}`);
  }
}

console.log("Preview verification passed");
