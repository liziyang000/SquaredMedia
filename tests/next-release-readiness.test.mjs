import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, lstatSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const deploy = readFileSync(path.join(root, "scripts/deploy-next-web.sh"), "utf8");
const rollback = readFileSync(path.join(root, "scripts/rollback-next-web.sh"), "utf8");
const unit = readFileSync(path.join(root, "ops/systemd/squaredmedia-next.service"), "utf8");
const site = readFileSync(path.join(root, "ops/nginx/www.ping2.my.server.conf"), "utf8");
const phpHeaders = readFileSync(path.join(root, "ops/nginx/www.ping2.my.fastcgi.conf"), "utf8");
assert.match(unit, /MACCMS_INTERNAL_ORIGIN=http:\/\/127\.0\.0\.1:3102/);
assert.match(deploy, /MACCMS_INTERNAL_ORIGIN=http:\/\/127\.0\.0\.1:3102/);
assert.match(deploy, /Candidate did not render permission-scoped home content before JavaScript/);
assert.match(deploy, /cp -a "template\/pingfangvideo\/\$asset_directory"/);
assert.match(deploy, /"\$old_release_backup\/\.deploy\/\$NEXT_SERVICE"/);
assert.match(site, /real_ip_header CF-Connecting-IP/);
assert.match(site, /proxy_cookie_flags PHPSESSID secure httponly samesite=lax/);
assert.match(phpHeaders, /session\.cookie_secure=1\\nsession\.cookie_httponly=1/);
assert.doesNotMatch(site, /set_real_ip_from (?:0\.0\.0\.0\/0|::\/0)/);
assert.equal((site.match(/set_real_ip_from /g) || []).length, 22);
assert.match(phpHeaders, /fastcgi_pass_request_headers off/);
assert.doesNotMatch(phpHeaders, /HTTP_(?:ALI_CDN_REAL_IP|X_FORWARDED_FOR|CLIENT_IP)/);

function between(source, start, end) {
  const from = source.indexOf(start),
    to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return source.slice(from, to);
}
const quote = (value) => `'${value.replaceAll("'", `'"'"'`)}'`;
const directory = mkdtempSync(path.join(tmpdir(), "squaredmedia-legacy-release-"));
try {
  const old = path.join(directory, "releases/20261010T070043Z-p0fix");
  mkdirSync(path.join(old, "node_modules/next/dist/bin"), { recursive: true });
  mkdirSync(path.join(old, "node_modules/.bin"));
  mkdirSync(path.join(old, ".next"));
  writeFileSync(path.join(old, "node_modules/next/dist/bin/next"), "legacy next runtime\n");
  symlinkSync("../next/dist/bin/next", path.join(old, "node_modules/.bin/next"));
  writeFileSync(path.join(old, ".next/BUILD_ID"), "legacy-build\n");
  const originalEnv = "CINEMA_RELEASE_ID=20261010T070043Z-p0fix\nMACCMS_ORIGIN=http://127.0.0.1:3102\n";
  writeFileSync(path.join(old, "release.env"), originalEnv);
  const releaseId = "20261104T130000Z-abcdef123456";
  const snapshot = between(deploy, 'old_release_backup="$old_current"', '\nif [[ -n "$old_release_backup"');
  const result = spawnSync("bash", ["-ec", `NEXT_ROOT=${quote(directory)}\nRELEASE_ID=${quote(releaseId)}\nold_current=${quote(old)}\n${snapshot}`], {
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  const target = path.join(directory, `releases/${releaseId}-legacy`);
  assert.equal(readFileSync(path.join(old, "release.env"), "utf8"), originalEnv);
  assert.equal(lstatSync(path.join(target, "node_modules/.bin/next")).isSymbolicLink(), false);
  assert.match(readFileSync(path.join(target, "release.env"), "utf8"), /MACCMS_ORIGIN=http:\/\/127\.0\.0\.1:3102/);
  const metadata = between(rollback, "read_legacy_release_metadata() {", "\n\nvalidate_rollback_api_response() {");
  const run = () => spawnSync("bash", ["-ec", `${metadata}\nread_legacy_release_metadata ${quote(target)}`], { encoding: "utf8" });
  assert.equal(run().stdout.trim(), `${releaseId}-legacy`);
  writeFileSync(path.join(target, "release.env"), originalEnv);
  assert.notEqual(run().status, 0, "A legacy snapshot must report its own release ID");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log("Next.js SSR, asset and legacy rollback readiness checks passed");
