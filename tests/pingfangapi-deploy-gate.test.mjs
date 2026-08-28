import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.match(packageJson.scripts["test:backend"], /npm run test:api/);
assert.match(packageJson.scripts["test:backend"], /device-controller\.test\.php/);
assert.match(packageJson.scripts["test:backend"], /api-rollback\.test\.mjs/);
assert.match(packageJson.scripts.test, /pingfangapi-deploy-gate\.test\.mjs/);
assert.doesNotMatch(packageJson.scripts["test:backend"], /test:web|test:e2e|build:web|lint:web|npm ci/);
const fixture = mkdtempSync(path.join(tmpdir(), "pingfangapi-deploy-gate-"));
try {
  mkdirSync(path.join(fixture, "scripts"));
  mkdirSync(path.join(fixture, "addons"));
  for (const name of ["pingfangapi", "pingfangdevice"]) {
    cpSync(path.join(root, "addons", name), path.join(fixture, "addons", name), { recursive: true });
  }
  for (const name of ["deploy-theme.sh", "package-theme.mjs", "verify-release.mjs", "release-input-fingerprint.mjs"]) {
    cpSync(path.join(root, "scripts", name), path.join(fixture, "scripts", name));
  }
  writeFileSync(path.join(fixture, "package.json"), '{"private":true}\n');
  writeFileSync(path.join(fixture, ".gitignore"), "dist/\n");
  const init = spawnSync("git", ["init", "--quiet"], { cwd: fixture, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);

  const bin = path.join(fixture, "bin");
  const log = path.join(fixture, "commands.log");
  mkdirSync(bin);
  for (const command of ["npm", "ssh", "scp"]) {
    const commandPath = path.join(bin, command);
    writeFileSync(
      commandPath,
      [
        "#!/bin/bash",
        "set -euo pipefail",
        'command_name="$(basename "$0")"',
        'if [[ "$command_name" == "npm" && "$*" == "--version" ]]; then',
        "  printf 'fixture-npm\\n'",
        "  exit 0",
        "fi",
        'printf "%s\\t%s\\n" "$command_name" "$*" >> "$PFAPI_GATE_LOG"',
        'if [[ "$command_name" == "npm" ]]; then',
        '  if [[ "$*" != "run test:backend" ]]; then exit 42; fi',
        '  if [[ "${PFAPI_GATE_FAIL:-0}" == "1" ]]; then exit 43; fi',
        '  if [[ "${PFAPI_GATE_MUTATE:-0}" == "1" ]]; then',
        '    printf "\\n; changed during verification\\n" >> addons/pingfangapi/info.ini',
        "  fi",
        "fi",
        'if [[ "$command_name" == "ssh" ]]; then cat >/dev/null; fi',
        'if [[ "$command_name" == "scp" ]]; then',
        '  for arg in "$@"; do',
        '    if [[ "$arg" == dist/* ]]; then test -f "$arg"; fi',
        "  done",
        "fi",
        ""
      ].join("\n")
    );
    chmodSync(commandPath, 0o755);
  }

  function run(scope, extraEnv = {}) {
    writeFileSync(log, "");
    return spawnSync("/bin/bash", ["scripts/deploy-theme.sh"], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 60000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PFAPI_GATE_LOG: log,
        PFAPI_GATE_FAIL: "0",
        PFAPI_GATE_MUTATE: "0",
        DEPLOY_HOST: "fixture.invalid",
        DEPLOY_USER: "fixture",
        DEPLOY_PATH: "/tmp/pingfangapi-fixture/template",
        DEPLOY_SCOPE: scope,
        DEPLOY_IDENTITY_FILE: "",
        DEPLOY_PASSWORD: "",
        DEPLOY_SITE_HOST: "",
        DEPLOY_SITE_MARKER: "",
        ...extraEnv
      }
    });
  }

  for (const scope of ["api", "backend"]) {
    const result = run(scope);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const commands = readFileSync(log, "utf8");
    assert.match(commands, /npm\trun test:backend\n/);
    assert.doesNotMatch(commands, /npm\t(?:ci|test|run (?:lint|test:web|package|verify:release))/);
    assert.match(commands, /scp[^\n]*dist\/pingfangapi\.tar\.gz/);
    assert.doesNotMatch(commands, /scp[^\n]*dist\/(?:pingfangvideo|vodops|pingfanggames-server)\.tar\.gz/);
    const expected = ["pingfangapi", "pingfangapi.tar.gz"];
    if (scope === "backend") {
      expected.push("pingfangdevice", "pingfangdevice.tar.gz");
      assert.match(commands, /scp[^\n]*dist\/pingfangdevice\.tar\.gz/);
    } else {
      assert.doesNotMatch(commands, /scp[^\n]*dist\/pingfangdevice\.tar\.gz/);
    }
    assert.deepEqual(readdirSync(path.join(fixture, "dist")).sort(), expected.sort());
    assert.equal(existsSync(path.join(fixture, "node_modules")), false, "backend gates must not install dependencies");
    assert.equal(existsSync(path.join(fixture, "apps")), false, "backend gates must work without Next sources");

    const failed = run(scope, { PFAPI_GATE_FAIL: "1" });
    assert.equal(failed.status, 43, failed.stderr);
    assert.doesNotMatch(readFileSync(log, "utf8"), /(?:ssh|scp)\t/, "failed backend tests must stop before any remote command");

    const changed = run(scope, { PFAPI_GATE_MUTATE: "1" });
    assert.notEqual(changed.status, 0);
    assert.match(changed.stderr, /Release inputs changed after local verification/);
    assert.doesNotMatch(readFileSync(log, "utf8"), /(?:ssh|scp)\t/, "changed verified inputs must never be uploaded");
  }

  const deviceHook = path.join(fixture, "addons", "pingfangdevice", "Pingfangdevice.php");
  const originalHook = readFileSync(deviceHook, "utf8");
  writeFileSync(deviceHook, "<?php function broken(\n");
  const invalidPhp = run("backend");
  assert.notEqual(invalidPhp.status, 0);
  assert.match(invalidPhp.stderr, /Pingfangdevice\.php must contain valid PHP/);
  assert.doesNotMatch(readFileSync(log, "utf8"), /(?:ssh|scp)\t/, "invalid device PHP must stop before upload");
  writeFileSync(deviceHook, originalHook);

  const unsafeFile = path.join(fixture, "addons", "pingfangapi", "unsafe-link");
  symlinkSync(path.join(fixture, "package.json"), unsafeFile);
  const unsafe = run("api");
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /Backend release fingerprint unavailable/);
  assert.doesNotMatch(readFileSync(log, "utf8"), /(?:npm|ssh|scp)\t/, "invalid backend inputs must fail before gates or upload");
  unlinkSync(unsafeFile);

  const full = run("all");
  assert.equal(full.status, 42, full.stderr);
  assert.match(readFileSync(log, "utf8"), /npm\ttest\n/, "full releases must retain their full validation gate");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log("Pingfangapi independent deployment gate tests passed");
