import { rmSync, mkdirSync, cpSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const themeName = "pingfangvideo";
const addonNames = ["pingfangdevice", "douban"];
const source = path.join(root, "template", themeName);
const dist = path.join(root, "dist");
const packageRoot = path.join(dist, themeName);
const archive = path.join(dist, `${themeName}.tar.gz`);
const assetVersionPlaceholder = "__PINGFANG_ASSET_VERSION__";
const assetVersionInputs = [
  "css/style.css",
  "js/rank-react.js",
  "js/app.js",
];

function assetVersion() {
  const hash = createHash("sha256");
  for (const relativePath of assetVersionInputs) {
    const filePath = path.join(source, relativePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

function replaceAssetVersionPlaceholders(directory, version) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      replaceAssetVersionPlaceholders(filePath, version);
      continue;
    }
    if (!stats.isFile() || !filePath.endsWith(".html")) continue;

    const content = readFileSync(filePath, "utf8");
    if (!content.includes(assetVersionPlaceholder)) continue;
    writeFileSync(filePath, content.replaceAll(assetVersionPlaceholder, version));
  }
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
  filter: (sourcePath) => !path.basename(sourcePath).startsWith("."),
});
const version = assetVersion();
replaceAssetVersionPlaceholders(packageRoot, version);
normalizePackagePermissions(packageRoot);
execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", dist, themeName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1",
  },
  stdio: "inherit",
});

console.log(`Created ${archive} with asset version ${version}`);

for (const addonName of addonNames) {
  const addonSource = path.join(root, "addons", addonName);
  const addonPackageRoot = path.join(dist, addonName);
  const addonArchive = path.join(dist, `${addonName}.tar.gz`);
  cpSync(addonSource, addonPackageRoot, {
    recursive: true,
    filter: (sourcePath) => !path.basename(sourcePath).startsWith("."),
  });
  normalizePackagePermissions(addonPackageRoot);
  execFileSync("tar", ["--no-xattrs", "-czf", addonArchive, "-C", dist, addonName], {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1",
    },
    stdio: "inherit",
  });
  console.log(`Created ${addonArchive}`);
}
