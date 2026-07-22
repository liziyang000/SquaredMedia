#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
NEXT_ROOT="/www/wwwroot/react_squared_media"
NEXT_SITE_HOST="react.ping2.my"
NEXT_PORT="3100"
NEXT_CANDIDATE_PORT="3101"
NEXT_SERVICE="squaredmedia-next.service"
NEXT_NGINX_EXTENSION="/www/server/panel/vhost/nginx/extension/react.ping2.my/react-spa.conf"
NEXT_UNIT_PATH="/etc/systemd/system/$NEXT_SERVICE"
NEXT_DEPLOY_CACHE_ROOT="$repo_root/.cache/next-deploy/v1"
NEXT_DEPLOY_LOCK_DIR="$NEXT_DEPLOY_CACHE_ROOT/.deploy.lock"
NEXT_DEPLOY_FORCE_REBUILD="${NEXT_DEPLOY_FORCE_REBUILD:-0}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ "$NEXT_DEPLOY_FORCE_REBUILD" != "0" && "$NEXT_DEPLOY_FORCE_REBUILD" != "1" ]]; then
  echo "NEXT_DEPLOY_FORCE_REBUILD must be 0 or 1." >&2
  exit 1
fi
for port in "$DEPLOY_PORT" "$NEXT_PORT" "$NEXT_CANDIDATE_PORT"; do
  if [[ ! "$port" =~ ^[1-9][0-9]{0,4}$ || "$port" -gt 65535 ]]; then
    echo "Invalid port: $port" >&2
    exit 1
  fi
done

ssh_options=(
  -p "$DEPLOY_PORT"
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=4
)
scp_options=(
  -P "$DEPLOY_PORT"
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=4
)

if [[ -n "${DEPLOY_IDENTITY_FILE:-}" ]]; then
  if [[ ! -f "$DEPLOY_IDENTITY_FILE" ]]; then
    echo "DEPLOY_IDENTITY_FILE does not exist: $DEPLOY_IDENTITY_FILE" >&2
    exit 1
  fi
  ssh_options+=(-i "$DEPLOY_IDENTITY_FILE" -o IdentitiesOnly=yes)
  scp_options+=(-i "$DEPLOY_IDENTITY_FILE" -o IdentitiesOnly=yes)
fi

if [[ -n "${DEPLOY_PASSWORD:-}" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "DEPLOY_PASSWORD requires sshpass; SSH key authentication is preferred." >&2
    exit 1
  fi
  export SSHPASS="$DEPLOY_PASSWORD"
  ssh_command=(sshpass -e ssh "${ssh_options[@]}")
  scp_command=(sshpass -e scp "${scp_options[@]}")
else
  ssh_command=(ssh "${ssh_options[@]}")
  scp_command=(scp "${scp_options[@]}")
fi

for command in node npm tar shasum file; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required for Next.js deployment." >&2
    exit 1
  fi
done

if [[ -n "$(find apps/web template/pingfangvideo \
  \( -path 'apps/web/node_modules' -o -path 'apps/web/.next' \) -prune -o \
  -type l -print -quit)" ]]; then
  echo "Next.js source deployment refuses symbolic links under apps/web or template/pingfangvideo." >&2
  exit 1
fi

for local_env in apps/web/.env apps/web/.env.local apps/web/.env.production apps/web/.env.production.local; do
  if [[ -e "$local_env" || -L "$local_env" ]]; then
    echo "Next.js deployment refuses local production environment files: $local_env" >&2
    exit 1
  fi
done

node scripts/next-artifact-cache.mjs prepare "$repo_root" "$NEXT_DEPLOY_CACHE_ROOT" >/dev/null

local_tmp=""
local_lock_acquired=0
cleanup_local() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "$local_tmp" ]]; then
    rm -rf -- "$local_tmp"
  fi
  if [[ "$local_lock_acquired" == "1" ]]; then
    rmdir "$NEXT_DEPLOY_LOCK_DIR" 2>/dev/null
  fi
  exit "$status"
}
release_local_deploy_lock() {
  if [[ "$local_lock_acquired" == "1" ]]; then
    if ! rmdir "$NEXT_DEPLOY_LOCK_DIR"; then
      echo "Unable to release the Next.js deployment lock: $NEXT_DEPLOY_LOCK_DIR" >&2
      return 1
    fi
    local_lock_acquired=0
  fi
}
trap cleanup_local EXIT

if ! mkdir "$NEXT_DEPLOY_LOCK_DIR"; then
  echo "Another local Next.js deployment is already running: $NEXT_DEPLOY_LOCK_DIR" >&2
  exit 1
fi
chmod 0700 "$NEXT_DEPLOY_LOCK_DIR"
local_lock_acquired=1

build_input_hash="$(node scripts/release-input-fingerprint.mjs next)"
if [[ ! "$build_input_hash" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Next.js build fingerprint is invalid." >&2
  exit 1
fi

echo "Running the local release gate before staging deployment..."
npm ci --no-audit --no-fund

node <<'NODE'
const fs = require("node:fs");

const rootLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const deployLock = JSON.parse(fs.readFileSync("apps/web/deploy/package-lock.json", "utf8"));
const packageNames = [
  ...Object.keys(JSON.parse(fs.readFileSync("apps/web/package.json", "utf8")).dependencies),
  "sharp",
  "@img/sharp-linux-x64",
  "@img/sharp-libvips-linux-x64"
];

for (const packageName of packageNames) {
  const packagePath = `node_modules/${packageName}`;
  const rootVersion = rootLock.packages?.[packagePath]?.version;
  const deployVersion = deployLock.packages?.[packagePath]?.version;
  if (!rootVersion || rootVersion !== deployVersion) {
    throw new Error(`Next.js deploy lock drift for ${packageName}: root=${rootVersion || "missing"}, deploy=${deployVersion || "missing"}`);
  }
}
NODE

npm test
npm run lint
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run typecheck:web
npm run test:e2e

verified_build_input_hash="$(node scripts/release-input-fingerprint.mjs next)"
if [[ "$verified_build_input_hash" != "$build_input_hash" ]]; then
  echo "Next.js build inputs changed while the local release gate was running." >&2
  exit 1
fi

local_tmp="$(mktemp -d "${TMPDIR:-/tmp}/squaredmedia-next.XXXXXX")"

validate_artifact_root() {
  local artifact_root="$1"
  local native_count native_file native_info
  if [[ ! -f "$artifact_root/apps/web/server.js" || ! -d "$artifact_root/apps/web/.next/static" ]]; then
    echo "Next.js standalone artifact is incomplete." >&2
    return 1
  fi
  if [[ -n "$(find "$artifact_root" -type l -print -quit)" ]]; then
    echo "Next.js artifact must not contain symbolic links." >&2
    return 1
  fi
  if ! ARTIFACT_ROOT="$artifact_root" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const artifactRoot = process.env.ARTIFACT_ROOT;
const readPackage = (packageName) => JSON.parse(fs.readFileSync(path.join(artifactRoot, "node_modules", packageName, "package.json"), "utf8"));
const sharp = readPackage("sharp");
const linuxSharp = readPackage("@img/sharp-linux-x64");
const linuxLibvips = readPackage("@img/sharp-libvips-linux-x64");

if (sharp.optionalDependencies?.["@img/sharp-linux-x64"] !== linuxSharp.version ||
    sharp.optionalDependencies?.["@img/sharp-libvips-linux-x64"] !== linuxLibvips.version ||
    linuxSharp.optionalDependencies?.["@img/sharp-libvips-linux-x64"] !== linuxLibvips.version) {
  throw new Error("Linux sharp runtime package versions do not match the standalone sharp package");
}
NODE
  then
    return 1
  fi
  native_count=0
  while IFS= read -r -d '' native_file; do
    native_info="$(file -b "$native_file")"
    if [[ "$native_info" != *"ELF 64-bit LSB"* || "$native_info" != *"x86-64"* ]]; then
      echo "Next.js artifact contains a non-Linux-x64 native file: $native_file ($native_info)" >&2
      return 1
    fi
    native_count=$((native_count + 1))
  done < <(find "$artifact_root" -type f \( -name '*.node' -o -name '*.so*' -o -name '*.dylib' \) -print0)
  if [[ "$native_count" -lt 1 ]]; then
    echo "Next.js artifact does not contain the expected Linux x64 native runtime." >&2
    return 1
  fi
}

validate_artifact_archive() {
  local archive="$1"
  local validation_root
  if ! tar -tzf "$archive" | while IFS= read -r entry; do
    case "$entry" in
      /*|..|../*|*/..|*/../*) echo "Unsafe cached artifact entry: $entry" >&2; exit 1 ;;
    esac
  done; then
    return 1
  fi
  if tar -tvzf "$archive" | awk '$1 !~ /^[-d]/ { found=1 } END { exit found ? 0 : 1 }'; then
    echo "Next.js artifact archive contains an unsupported entry type." >&2
    return 1
  fi
  validation_root="$(mktemp -d "$local_tmp/artifact-validation.XXXXXX")"
  if ! tar -xzf "$archive" -C "$validation_root"; then
    return 1
  fi
  validate_artifact_root "$validation_root"
}

artifact_archive="$local_tmp/artifact.tar.gz"
artifact_hash=""
cache_hit=0
if [[ "$NEXT_DEPLOY_FORCE_REBUILD" == "0" ]]; then
  cache_entry="$NEXT_DEPLOY_CACHE_ROOT/$build_input_hash"
  cache_archive="$cache_entry/artifact.tar.gz"
  cache_manifest="$cache_entry/manifest.json"
  verified_cache_hash=""
  if verified_cache_hash="$(node scripts/next-artifact-cache.mjs verify \
      "$cache_manifest" "$cache_archive" "$build_input_hash" "$NEXT_DEPLOY_CACHE_ROOT" 2>/dev/null)" &&
    [[ "$verified_cache_hash" =~ ^[a-f0-9]{64}$ ]] &&
    cp "$cache_archive" "$artifact_archive"; then
    copied_artifact_hash="$(shasum -a 256 "$artifact_archive" | awk '{print $1}')"
    if [[ "$copied_artifact_hash" == "$verified_cache_hash" ]] && validate_artifact_archive "$artifact_archive"; then
      artifact_hash="$copied_artifact_hash"
      cache_hit=1
      echo "Reusing verified Next.js Linux artifact $build_input_hash"
    fi
  fi
  if [[ "$cache_hit" != "1" ]]; then
    artifact_hash=""
    rm -f -- "$artifact_archive"
    echo "No valid Next.js artifact cache entry for $build_input_hash; rebuilding."
  fi
fi

if [[ "$cache_hit" != "1" ]]; then
  NODE_ENV=production \
  MACCMS_ORIGIN= \
  SQUAREDMEDIA_LOW_MEMORY_BUILD=0 \
  NEXT_PUBLIC_API_BASE_URL=/index.php/pingfangapi/index \
  NEXT_PUBLIC_HOME_API_URL=/index.php/pingfangapi/index \
    npm run build:web

  if [[ ! -f apps/web/.next/standalone/apps/web/server.js || ! -d apps/web/.next/static ]]; then
    echo "Local Next.js standalone build is incomplete." >&2
    exit 1
  fi

  linux_deps_root="$local_tmp/linux-deps"
  mkdir -p "$linux_deps_root"
  cp apps/web/deploy/package.json apps/web/deploy/package-lock.json "$linux_deps_root/"
  (
    cd "$linux_deps_root"
    NODE_OPTIONS=--max-old-space-size=192 npm ci \
      --omit=dev \
      --ignore-scripts \
      --no-audit \
      --no-fund \
      --maxsockets=1 \
      --workspaces=false \
      --os=linux \
      --cpu=x64 \
      --libc=glibc
  )

  artifact_root="$local_tmp/artifact"
  mkdir -p "$artifact_root/apps/web/.next"
  cp -a apps/web/.next/standalone/. "$artifact_root/"
  cp -a apps/web/.next/static "$artifact_root/apps/web/.next/static"
  for native_dir in "$artifact_root/node_modules/@img"/sharp-*; do
    if [[ -e "$native_dir" ]]; then
      rm -rf -- "$native_dir"
    fi
  done
  for linux_package in sharp-linux-x64 sharp-libvips-linux-x64; do
    if [[ ! -d "$linux_deps_root/node_modules/@img/$linux_package" ]]; then
      echo "Missing Linux x64 runtime package: @img/$linux_package" >&2
      exit 1
    fi
    cp -a "$linux_deps_root/node_modules/@img/$linux_package" "$artifact_root/node_modules/@img/"
  done
  validate_artifact_root "$artifact_root"

  COPYFILE_DISABLE=1 tar --no-xattrs \
    --exclude='.DS_Store' \
    --exclude='._*' \
    -czf "$artifact_archive" \
    -C "$artifact_root" .
  validate_artifact_archive "$artifact_archive"
  artifact_hash="$(shasum -a 256 "$artifact_archive" | awk '{print $1}')"

  post_build_input_hash="$(node scripts/release-input-fingerprint.mjs next)"
  if [[ "$post_build_input_hash" != "$build_input_hash" ]]; then
    echo "Next.js build inputs changed during the build; refusing to publish a stale cache entry." >&2
    exit 1
  fi
  published_artifact_hash="$(node scripts/next-artifact-cache.mjs publish \
    "$repo_root" "$NEXT_DEPLOY_CACHE_ROOT" "$artifact_archive" "$build_input_hash")"
  if [[ "$published_artifact_hash" != "$artifact_hash" ]]; then
    echo "Published Next.js cache artifact checksum mismatch." >&2
    exit 1
  fi
  echo "Cached verified Next.js Linux artifact $build_input_hash"
fi

upload_build_input_hash="$(node scripts/release-input-fingerprint.mjs next)"
if [[ "$upload_build_input_hash" != "$build_input_hash" ]]; then
  echo "Next.js build inputs changed after artifact verification; refusing to upload." >&2
  exit 1
fi

release_id="$(date -u +%Y%m%dT%H%M%SZ)-${artifact_hash:0:12}"
if [[ ! "$release_id" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]]; then
  echo "Generated release id is invalid: $release_id" >&2
  exit 1
fi

remote_artifact="/tmp/squaredmedia-next.${release_id}.artifact.tar.gz"
remote_nginx="/tmp/squaredmedia-next.${release_id}.nginx.conf"
remote_unit="/tmp/squaredmedia-next.${release_id}.service"

remote_env=(
  "RELEASE_ID=$(printf '%q' "$release_id")"
  "ARTIFACT_HASH=$(printf '%q' "$artifact_hash")"
  "REMOTE_ARTIFACT=$(printf '%q' "$remote_artifact")"
  "REMOTE_NGINX=$(printf '%q' "$remote_nginx")"
  "REMOTE_UNIT=$(printf '%q' "$remote_unit")"
  "NEXT_ROOT=$(printf '%q' "$NEXT_ROOT")"
  "NEXT_SITE_HOST=$(printf '%q' "$NEXT_SITE_HOST")"
  "NEXT_PORT=$(printf '%q' "$NEXT_PORT")"
  "NEXT_CANDIDATE_PORT=$(printf '%q' "$NEXT_CANDIDATE_PORT")"
  "NEXT_SERVICE=$(printf '%q' "$NEXT_SERVICE")"
  "NEXT_NGINX_EXTENSION=$(printf '%q' "$NEXT_NGINX_EXTENSION")"
  "NEXT_UNIT_PATH=$(printf '%q' "$NEXT_UNIT_PATH")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_PREFLIGHT'
set -euo pipefail
for target in "$REMOTE_ARTIFACT" "$REMOTE_NGINX" "$REMOTE_UNIT"; do
  if [[ -e "$target" || -L "$target" ]]; then
    echo "Remote upload target already exists: $target" >&2
    exit 1
  fi
done
REMOTE_PREFLIGHT

"${scp_command[@]}" "$artifact_archive" "${REMOTE}:${remote_artifact}"
"${scp_command[@]}" ops/nginx/react.ping2.my.conf "${REMOTE}:${remote_nginx}"
"${scp_command[@]}" ops/systemd/squaredmedia-next.service "${REMOTE}:${remote_unit}"

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_DEPLOY'
set -euo pipefail

expected_root="/www/wwwroot/react_squared_media"
expected_host="react.ping2.my"
expected_service="squaredmedia-next.service"
expected_nginx="/www/server/panel/vhost/nginx/extension/react.ping2.my/react-spa.conf"
expected_unit="/etc/systemd/system/squaredmedia-next.service"

if [[ "$NEXT_ROOT" != "$expected_root" || "$NEXT_SITE_HOST" != "$expected_host" || "$NEXT_SERVICE" != "$expected_service" || "$NEXT_NGINX_EXTENSION" != "$expected_nginx" || "$NEXT_UNIT_PATH" != "$expected_unit" ]]; then
  echo "Next.js staging target does not match the locked deployment boundary." >&2
  exit 1
fi
if [[ ! "$RELEASE_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ || ! "$ARTIFACT_HASH" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Invalid release metadata." >&2
  exit 1
fi
for upload in "$REMOTE_ARTIFACT" "$REMOTE_NGINX" "$REMOTE_UNIT"; do
  if [[ ! "$upload" =~ ^/tmp/squaredmedia-next\.[A-Za-z0-9.-]+\.(artifact\.tar\.gz|nginx\.conf|service)$ || ! -f "$upload" || -L "$upload" ]]; then
    echo "Invalid remote upload: $upload" >&2
    exit 1
  fi
done

for command in curl getconf nginx php runuser sha256sum systemctl tar uname; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required on the staging server." >&2
    exit 1
  fi
done
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" || "$(getconf GNU_LIBC_VERSION)" != glibc\ * ]]; then
  echo "Next.js artifact requires Linux x86_64 with glibc." >&2
  exit 1
fi
if [[ ! -x /usr/bin/node ]]; then
  echo "/usr/bin/node is required on the staging server." >&2
  exit 1
fi
/usr/bin/node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 22)) process.exit(1)'
id www >/dev/null

actual_hash="$(sha256sum "$REMOTE_ARTIFACT" | awk '{print $1}')"
if [[ "$actual_hash" != "$ARTIFACT_HASH" ]]; then
  echo "Uploaded Next.js artifact checksum mismatch." >&2
  exit 1
fi

build_root="$NEXT_ROOT/builds/$RELEASE_ID"
release_dir="$NEXT_ROOT/releases/$RELEASE_ID"
backup_dir="$NEXT_ROOT/config-backups/$RELEASE_ID"
logs_dir="$NEXT_ROOT/logs"
case "$build_root" in
  "$NEXT_ROOT"/builds/"$RELEASE_ID") ;;
  *) echo "Unsafe build directory." >&2; exit 1 ;;
esac
if [[ -e "$build_root" || -e "$release_dir" ]]; then
  echo "Release already exists: $RELEASE_ID" >&2
  exit 1
fi

mkdir -p "$NEXT_ROOT/builds" "$NEXT_ROOT/releases" "$NEXT_ROOT/config-backups" "$logs_dir" "$build_root" "$backup_dir"
chmod 0755 "$NEXT_ROOT" "$NEXT_ROOT/builds" "$NEXT_ROOT/releases" "$NEXT_ROOT/config-backups" "$logs_dir" "$build_root" "$backup_dir"

candidate_pid=""
switch_started=0
release_committed=0
old_current=""
old_service_exists=0
old_service_active=0
old_service_enabled=0
old_nginx_exists=0

reload_nginx() {
  nginx -t
  if systemctl is-active --quiet nginx.service; then
    systemctl reload nginx.service
  else
    nginx -s reload
  fi
}

harden_release() {
  local target="$1"
  chown -R root:root "$target"
  chmod -R u=rwX,go=rX "$target"
  install -d -o www -g www -m 0750 "$target/apps/web/.next/cache"
  chown -R www:www "$target/apps/web/.next/cache"
  chmod -R u=rwX,g=rX,o= "$target/apps/web/.next/cache"
}

cleanup_remote() {
  rm -f -- "$REMOTE_ARTIFACT" "$REMOTE_NGINX" "$REMOTE_UNIT"
  if [[ -d "$build_root" && ! -L "$build_root" ]]; then
    rm -rf -- "$build_root"
  fi
  if [[ "$release_committed" != "1" && -d "$release_dir" && ! -L "$release_dir" && "$(readlink -f "$NEXT_ROOT/current" 2>/dev/null || true)" != "$release_dir" ]]; then
    rm -rf -- "$release_dir"
  fi
}

restore_failed_release() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "$candidate_pid" ]]; then
    kill "$candidate_pid" 2>/dev/null || true
    wait "$candidate_pid" 2>/dev/null || true
  fi
  if [[ "$switch_started" == "1" && "$release_committed" != "1" ]]; then
    echo "Next.js deployment failed; restoring the previous staging release." >&2
    if [[ -n "$old_current" && -d "$old_current" ]]; then
      ln -s "$old_current" "$NEXT_ROOT/.current.rollback.$RELEASE_ID"
      mv -Tf "$NEXT_ROOT/.current.rollback.$RELEASE_ID" "$NEXT_ROOT/current"
    elif [[ "$(readlink -f "$NEXT_ROOT/current" 2>/dev/null || true)" == "$release_dir" ]]; then
      rm -f -- "$NEXT_ROOT/current"
    fi
    if [[ -f "$backup_dir/react-spa.conf" ]]; then
      install -m 0644 "$backup_dir/react-spa.conf" "$NEXT_NGINX_EXTENSION"
    elif [[ "$old_nginx_exists" == "0" ]]; then
      rm -f -- "$NEXT_NGINX_EXTENSION"
    fi
    if [[ "$old_service_exists" == "1" && -f "$backup_dir/$NEXT_SERVICE" ]]; then
      install -m 0644 "$backup_dir/$NEXT_SERVICE" "$NEXT_UNIT_PATH"
      systemctl daemon-reload
      if [[ "$old_service_active" == "1" ]]; then
        systemctl restart "$NEXT_SERVICE" || true
      else
        systemctl stop "$NEXT_SERVICE" 2>/dev/null || true
      fi
      if [[ "$old_service_enabled" == "1" ]]; then
        systemctl enable "$NEXT_SERVICE" >/dev/null 2>&1 || true
      else
        systemctl disable "$NEXT_SERVICE" >/dev/null 2>&1 || true
      fi
    else
      systemctl stop "$NEXT_SERVICE" 2>/dev/null || true
      systemctl disable "$NEXT_SERVICE" 2>/dev/null || true
      rm -f -- "$NEXT_UNIT_PATH"
      systemctl daemon-reload
    fi
    reload_nginx || true
  fi
  cleanup_remote
  exit "$status"
}
trap restore_failed_release EXIT

tar -tzf "$REMOTE_ARTIFACT" | while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*) echo "Unsafe artifact archive entry: $entry" >&2; exit 1 ;;
  esac
done
if tar -tvzf "$REMOTE_ARTIFACT" | awk '$1 ~ /^[lh]/ { found=1 } END { exit found ? 0 : 1 }'; then
  echo "Next.js artifact must not contain symbolic or hard links." >&2
  exit 1
fi
tar -xzf "$REMOTE_ARTIFACT" -C "$build_root"

if [[ ! -f "$build_root/apps/web/server.js" || ! -d "$build_root/apps/web/.next/static" ]]; then
  echo "Uploaded Next.js artifact is incomplete." >&2
  exit 1
fi

mkdir -p "$release_dir"
cp -a "$build_root/." "$release_dir/"
mkdir -p "$release_dir/.deploy"
cp -a "$REMOTE_NGINX" "$release_dir/.deploy/nginx.conf"
cp -a "$REMOTE_UNIT" "$release_dir/.deploy/$NEXT_SERVICE"
printf 'SQUAREDMEDIA_RELEASE_ID=%s\n' "$RELEASE_ID" > "$release_dir/release.env"
printf '{"release":"%s","artifactSha256":"%s"}\n' "$RELEASE_ID" "$ARTIFACT_HASH" > "$release_dir/release.json"
harden_release "$release_dir"

(
  cd "$release_dir"
  runuser -u www -- /usr/bin/node -e '
    const sharp = require("sharp");
    sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer()
      .then((output) => { if (!Buffer.isBuffer(output) || output.length === 0) process.exit(1); })
      .catch((error) => { console.error(error); process.exit(1); });
  '
)

if ss -lnt | awk '{print $4}' | grep -Eq "(^|:)$NEXT_CANDIDATE_PORT$"; then
  echo "Candidate port $NEXT_CANDIDATE_PORT is already in use." >&2
  exit 1
fi
candidate_log="$logs_dir/candidate-$RELEASE_ID.log"
(
  cd "$release_dir"
  exec runuser -u www -- env \
    NODE_ENV=production \
    HOSTNAME=127.0.0.1 \
    PORT="$NEXT_CANDIDATE_PORT" \
    NEXT_TELEMETRY_DISABLED=1 \
    SQUAREDMEDIA_RELEASE_ID="$RELEASE_ID" \
    /usr/bin/node apps/web/server.js
) >"$candidate_log" 2>&1 &
candidate_pid=$!

candidate_ready=0
for _ in $(seq 1 45); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$NEXT_CANDIDATE_PORT/healthz" | grep -Fq "$RELEASE_ID"; then
    candidate_ready=1
    break
  fi
  sleep 1
done
if [[ "$candidate_ready" != "1" ]]; then
  echo "Candidate Next.js process did not become healthy." >&2
  tail -n 80 "$candidate_log" >&2 || true
  exit 1
fi
for route in / /status /vod/371745; do
  status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NEXT_CANDIDATE_PORT$route")"
  if [[ "$status" != "200" ]]; then
    echo "Candidate route $route returned HTTP $status." >&2
    exit 1
  fi
done
for route in /register /forgot-password; do
  for method in GET HEAD; do
    if [[ "$method" == "HEAD" ]]; then
      status="$(curl -sS --max-time 10 --head -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NEXT_CANDIDATE_PORT$route")"
    else
      status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NEXT_CANDIDATE_PORT$route")"
    fi
    if [[ "$status" != "410" ]]; then
      echo "Candidate retired route $method $route returned HTTP $status instead of 410." >&2
      exit 1
    fi
  done
done
unknown_status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NEXT_CANDIDATE_PORT/__deployment_missing_route__")"
if [[ "$unknown_status" != "404" ]]; then
  echo "Candidate unknown route returned HTTP $unknown_status instead of 404." >&2
  exit 1
fi
asset_file="$(find "$release_dir/apps/web/.next/static" -type f \( -name '*.js' -o -name '*.css' \) -print -quit)"
asset_path="/_next/static${asset_file#"$release_dir/apps/web/.next/static"}"
curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:$NEXT_CANDIDATE_PORT$asset_path"
kill "$candidate_pid"
wait "$candidate_pid" 2>/dev/null || true
candidate_pid=""

old_current="$(readlink -f "$NEXT_ROOT/current" 2>/dev/null || true)"
if [[ (-e "$NEXT_ROOT/current" || -L "$NEXT_ROOT/current") && -z "$old_current" ]]; then
  echo "Current staging pointer is invalid." >&2
  exit 1
fi
if [[ -n "$old_current" && "$old_current" != "$NEXT_ROOT"/releases/* ]]; then
  echo "Current staging target is outside the releases directory: $old_current" >&2
  exit 1
fi
if [[ -n "$old_current" && -d "$old_current" ]]; then
  mkdir -p "$old_current/.deploy"
  if [[ -f "$NEXT_NGINX_EXTENSION" ]]; then
    install -m 0644 "$NEXT_NGINX_EXTENSION" "$old_current/.deploy/nginx.conf"
  else
    install -m 0644 "$REMOTE_NGINX" "$old_current/.deploy/nginx.conf"
  fi
  install -m 0644 "$REMOTE_UNIT" "$old_current/.deploy/$NEXT_SERVICE"
  harden_release "$old_current"
fi
if [[ -f "$NEXT_NGINX_EXTENSION" ]]; then
  old_nginx_exists=1
  cp -a "$NEXT_NGINX_EXTENSION" "$backup_dir/react-spa.conf"
  if [[ ! -f "$NEXT_ROOT/config-backups/pre-next-react-spa.conf" ]]; then
    cp -a "$NEXT_NGINX_EXTENSION" "$NEXT_ROOT/config-backups/pre-next-react-spa.conf"
  fi
fi
if [[ -f "$NEXT_UNIT_PATH" ]]; then
  cp -a "$NEXT_UNIT_PATH" "$backup_dir/$NEXT_SERVICE"
  old_service_exists=1
fi
if systemctl is-active --quiet "$NEXT_SERVICE"; then
  old_service_active=1
fi
if systemctl is-enabled --quiet "$NEXT_SERVICE"; then
  old_service_enabled=1
fi

switch_started=1
install -m 0644 "$REMOTE_NGINX" "$NEXT_NGINX_EXTENSION"
install -m 0644 "$REMOTE_UNIT" "$NEXT_UNIT_PATH"
ln -s "$release_dir" "$NEXT_ROOT/.current.$RELEASE_ID"
mv -Tf "$NEXT_ROOT/.current.$RELEASE_ID" "$NEXT_ROOT/current"

systemctl daemon-reload
systemctl enable "$NEXT_SERVICE" >/dev/null
systemctl restart "$NEXT_SERVICE"

service_ready=0
for _ in $(seq 1 45); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$NEXT_PORT/healthz" | grep -Fq "$RELEASE_ID"; then
    service_ready=1
    break
  fi
  sleep 1
done
if [[ "$service_ready" != "1" ]]; then
  journalctl -u "$NEXT_SERVICE" -n 100 --no-pager >&2 || true
  exit 1
fi

reload_nginx

base_url="https://$NEXT_SITE_HOST"
resolve_args=(--noproxy '*' --resolve "$NEXT_SITE_HOST:443:127.0.0.1")
wait_for_http_status() {
  local method="$1"
  local route="$2"
  local expected="$3"
  local observed=""
  for _ in $(seq 1 15); do
    if [[ "$method" == "HEAD" ]]; then
      if observed="$(curl -ksS --max-time 20 "${resolve_args[@]}" --head -o /dev/null -w '%{http_code}' "$base_url$route")" && [[ "$observed" == "$expected" ]]; then
        return 0
      fi
    elif observed="$(curl -ksS --max-time 20 "${resolve_args[@]}" -X "$method" -o /dev/null -w '%{http_code}' "$base_url$route")" && [[ "$observed" == "$expected" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Staging route $method $route returned HTTP ${observed:-transport-error} instead of $expected after Nginx reload." >&2
  return 1
}

nginx_ready=0
for _ in $(seq 1 15); do
  if curl -kfs --max-time 3 "${resolve_args[@]}" "$base_url/healthz" | grep -Fq "$RELEASE_ID"; then
    nginx_ready=1
    break
  fi
  sleep 1
done
if [[ "$nginx_ready" != "1" ]]; then
  echo "Reloaded Nginx did not route staging traffic to release $RELEASE_ID." >&2
  exit 1
fi
for route in / /status /vod/371745 /favicon.ico "$asset_path"; do
  wait_for_http_status GET "$route" 200
done
for route in /register /forgot-password /index.php/user/reg /index.php/user/reg.html /index.php/user/findpass /index.php/user/findpass.html; do
  for method in GET HEAD; do
    wait_for_http_status "$method" "$route" 410
  done
done
wait_for_http_status GET /__deployment_missing_route__ 404

api_file="$(mktemp /tmp/squaredmedia-api.XXXXXX.json)"
api_valid=0
for _ in $(seq 1 2); do
  if api_status="$(curl -ksS --max-time 10 "${resolve_args[@]}" -H 'Accept: application/json' -o "$api_file" -w '%{http_code}' "$base_url/index.php/pingfangapi/index?action=home_v2&compact=1")" &&
    API_RESPONSE_FILE="$api_file" API_HTTP_STATUS="$api_status" php -r '
    $payload = json_decode(file_get_contents(getenv("API_RESPONSE_FILE")), true);
    $status = getenv("API_HTTP_STATUS");
    $ok = $status === "200" && is_array($payload) && (string)($payload["code"] ?? "") === "1";
    $policy = $status === "403" && is_array($payload) && (string)($payload["code"] ?? "") === "403" && (string)($payload["msg"] ?? "") === "当前地区不可访问";
    if (!$ok && !$policy) exit(1);
  '; then
    api_valid=1
    break
  fi
  sleep 1
done
rm -f -- "$api_file"
if [[ "$api_valid" != "1" ]]; then
  echo "Staging production API did not return a valid home envelope after Nginx reload." >&2
  exit 1
fi

content_api_file="$(mktemp /tmp/squaredmedia-content-api.XXXXXX.json)"
content_api_valid=0
if content_api_status="$(curl -ksS --max-time 10 "${resolve_args[@]}" -H 'Accept: application/json' -o "$content_api_file" -w '%{http_code}' "$base_url/index.php/pingfangapi/index?action=content&compact=1&scope=library&sort=latest&page=1&page_size=24&include_facets=1")" &&
  API_RESPONSE_FILE="$content_api_file" API_HTTP_STATUS="$content_api_status" php -r '
  $payload = json_decode(file_get_contents(getenv("API_RESPONSE_FILE")), true);
  $status = getenv("API_HTTP_STATUS");
  $data = is_array($payload) && is_array($payload["data"] ?? null) ? $payload["data"] : [];
  $ok = $status === "200"
      && is_array($payload)
      && (string)($payload["code"] ?? "") === "1"
      && is_array($data["videos"] ?? null)
      && count($data["videos"]) <= 24
      && is_array($data["facets"] ?? null);
  $policy = $status === "403" && is_array($payload) && (string)($payload["code"] ?? "") === "403" && (string)($payload["msg"] ?? "") === "当前地区不可访问";
  if (!$ok && !$policy) exit(1);
'; then
  content_api_valid=1
fi
rm -f -- "$content_api_file"
if [[ "$content_api_valid" != "1" ]]; then
  echo "Staging production API content query exceeded its 10s browser budget or returned an invalid envelope." >&2
  exit 1
fi

for retired_action in register registration.code recover; do
  retired_api_file="$(mktemp /tmp/squaredmedia-retired-api.XXXXXX.json)"
  retired_api_valid=0
  for _ in $(seq 1 2); do
    if retired_api_status="$(curl -ksS --max-time 10 "${resolve_args[@]}" -H 'Accept: application/json' -o "$retired_api_file" -w '%{http_code}' "$base_url/index.php/pingfangapi/index?action=$retired_action")" &&
      RETIRED_API_RESPONSE_FILE="$retired_api_file" RETIRED_API_HTTP_STATUS="$retired_api_status" php -r '
      $payload = json_decode(file_get_contents(getenv("RETIRED_API_RESPONSE_FILE")), true);
      $status = getenv("RETIRED_API_HTTP_STATUS");
      $retired = $status === "404" && is_array($payload) && (string)($payload["code"] ?? "") === "404";
      $policy = $status === "403" && is_array($payload) && (string)($payload["code"] ?? "") === "403" && (string)($payload["msg"] ?? "") === "当前地区不可访问";
      if (!$retired && !$policy) exit(1);
    '; then
      retired_api_valid=1
      break
    fi
    sleep 1
  done
  rm -f -- "$retired_api_file"
  if [[ "$retired_api_valid" != "1" ]]; then
    echo "Staging retired API action $retired_action did not return a valid JSON 404 after Nginx reload." >&2
    exit 1
  fi
done

if [[ -n "$old_current" && -d "$old_current" ]]; then
  ln -s "$old_current" "$NEXT_ROOT/.previous.$RELEASE_ID"
  mv -Tf "$NEXT_ROOT/.previous.$RELEASE_ID" "$NEXT_ROOT/previous"
fi

release_committed=1
cleanup_remote
trap - EXIT
echo "Deployed Next.js release $RELEASE_ID to https://$NEXT_SITE_HOST/"
echo "Previous release: ${old_current:-none}"
REMOTE_DEPLOY

release_local_deploy_lock
echo "Next.js staging deployment completed: $release_id"
