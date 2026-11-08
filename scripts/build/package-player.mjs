import { chmodSync, copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { packageName, expectedDependencyVersions, packageFiles } from "./player-manifest.mjs";

const root = process.cwd();
const distRoot = path.join(root, "dist");
const packageRoot = path.join(distRoot, packageName);
const archive = path.join(distRoot, `${packageName}.tar.gz`);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertDependencyVersions() {
  const projectPackage = readJson(path.join(root, "package.json"));
  for (const [dependency, version] of Object.entries(expectedDependencyVersions)) {
    if (projectPackage.devDependencies?.[dependency] !== version) {
      throw new Error(`${dependency} must be pinned exactly to ${version} in package.json`);
    }
    const installedPackagePath = path.join(root, "node_modules", dependency, "package.json");
    assertSafeSourceFile(installedPackagePath);
    if (readJson(installedPackagePath).version !== version) {
      throw new Error(`Installed ${dependency} must be version ${version}`);
    }
  }
}

function assertSafeSourceFile(filePath) {
  const relativePath = path.relative(root, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Player source must stay inside the repository: ${filePath}`);
  }

  let currentPath = root;
  for (const part of relativePath.split(path.sep)) {
    currentPath = path.join(currentPath, part);
    const stats = lstatSync(currentPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in player source: ${relativePath}`);
    }
  }

  const stats = lstatSync(currentPath);
  if (!stats.isFile()) {
    throw new Error(`Player source must be a regular file: ${relativePath}`);
  }
}

function normalizePackagePermissions(directory) {
  chmodSync(directory, 0o755);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Player package must not contain symbolic links: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      normalizePackagePermissions(entryPath);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Player package must contain only regular files: ${entryPath}`);
    }
    chmodSync(entryPath, 0o644);
  }
}

assertDependencyVersions();
for (const file of packageFiles) {
  assertSafeSourceFile(path.join(root, file.source));
}

rmSync(packageRoot, { recursive: true, force: true });
rmSync(archive, { force: true });
mkdirSync(packageRoot, { recursive: true });

for (const file of packageFiles) {
  const destination = path.join(packageRoot, file.destination);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(root, file.source), destination);
}

normalizePackagePermissions(packageRoot);
execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", distRoot, packageName], {
  env: {
    ...process.env,
    COPYFILE_DISABLE: "1"
  },
  stdio: "inherit"
});

console.log(`Created ${archive}`);
