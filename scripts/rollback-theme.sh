#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}"
ROLLBACK_SCOPE="${ROLLBACK_SCOPE:-theme}"
ROLLBACK_BACKUP="${ROLLBACK_BACKUP:-}"
THEME_NAME="pingfangvideo"
DOUBAN_ADDON_NAME="douban"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ "$ROLLBACK_SCOPE" != "theme" && "$ROLLBACK_SCOPE" != "douban" ]]; then
  echo "ROLLBACK_SCOPE must be theme or douban." >&2
  exit 1
fi

ssh_options=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)

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
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
  "DEPLOY_CLEAR_CACHE=$(printf "%q" "$DEPLOY_CLEAR_CACHE")"
  "ROLLBACK_SCOPE=$(printf "%q" "$ROLLBACK_SCOPE")"
  "ROLLBACK_BACKUP=$(printf "%q" "$ROLLBACK_BACKUP")"
  "DOUBAN_ADDON_NAME=$(printf "%q" "$DOUBAN_ADDON_NAME")"
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

rollback_douban() {
  local maccms_root addons_dir backup candidate previous_addon controller_source controller_target controller_backup stamp

  maccms_root="$(dirname "$DEPLOY_PATH")"
  addons_dir="$maccms_root/addons"
  if [[ ! -d "$addons_dir" ]]; then
    echo "Addon directory does not exist: $addons_dir" >&2
    exit 1
  fi
  cd "$addons_dir"

  if [[ -n "$ROLLBACK_BACKUP" ]]; then
    backup="${ROLLBACK_BACKUP#./}"
  else
    backup="$(find . -maxdepth 1 -type d -name "douban.backup.*" -print | sort | tail -n 1)"
    backup="${backup#./}"
  fi
  if [[ -z "$backup" || "$backup" == */* || ! -d "$backup" ]]; then
    echo "Douban rollback backup is invalid or missing: ${backup:-none}" >&2
    exit 1
  fi
  if [[ ! -f "$backup/info.ini" || ! -f "$backup/application/admin/controller/Douban.php" ]]; then
    echo "Rollback backup is not a valid Douban addon: $addons_dir/$backup" >&2
    exit 1
  fi

  stamp="$(date +%Y%m%d%H%M%S)"
  candidate=".douban.rollback.$stamp"
  cp -a "$backup" "$candidate"
  while IFS= read -r -d '' php_file; do
    php -l "$php_file" >/dev/null
  done < <(find "$candidate" -type f -name '*.php' -print0)

  previous_addon=""
  if [[ -d "$DOUBAN_ADDON_NAME" ]]; then
    previous_addon="douban.failed.$stamp"
    mv "$DOUBAN_ADDON_NAME" "$previous_addon"
  fi
  if ! mv "$candidate" "$DOUBAN_ADDON_NAME"; then
    if [[ -n "$previous_addon" && -d "$previous_addon" ]]; then
      mv "$previous_addon" "$DOUBAN_ADDON_NAME"
    fi
    echo "Douban addon rollback failed; restored the previous addon." >&2
    exit 1
  fi

  controller_source="$addons_dir/$DOUBAN_ADDON_NAME/application/admin/controller/Douban.php"
  controller_target="$maccms_root/application/admin/controller/Douban.php"
  controller_backup=""
  mkdir -p "$(dirname "$controller_target")"
  if [[ -f "$controller_target" ]]; then
    controller_backup="${controller_target}.failed.$stamp"
    cp -a "$controller_target" "$controller_backup"
  fi
  if ! cp -a "$controller_source" "$controller_target" || ! php -l "$controller_target" >/dev/null; then
    rm -rf "$addons_dir/$DOUBAN_ADDON_NAME"
    if [[ -n "$previous_addon" && -d "$addons_dir/$previous_addon" ]]; then
      mv "$addons_dir/$previous_addon" "$addons_dir/$DOUBAN_ADDON_NAME"
    fi
    if [[ -n "$controller_backup" && -f "$controller_backup" ]]; then
      cp -a "$controller_backup" "$controller_target"
    else
      rm -f "$controller_target"
    fi
    echo "Douban controller rollback failed; restored the previous addon and controller." >&2
    exit 1
  fi

  echo "Rolled back ${DOUBAN_ADDON_NAME} from ${backup}"
  if [[ -n "$previous_addon" ]]; then
    echo "Previous live addon moved to ${previous_addon}"
  fi
  echo "Database tables were preserved."
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

if [[ "$ROLLBACK_SCOPE" == "douban" ]]; then
  rollback_douban
  if [[ "$DEPLOY_CLEAR_CACHE" != "0" ]]; then
    clear_maccms_cache
  fi
  exit 0
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
  previous_theme="pingfangvideo.failed.$(date +%Y%m%d%H%M%S)"
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

echo "Rollback completed for ${ROLLBACK_SCOPE} on ${REMOTE}"
