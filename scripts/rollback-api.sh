#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"
: "${DEPLOY_SITE_HOST:?Set DEPLOY_SITE_HOST for the API smoke check.}"
: "${API_ROLLBACK_BACKUP:?Set API_ROLLBACK_BACKUP to the explicit paired backup ID.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_SITE_SCHEME="${DEPLOY_SITE_SCHEME:-https}"
API_ADDON_NAME="pingfangapi"
ROLLBACK_FAILED_EXIT_STATUS=95
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ ! "$API_ROLLBACK_BACKUP" =~ ^[0-9]{8}T[0-9]{6}Z-[1-9][0-9]*-[0-9]+$ ]]; then
  echo "API_ROLLBACK_BACKUP must be an explicit API backup ID." >&2
  exit 1
fi

normalized_deploy_path="${DEPLOY_PATH%/}"
if [[ "$normalized_deploy_path" != /* || "$normalized_deploy_path" == "/" || "$(basename -- "$normalized_deploy_path")" != "template" ]]; then
  echo "DEPLOY_PATH must be an absolute MacCMS template directory ending in /template." >&2
  exit 1
fi
DEPLOY_PATH="$normalized_deploy_path"

if [[ ! "$DEPLOY_SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DEPLOY_SITE_HOST must be a hostname without a scheme or path." >&2
  exit 1
fi
if [[ "$DEPLOY_SITE_SCHEME" != "http" && "$DEPLOY_SITE_SCHEME" != "https" ]]; then
  echo "DEPLOY_SITE_SCHEME must be http or https." >&2
  exit 1
fi

ssh_options=(
  -p "$DEPLOY_PORT"
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
fi

if [[ -n "${DEPLOY_PASSWORD:-}" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "DEPLOY_PASSWORD requires sshpass. Install sshpass or configure SSH key authentication." >&2
    exit 1
  fi
  export SSHPASS="$DEPLOY_PASSWORD"
  ssh_command=(sshpass -e ssh "${ssh_options[@]}")
else
  ssh_command=(ssh "${ssh_options[@]}")
fi

remote_env=(
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "DEPLOY_SITE_HOST=$(printf "%q" "$DEPLOY_SITE_HOST")"
  "DEPLOY_SITE_SCHEME=$(printf "%q" "$DEPLOY_SITE_SCHEME")"
  "API_ADDON_NAME=$(printf "%q" "$API_ADDON_NAME")"
  "API_ROLLBACK_BACKUP=$(printf "%q" "$API_ROLLBACK_BACKUP")"
  "ROLLBACK_FAILED_EXIT_STATUS=$(printf "%q" "$ROLLBACK_FAILED_EXIT_STATUS")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

for command in cmp curl find php readlink; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required on the server." >&2
    exit 1
  fi
done

rollback_tmp_dir=""
rollback_started=0
rollback_committed=0

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

validate_api_pair() {
  local addon_dir="$1"
  local controller_file="$2"
  local label="$3"
  local php_file

  if [[ ! -d "$addon_dir" || ! -f "$controller_file" ]]; then
    echo "$label is not a complete API rollback pair." >&2
    return 1
  fi
  if [[ -L "$addon_dir" || -L "$controller_file" || -n "$(find "$addon_dir" -type l -print -quit)" ]]; then
    echo "$label must not contain a symbolic link." >&2
    return 1
  fi
  if [[ ! -f "$addon_dir/info.ini" || ! -f "$addon_dir/application/index/controller/Pingfangapi.php" || ! -f "$addon_dir/service/AccountService.php" ]]; then
    echo "$label does not contain the required pingfangapi structure." >&2
    return 1
  fi
  if ! cmp -s -- "$addon_dir/application/index/controller/Pingfangapi.php" "$controller_file"; then
    echo "$label contains mismatched API controllers." >&2
    return 1
  fi
  while IFS= read -r -d '' php_file; do
    php -l "$php_file" >/dev/null
  done < <(find "$addon_dir" -type f -name '*.php' -print0)
  php -l "$controller_file" >/dev/null
}

replace_api_pair() {
  local source_addon="$1"
  local source_controller="$2"

  rm -rf -- "$api_target"
  rm -f -- "$controller_target"
  mkdir -p "$(dirname "$api_target")" "$(dirname "$controller_target")"
  cp -a -- "$source_addon" "$api_target"
  cp -a -- "$source_controller" "$controller_target"
}

restore_pre_rollback() {
  local restore_status=0

  echo "API rollback failed; restoring the pre-rollback filesystem snapshot." >&2
  if ! replace_api_pair "$rollback_tmp_dir/current-api-addon" "$rollback_tmp_dir/current-api-controller"; then
    restore_status=1
  elif ! validate_api_pair "$api_target" "$controller_target" "Restored pre-rollback API"; then
    restore_status=1
  fi
  if ! clear_maccms_cache; then
    restore_status=1
  fi
  return "$restore_status"
}

cleanup_rollback() {
  local status=$?
  local restore_status=0

  trap - EXIT
  set +e
  if [[ "$rollback_started" == "1" && "$rollback_committed" != "1" ]]; then
    if [[ ! -d "$rollback_tmp_dir" ]]; then
      echo "Pre-rollback snapshot is missing: $rollback_tmp_dir" >&2
      restore_status=1
    elif ! restore_pre_rollback; then
      restore_status=1
    fi
  fi
  if [[ "$restore_status" -ne 0 ]]; then
    echo "CRITICAL: failed to restore the pre-rollback API files." >&2
    if [[ -d "$rollback_tmp_dir" ]]; then
      echo "CRITICAL: preserved pre-rollback snapshot at $rollback_tmp_dir" >&2
    fi
    exit "$ROLLBACK_FAILED_EXIT_STATUS"
  fi
  if [[ -n "$rollback_tmp_dir" && -d "$rollback_tmp_dir" ]]; then
    rm -rf -- "$rollback_tmp_dir"
  fi
  exit "$status"
}
trap cleanup_rollback EXIT

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
if [[ "$maccms_root" == "/" || ! -f "$maccms_root/application/database.php" || -L "$maccms_root/application/database.php" ]]; then
  echo "Remote MacCMS application/database.php is missing next to DEPLOY_PATH." >&2
  exit 1
fi
for protected_dir in \
  "$maccms_root/addons" \
  "$maccms_root/application" \
  "$maccms_root/application/index" \
  "$maccms_root/application/index/controller"
do
  if [[ ! -d "$protected_dir" || -L "$protected_dir" ]]; then
    echo "Remote MacCMS API path must be a real directory: $protected_dir" >&2
    exit 1
  fi
done
api_target="$maccms_root/addons/$API_ADDON_NAME"
controller_target="$maccms_root/application/index/controller/Pingfangapi.php"
api_backup="$maccms_root/addons/${API_ADDON_NAME}.backup.${API_ROLLBACK_BACKUP}"
controller_backup="${controller_target}.backup.${API_ROLLBACK_BACKUP}"

validate_api_pair "$api_backup" "$controller_backup" "Selected API backup"
validate_api_pair "$api_target" "$controller_target" "Current API"

rollback_tmp_dir="$(mktemp -d)"
cp -a -- "$api_target" "$rollback_tmp_dir/current-api-addon"
cp -a -- "$controller_target" "$rollback_tmp_dir/current-api-controller"
validate_api_pair \
  "$rollback_tmp_dir/current-api-addon" \
  "$rollback_tmp_dir/current-api-controller" \
  "Pre-rollback snapshot"

rollback_started=1
replace_api_pair "$api_backup" "$controller_backup"
validate_api_pair "$api_target" "$controller_target" "Restored API backup"

clear_maccms_cache

if [[ "$DEPLOY_SITE_SCHEME" == "https" ]]; then
  api_port=443
else
  api_port=80
fi
api_url="${DEPLOY_SITE_SCHEME}://${DEPLOY_SITE_HOST}/index.php/pingfangapi/index?action=home_v2&compact=1"
api_response="$rollback_tmp_dir/api-smoke.json"
if ! api_status="$(curl -k -sS --noproxy '*' \
  --connect-timeout 5 --max-time 15 \
  --resolve "${DEPLOY_SITE_HOST}:${api_port}:127.0.0.1" \
  -H 'Accept: application/json' \
  -o "$api_response" -w '%{http_code}' "$api_url")"; then
  echo "API rollback smoke request failed for ${api_url}" >&2
  exit 1
fi

if ! API_RESPONSE_FILE="$api_response" API_HTTP_STATUS="$api_status" php -r '
  $payload = json_decode(file_get_contents(getenv("API_RESPONSE_FILE")), true);
  $status = (string) getenv("API_HTTP_STATUS");
  $regionalPolicy = $status === "403"
      && is_array($payload)
      && (string)($payload["code"] ?? "") === "403"
      && (string)($payload["msg"] ?? "") === "当前地区不可访问";
  $data = is_array($payload) ? ($payload["data"] ?? null) : null;
  $success = $status === "200"
      && (string)($payload["code"] ?? "") === "1"
      && is_array($data)
      && is_string($data["siteName"] ?? null)
      && trim($data["siteName"]) !== ""
      && is_int($data["todayUpdated"] ?? null)
      && $data["todayUpdated"] >= 0
      && is_array($data["categories"] ?? null)
      && is_array($data["hero"] ?? null)
      && is_array($data["ranking"] ?? null)
      && is_array($data["latest"] ?? null)
      && is_array($data["latestByCategory"] ?? null);
  if (!$regionalPolicy && !$success) {
      fwrite(STDERR, "API rollback smoke response is invalid.\n");
      exit(1);
  }
'; then
  exit 1
fi

rollback_committed=1
echo "Rolled back ${API_ADDON_NAME} from ${API_ROLLBACK_BACKUP}"
REMOTE_SCRIPT

echo "API rollback completed for ${REMOTE} using backup ${API_ROLLBACK_BACKUP}"
