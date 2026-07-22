import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fingerprintEntries } from "../scripts/release-input-fingerprint.mjs";
import { validateNextArtifactManifest, writeNextArtifactManifest } from "../scripts/next-artifact-cache.mjs";

const root = mkdtempSync(path.join(tmpdir(), "squaredmedia-release-cache-"));
try {
  mkdirSync(path.join(root, "nested"));
  writeFileSync(path.join(root, "a.txt"), "alpha");
  writeFileSync(path.join(root, "nested", "b.txt"), "beta");
  const entries = ["nested/b.txt", "a.txt"];
  const first = fingerprintEntries(root, entries, ["target=test"]);
  assert.equal(first, fingerprintEntries(root, [...entries].reverse(), ["target=test"]));

  utimesSync(path.join(root, "a.txt"), new Date(), new Date());
  assert.equal(first, fingerprintEntries(root, entries, ["target=test"]), "mtime must not change a release fingerprint");
  writeFileSync(path.join(root, "a.txt"), "changed");
  assert.notEqual(first, fingerprintEntries(root, entries, ["target=test"]), "content must change a release fingerprint");
  writeFileSync(path.join(root, "a.txt"), "alpha");
  chmodSync(path.join(root, "a.txt"), 0o600);
  assert.notEqual(first, fingerprintEntries(root, entries, ["target=test"]), "mode must change a release fingerprint");

  symlinkSync(path.join(root, "a.txt"), path.join(root, "link.txt"));
  assert.throws(() => fingerprintEntries(root, ["link.txt"]), /must not be a symbolic link/);

  const archive = path.join(root, "artifact.tar.gz");
  const manifest = path.join(root, "cache", "manifest.json");
  const buildInput = "a".repeat(64);
  writeFileSync(archive, "artifact-v1");
  writeNextArtifactManifest(manifest, archive, buildInput);
  assert.equal(validateNextArtifactManifest(manifest, archive, buildInput).valid, true);
  assert.equal(validateNextArtifactManifest(manifest, archive, "b".repeat(64)).valid, false);
  const unsafeManifest = JSON.parse(readFileSync(manifest, "utf8"));
  unsafeManifest.target = "darwin-arm64";
  writeFileSync(manifest, JSON.stringify(unsafeManifest));
  assert.equal(validateNextArtifactManifest(manifest, archive, buildInput).valid, false, "wrong target must miss the cache");
  writeNextArtifactManifest(manifest, archive, buildInput);
  symlinkSync(manifest, path.join(root, "manifest-link.json"));
  assert.equal(
    validateNextArtifactManifest(path.join(root, "manifest-link.json"), archive, buildInput).valid,
    false,
    "symbolic-link manifests must miss the cache"
  );
  writeFileSync(archive, "artifact-v2");
  assert.equal(validateNextArtifactManifest(manifest, archive, buildInput).valid, false, "tampered artifacts must miss the cache");
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Release cache tests passed");
