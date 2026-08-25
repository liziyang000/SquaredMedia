#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

usage() {
  cat <<'USAGE'
Usage: npm run deploy:api -- [--check] [--backend] [--yes]

  --check    Detect the required deployment scope without installing or deploying.
  --backend  Force a backend dependency refresh after the remote safety probe.
  --yes      Confirm the detected production deployment without an interactive prompt.
  --help     Show this help.

The command loads scripts/deploy-ping2.env by default. Set
PINGFANGAPI_DEPLOY_ENV_FILE to use another trusted deployment environment file.
USAGE
}

check_only=0
assume_yes=0
force_backend=0
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --check)
      check_only=1
      ;;
    --yes)
      assume_yes=1
      ;;
    --backend)
      force_backend=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

env_file="${PINGFANGAPI_DEPLOY_ENV_FILE:-$repo_root/scripts/deploy-ping2.env}"
if [[ "$env_file" != /* ]]; then
  env_file="$repo_root/$env_file"
fi
if [[ ! -f "$env_file" || -L "$env_file" ]]; then
  echo "Deployment environment file must be a regular file: $env_file" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$env_file"

: "${DEPLOY_HOST:?Set DEPLOY_HOST in the deployment environment file.}"
: "${DEPLOY_USER:?Set DEPLOY_USER in the deployment environment file.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in the deployment environment file.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
normalized_deploy_path="${DEPLOY_PATH%/}"
if [[ "$normalized_deploy_path" != /* || "$normalized_deploy_path" == "/" || "$(basename -- "$normalized_deploy_path")" != "template" ]]; then
  echo "DEPLOY_PATH must be an absolute MacCMS template directory ending in /template." >&2
  exit 1
fi
DEPLOY_PATH="$normalized_deploy_path"

for required_command in php ssh; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "$required_command is required for pingfangapi deployment." >&2
    exit 1
  fi
done

device_session_file="$repo_root/addons/pingfangdevice/service/DeviceSession.php"
device_hook_file="$repo_root/addons/pingfangdevice/Pingfangdevice.php"
deploy_script="$repo_root/scripts/deploy-theme.sh"
for required_file in "$device_session_file" "$device_hook_file" "$deploy_script"; do
  if [[ ! -f "$required_file" || -L "$required_file" ]]; then
    echo "Required deployment file is missing or unsafe: $required_file" >&2
    exit 1
  fi
done

device_session_hash="$(php -r '
  $hash = hash_file("sha256", $argv[1]);
  if ($hash === false) {
      exit(1);
  }
  echo $hash;
' "$device_session_file")"
device_hook_hash="$(php -r '
  $hash = hash_file("sha256", $argv[1]);
  if ($hash === false) {
      exit(1);
  }
  echo $hash;
' "$device_hook_file")"

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
    echo "DEPLOY_PASSWORD requires sshpass. Configure SSH key authentication or install sshpass." >&2
    exit 1
  fi
  export SSHPASS="$DEPLOY_PASSWORD"
  ssh_command=(sshpass -e ssh "${ssh_options[@]}")
else
  ssh_command=(ssh "${ssh_options[@]}")
fi

remote="${DEPLOY_USER}@${DEPLOY_HOST}"
maccms_root="$(dirname "$DEPLOY_PATH")"
probe_env=(
  "PFAPI_CMS_ROOT=$(printf '%q' "$maccms_root")"
  "PFAPI_DEVICE_SESSION_HASH=$(printf '%q' "$device_session_hash")"
  "PFAPI_DEVICE_HOOK_HASH=$(printf '%q' "$device_hook_hash")"
)

probe_output="$("${ssh_command[@]}" "$remote" "${probe_env[*]} bash -s" <<'REMOTE_PROBE'
set -euo pipefail

for command in cmp find php readlink; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required on the server." >&2
    exit 1
  fi
done

if [[ -z "${PFAPI_CMS_ROOT:-}" || "$PFAPI_CMS_ROOT" != /* || "$PFAPI_CMS_ROOT" == "/" ]]; then
  echo "Remote MacCMS root is invalid." >&2
  exit 1
fi
resolved_root="$(readlink -f -- "$PFAPI_CMS_ROOT")"
if [[ -z "$resolved_root" || "$resolved_root" == "/" || ! -f "$resolved_root/application/database.php" ]]; then
  echo "Remote MacCMS application/database.php is missing." >&2
  exit 1
fi
PFAPI_CMS_ROOT="$resolved_root"

api_addon="$PFAPI_CMS_ROOT/addons/pingfangapi"
api_controller="$PFAPI_CMS_ROOT/application/index/controller/Pingfangapi.php"
device_service="$PFAPI_CMS_ROOT/addons/pingfangdevice/service/DeviceSession.php"
device_hook="$PFAPI_CMS_ROOT/addons/pingfangdevice/Pingfangdevice.php"
addons_config="$PFAPI_CMS_ROOT/application/extra/addons.php"

api_addon_present=0
api_controller_present=0
if [[ -e "$api_addon" || -L "$api_addon" ]]; then
  api_addon_present=1
fi
if [[ -e "$api_controller" || -L "$api_controller" ]]; then
  api_controller_present=1
fi

if [[ "$api_addon_present" != "$api_controller_present" ]]; then
  echo "Remote pingfangapi installation is incomplete; inspect the addon and controller before deploying." >&2
  exit 1
fi

reasons=()
if [[ "$api_addon_present" == "0" ]]; then
  reasons+=("pingfangapi is not installed")
else
  if [[ ! -d "$api_addon" || -L "$api_addon" || ! -f "$api_controller" || -L "$api_controller" || -n "$(find "$api_addon" -type l -print -quit)" ]]; then
    echo "Remote pingfangapi installation contains an unsafe path." >&2
    exit 1
  fi
  addon_controller="$api_addon/application/index/controller/Pingfangapi.php"
  if [[ ! -f "$api_addon/info.ini" || ! -f "$api_addon/service/AccountService.php" || ! -f "$addon_controller" ]]; then
    echo "Remote pingfangapi installation is incomplete." >&2
    exit 1
  fi
  if ! cmp -s -- "$addon_controller" "$api_controller"; then
    echo "Remote pingfangapi addon and application controller do not match." >&2
    exit 1
  fi
fi

if [[ ! -f "$device_service" || ! -f "$device_hook" ]]; then
  reasons+=("pingfangdevice files are missing")
else
  installed_session_hash="$(PFAPI_FILE="$device_service" php -r '
    $hash = hash_file("sha256", getenv("PFAPI_FILE"));
    if ($hash === false) {
        exit(1);
    }
    echo $hash;
  ')"
  installed_hook_hash="$(PFAPI_FILE="$device_hook" php -r '
    $hash = hash_file("sha256", getenv("PFAPI_FILE"));
    if ($hash === false) {
        exit(1);
    }
    echo $hash;
  ')"
  if [[ "$installed_session_hash" != "$PFAPI_DEVICE_SESSION_HASH" ]]; then
    reasons+=("pingfangdevice service differs from this release")
  fi
  if [[ "$installed_hook_hash" != "$PFAPI_DEVICE_HOOK_HASH" ]]; then
    reasons+=("pingfangdevice hook differs from this release")
  fi
fi

if ! PFAPI_ADDONS_CONFIG="$addons_config" php -r '
  $path = getenv("PFAPI_ADDONS_CONFIG");
  if (!is_file($path)) {
      exit(1);
  }
  $config = include $path;
  $hooks = is_array($config) ? ($config["hooks"]["app_begin"] ?? []) : [];
  exit(is_array($hooks) && in_array("pingfangdevice", $hooks, true) ? 0 : 1);
'; then
  reasons+=("pingfangdevice app_begin hook is not enabled")
fi

if [[ "${#reasons[@]}" -gt 0 ]]; then
  reason="${reasons[0]}"
  for ((index = 1; index < ${#reasons[@]}; index += 1)); do
    reason+=", ${reasons[$index]}"
  done
  printf 'PFAPI_DEPLOY_SCOPE=backend\nPFAPI_DEPLOY_REASON=%s\n' "$reason"
else
  printf '%s\n' \
    'PFAPI_DEPLOY_SCOPE=api' \
    'PFAPI_DEPLOY_REASON=compatible backend baseline'
fi
REMOTE_PROBE
)"

detected_scope="$(printf '%s\n' "$probe_output" | sed -n 's/^PFAPI_DEPLOY_SCOPE=//p')"
detected_reason="$(printf '%s\n' "$probe_output" | sed -n 's/^PFAPI_DEPLOY_REASON=//p')"
if [[ "$detected_scope" != "backend" && "$detected_scope" != "api" ]]; then
  echo "Unable to determine a safe pingfangapi deployment scope." >&2
  exit 1
fi
if [[ -z "$detected_reason" ]]; then
  echo "Remote deployment probe did not provide a reason." >&2
  exit 1
fi
if [[ "$force_backend" == "1" ]]; then
  detected_scope="backend"
  detected_reason="operator requested backend dependency refresh; ${detected_reason}"
fi

printf '%s\n' \
  "Pingfangapi deployment plan" \
  "  target: ${remote}:${DEPLOY_PATH}" \
  "  site: ${DEPLOY_SITE_SCHEME:-https}://${DEPLOY_SITE_HOST:-not-configured}" \
  "  scope: ${detected_scope}" \
  "  reason: ${detected_reason}"

if [[ "$check_only" == "1" ]]; then
  exit 0
fi

if [[ "$detected_scope" == "backend" ]]; then
  echo "首次或依赖升级模式会更新 pingfangdevice、Hook、设备会话结构和 pingfangapi。" >&2
  echo "继续前必须确认当前 MacCMS 数据库备份已经完成。" >&2
else
  echo "API-only 模式只更新 pingfangapi 插件和应用控制器。" >&2
fi

if [[ "$assume_yes" != "1" ]]; then
  if [[ ! -t 0 ]]; then
    echo "Interactive confirmation is unavailable. Rerun with --yes after reviewing the plan and database backup." >&2
    exit 1
  fi
  read -r -p "Type deploy to continue: " confirmation
  if [[ "$confirmation" != "deploy" ]]; then
    echo "Deployment cancelled." >&2
    exit 1
  fi
fi

dependencies_ready=1
for dependency in \
  "$repo_root/node_modules/.bin/eslint" \
  "$repo_root/node_modules/.bin/prettier" \
  "$repo_root/node_modules/artplayer/package.json" \
  "$repo_root/node_modules/next/package.json"
do
  if [[ ! -e "$dependency" ]]; then
    dependencies_ready=0
    break
  fi
done
if [[ "$dependencies_ready" != "1" ]]; then
  echo "Installing locked workspace dependencies with npm ci..."
  npm ci
fi

DEPLOY_SCOPE="$detected_scope" \
DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}" \
bash "$deploy_script"

echo "Pingfangapi deployment completed with scope ${detected_scope}."
