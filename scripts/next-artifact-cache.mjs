import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const schema = 1;
const kind = "squaredmedia-next-standalone";
const target = "linux-x64-glibc";
const sha256Pattern = /^[a-f0-9]{64}$/;

export function fileSha256(file) {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = openSync(file, "r");
  try {
    let bytesRead;
    while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function assertDirectory(directory, label) {
  const stats = lstatSync(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`${label} must be a real directory: ${directory}`);
}

function assertInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Cache path escapes its root: ${target}`);
  }
  return { resolvedRoot, resolvedTarget };
}

function assertSafeCachePath(cacheRoot, target, expectedType) {
  const { resolvedRoot, resolvedTarget } = assertInside(cacheRoot, target);
  assertDirectory(resolvedRoot, "Cache root");
  let current = resolvedRoot;
  const parts = path.relative(resolvedRoot, resolvedTarget).split(path.sep).filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) throw new Error(`Cache path must not contain symbolic links: ${current}`);
    if (index < parts.length - 1 && !stats.isDirectory()) throw new Error(`Cache path ancestor must be a directory: ${current}`);
    if (index === parts.length - 1 && expectedType === "file" && !stats.isFile()) {
      throw new Error(`Cache path must be a regular file: ${current}`);
    }
    if (index === parts.length - 1 && expectedType === "directory" && !stats.isDirectory()) {
      throw new Error(`Cache path must be a directory: ${current}`);
    }
  }
}

function regularFile(file, cacheRoot) {
  try {
    if (cacheRoot) assertSafeCachePath(cacheRoot, file, "file");
    const stats = lstatSync(file);
    return stats.isFile() && !stats.isSymbolicLink();
  } catch {
    return false;
  }
}

export function prepareNextCacheRoot(repoRoot, cacheRoot) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedCacheRoot = path.resolve(cacheRoot);
  const expectedCacheRoot = path.join(resolvedRepoRoot, ".cache", "next-deploy", "v1");
  if (resolvedCacheRoot !== expectedCacheRoot) throw new Error(`Unexpected Next.js cache root: ${cacheRoot}`);
  assertDirectory(resolvedRepoRoot, "Repository root");

  let current = resolvedRepoRoot;
  for (const part of path.relative(resolvedRepoRoot, resolvedCacheRoot).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      assertDirectory(current, "Cache ancestor");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      try {
        mkdirSync(current, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError?.code !== "EEXIST") throw mkdirError;
      }
      assertDirectory(current, "Cache ancestor");
    }
  }
  chmodSync(resolvedCacheRoot, 0o700);
  return resolvedCacheRoot;
}

export function validateNextArtifactManifest(manifestFile, archiveFile, expectedBuildInputSha256, cacheRoot) {
  if (!sha256Pattern.test(expectedBuildInputSha256)) return { valid: false, reason: "invalid build input hash" };
  if (!regularFile(manifestFile, cacheRoot) || !regularFile(archiveFile, cacheRoot)) {
    return { valid: false, reason: "cache files are missing or unsafe" };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch {
    return { valid: false, reason: "cache manifest is not valid JSON" };
  }
  const archiveStats = statSync(archiveFile);
  const artifactSha256 = fileSha256(archiveFile);
  const valid =
    manifest?.schema === schema &&
    manifest?.kind === kind &&
    manifest?.target === target &&
    manifest?.buildInputSha256 === expectedBuildInputSha256 &&
    manifest?.artifactSha256 === artifactSha256 &&
    manifest?.artifactBytes === archiveStats.size;
  return { valid, reason: valid ? "" : "cache manifest does not match the artifact", artifactSha256 };
}

export function writeNextArtifactManifest(manifestFile, archiveFile, buildInputSha256, cacheRoot) {
  if (!sha256Pattern.test(buildInputSha256)) throw new Error("Invalid Next.js build input hash");
  if (cacheRoot) {
    assertInside(cacheRoot, manifestFile);
    assertSafeCachePath(cacheRoot, path.dirname(manifestFile), "directory");
  }
  if (!regularFile(archiveFile, cacheRoot)) throw new Error("Next.js artifact cache requires a regular archive file");
  const archiveStats = statSync(archiveFile);
  const manifest = {
    schema,
    kind,
    target,
    buildInputSha256,
    artifactSha256: fileSha256(archiveFile),
    artifactBytes: archiveStats.size,
    createdAt: new Date().toISOString()
  };
  mkdirSync(path.dirname(manifestFile), { recursive: true, mode: 0o700 });
  const temporaryFile = `${manifestFile}.${process.pid}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporaryFile, `${JSON.stringify(manifest)}\n`, { flag: "wx", mode: 0o600 });
    temporaryCreated = true;
    renameSync(temporaryFile, manifestFile);
    temporaryCreated = false;
  } finally {
    if (temporaryCreated) rmSync(temporaryFile, { force: true });
  }
  return manifest;
}

export function publishNextArtifactCache(repoRoot, cacheRoot, archiveFile, buildInputSha256) {
  if (!sha256Pattern.test(buildInputSha256)) throw new Error("Invalid Next.js build input hash");
  const resolvedCacheRoot = prepareNextCacheRoot(repoRoot, cacheRoot);
  if (!regularFile(archiveFile)) throw new Error("Next.js artifact cache requires a regular source archive");

  const cacheEntry = path.join(resolvedCacheRoot, buildInputSha256);
  if (existsSync(cacheEntry)) assertSafeCachePath(resolvedCacheRoot, cacheEntry, "directory");

  let temporaryEntry = mkdtempSync(path.join(resolvedCacheRoot, `.publish-${buildInputSha256}-`));
  chmodSync(temporaryEntry, 0o700);
  let staleEntry = "";
  try {
    const temporaryArchive = path.join(temporaryEntry, "artifact.tar.gz");
    const temporaryManifest = path.join(temporaryEntry, "manifest.json");
    copyFileSync(archiveFile, temporaryArchive, constants.COPYFILE_EXCL);
    chmodSync(temporaryArchive, 0o600);
    const manifest = writeNextArtifactManifest(temporaryManifest, temporaryArchive, buildInputSha256, resolvedCacheRoot);
    const validation = validateNextArtifactManifest(temporaryManifest, temporaryArchive, buildInputSha256, resolvedCacheRoot);
    if (!validation.valid || validation.artifactSha256 !== manifest.artifactSha256) {
      throw new Error("Completed Next.js cache entry failed validation");
    }

    if (existsSync(cacheEntry)) {
      staleEntry = mkdtempSync(path.join(resolvedCacheRoot, `.stale-${buildInputSha256}-`));
      rmdirSync(staleEntry);
      renameSync(cacheEntry, staleEntry);
    }
    renameSync(temporaryEntry, cacheEntry);
    temporaryEntry = "";
    if (staleEntry) {
      rmSync(staleEntry, { recursive: true, force: true });
      staleEntry = "";
    }
    return manifest;
  } catch (error) {
    if (staleEntry && !existsSync(cacheEntry) && existsSync(staleEntry)) {
      renameSync(staleEntry, cacheEntry);
      staleEntry = "";
    }
    throw error;
  } finally {
    if (temporaryEntry) rmSync(temporaryEntry, { recursive: true, force: true });
    if (staleEntry) rmSync(staleEntry, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, first, second, third, fourth] = process.argv.slice(2);
  try {
    if (command === "prepare") {
      process.stdout.write(`${prepareNextCacheRoot(first, second)}\n`);
    } else if (command === "verify") {
      const result = validateNextArtifactManifest(first, second, third, fourth);
      if (!result.valid) throw new Error(result.reason);
      process.stdout.write(`${result.artifactSha256}\n`);
    } else if (command === "write") {
      process.stdout.write(`${writeNextArtifactManifest(first, second, third, fourth).artifactSha256}\n`);
    } else if (command === "publish") {
      process.stdout.write(`${publishNextArtifactCache(first, second, third, fourth).artifactSha256}\n`);
    } else {
      throw new Error("Usage: next-artifact-cache.mjs prepare|verify|write|publish ...");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
