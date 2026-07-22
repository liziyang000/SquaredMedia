import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createReleaseFingerprint, repositoryFiles } from "../scripts/release-input-fingerprint.mjs";

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || `git ${args.join(" ")} failed`);
}

const root = mkdtempSync(path.join(tmpdir(), "squaredmedia-release-input-"));
try {
  git(root, ["init", "--quiet"]);
  mkdirSync(path.join(root, "addons", "pingfangapi", "output"), { recursive: true });
  mkdirSync(path.join(root, "addons", "pingfangdevice"), { recursive: true });
  mkdirSync(path.join(root, "apps", "web", "output"), { recursive: true });
  mkdirSync(path.join(root, "dist"));
  mkdirSync(path.join(root, "template", "pingfangvideo", "css"), { recursive: true });
  writeFileSync(path.join(root, ".gitignore"), "dist/\naddons/pingfangapi/runtime.log\naddons/pingfangapi/ignored-link\n");
  writeFileSync(path.join(root, "addons", "pingfangapi", "output", "X.php"), "tracked-v1\n");
  writeFileSync(path.join(root, "addons", "pingfangapi", "runtime.log"), "runtime-v1\n");
  writeFileSync(path.join(root, "apps", "web", "next-env.d.ts"), 'import "./.next/types/routes.d.ts";\n');
  writeFileSync(path.join(root, "apps", "web", "output", "generated.js"), "generated-v1\n");
  writeFileSync(path.join(root, "template", "pingfangvideo", "css", "style.css"), "body { color: red; }\n");
  git(root, [
    "add",
    ".gitignore",
    "addons/pingfangapi/output/X.php",
    "apps/web/next-env.d.ts",
    "apps/web/output/generated.js",
    "template/pingfangvideo/css/style.css"
  ]);

  writeFileSync(path.join(root, "untracked.txt"), "untracked-v1\n");
  writeFileSync(path.join(root, "dist", "ignored.txt"), "ignored-v1\n");

  const files = repositoryFiles(root);
  assert(files.includes("addons/pingfangapi/output/X.php"), "tracked output paths must be repository inputs");
  assert(files.includes("addons/pingfangapi/runtime.log"), "ignored packaged files must be repository inputs");
  assert(files.includes("untracked.txt"), "untracked nonignored files must be repository inputs");
  assert(!files.includes("dist/ignored.txt"), "git-ignored files must not be repository inputs");

  const initial = createReleaseFingerprint(root, "repository");
  writeFileSync(path.join(root, "addons", "pingfangapi", "runtime.log"), "runtime-v2\n");
  const ignoredPackagedChanged = createReleaseFingerprint(root, "repository");
  assert.notEqual(initial, ignoredPackagedChanged, "ignored packaged content must change the repository fingerprint");

  writeFileSync(path.join(root, "addons", "pingfangapi", "output", "X.php"), "tracked-v2\n");
  const trackedChanged = createReleaseFingerprint(root, "repository");
  assert.notEqual(ignoredPackagedChanged, trackedChanged, "tracked output content must change the repository fingerprint");

  writeFileSync(path.join(root, "untracked.txt"), "untracked-v2\n");
  const untrackedChanged = createReleaseFingerprint(root, "repository");
  assert.notEqual(trackedChanged, untrackedChanged, "untracked content must change the repository fingerprint");

  writeFileSync(path.join(root, "dist", "ignored.txt"), "ignored-v2\n");
  assert.equal(untrackedChanged, createReleaseFingerprint(root, "repository"), "ignored content must not change the repository fingerprint");

  const nextInitial = createReleaseFingerprint(root, "next");
  writeFileSync(path.join(root, "apps", "web", "output", "generated.js"), "generated-v2\n");
  assert.equal(nextInitial, createReleaseFingerprint(root, "next"), "generated path segments must remain excluded from Next fingerprints");
  writeFileSync(path.join(root, "apps", "web", "next-env.d.ts"), 'import "./.next/dev/types/routes.d.ts";\n');
  assert.equal(nextInitial, createReleaseFingerprint(root, "next"), "generated next-env.d.ts content must not change the Next fingerprint");
  writeFileSync(path.join(root, "template", "pingfangvideo", "css", "style.css"), "body { color: blue; }\n");
  assert.notEqual(nextInitial, createReleaseFingerprint(root, "next"), "imported theme CSS content must change the Next fingerprint");

  symlinkSync(path.join(root, "untracked.txt"), path.join(root, "addons", "pingfangapi", "ignored-link"));
  assert.doesNotThrow(() => createReleaseFingerprint(root, "next"), "release-only entries must not affect Next fingerprints");
  assert.throws(
    () => createReleaseFingerprint(root, "repository"),
    /Unsupported release entry type: addons\/pingfangapi\/ignored-link/,
    "ignored symbolic links in a release source must be rejected"
  );
  unlinkSync(path.join(root, "addons", "pingfangapi", "ignored-link"));
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("Release input fingerprint tests passed");
