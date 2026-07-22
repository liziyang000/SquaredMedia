import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageScript = path.join(root, "scripts", "package-theme.mjs");
const verifyScript = path.join(root, "scripts", "verify-release.mjs");

function run(script, cwd, scope) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, DEPLOY_SCOPE: scope }
  });
}

function copyAddon(testRoot, name) {
  const destination = path.join(testRoot, "addons", name);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(path.join(root, "addons", name), destination, { recursive: true });
}

const apiRoot = mkdtempSync(path.join(tmpdir(), "pingfang-api-package-"));
const backendRoot = mkdtempSync(path.join(tmpdir(), "pingfang-backend-package-"));
try {
  copyAddon(apiRoot, "pingfangapi");
  const apiPackage = run(packageScript, apiRoot, "api");
  assert.equal(apiPackage.status, 0, apiPackage.stderr);
  assert.deepEqual(readdirSync(path.join(apiRoot, "dist")).sort(), ["pingfangapi", "pingfangapi.tar.gz"]);
  const apiVerify = run(verifyScript, apiRoot, "api");
  assert.equal(apiVerify.status, 0, apiVerify.stderr);
  assert.notEqual(run(verifyScript, apiRoot, "all").status, 0, "full verification must reject an API-only dist directory");

  writeFileSync(path.join(apiRoot, "dist", "sentinel"), "keep");
  const invalidPackage = run(packageScript, apiRoot, "invalid");
  assert.notEqual(invalidPackage.status, 0);
  assert.match(invalidPackage.stderr, /DEPLOY_SCOPE must be all, backend, or api/);
  assert.equal(existsSync(path.join(apiRoot, "dist", "sentinel")), true, "invalid scope must fail before clearing dist");

  copyAddon(backendRoot, "pingfangapi");
  copyAddon(backendRoot, "pingfangdevice");
  const backendPackage = run(packageScript, backendRoot, "backend");
  assert.equal(backendPackage.status, 0, backendPackage.stderr);
  assert.deepEqual(readdirSync(path.join(backendRoot, "dist")).sort(), ["pingfangapi", "pingfangapi.tar.gz", "pingfangdevice", "pingfangdevice.tar.gz"]);
  const backendVerify = run(verifyScript, backendRoot, "backend");
  assert.equal(backendVerify.status, 0, backendVerify.stderr);
} finally {
  rmSync(apiRoot, { recursive: true, force: true });
  rmSync(backendRoot, { recursive: true, force: true });
}

console.log("Release scope tests passed");
