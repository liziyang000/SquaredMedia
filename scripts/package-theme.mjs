import { rmSync, mkdirSync, cpSync, readFileSync, readdirSync, statSync, lstatSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const scope = process.env.DEPLOY_SCOPE || "all";
if (!["all", "backend", "api"].includes(scope)) {
  throw new Error("DEPLOY_SCOPE must be all, backend, or api");
}
const includeTheme = scope === "all";
const includeDevice = scope !== "api";
const themeName = "pingfangvideo";
const addonName = "pingfangdevice";
const apiAddonName = "pingfangapi";
const source = path.join(root, "template", themeName);
const addonSource = path.join(root, "addons", addonName);
const apiAddonSource = path.join(root, "addons", apiAddonName);
const dist = path.join(root, "dist");
const packageRoot = path.join(dist, themeName);
const archive = path.join(dist, `${themeName}.tar.gz`);
const addonPackageRoot = path.join(dist, addonName);
const addonArchive = path.join(dist, `${addonName}.tar.gz`);
const apiAddonPackageRoot = path.join(dist, apiAddonName);
const apiAddonArchive = path.join(dist, `${apiAddonName}.tar.gz`);
const assetVersionInputs = {
  __PINGFANG_STYLE_VERSION__: "css/style.css",
  __PINGFANG_APP_VERSION__: "js/app.js",
  __PINGFANG_PROMPT_VERSION__: "player/prompt.css"
};
const excludedThemePackageFiles = new Set([
  "js/hls.min.js",
  "js/pingfang-player.js",
  "js/react.production.min.js",
  "js/react-dom.production.min.js",
  "js/rank-react.js"
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
  const stats = lstatSync(sourcePath);
  if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile())) {
    throw new Error(`Unsupported release entry type: ${sourcePath}`);
  }
  const relativePath = path.relative(source, sourcePath).split(path.sep).join("/");
  return !excludedThemePackageFiles.has(relativePath);
}

function shouldCopyAddonPath(sourcePath) {
  if (path.basename(sourcePath).startsWith(".")) return false;
  const stats = lstatSync(sourcePath);
  if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile())) {
    throw new Error(`Unsupported release entry type: ${sourcePath}`);
  }
  return true;
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
if (includeTheme) {
  cpSync(source, packageRoot, {
    recursive: true,
    filter: shouldCopyThemePath
  });
}
if (includeDevice) {
  cpSync(addonSource, addonPackageRoot, {
    recursive: true,
    filter: shouldCopyAddonPath
  });
}
cpSync(apiAddonSource, apiAddonPackageRoot, {
  recursive: true,
  filter: shouldCopyAddonPath
});
if (includeTheme) {
  const versions = Object.fromEntries(Object.entries(assetVersionInputs).map(([placeholder, relativePath]) => [placeholder, assetVersion(relativePath)]));
  replaceAssetVersionPlaceholders(packageRoot, versions);
  normalizePackagePermissions(packageRoot);
}
if (includeDevice) normalizePackagePermissions(addonPackageRoot);
normalizePackagePermissions(apiAddonPackageRoot);
if (includeTheme) {
  execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", dist, themeName], {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1"
    },
    stdio: "inherit"
  });
}
if (includeDevice) {
  execFileSync("tar", ["--no-xattrs", "-czf", addonArchive, "-C", dist, addonName], {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1"
    },
    stdio: "inherit"
  });
}
execFileSync("tar", ["--no-xattrs", "-czf", apiAddonArchive, "-C", dist, apiAddonName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1"
  },
  stdio: "inherit"
});

if (includeTheme) console.log(`Created ${archive} with per-file asset versions`);
if (includeDevice) console.log(`Created ${addonArchive}`);
console.log(`Created ${apiAddonArchive}`);
