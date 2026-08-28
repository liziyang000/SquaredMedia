import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(root, "scripts/deploy-pingfangapi.sh");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

assert.equal(packageJson.scripts["deploy:api"], "bash scripts/deploy-pingfangapi.sh");
assert.match(packageJson.scripts.test, /node tests\/pingfangapi-deploy-command\.test\.mjs/);
assert.equal(existsSync(scriptPath), true, "pingfangapi deploy command must exist");

const script = readFileSync(scriptPath, "utf8");
assert.match(script, /^#!\/usr\/bin\/env bash/);
assert.match(script, /set -euo pipefail/);
assert.match(script, /scripts\/deploy-ping2\.env/);
assert.match(script, /scripts\/deploy-theme\.sh/);
assert.match(script, /DEPLOY_SCOPE="\$detected_scope"/);
assert.doesNotMatch(script, /npm ci|node_modules/, "backend deployment must not install or require frontend dependencies");
assert.match(script, /--check/);
assert.match(script, /--backend/);
assert.match(script, /--yes/);
assert.match(script, /数据库备份/);
assert.doesNotMatch(script, /npm run deploy(?:\s|"|$)/);
assert.match(script, /PFAPI_RUN_DEPLOY_CHECK=1/);
assert.match(script, /< "\$deployment_check_file"/, "readiness source must be streamed without uploading files");
const schemaTests = spawnSync("php", [path.join(root, "tests/pingfang-api-deployment-check.test.php")], { encoding: "utf8" });
assert.equal(schemaTests.status, 0, schemaTests.stderr || schemaTests.stdout);
const missingExtension = spawnSync("php", ["-r", `namespace addons\\pingfangapi\\service; function extension_loaded($name) { return $name !== 'pdo_mysql'; } require ${JSON.stringify(path.join(root, "addons/pingfangapi/service/DeploymentCheck.php"))};`], {
  encoding: "utf8",
  env: { ...process.env, PFAPI_RUN_DEPLOY_CHECK: "1", MACCMS_ROOT: "/unused-fixture", DEPLOY_SCOPE: "api" }
});
assert.notEqual(missingExtension.status, 0);
assert.match(missingExtension.stderr, /PHP CLI extension is missing: pdo_mysql/);

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "pingfangapi-deploy-command-"));
try {
  const fakeBin = path.join(fixtureRoot, "bin");
  const envFile = path.join(fixtureRoot, "deploy.env");
  const identityFile = path.join(fixtureRoot, "deploy-key");
  const commandLog = path.join(fixtureRoot, "commands.log");
  const sshLog = path.join(fixtureRoot, "ssh.log");

  mkdirSync(fakeBin);
  writeFileSync(identityFile, "fixture identity\n");
  writeFileSync(commandLog, "");
  writeFileSync(sshLog, "");
  writeFileSync(
    envFile,
    [
      "export DEPLOY_HOST=fixture.invalid",
      "export DEPLOY_USER=fixture",
      "export DEPLOY_PORT=814",
      "export DEPLOY_PATH=/www/wwwroot/squaredMedia/template",
      `export DEPLOY_IDENTITY_FILE=${identityFile}`,
      "export DEPLOY_SITE_HOST=www.fixture.invalid",
      "export DEPLOY_SITE_SCHEME=https",
      ""
    ].join("\n")
  );

  const fakeSsh = path.join(fakeBin, "ssh");
  writeFileSync(
    fakeSsh,
    [
      "#!/bin/bash",
      "set -euo pipefail",
      'printf "%s\\n" "$*" >> "$PFAPI_TEST_SSH_LOG"',
      'if [[ "$*" == *"PFAPI_RUN_DEPLOY_CHECK=1"* ]]; then',
      "  cat >/dev/null",
      '  case "${PFAPI_TEST_CHECK_STATE:-ready}" in',
      "    error) echo 'Database connection failed; deployment stopped.' >&2; exit 25 ;;",
      "    migration) echo 'MacCMS ulog is missing: ulog_point. Separate migration required.' >&2; exit 26 ;;",
      "    invalid) echo 'PFAPI_DEPLOY_SCOPE=unknown'; exit 0 ;;",
      "  esac",
      "  scope=api",
      '  if [[ "$*" == *"DEPLOY_SCOPE=backend"* || "${PFAPI_TEST_CHECK_STATE:-}" == "upgrade" ]]; then scope=backend; fi',
      '  printf "PFAPI_DEPLOY_SCOPE=%s\\n" "$scope"',
      "  printf '%s\\n' 'PFAPI_DEPLOY_REASON=database baseline checked' 'PFAPI_DEPLOY_CHECK=PHP CLI and database ready'",
      "  exit 0",
      "fi",
      'case "${PFAPI_TEST_REMOTE_STATE:-backend}" in',
      "  backend)",
      "    printf '%s\\n' 'PFAPI_DEPLOY_SCOPE=backend' 'PFAPI_DEPLOY_REASON=pingfangapi is not installed'",
      "    ;;",
      "  api)",
      "    printf '%s\\n' 'PFAPI_DEPLOY_SCOPE=api' 'PFAPI_DEPLOY_REASON=compatible backend baseline'",
      "    ;;",
      "  error)",
      "    printf '%s\\n' 'Remote pingfangapi installation is incomplete.' >&2",
      "    exit 23",
      "    ;;",
      "  *)",
      "    exit 24",
      "    ;;",
      "esac",
      ""
    ].join("\n")
  );
  chmodSync(fakeSsh, 0o755);

  const fakeNpm = path.join(fakeBin, "npm");
  writeFileSync(fakeNpm, ["#!/bin/bash", "set -euo pipefail", 'printf "npm\\t%s\\n" "$*" >> "$PFAPI_TEST_COMMAND_LOG"', ""].join("\n"));
  chmodSync(fakeNpm, 0o755);

  const fakeBash = path.join(fakeBin, "bash");
  writeFileSync(
    fakeBash,
    ["#!/bin/bash", "set -euo pipefail", 'printf "deploy\\t%s\\t%s\\n" "${DEPLOY_SCOPE:-}" "$*" >> "$PFAPI_TEST_COMMAND_LOG"', ""].join("\n")
  );
  chmodSync(fakeBash, 0o755);

  function run(args, remoteState, input, checkState = "ready") {
    return spawnSync("/bin/bash", [scriptPath, ...args], {
      cwd: root,
      encoding: "utf8",
      input,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        PINGFANGAPI_DEPLOY_ENV_FILE: envFile,
        PFAPI_TEST_COMMAND_LOG: commandLog,
        PFAPI_TEST_SSH_LOG: sshLog,
        PFAPI_TEST_REMOTE_STATE: remoteState,
        PFAPI_TEST_CHECK_STATE: checkState
      }
    });
  }

  const checkBackend = run(["--check"], "backend");
  assert.equal(checkBackend.status, 0, checkBackend.stderr);
  assert.match(checkBackend.stdout, /scope: backend/i);
  assert.match(checkBackend.stdout, /pingfangapi is not installed/);
  assert.equal(readFileSync(commandLog, "utf8"), "", "check mode must not install or deploy");
  assert.match(readFileSync(sshLog, "utf8"), /-p 814/);
  assert.match(readFileSync(sshLog, "utf8"), /IdentitiesOnly=yes/);

  writeFileSync(commandLog, "");
  const checkApi = run(["--check"], "api");
  assert.equal(checkApi.status, 0, checkApi.stderr);
  assert.match(checkApi.stdout, /scope: api/i);
  assert.match(checkApi.stdout, /check: PHP CLI and database ready/);
  assert.equal(readFileSync(commandLog, "utf8"), "");

  const forcedBackend = run(["--check", "--backend"], "api");
  assert.equal(forcedBackend.status, 0, forcedBackend.stderr);
  assert.match(forcedBackend.stdout, /scope: backend/i);
  assert.match(forcedBackend.stdout, /operator requested backend dependency refresh/i);

  const schemaUpgrade = run(["--check"], "api", undefined, "upgrade");
  assert.equal(schemaUpgrade.status, 0, schemaUpgrade.stderr);
  assert.match(schemaUpgrade.stdout, /scope: backend/i);
  for (const [state, status] of [["error", 25], ["migration", 26], ["invalid", 1]]) {
    writeFileSync(commandLog, "");
    const failedCheck = run(["--yes"], "api", undefined, state);
    assert.equal(failedCheck.status, status, failedCheck.stderr);
    assert.equal(readFileSync(commandLog, "utf8"), "", "failed readiness must stop before local packaging or deployment");
    assert.doesNotMatch(failedCheck.stdout, /deployment completed/);
  }

  writeFileSync(commandLog, "");
  const nonInteractiveBackend = run([], "backend");
  assert.notEqual(nonInteractiveBackend.status, 0);
  assert.match(nonInteractiveBackend.stderr, /--yes/);
  assert.equal(readFileSync(commandLog, "utf8"), "");

  writeFileSync(commandLog, "");
  const deployBackend = run(["--yes"], "backend");
  assert.equal(deployBackend.status, 0, deployBackend.stderr);
  assert.match(readFileSync(commandLog, "utf8"), /deploy\tbackend\t.*scripts\/deploy-theme\.sh/);
  assert.match(deployBackend.stdout, /completed with scope backend/i);
  assert.doesNotMatch(readFileSync(commandLog, "utf8"), /npm\tci/, "first installs must not install frontend dependencies");

  writeFileSync(commandLog, "");
  const deployApi = run(["--yes"], "api");
  assert.equal(deployApi.status, 0, deployApi.stderr);
  assert.match(readFileSync(commandLog, "utf8"), /deploy\tapi\t.*scripts\/deploy-theme\.sh/);
  assert.match(deployApi.stdout, /completed with scope api/i);
  assert.doesNotMatch(readFileSync(commandLog, "utf8"), /npm\tci/, "API updates must not install frontend dependencies");

  const remoteError = run(["--check"], "error");
  assert.equal(remoteError.status, 23);
  assert.match(remoteError.stderr, /incomplete/);

  const invalidOption = run(["--unknown"], "api");
  assert.notEqual(invalidOption.status, 0);
  assert.match(invalidOption.stderr, /Unknown option/);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("Pingfangapi deploy command tests passed");
