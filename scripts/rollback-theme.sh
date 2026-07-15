#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}"
ROLLBACK_BACKUP="${ROLLBACK_BACKUP:-}"
THEME_NAME="squaredmedia"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

ssh_options=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)

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
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
  "DEPLOY_CLEAR_CACHE=$(printf "%q" "$DEPLOY_CLEAR_CACHE")"
  "ROLLBACK_BACKUP=$(printf "%q" "$ROLLBACK_BACKUP")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

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
      find "$cache_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
      cleared=$((cleared + 1))
    fi
  done

  echo "Cleared ${cleared} MacCMS cache directories under ${maccms_root}"
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

if [[ -n "$ROLLBACK_BACKUP" ]]; then
  backup="${ROLLBACK_BACKUP#./}"
else
  backup="$(find . -maxdepth 1 -type d -name "${THEME_NAME}.backup.*" -print | sort | tail -n 1)"
  backup="${backup#./}"
fi

if [[ -z "$backup" ]]; then
  echo "No ${THEME_NAME}.backup.* directory found in $DEPLOY_PATH" >&2
  exit 1
fi

if [[ "$backup" == */* ]]; then
  echo "ROLLBACK_BACKUP must be a backup directory name inside $DEPLOY_PATH" >&2
  exit 1
fi

if [[ ! -d "$backup" ]]; then
  echo "Rollback backup does not exist: $DEPLOY_PATH/$backup" >&2
  exit 1
fi

if [[ ! -f "$backup/info.ini" ]]; then
  echo "Rollback backup is not a valid theme directory: $DEPLOY_PATH/$backup" >&2
  exit 1
fi

previous_theme=""
if [[ -d "$THEME_NAME" ]]; then
  previous_theme="squaredmedia.failed.$(date +%Y%m%d%H%M%S)"
  mv "$THEME_NAME" "$previous_theme"
fi

if ! cp -a "$backup" "$THEME_NAME"; then
  rm -rf "$THEME_NAME"
  if [[ -n "$previous_theme" && -d "$previous_theme" ]]; then
    mv "$previous_theme" "$THEME_NAME"
  fi
  echo "Rollback copy failed; restored previous theme." >&2
  exit 1
fi

if [[ "$DEPLOY_CLEAR_CACHE" != "0" ]]; then
  clear_maccms_cache
fi

echo "Rolled back ${THEME_NAME} from ${backup}"
if [[ -n "$previous_theme" ]]; then
  echo "Previous live theme moved to ${previous_theme}"
fi
REMOTE_SCRIPT

echo "Rollback completed for ${REMOTE}:${DEPLOY_PATH}/${THEME_NAME}"
