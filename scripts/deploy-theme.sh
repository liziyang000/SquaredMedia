#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

deploy_tmp_dir=""

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}"
DEPLOY_SITE_HOST="${DEPLOY_SITE_HOST:-}"
DEPLOY_SITE_SCHEME="${DEPLOY_SITE_SCHEME:-https}"
DEPLOY_SITE_MARKER="${DEPLOY_SITE_MARKER:-}"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-all}"
DEPLOY_GATE_CACHE_ROOT="${DEPLOY_GATE_CACHE_ROOT:-$repo_root/.cache/deploy-gates/v1}"
THEME_NAME="pingfangvideo"
ADDON_NAME="pingfangdevice"
API_ADDON_NAME="pingfangapi"
ARCHIVE="dist/pingfangvideo.tar.gz"
ADDON_ARCHIVE="dist/pingfangdevice.tar.gz"
API_ADDON_ARCHIVE="dist/pingfangapi.tar.gz"
ROLLBACK_FAILED_EXIT_STATUS=95
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
upload_nonce="$(date +%Y%m%d%H%M%S).$$.$RANDOM"
REMOTE_TMP="${DEPLOY_REMOTE_TMP:-/tmp/${THEME_NAME}.${upload_nonce}.tar.gz}"
REMOTE_ADDON_TMP="${DEPLOY_REMOTE_ADDON_TMP:-/tmp/${ADDON_NAME}.${upload_nonce}.tar.gz}"
REMOTE_API_ADDON_TMP="${DEPLOY_REMOTE_API_ADDON_TMP:-/tmp/${API_ADDON_NAME}.${upload_nonce}.tar.gz}"

case "$DEPLOY_SCOPE" in
  all|backend|api) ;;
  *)
    echo "DEPLOY_SCOPE must be all, backend, or api." >&2
    exit 1
    ;;
esac

normalized_deploy_path="${DEPLOY_PATH%/}"
if [[ "$normalized_deploy_path" != /* || "$normalized_deploy_path" == "/" || "$(basename -- "$normalized_deploy_path")" != "template" ]]; then
  echo "DEPLOY_PATH must be an absolute MacCMS template directory ending in /template." >&2
  exit 1
fi
DEPLOY_PATH="$normalized_deploy_path"

validate_remote_archive_path() {
  local value="$1"
  local name="$2"
  if [[ ! "$value" =~ ^/tmp/[A-Za-z0-9][A-Za-z0-9._-]*\.tar\.gz$ ]]; then
    echo "$name must be a single .tar.gz file directly under /tmp." >&2
    exit 1
  fi
}

if [[ "$DEPLOY_SCOPE" == "all" ]]; then
  validate_remote_archive_path "$REMOTE_TMP" "DEPLOY_REMOTE_TMP"
fi
if [[ "$DEPLOY_SCOPE" != "api" ]]; then
  validate_remote_archive_path "$REMOTE_ADDON_TMP" "DEPLOY_REMOTE_ADDON_TMP"
fi
validate_remote_archive_path "$REMOTE_API_ADDON_TMP" "DEPLOY_REMOTE_API_ADDON_TMP"

if [[ -n "$DEPLOY_SITE_HOST" && ! "$DEPLOY_SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DEPLOY_SITE_HOST must be a hostname without a scheme or path." >&2
  exit 1
fi
if [[ "$DEPLOY_SITE_SCHEME" != "http" && "$DEPLOY_SITE_SCHEME" != "https" ]]; then
  echo "DEPLOY_SITE_SCHEME must be http or https." >&2
  exit 1
fi
if [[ "$DEPLOY_GATE_CACHE_ROOT" != /* || "$DEPLOY_GATE_CACHE_ROOT" == "/" || -L "$DEPLOY_GATE_CACHE_ROOT" ]]; then
  echo "DEPLOY_GATE_CACHE_ROOT must be a safe absolute directory." >&2
  exit 1
fi

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
    echo "DEPLOY_PASSWORD requires sshpass. Install sshpass or configure SSH key authentication." >&2
    exit 1
  fi

  export SSHPASS="$DEPLOY_PASSWORD"
  ssh_command=(sshpass -e ssh "${ssh_options[@]}")
  scp_command=(sshpass -e scp "${scp_options[@]}")
else
  ssh_command=(ssh "${ssh_options[@]}")
  scp_command=(scp "${scp_options[@]}")
fi

DEVICE_SESSION_HASH=""
DEVICE_HOOK_HASH=""
if [[ "$DEPLOY_SCOPE" == "api" ]]; then
  device_session_file="addons/$ADDON_NAME/service/DeviceSession.php"
  device_hook_file="addons/$ADDON_NAME/Pingfangdevice.php"
  if [[ ! -f "$device_session_file" || ! -f "$device_hook_file" ]]; then
    echo "API-only deployment requires the local $ADDON_NAME service and hook files." >&2
    exit 1
  fi
  DEVICE_SESSION_HASH="$(php -r '
    $hash = hash_file("sha256", $argv[1]);
    if ($hash === false) {
        exit(1);
    }
    echo $hash;
  ' "$device_session_file")"
  DEVICE_HOOK_HASH="$(php -r '
    $hash = hash_file("sha256", $argv[1]);
    if ($hash === false) {
        exit(1);
    }
    echo $hash;
  ' "$device_hook_file")"
fi

run_full_gate() {
  npm test
  npm run lint
  npm run lint:template
  npm run verify:compat
  npm run verify:preview
  DEPLOY_SCOPE=all npm run package
  DEPLOY_SCOPE=all npm run verify:release
}

run_api_gate() {
  npm run test:api
  DEPLOY_SCOPE=api npm run package
  DEPLOY_SCOPE=api npm run verify:release
}

release_fingerprint=""
if release_fingerprint="$(node scripts/release-input-fingerprint.mjs repository)"; then
  gate_receipt="$DEPLOY_GATE_CACHE_ROOT/$release_fingerprint.ok"
else
  echo "Release fingerprint unavailable; running the full local gate." >&2
  release_fingerprint=""
  gate_receipt=""
fi

if [[ "$DEPLOY_SCOPE" == "api" && -n "$gate_receipt" && -f "$gate_receipt" && ! -L "$gate_receipt" && "$(<"$gate_receipt")" == "$release_fingerprint" ]]; then
  echo "Using the scoped API gate for previously verified release inputs $release_fingerprint"
  run_api_gate
else
  run_full_gate
  if [[ -n "$release_fingerprint" ]]; then
    verified_fingerprint="$(node scripts/release-input-fingerprint.mjs repository)"
    if [[ "$verified_fingerprint" != "$release_fingerprint" ]]; then
      echo "Release inputs changed while the full local gate was running." >&2
      exit 1
    fi
    mkdir -p "$DEPLOY_GATE_CACHE_ROOT"
    chmod 0700 "$DEPLOY_GATE_CACHE_ROOT"
    gate_receipt_tmp="$gate_receipt.$$.$RANDOM.tmp"
    (umask 077 && printf '%s\n' "$release_fingerprint" > "$gate_receipt_tmp")
    mv -f "$gate_receipt_tmp" "$gate_receipt"
  fi
fi

if [[ -n "$release_fingerprint" ]]; then
  upload_fingerprint="$(node scripts/release-input-fingerprint.mjs repository)"
  if [[ "$upload_fingerprint" != "$release_fingerprint" ]]; then
    echo "Release inputs changed after local verification; refusing to upload." >&2
    exit 1
  fi
fi

remote_tmp_env=(
  "DEPLOY_SCOPE=$(printf "%q" "$DEPLOY_SCOPE")"
  "REMOTE_TMP=$(printf "%q" "$REMOTE_TMP")"
  "REMOTE_ADDON_TMP=$(printf "%q" "$REMOTE_ADDON_TMP")"
  "REMOTE_API_ADDON_TMP=$(printf "%q" "$REMOTE_API_ADDON_TMP")"
)
"${ssh_command[@]}" "$REMOTE" "${remote_tmp_env[*]} bash -s" <<'REMOTE_TMP_PREFLIGHT'
set -euo pipefail
archives=("$REMOTE_API_ADDON_TMP")
if [[ "$DEPLOY_SCOPE" == "all" ]]; then
  archives=("$REMOTE_TMP" "$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
elif [[ "$DEPLOY_SCOPE" == "backend" ]]; then
  archives=("$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
fi
for archive in "${archives[@]}"; do
  if [[ -e "$archive" || -L "$archive" ]]; then
    echo "Remote upload target already exists: $archive" >&2
    exit 1
  fi
done
REMOTE_TMP_PREFLIGHT

cleanup_remote_uploads() {
  local status=$?
  local -a preserved_archives
  trap - EXIT
  set +e
  preserved_archives=("$REMOTE_API_ADDON_TMP")
  if [[ "$DEPLOY_SCOPE" == "all" ]]; then
    preserved_archives=("$REMOTE_TMP" "$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
  elif [[ "$DEPLOY_SCOPE" == "backend" ]]; then
    preserved_archives=("$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
  fi
  if [[ "$status" -eq "$ROLLBACK_FAILED_EXIT_STATUS" ]]; then
    echo "CRITICAL: remote automatic rollback failed; preserving uploaded release archives for manual recovery." >&2
    echo "CRITICAL: preserved remote archives: ${preserved_archives[*]}" >&2
    exit "$status"
  fi
  if [[ "$status" -eq 255 ]]; then
    echo "CRITICAL: SSH transport failed; the remote deployment state is unknown, so uploaded release archives are being preserved." >&2
    echo "CRITICAL: preserved remote archives: ${preserved_archives[*]}" >&2
    exit "$status"
  fi
  if ! "${ssh_command[@]}" "$REMOTE" "${remote_tmp_env[*]} bash -s" <<'REMOTE_UPLOAD_CLEANUP'
set -euo pipefail
archives=("$REMOTE_API_ADDON_TMP")
if [[ "$DEPLOY_SCOPE" == "all" ]]; then
  archives=("$REMOTE_TMP" "$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
elif [[ "$DEPLOY_SCOPE" == "backend" ]]; then
  archives=("$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
fi
for archive in "${archives[@]}"; do
  if [[ -f "$archive" && ! -L "$archive" ]]; then
    rm -f -- "$archive"
  fi
done
REMOTE_UPLOAD_CLEANUP
  then
    echo "Warning: failed to clean remote upload files after deployment interruption." >&2
  fi
  exit "$status"
}
trap cleanup_remote_uploads EXIT

if [[ "$DEPLOY_SCOPE" == "all" ]]; then
  "${scp_command[@]}" "$ARCHIVE" "${REMOTE}:${REMOTE_TMP}"
fi
if [[ "$DEPLOY_SCOPE" != "api" ]]; then
  "${scp_command[@]}" "$ADDON_ARCHIVE" "${REMOTE}:${REMOTE_ADDON_TMP}"
fi
"${scp_command[@]}" "$API_ADDON_ARCHIVE" "${REMOTE}:${REMOTE_API_ADDON_TMP}"

remote_env=(
  "DEPLOY_SCOPE=$(printf "%q" "$DEPLOY_SCOPE")"
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "REMOTE_TMP=$(printf "%q" "$REMOTE_TMP")"
  "REMOTE_ADDON_TMP=$(printf "%q" "$REMOTE_ADDON_TMP")"
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
  "ADDON_NAME=$(printf "%q" "$ADDON_NAME")"
  "API_ADDON_NAME=$(printf "%q" "$API_ADDON_NAME")"
  "REMOTE_API_ADDON_TMP=$(printf "%q" "$REMOTE_API_ADDON_TMP")"
  "DEPLOY_CLEAR_CACHE=$(printf "%q" "$DEPLOY_CLEAR_CACHE")"
  "DEPLOY_SITE_HOST=$(printf "%q" "$DEPLOY_SITE_HOST")"
  "DEPLOY_SITE_SCHEME=$(printf "%q" "$DEPLOY_SITE_SCHEME")"
  "DEPLOY_SITE_MARKER=$(printf "%q" "$DEPLOY_SITE_MARKER")"
  "DEVICE_SESSION_HASH=$(printf "%q" "$DEVICE_SESSION_HASH")"
  "DEVICE_HOOK_HASH=$(printf "%q" "$DEVICE_HOOK_HASH")"
  "ROLLBACK_FAILED_EXIT_STATUS=$(printf "%q" "$ROLLBACK_FAILED_EXIT_STATUS")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

case "$DEPLOY_SCOPE" in
  all|backend|api) ;;
  *)
    echo "Remote DEPLOY_SCOPE must be all, backend, or api." >&2
    exit 1
    ;;
esac

theme_source=""
device_addon_source=""
api_addon_source=""
rollback_root=""
release_started=0
release_committed=0
API_WARMUP_TIMEOUT_SECONDS=10
API_WARMUP_TOTAL_TIMEOUT_SECONDS=30
API_WARMUP_MAX_ENDPOINTS=5
api_warmup_count=0
api_warmed_count=0
api_warmup_last_file=""
api_warmup_started_seconds=0

clear_maccms_cache() {
  local maccms_root cache_dir cleared

  maccms_root="$(dirname "$DEPLOY_PATH")"
  cleared=0

  for cache_dir in \
    "$maccms_root/runtime/cache" \
    "$maccms_root/runtime/temp" \
    "$maccms_root/application/admin/view/_cache" \
    "$maccms_root/application/index/view/_cache"
  do
    if [[ -d "$cache_dir" ]]; then
      if ! find "$cache_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; then
        echo "Failed to clear MacCMS cache directory: $cache_dir" >&2
        return 1
      fi
      cleared=$((cleared + 1))
    fi
  done

  echo "Cleared ${cleared} MacCMS cache directories under ${maccms_root}"
}

validate_api_warmup_response() {
  local response_file="$1"
  local http_status="$2"
  local response_kind="$3"
  local validation_status

  if API_RESPONSE_FILE="$response_file" API_HTTP_STATUS="$http_status" API_RESPONSE_KIND="$response_kind" php -r '
    $payload = json_decode(file_get_contents(getenv("API_RESPONSE_FILE")), true);
    $status = (string) getenv("API_HTTP_STATUS");
    $kind = (string) getenv("API_RESPONSE_KIND");
    $policyValid = $status === "403"
        && is_array($payload)
        && (string)($payload["code"] ?? "") === "403"
        && (string)($payload["msg"] ?? "") === "当前地区不可访问";
    if ($status === "403") {
        if ($policyValid) {
            exit(42);
        }
        fwrite(STDERR, "Production API returned an invalid regional policy envelope.\n");
        exit(1);
    }
    if ($status !== "200" || !is_array($payload) || (string)($payload["code"] ?? "") !== "1" || !is_array($payload["data"] ?? null)) {
        fwrite(STDERR, "Production API response is not a valid success envelope.\n");
        exit(1);
    }

    $data = $payload["data"];
    $validCategories = static function ($categories, $requireTotals = false) {
        if (!is_array($categories)) {
            return false;
        }
        foreach ($categories as $category) {
            $id = is_array($category) ? (string)($category["id"] ?? "") : "";
            if (!is_array($category) || !preg_match("/^[1-9][0-9]*$/", $id) || !is_string($category["name"] ?? null)) {
                return false;
            }
            if ($requireTotals && (!is_int($category["total"] ?? null) || $category["total"] < 0)) {
                return false;
            }
        }
        return true;
    };
    $validContent = static function ($value, $requireTotals = false) use ($validCategories) {
        return $validCategories($value["categories"] ?? null, $requireTotals)
            && is_array($value["facets"] ?? null)
            && is_array($value["facets"]["classes"] ?? null)
            && is_array($value["videos"] ?? null)
            && is_int($value["total"] ?? null)
            && $value["total"] >= 0
            && is_int($value["page"] ?? null)
            && $value["page"] >= 1
            && is_int($value["totalPages"] ?? null)
            && $value["totalPages"] >= 0;
    };

    $valid = false;
    if ($kind === "home_v2") {
        $valid = $validCategories($data["categories"] ?? null)
            && count($data["categories"]) <= 5
            && is_array($data["hero"] ?? null)
            && is_array($data["ranking"] ?? null)
            && is_array($data["latest"] ?? null)
            && is_array($data["latestByCategory"] ?? null);
    } elseif ($kind === "navigation") {
        $valid = is_string($data["siteName"] ?? null)
            && $validCategories($data["categories"] ?? null);
    } elseif ($kind === "content") {
        $valid = $validContent($data);
    } elseif ($kind === "category_totals") {
        $valid = $validContent($data, true);
    }
    if (!$valid) {
        $message = $kind === "home_v2"
            ? "Production API response is not a valid home envelope.\n"
            : "Production API response is not a valid " . $kind . " envelope.\n";
        fwrite(STDERR, $message);
        exit(1);
    }
  '; then
    return 0
  else
    validation_status=$?
  fi

  if [[ "$validation_status" == "42" ]]; then
    return 2
  fi
  return 1
}

request_api_warmup() {
  local port="$1"
  local label="$2"
  local query="$3"
  local response_kind="$4"
  local api_url api_file api_metrics api_status api_bytes api_time validation_status elapsed remaining request_timeout

  if (( api_warmup_count >= API_WARMUP_MAX_ENDPOINTS )); then
    echo "API warmup endpoint limit of ${API_WARMUP_MAX_ENDPOINTS} would be exceeded." >&2
    return 1
  fi
  elapsed=$((SECONDS - api_warmup_started_seconds))
  remaining=$((API_WARMUP_TOTAL_TIMEOUT_SECONDS - elapsed))
  if (( remaining <= 0 )); then
    echo "Production API warmup exhausted its ${API_WARMUP_TOTAL_TIMEOUT_SECONDS}s total budget before ${label}." >&2
    return 1
  fi
  request_timeout="$API_WARMUP_TIMEOUT_SECONDS"
  if (( remaining < request_timeout )); then
    request_timeout="$remaining"
  fi
  api_warmup_count=$((api_warmup_count + 1))
  api_url="${DEPLOY_SITE_SCHEME}://${DEPLOY_SITE_HOST}/index.php/pingfangapi/index?${query}"
  api_file="$deploy_tmp_dir/api-warmup-${api_warmup_count}.json"
  if ! api_metrics="$(curl -k -sS --noproxy '*' \
    --connect-timeout 5 --max-time "$request_timeout" \
    --resolve "${DEPLOY_SITE_HOST}:${port}:127.0.0.1" \
    -H 'Accept: application/json' \
    -o "$api_file" -w '%{http_code} %{size_download} %{time_total}' "$api_url")"; then
    echo "Production API warmup request failed for ${label}: ${api_url}" >&2
    return 1
  fi
  read -r api_status api_bytes api_time <<< "$api_metrics"
  if [[ "$api_status" != "200" && "$api_status" != "403" ]]; then
    echo "Production API warmup failed for ${label}: HTTP ${api_status}" >&2
    return 1
  fi

  if validate_api_warmup_response "$api_file" "$api_status" "$response_kind"; then
    api_warmed_count=$((api_warmed_count + 1))
    api_warmup_last_file="$api_file"
    echo "Warmed production API ${label}: HTTP ${api_status}, ${api_bytes} bytes, ${api_time}s"
    return 0
  else
    validation_status=$?
  fi
  if [[ "$validation_status" == "2" ]]; then
    echo "API warmup not completed for ${label}: exact regional policy HTTP 403 was verified; no API cache was warmed."
    return 2
  fi
  return 1
}

warm_api_endpoints() {
  local port="$1"
  local result planned_count index type_id
  local -a home_type_ids labels queries kinds

  api_warmup_count=0
  api_warmed_count=0
  api_warmup_last_file=""
  api_warmup_started_seconds=$SECONDS
  echo "Starting bounded production API warmup (max ${API_WARMUP_MAX_ENDPOINTS} endpoints, ${API_WARMUP_TIMEOUT_SECONDS}s each, ${API_WARMUP_TOTAL_TIMEOUT_SECONDS}s total)."

  if request_api_warmup "$port" "home_v2" "action=home_v2&compact=1" "home_v2"; then
    :
  else
    result=$?
    if [[ "$result" == "2" ]]; then
      echo "API warmup stopped: regional policy prevented home_v2; all remaining endpoints were not requested and are not warmed."
      return 0
    fi
    return "$result"
  fi

  mapfile -t home_type_ids < <(API_RESPONSE_FILE="$api_warmup_last_file" php -r '
    $payload = json_decode(file_get_contents(getenv("API_RESPONSE_FILE")), true);
    $seen = [];
    foreach (($payload["data"]["categories"] ?? []) as $category) {
        $id = (string)($category["id"] ?? "");
        if (!preg_match("/^[1-9][0-9]*$/", $id) || isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        echo $id, PHP_EOL;
        if (count($seen) === 1) {
            break;
        }
    }
  ')

  labels=("navigation" "content page 1 with facets" "category totals")
  queries=(
    "action=navigation"
    "action=content&compact=1&scope=library&sort=latest&page=1&page_size=24&include_facets=1"
    "action=content&compact=1&page=1&page_size=1&include_category_totals=1"
  )
  kinds=("navigation" "content" "category_totals")
  planned_count=$((4 + ${#home_type_ids[@]}))

  for index in "${!queries[@]}"; do
    if request_api_warmup "$port" "${labels[$index]}" "${queries[$index]}" "${kinds[$index]}"; then
      continue
    else
      result=$?
    fi
    if [[ "$result" == "2" ]]; then
      echo "API warmup stopped after ${api_warmed_count}/${planned_count} endpoints; remaining endpoints were not requested and are not warmed."
      return 0
    fi
    return "$result"
  done

  for type_id in "${home_type_ids[@]}"; do
    if request_api_warmup "$port" "HOME type ${type_id} page 1" "action=content&compact=1&type_id=${type_id}&sort=latest&page=1&page_size=24&include_facets=1" "content"; then
      continue
    else
      result=$?
    fi
    if [[ "$result" == "2" ]]; then
      echo "API warmup stopped after ${api_warmed_count}/${planned_count} endpoints; remaining endpoints were not requested and are not warmed."
      return 0
    fi
    return "$result"
  done

  echo "Completed bounded production API warmup: ${api_warmed_count}/${planned_count} endpoints warmed."
}

verify_deployed_site() {
  local port verify_url verify_file status bytes

  if [[ -z "$DEPLOY_SITE_HOST" ]]; then
    return
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required when DEPLOY_SITE_HOST is configured." >&2
    exit 1
  fi

  if [[ "$DEPLOY_SITE_SCHEME" == "https" ]]; then
    port=443
  else
    port=80
  fi
  verify_url="${DEPLOY_SITE_SCHEME}://${DEPLOY_SITE_HOST}/"
  verify_file="$deploy_tmp_dir/site-verification.html"
  if ! status="$(curl -k -sS -L --max-time 30 \
    --resolve "${DEPLOY_SITE_HOST}:${port}:127.0.0.1" \
    -o "$verify_file" -w '%{http_code}' "$verify_url")"; then
    echo "Deployed site verification request failed for ${verify_url}" >&2
    exit 1
  fi

  if [[ ! "$status" =~ ^[23][0-9][0-9]$ ]]; then
    echo "Deployed site verification failed for ${verify_url}: HTTP ${status}" >&2
    exit 1
  fi
  if [[ -n "$DEPLOY_SITE_MARKER" ]] && ! grep -Fq -- "$DEPLOY_SITE_MARKER" "$verify_file"; then
    echo "Deployed site verification failed: response is missing marker ${DEPLOY_SITE_MARKER}" >&2
    exit 1
  fi

  bytes="$(wc -c < "$verify_file")"
  echo "Verified deployed site ${verify_url}: HTTP ${status}, ${bytes} bytes"
  warm_api_endpoints "$port"
}

install_device_addon() {
  local maccms_root addon_dir backup application_source application_target application_backup

  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$ADDON_NAME"
  application_target="$maccms_root/application/index/controller/Pingfangdevice.php"
  mkdir -p "$maccms_root/addons"

  if [[ -d "$addon_dir" ]]; then
    backup="${ADDON_NAME}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$addon_dir" "$maccms_root/addons/$backup"
  fi

  rm -rf "$addon_dir"
  mv "$device_addon_source" "$addon_dir"

  application_source="$addon_dir/application/index/controller/Pingfangdevice.php"
  if [[ ! -f "$application_source" ]]; then
    echo "Addon archive does not contain application/index/controller/Pingfangdevice.php" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$application_target")"
  if [[ -f "$application_target" ]]; then
    application_backup="${application_target}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$application_target" "$application_backup"
  fi
  cp -a "$application_source" "$application_target"

  MACCMS_ROOT="$maccms_root" ADDON_NAME="$ADDON_NAME" php <<'PHP_CONFIG'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$addon = getenv('ADDON_NAME');
$path = $root . '/application/extra/addons.php';
$config = is_file($path) ? include $path : [];
if (!is_array($config)) {
    $config = [];
}
$config += ['autoload' => false, 'hooks' => [], 'route' => []];
if (!is_array($config['hooks'])) {
    $config['hooks'] = [];
}
if (!isset($config['hooks']['app_begin']) || !is_array($config['hooks']['app_begin'])) {
    $config['hooks']['app_begin'] = [];
}
if (!in_array($addon, $config['hooks']['app_begin'], true)) {
    $config['hooks']['app_begin'][] = $addon;
}
$content = "<?php\n\nreturn " . var_export($config, true) . ";\n";
$tempPath = $path . '.tmp.' . getmypid();
if (is_file($path) && !copy($path, $path . '.backup.' . date('YmdHis') . '.' . getmypid())) {
    fwrite(STDERR, "Failed to back up addon hook config.\n");
    exit(1);
}
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $path)) {
    @unlink($tempPath);
    fwrite(STDERR, "Failed to update addon hook config.\n");
    exit(1);
}
$verified = include $path;
if (!in_array($addon, $verified['hooks']['app_begin'] ?? [], true)) {
    fwrite(STDERR, "Addon app_begin hook verification failed.\n");
    exit(1);
}
PHP_CONFIG

  MACCMS_ROOT="$maccms_root" ADDON_NAME="$ADDON_NAME" php <<'PHP_SQL'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$addon = getenv('ADDON_NAME');
$dbFile = $root . '/application/database.php';
$sqlFile = $root . '/addons/' . $addon . '/install.sql';
if (!is_file($dbFile) || !is_file($sqlFile)) {
    fwrite(STDERR, "MacCMS database config or addon install.sql is missing.\n");
    exit(1);
}
$db = include $dbFile;
$prefix = isset($db['prefix']) ? $db['prefix'] : '';
$sql = str_replace('__PREFIX__', $prefix, file_get_contents($sqlFile));
$dsn = isset($db['dsn']) && $db['dsn'] !== '' ? $db['dsn'] : sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
    $db['hostname'] ?? '127.0.0.1',
    $db['hostport'] ?? '3306',
    $db['database'] ?? '',
    $db['charset'] ?? 'utf8'
);
$pdo = new PDO($dsn, $db['username'] ?? '', $db['password'] ?? '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$statement = '';
foreach (preg_split('/\r?\n/', $sql) as $line) {
    $trimmed = trim($line);
    if ($trimmed === '' || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '/*')) {
        continue;
    }
    $statement .= $line . "\n";
    if (substr($trimmed, -1) === ';') {
        $pdo->exec($statement);
        $statement = '';
    }
}
$table = $prefix . 'pingfang_device_session';
$required = [
    'device_label',
    'ip_address',
    'last_seen_time',
    'login_check_hash',
    'login_time',
    'revoked_reason',
    'revoked_time',
    'session_id',
    'token_hash',
    'user_agent',
    'user_id',
];
$placeholders = implode(',', array_fill(0, count($required), '?'));
$check = $pdo->prepare(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (' . $placeholders . ')'
);
$check->execute(array_merge([$table], $required));
$columns = $check->fetchAll(PDO::FETCH_COLUMN);
sort($columns);
if ($columns !== $required) {
    fwrite(STDERR, "Device session schema verification failed.\n");
    exit(1);
}
PHP_SQL

  php -l "$addon_dir/service/DeviceSession.php" >/dev/null
  php -l "$application_target" >/dev/null

  echo "Installed and verified ${ADDON_NAME} addon under ${addon_dir}"
}

preflight_release() {
  local maccms_root theme_tmp device_tmp api_tmp php_file device_service device_hook installed_hash installed_hook_hash
  local -a php_roots

  maccms_root="$(dirname "$DEPLOY_PATH")"
  api_tmp="$deploy_tmp_dir/preflight-api"
  mkdir -p "$api_tmp"

  tar -xzf "$REMOTE_API_ADDON_TMP" -C "$api_tmp"
  api_addon_source="$api_tmp/$API_ADDON_NAME"

  if [[ ! -f "$api_addon_source/info.ini" || ! -f "$api_addon_source/application/index/controller/Pingfangapi.php" || ! -f "$api_addon_source/service/AccountService.php" ]]; then
    echo "Uploaded API addon archive is incomplete." >&2
    exit 1
  fi
  php_roots=("$api_addon_source")

  if [[ "$DEPLOY_SCOPE" != "api" ]]; then
    device_tmp="$deploy_tmp_dir/preflight-device"
    mkdir -p "$device_tmp"
    tar -xzf "$REMOTE_ADDON_TMP" -C "$device_tmp"
    device_addon_source="$device_tmp/$ADDON_NAME"

    if [[ ! -f "$device_addon_source/info.ini" || ! -f "$device_addon_source/install.sql" || ! -f "$device_addon_source/application/index/controller/Pingfangdevice.php" ]]; then
      echo "Uploaded device addon archive is incomplete." >&2
      exit 1
    fi
    php_roots=("$device_addon_source" "$api_addon_source")
  fi

  if [[ "$DEPLOY_SCOPE" == "all" ]]; then
    theme_tmp="$deploy_tmp_dir/preflight-theme"
    mkdir -p "$theme_tmp"
    tar -xzf "$REMOTE_TMP" -C "$theme_tmp"
    theme_source="$theme_tmp/$THEME_NAME"
    if [[ ! -f "$theme_source/info.ini" ]]; then
      echo "Uploaded theme archive does not contain $THEME_NAME/info.ini" >&2
      exit 1
    fi
  fi

  while IFS= read -r -d '' php_file; do
    php -l "$php_file" >/dev/null
  done < <(find "${php_roots[@]}" -type f -name '*.php' -print0)

  if [[ "$DEPLOY_SCOPE" == "api" ]]; then
    device_service="$maccms_root/addons/$ADDON_NAME/service/DeviceSession.php"
    device_hook="$maccms_root/addons/$ADDON_NAME/Pingfangdevice.php"
    if [[ ! -f "$device_service" || ! -f "$device_hook" ]]; then
      echo "API-only deployment requires the installed $ADDON_NAME service and hook files." >&2
      exit 1
    fi
    if [[ ! "$DEVICE_SESSION_HASH" =~ ^[a-f0-9]{64}$ || ! "$DEVICE_HOOK_HASH" =~ ^[a-f0-9]{64}$ ]]; then
      echo "API-only deployment received an invalid device dependency hash." >&2
      exit 1
    fi
    installed_hash="$(DEVICE_SESSION_FILE="$device_service" php -r '
      $hash = hash_file("sha256", getenv("DEVICE_SESSION_FILE"));
      if ($hash === false) {
          exit(1);
      }
      echo $hash;
    ')"
    if [[ "$installed_hash" != "$DEVICE_SESSION_HASH" ]]; then
      echo "Installed $ADDON_NAME service is not compatible with this API-only release. Run the backend deployment first." >&2
      exit 1
    fi
    installed_hook_hash="$(DEVICE_HOOK_FILE="$device_hook" php -r '
      $hash = hash_file("sha256", getenv("DEVICE_HOOK_FILE"));
      if ($hash === false) {
          exit(1);
      }
      echo $hash;
    ')"
    if [[ "$installed_hook_hash" != "$DEVICE_HOOK_HASH" ]]; then
      echo "Installed $ADDON_NAME hook is not compatible with this API-only release. Run the backend deployment first." >&2
      exit 1
    fi
    MACCMS_ROOT="$maccms_root" ADDON_NAME="$ADDON_NAME" php <<'PHP_DEVICE_HOOK'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$addon = getenv('ADDON_NAME');
$path = $root . '/application/extra/addons.php';
$config = is_file($path) ? include $path : [];
if (!is_array($config) || !in_array($addon, $config['hooks']['app_begin'] ?? [], true)) {
    fwrite(STDERR, "Installed pingfangdevice app_begin hook is not enabled. Run the backend deployment first.\n");
    exit(1);
}
PHP_DEVICE_HOOK
  fi

  MACCMS_ROOT="$maccms_root" DEPLOY_SCOPE="$DEPLOY_SCOPE" php <<'PHP_API_SCHEMA'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$dbFile = $root . '/application/database.php';
if (!is_file($dbFile)) {
    fwrite(STDERR, "MacCMS database config is missing.\n");
    exit(1);
}
$db = include $dbFile;
$prefix = isset($db['prefix']) ? $db['prefix'] : '';
$dsn = isset($db['dsn']) && $db['dsn'] !== '' ? $db['dsn'] : sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=%s',
    $db['hostname'] ?? '127.0.0.1',
    $db['hostport'] ?? '3306',
    $db['database'] ?? '',
    $db['charset'] ?? 'utf8'
);
$pdo = new PDO($dsn, $db['username'] ?? '', $db['password'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$table = $prefix . 'ulog';
$check = $pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?, ?)');
$check->execute([$table, 'ulog_point', 'ulog_duration']);
$columns = $check->fetchAll(PDO::FETCH_COLUMN);
sort($columns);
if ($columns !== ['ulog_duration', 'ulog_point']) {
    fwrite(STDERR, "MacCMS ulog progress columns are required by pingfangapi.\n");
    exit(1);
}

if (getenv('DEPLOY_SCOPE') === 'api') {
    $table = $prefix . 'pingfang_device_session';
    $required = [
        'device_label',
        'ip_address',
        'last_seen_time',
        'login_check_hash',
        'login_time',
        'revoked_reason',
        'revoked_time',
        'session_id',
        'token_hash',
        'user_agent',
        'user_id',
    ];
    $placeholders = implode(',', array_fill(0, count($required), '?'));
    $check = $pdo->prepare(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (' . $placeholders . ')'
    );
    $check->execute(array_merge([$table], $required));
    $columns = $check->fetchAll(PDO::FETCH_COLUMN);
    sort($columns);
    if ($columns !== $required) {
        fwrite(STDERR, "Installed pingfangdevice database schema is not compatible with API-only deployment.\n");
        exit(1);
    }
}
PHP_API_SCHEMA

  if [[ "$DEPLOY_SCOPE" == "api" ]]; then
    echo "Preflighted API addon, installed device service and hook, PHP syntax, and API database requirements"
  elif [[ "$DEPLOY_SCOPE" == "backend" ]]; then
    echo "Preflighted device addon, API addon, PHP syntax, and API database requirements"
  else
    echo "Preflighted theme, device addon, API addon, PHP syntax, and API database requirements"
  fi
}

install_api_addon() {
  local maccms_root addon_dir backup application_source application_target application_backup

  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$API_ADDON_NAME"
  application_target="$maccms_root/application/index/controller/Pingfangapi.php"
  mkdir -p "$maccms_root/addons"

  if [[ -d "$addon_dir" ]]; then
    backup="${API_ADDON_NAME}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$addon_dir" "$maccms_root/addons/$backup"
  fi

  rm -rf "$addon_dir"
  mv "$api_addon_source" "$addon_dir"

  application_source="$addon_dir/application/index/controller/Pingfangapi.php"
  mkdir -p "$(dirname "$application_target")"
  if [[ -f "$application_target" ]]; then
    application_backup="${application_target}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$application_target" "$application_backup"
  fi
  cp -a "$application_source" "$application_target"

  php -l "$application_target" >/dev/null
  echo "Installed and verified ${API_ADDON_NAME} addon under ${addon_dir}"
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi
resolved_deploy_path="$(readlink -f -- "$DEPLOY_PATH")"
if [[ -z "$resolved_deploy_path" || "$resolved_deploy_path" == "/" || "$(basename -- "$resolved_deploy_path")" != "template" ]]; then
  echo "Remote DEPLOY_PATH did not resolve to a MacCMS template directory." >&2
  exit 1
fi
DEPLOY_PATH="$resolved_deploy_path"
maccms_root="$(dirname "$DEPLOY_PATH")"
if [[ "$maccms_root" == "/" || ! -f "$maccms_root/application/database.php" ]]; then
  echo "Remote MacCMS application/database.php is missing next to DEPLOY_PATH." >&2
  exit 1
fi

deploy_tmp_dir="$(mktemp -d)"
snapshot_release() {
  local maccms_root
  maccms_root="$(dirname "$DEPLOY_PATH")"
  rollback_root="$deploy_tmp_dir/rollback"
  mkdir -p "$rollback_root"

  snapshot_path "$maccms_root/addons/$API_ADDON_NAME" "api-addon"
  snapshot_path "$maccms_root/application/index/controller/Pingfangapi.php" "api-controller"
  if [[ "$DEPLOY_SCOPE" != "api" ]]; then
    snapshot_path "$maccms_root/addons/$ADDON_NAME" "device-addon"
    snapshot_path "$maccms_root/application/index/controller/Pingfangdevice.php" "device-controller"
    snapshot_path "$maccms_root/application/extra/addons.php" "addons-config"
  fi
  if [[ "$DEPLOY_SCOPE" == "all" ]]; then
    snapshot_path "$DEPLOY_PATH/$THEME_NAME" "theme"
  fi
}

snapshot_path() {
  local source="$1"
  local label="$2"
  if [[ -e "$source" || -L "$source" ]]; then
    cp -a -- "$source" "$rollback_root/$label"
  else
    : > "$rollback_root/$label.missing"
  fi
}

restore_release() {
  local maccms_root rollback_status
  maccms_root="$(dirname "$DEPLOY_PATH")"
  rollback_status=0
  echo "Deployment failed; restoring the pre-deploy filesystem snapshot." >&2
  if ! restore_path "$maccms_root/addons/$API_ADDON_NAME" "api-addon"; then
    rollback_status=1
  fi
  if ! restore_path "$maccms_root/application/index/controller/Pingfangapi.php" "api-controller"; then
    rollback_status=1
  fi
  if [[ "$DEPLOY_SCOPE" != "api" ]]; then
    if ! restore_path "$maccms_root/addons/$ADDON_NAME" "device-addon"; then
      rollback_status=1
    fi
    if ! restore_path "$maccms_root/application/index/controller/Pingfangdevice.php" "device-controller"; then
      rollback_status=1
    fi
    if ! restore_path "$maccms_root/application/extra/addons.php" "addons-config"; then
      rollback_status=1
    fi
  fi
  if [[ "$DEPLOY_SCOPE" == "all" ]]; then
    if ! restore_path "$DEPLOY_PATH/$THEME_NAME" "theme"; then
      rollback_status=1
    fi
  fi
  if [[ "$DEPLOY_CLEAR_CACHE" != "0" ]]; then
    if ! clear_maccms_cache; then
      rollback_status=1
    fi
  fi
  return "$rollback_status"
}

restore_path() {
  local target="$1"
  local label="$2"
  if ! rm -rf -- "$target"; then
    echo "Failed to remove deployment target while restoring $label: $target" >&2
    return 1
  fi
  if [[ ! -f "$rollback_root/$label.missing" ]]; then
    if ! mkdir -p "$(dirname "$target")"; then
      echo "Failed to prepare deployment target while restoring $label: $target" >&2
      return 1
    fi
    if ! cp -a -- "$rollback_root/$label" "$target"; then
      echo "Failed to restore $label from $rollback_root/$label to $target" >&2
      return 1
    fi
  fi
}

cleanup_deploy_files() {
  local status=$?
  local rollback_status=0
  local archive
  local -a archives
  trap - EXIT
  set +e
  archives=("$REMOTE_API_ADDON_TMP")
  if [[ "$DEPLOY_SCOPE" == "all" ]]; then
    archives=("$REMOTE_TMP" "$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
  elif [[ "$DEPLOY_SCOPE" == "backend" ]]; then
    archives=("$REMOTE_ADDON_TMP" "$REMOTE_API_ADDON_TMP")
  fi
  if [[ "$release_started" == "1" && "$release_committed" != "1" ]]; then
    if [[ ! -d "$rollback_root" ]]; then
      echo "Automatic rollback snapshot is missing or invalid: $rollback_root" >&2
      rollback_status=1
    elif ! restore_release; then
      rollback_status=1
    fi
  fi
  if [[ "$rollback_status" -ne 0 ]]; then
    echo "CRITICAL: automatic rollback failed; the deployment may be only partially restored." >&2
    if [[ -d "$rollback_root" ]]; then
      echo "CRITICAL: preserved rollback snapshot at $rollback_root" >&2
    else
      echo "CRITICAL: rollback snapshot is unavailable at $rollback_root" >&2
    fi
    echo "CRITICAL: preserved deployment temporary root at $deploy_tmp_dir" >&2
    echo "CRITICAL: preserved remote release archives: ${archives[*]}" >&2
    exit "$ROLLBACK_FAILED_EXIT_STATUS"
  fi
  rm -rf -- "$deploy_tmp_dir"
  for archive in "${archives[@]}"; do
    if [[ -f "$archive" && ! -L "$archive" ]]; then
      rm -f -- "$archive"
    fi
  done
  exit "$status"
}
trap cleanup_deploy_files EXIT

preflight_release
snapshot_release
release_started=1
if [[ "$DEPLOY_SCOPE" != "api" ]]; then
  install_device_addon
fi
install_api_addon

if [[ "$DEPLOY_SCOPE" == "all" ]]; then
  cd "$DEPLOY_PATH"

  if [[ -d "$THEME_NAME" ]]; then
    backup="pingfangvideo.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$THEME_NAME" "$backup"
  fi

  rm -rf "$THEME_NAME"
  mv "$theme_source" "$THEME_NAME"
fi

if [[ "$DEPLOY_CLEAR_CACHE" != "0" ]]; then
  clear_maccms_cache
fi

verify_deployed_site
release_committed=1
REMOTE_SCRIPT
trap - EXIT

if [[ "$DEPLOY_SCOPE" == "api" ]]; then
  echo "Deployed ${API_ADDON_NAME} to ${REMOTE} without changing the theme or ${ADDON_NAME}"
elif [[ "$DEPLOY_SCOPE" == "backend" ]]; then
  echo "Deployed ${ADDON_NAME} and ${API_ADDON_NAME} to ${REMOTE} without changing the theme"
else
  echo "Deployed ${THEME_NAME}, ${ADDON_NAME}, and ${API_ADDON_NAME} to ${REMOTE}"
fi
