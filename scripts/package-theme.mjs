import { rmSync, mkdirSync, cpSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const themeName = "pingfangvideo";
const addonNames = ["pingfangdevice", "vodops"];
const source = path.join(root, "template", themeName);
const dist = path.join(root, "dist");
const packageRoot = path.join(dist, themeName);
const archive = path.join(dist, `${themeName}.tar.gz`);
const assetVersionInputs = {
  __PINGFANG_BASE_STYLE_VERSION__: "css/base.css",
  __PINGFANG_STYLE_VERSION__: "css/style.css",
  __PINGFANG_INK_WASH_VERSION__: "css/ink-wash.css",
  __PINGFANG_THEME_FOUNDATION_VERSION__: "css/themes-foundation.css",
  __PINGFANG_THEMES_VERSION__: "css/themes.css",
  __PINGFANG_GAMES_STYLE_VERSION__: "css/games.css",
  __PINGFANG_RESPONSIVE_STYLE_VERSION__: "css/responsive.css",
  __PINGFANG_APP_VERSION__: "js/app.js",
  __PINGFANG_PROMPT_VERSION__: "player/prompt.css",
  __PINGFANG_GAME_VERSION__: "games/init.js",
  __PINGFANG_BLOCKRAIN_VERSION__: "games/blockrain/blockrain.jquery.min.js",
  __PINGFANG_BAMBOO_CICADA_VERSION__: "games/bamboo-cicada.js",
  __PINGFANG_MULTIPLAYER_VERSION__: "js/multiplayer-games.js",
  __PINGFANG_QIXI_VERSION__: "js/qixi-particle-bouquet.js",
  __PINGFANG_QIXI_STYLE_VERSION__: "css/qixi-bouquet.css",
};
const excludedThemePackageFiles = new Set([
  "games/blockrain/jquery-1.11.1.min.js",
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
for (const addonName of addonNames) {
  cpSync(path.join(root, "addons", addonName), path.join(dist, addonName), {
    recursive: true,
    filter: (sourcePath) => !path.basename(sourcePath).startsWith("."),
  });
}
const versions = Object.fromEntries(
  Object.entries(assetVersionInputs).map(([placeholder, relativePath]) => [placeholder, assetVersion(relativePath)]),
);
replaceAssetVersionPlaceholders(packageRoot, versions);
normalizePackagePermissions(packageRoot);
for (const addonName of addonNames) {
  normalizePackagePermissions(path.join(dist, addonName));
}
execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", dist, themeName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1",
  },
  stdio: "inherit",
});
console.log(`Created ${archive} with per-file asset versions`);
for (const addonName of addonNames) {
  const addonArchive = path.join(dist, `${addonName}.tar.gz`);
  execFileSync("tar", ["--no-xattrs", "-czf", addonArchive, "-C", dist, addonName], {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1",
    },
    stdio: "inherit",
  });
  console.log(`Created ${addonArchive}`);
}
