import { rmSync, mkdirSync, cpSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const themeName = "pingfangvideo";
const addonName = "pingfangdevice";
const source = path.join(root, "template", themeName);
const addonSource = path.join(root, "addons", addonName);
const dist = path.join(root, "dist");
const packageRoot = path.join(dist, themeName);
const archive = path.join(dist, `${themeName}.tar.gz`);
const addonPackageRoot = path.join(dist, addonName);
const addonArchive = path.join(dist, `${addonName}.tar.gz`);
const assetVersionInputs = {
  __PINGFANG_STYLE_VERSION__: "css/style.css",
  __PINGFANG_APP_VERSION__: "js/app.js",
  __PINGFANG_PROMPT_VERSION__: "player/prompt.css",
};
const excludedThemePackageFiles = new Set([
  "js/hls.min.js",
  "js/pingfang-player.js",
  "js/react.production.min.js",
  "js/react-dom.production.min.js",
  "js/rank-react.js",
]);

function assetVersion(relativePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path.join(source, relativePath)));
  return hash.digest("hex").slice(0, 12);
}

function replaceAssetVersionPlaceholders(directory, versions) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      replaceAssetVersionPlaceholders(filePath, versions);
      continue;
    }
    if (!stats.isFile() || !filePath.endsWith(".html")) continue;

    const content = readFileSync(filePath, "utf8");
    let nextContent = content;
    for (const [placeholder, version] of Object.entries(versions)) {
      nextContent = nextContent.replaceAll(placeholder, version);
    }
    if (nextContent !== content) writeFileSync(filePath, nextContent);
  }
}

function shouldCopyThemePath(sourcePath) {
  if (path.basename(sourcePath).startsWith(".")) return false;
  const relativePath = path.relative(source, sourcePath).split(path.sep).join("/");
  return !excludedThemePackageFiles.has(relativePath);
}

function normalizePackagePermissions(directory) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      chmodSync(filePath, 0o755);
      normalizePackagePermissions(filePath);
      continue;
    }
    if (stats.isFile()) {
      chmodSync(filePath, 0o644);
    }
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(source, packageRoot, {
  recursive: true,
  filter: shouldCopyThemePath,
});
cpSync(addonSource, addonPackageRoot, {
  recursive: true,
  filter: (sourcePath) => !path.basename(sourcePath).startsWith("."),
});
const versions = Object.fromEntries(
  Object.entries(assetVersionInputs).map(([placeholder, relativePath]) => [placeholder, assetVersion(relativePath)]),
);
replaceAssetVersionPlaceholders(packageRoot, versions);
normalizePackagePermissions(packageRoot);
normalizePackagePermissions(addonPackageRoot);
execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", dist, themeName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1",
  },
  stdio: "inherit",
});
execFileSync("tar", ["--no-xattrs", "-czf", addonArchive, "-C", dist, addonName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1",
  },
  stdio: "inherit",
});

console.log(`Created ${archive} with per-file asset versions`);
console.log(`Created ${addonArchive}`);
