import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const schema = "squaredmedia-release-input-v1";
const ignoredParts = new Set([".cache", ".git", ".next", ".playwright-cli", "coverage", "dist", "node_modules", "output", "playwright-report", "test-results"]);
const excludedThemePackageFiles = new Set([
  "js/hls.min.js",
  "js/pingfang-player.js",
  "js/react.production.min.js",
  "js/react-dom.production.min.js",
  "js/rank-react.js"
]);
const releaseSources = [
  { relativePath: "template/pingfangvideo", excludedFiles: excludedThemePackageFiles },
  { relativePath: "addons/pingfangdevice" },
  { relativePath: "addons/pingfangapi" }
];

function commandVersion(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

function isGeneratedPath(relativePath) {
  const parts = relativePath.split("/");
  return relativePath === "apps/web/next-env.d.ts" || parts.some((part) => ignoredParts.has(part)) || relativePath.endsWith(".tsbuildinfo");
}

function isNextBuildInput(relativePath) {
  return (
    relativePath === "package.json" ||
    relativePath === "package-lock.json" ||
    relativePath === "scripts/deploy-next-web.sh" ||
    relativePath === "scripts/release-input-fingerprint.mjs" ||
    relativePath === "scripts/next-artifact-cache.mjs" ||
    relativePath === "template/pingfangvideo/css/style.css" ||
    relativePath.startsWith("apps/web/")
  );
}

export function fingerprintEntries(root, entries, metadata = []) {
  const hash = createHash("sha256");
  hash.update(`${schema}\0`);
  for (const value of metadata) hash.update(`meta\0${value}\0`);

  for (const relativePath of [...new Set(entries)].sort()) {
    const normalized = relativePath.split(path.sep).join("/");
    const absolutePath = path.join(root, relativePath);
    let stats;
    try {
      stats = lstatSync(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        hash.update(`missing\0${normalized}\0`);
        continue;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) throw new Error(`Release input must not be a symbolic link: ${normalized}`);
    if (!stats.isFile()) throw new Error(`Release input must be a regular file: ${normalized}`);
    hash.update(`file\0${normalized}\0${(stats.mode & 0o777).toString(8)}\0${stats.size}\0`);
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function gitFiles(root) {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "buffer"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString("utf8").trim() || "Unable to enumerate release inputs with git");
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.split(path.sep).join("/"));
}

function packagedFiles(root, source) {
  const sourceRoot = path.join(root, source.relativePath);
  const rootStats = lstatSync(sourceRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`Unsupported release entry type: ${source.relativePath}`);
  }

  const files = [];
  function visit(directory) {
    for (const basename of readdirSync(directory)) {
      if (basename.startsWith(".")) continue;
      const absolutePath = path.join(directory, basename);
      const stats = lstatSync(absolutePath);
      const sourceRelativePath = path.relative(sourceRoot, absolutePath).split(path.sep).join("/");
      const repositoryRelativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (stats.isSymbolicLink() || (!stats.isDirectory() && !stats.isFile())) {
        throw new Error(`Unsupported release entry type: ${repositoryRelativePath}`);
      }
      if (source.excludedFiles?.has(sourceRelativePath)) continue;
      if (stats.isDirectory()) visit(absolutePath);
      else files.push(repositoryRelativePath);
    }
  }
  visit(sourceRoot);
  return files;
}

export function repositoryFiles(root) {
  const files = new Set(gitFiles(root));
  for (const source of releaseSources) {
    for (const relativePath of packagedFiles(root, source)) files.add(relativePath);
  }
  return [...files];
}

export function createReleaseFingerprint(root, kind) {
  if (kind !== "repository" && kind !== "next") throw new Error("Fingerprint kind must be repository or next");
  const files = kind === "repository" ? repositoryFiles(root) : gitFiles(root).filter((entry) => !isGeneratedPath(entry) && isNextBuildInput(entry));
  const metadata = [
    `kind=${kind}`,
    `platform=${process.platform}`,
    `arch=${process.arch}`,
    `node=${process.version}`,
    `npm=${commandVersion("npm", ["--version"])}`
  ];
  if (kind === "repository") metadata.push(`php=${commandVersion("php", ["-r", "echo PHP_VERSION;"])}`);
  if (kind === "next") {
    metadata.push(
      "target=linux-x64-glibc",
      "NODE_ENV=production",
      "NEXT_PUBLIC_API_BASE_URL=/index.php/pingfangapi/index",
      "NEXT_PUBLIC_HOME_API_URL=/index.php/pingfangapi/index",
      "MACCMS_ORIGIN=",
      "SQUAREDMEDIA_LOW_MEMORY_BUILD=0"
    );
  }
  return fingerprintEntries(root, files, metadata);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const kind = process.argv[2];
  try {
    process.stdout.write(`${createReleaseFingerprint(process.cwd(), kind)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
