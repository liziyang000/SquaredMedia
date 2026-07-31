import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextRoot = path.join(root, "apps/web/.next");
const appRoot = path.join(nextRoot, "server/app");
const manifestPath = path.join(nextRoot, "prerender-manifest.json");
const bailoutMarker = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
const oldFallbackText = ["正在加载页面", "正在准备内容与会员会话"];

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? htmlFiles(entryPath) : entry.name.endsWith(".html") ? [entryPath] : [];
    })
  );
  return nestedFiles.flat();
}

function routeHtmlPath(route) {
  return path.join(appRoot, route === "/" ? "index.html" : `${route.slice(1)}.html`);
}

function staticMarkup(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

let files;
let manifest;
try {
  [files, manifest] = await Promise.all([htmlFiles(appRoot), readFile(manifestPath, "utf8").then(JSON.parse)]);
} catch (error) {
  console.error(`Next.js 预渲染产物不可读：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error("Next.js 预渲染目录中没有 HTML 文件。");
  process.exit(1);
}

const bailoutFiles = [];
for (const file of files) {
  if ((await readFile(file, "utf8")).includes(bailoutMarker)) bailoutFiles.push(path.relative(root, file));
}

if (bailoutFiles.length > 0) {
  console.error(`检测到全页 CSR bailout：\n${bailoutFiles.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}

const staticRoutes = Object.keys(manifest.routes ?? {}).filter((route) => !route.startsWith("/_"));
if (staticRoutes.length === 0) {
  console.error("prerender-manifest.json 中没有可验证的静态应用路由。");
  process.exit(1);
}

const failures = [];
for (const route of staticRoutes) {
  const file = routeHtmlPath(route);
  let markup;
  try {
    markup = staticMarkup(await readFile(file, "utf8"));
  } catch {
    failures.push(`${route}: 缺少 ${path.relative(root, file)}`);
    continue;
  }
  if (!/class="[^"]*\breact-app\b/.test(markup)) failures.push(`${route}: 缺少 react-app 静态壳`);
  if (!/class="[^"]*\bsite-header\b/.test(markup)) failures.push(`${route}: 缺少 site-header`);
  if (!markup.includes("正在确认登录状态")) failures.push(`${route}: 缺少 session-first 状态`);
  for (const text of oldFallbackText) {
    if (markup.includes(text)) failures.push(`${route}: 仍包含旧根级 fallback “${text}”`);
  }
}

if (failures.length > 0) {
  console.error(`Next.js 静态壳验证失败：\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log(`Next.js 预渲染验证通过：${files.length} 个 HTML 无全页 CSR bailout，${staticRoutes.length} 个静态路由保留 session-first 静态壳。`);
