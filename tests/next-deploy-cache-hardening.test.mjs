import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  fileSha256,
  prepareNextCacheRoot,
  publishNextArtifactCache,
  validateNextArtifactManifest,
  writeNextArtifactManifest
} from "../scripts/next-artifact-cache.mjs";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const deployScript = readFileSync(path.join(workspaceRoot, "scripts/deploy-next-web.sh"), "utf8");
const cacheScript = path.join(workspaceRoot, "scripts/next-artifact-cache.mjs");
const fingerprintScript = readFileSync(path.join(workspaceRoot, "scripts/release-input-fingerprint.mjs"), "utf8");

const lockIndex = deployScript.indexOf('if ! mkdir "$NEXT_DEPLOY_LOCK_DIR"');
const initialFingerprintIndex = deployScript.indexOf('build_input_hash="$(node scripts/release-input-fingerprint.mjs next)"');
const installIndex = deployScript.indexOf("npm ci --no-audit --no-fund");
const buildIndex = deployScript.indexOf("npm run build:web");
const postBuildFingerprintIndex = deployScript.indexOf('post_build_input_hash="$(node scripts/release-input-fingerprint.mjs next)"');
const publishIndex = deployScript.indexOf("node scripts/next-artifact-cache.mjs publish");
const unlockIndex = deployScript.indexOf("\nrelease_local_deploy_lock\n", publishIndex);
const remoteDeployStartIndex = deployScript.indexOf("<<'REMOTE_DEPLOY'", publishIndex);
const remoteDeployEndIndex = deployScript.lastIndexOf("\nREMOTE_DEPLOY\n");

assert.ok(lockIndex >= 0 && lockIndex < installIndex, "the local deployment lock must cover npm ci");
assert.ok(
  initialFingerprintIndex > lockIndex && initialFingerprintIndex < buildIndex,
  "the build input fingerprint must be captured before the production build"
);
assert.ok(buildIndex > installIndex, "the production build must run after the local gate");
assert.match(
  deployScript.slice(buildIndex - 260, buildIndex + 40),
  /NODE_ENV=production[\s\S]*npm run build:web/,
  "the real Next.js build must use the NODE_ENV value recorded in its fingerprint"
);
assert.match(fingerprintScript, /"NODE_ENV=production"/);
assert.ok(
  postBuildFingerprintIndex > buildIndex && postBuildFingerprintIndex < publishIndex,
  "build inputs must be fingerprinted again immediately before cache publication"
);
assert.ok(publishIndex < unlockIndex, "the local deployment lock must cover atomic cache publication");
assert.ok(
  remoteDeployStartIndex > publishIndex && remoteDeployEndIndex > remoteDeployStartIndex && unlockIndex > remoteDeployEndIndex,
  "the local deployment lock must cover the complete remote deploy and rollback transaction"
);
assert.match(deployScript, /verified_cache_hash="\$\(node scripts\/next-artifact-cache\.mjs verify/);
assert.match(deployScript, /copied_artifact_hash="\$\(shasum -a 256/);
assert.match(deployScript, /"\$copied_artifact_hash" == "\$verified_cache_hash"/);
assert.doesNotMatch(deployScript, /artifact cache is disabled/);

const root = mkdtempSync(path.join(tmpdir(), "squaredmedia-next-cache-hardening-"));
try {
  const unsafeRepo = path.join(root, "unsafe-repo");
  const outside = path.join(root, "outside");
  mkdirSync(unsafeRepo);
  mkdirSync(outside);
  symlinkSync(outside, path.join(unsafeRepo, ".cache"));
  assert.throws(
    () => prepareNextCacheRoot(unsafeRepo, path.join(unsafeRepo, ".cache", "next-deploy", "v1")),
    /real directory/,
    "cache-root ancestors must not be symbolic links"
  );

  const repo = path.join(root, "repo");
  mkdirSync(repo);
  const cacheRoot = path.join(repo, ".cache", "next-deploy", "v1");
  assert.equal(prepareNextCacheRoot(repo, cacheRoot), cacheRoot);
  assert.throws(
    () => prepareNextCacheRoot(repo, path.join(root, "escaped-cache")),
    /Unexpected Next\.js cache root/,
    "the cache root must not escape the repository boundary"
  );

  const buildInput = "a".repeat(64);
  const archive = path.join(root, "artifact.tar.gz");
  const largeContent = Buffer.alloc(2 * 1024 * 1024 + 17, "a");
  writeFileSync(archive, largeContent);
  assert.equal(fileSha256(archive), createHash("sha256").update(largeContent).digest("hex"));

  const exclusiveManifest = path.join(root, "exclusive", "manifest.json");
  const exclusiveTarget = path.join(root, "exclusive-target.txt");
  mkdirSync(path.dirname(exclusiveManifest));
  writeFileSync(exclusiveTarget, "unchanged\n");
  symlinkSync(exclusiveTarget, `${exclusiveManifest}.${process.pid}.tmp`);
  assert.throws(() => writeNextArtifactManifest(exclusiveManifest, archive, buildInput), /EEXIST/, "manifest temporary files must be created exclusively");
  assert.equal(readFileSync(exclusiveTarget, "utf8"), "unchanged\n");

  const published = publishNextArtifactCache(repo, cacheRoot, archive, buildInput);
  const cacheEntry = path.join(cacheRoot, buildInput);
  const cacheArchive = path.join(cacheEntry, "artifact.tar.gz");
  const cacheManifest = path.join(cacheEntry, "manifest.json");
  assert.equal(published.artifactSha256, fileSha256(archive));
  assert.equal(validateNextArtifactManifest(cacheManifest, cacheArchive, buildInput, cacheRoot).valid, true);
  assert.deepEqual(readdirSync(cacheEntry).sort(), ["artifact.tar.gz", "manifest.json"]);
  assert.deepEqual(
    readdirSync(cacheRoot).filter((entry) => entry.startsWith(".publish-") || entry.startsWith(".stale-")),
    [],
    "cache publication must leave only the atomically renamed complete entry"
  );

  const verified = spawnSync(process.execPath, [cacheScript, "verify", cacheManifest, cacheArchive, buildInput, cacheRoot], { encoding: "utf8" });
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(verified.stdout.trim(), published.artifactSha256, "verify must print the manifest-backed SHA-256");
  const copiedArchive = path.join(root, "copied-artifact.tar.gz");
  copyFileSync(cacheArchive, copiedArchive);
  assert.equal(fileSha256(copiedArchive), verified.stdout.trim(), "a copied cache artifact must be hashed again");

  rmSync(cacheEntry, { recursive: true });
  const outsideEntry = path.join(outside, "entry");
  mkdirSync(outsideEntry);
  writeFileSync(path.join(outsideEntry, "artifact.tar.gz"), "outside");
  writeFileSync(path.join(outsideEntry, "manifest.json"), "{}");
  symlinkSync(outsideEntry, cacheEntry);
  assert.equal(
    validateNextArtifactManifest(cacheManifest, cacheArchive, buildInput, cacheRoot).valid,
    false,
    "a symlinked cache-entry ancestor must never validate"
  );
  assert.throws(() => publishNextArtifactCache(repo, cacheRoot, archive, buildInput), /symbolic links/, "cache publication must not replace a symlinked entry");
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Next.js deployment cache hardening tests passed");
