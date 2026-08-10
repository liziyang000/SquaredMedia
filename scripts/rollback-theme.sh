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
VODOPS_ADDON_NAME="vodops"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ "$ROLLBACK_SCOPE" != "theme" && "$ROLLBACK_SCOPE" != "vodops" ]]; then
  echo "ROLLBACK_SCOPE must be theme or vodops." >&2
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
  "VODOPS_ADDON_NAME=$(printf "%q" "$VODOPS_ADDON_NAME")"
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

rollback_vodops() {
  local maccms_root addons_dir backup backup_dir state_dir candidate legacy_candidate
  local previous_addon previous_douban stamp payload_backup_dir switch_failed restore_failed
  local vodops_controller_source vodops_controller_target douban_controller_source douban_controller_target view_source view_target
  local legacy_index_controller_target

  restore_optional_file() {
    local source="$1" target="$2"

    mkdir -p "$(dirname "$target")"
    if [[ -f "$source" ]]; then
      cp -a "$source" "$target"
    else
      rm -f "$target"
    fi
  }

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
    backup="$(find . -maxdepth 1 -type d -name "vodops.backup.*" -print | sort | tail -n 1)"
    backup="${backup#./}"
  fi
  if [[ -z "$backup" || "$backup" == */* || ! -d "$backup" ]]; then
    echo "VodOps rollback backup is invalid or missing: ${backup:-none}" >&2
    exit 1
  fi
  backup_dir="$addons_dir/$backup"
  state_dir="$backup_dir/.vodops-deploy-state"
  if [[ -d "$state_dir" ]]; then
    if [[ -f "$state_dir/vodops-addon-present" && ! -f "$backup_dir/info.ini" ]]; then
      echo "Rollback snapshot is missing the previous VodOps addon: $backup_dir" >&2
      exit 1
    fi
    if [[ -d "$state_dir/addons/douban" \
      && ( ! -f "$state_dir/addons/douban/info.ini" \
        || ! -f "$state_dir/addons/douban/application/admin/controller/Douban.php" ) ]]; then
      echo "Rollback snapshot contains an invalid legacy Douban addon: $backup_dir" >&2
      exit 1
    fi
  elif [[ ! -f "$backup_dir/info.ini" \
    || ! -f "$backup_dir/application/admin/controller/Vodops.php" \
    || ! -f "$backup_dir/application/admin/controller/Douban.php" \
    || ! -f "$backup_dir/application/admin/view_new/vodops/index.html" ]]; then
    echo "Rollback backup is not a valid integrated VodOps addon: $backup_dir" >&2
    exit 1
  fi

  stamp="$(date +%Y%m%d%H%M%S)"
  candidate=""
  legacy_candidate=""
  if [[ ! -d "$state_dir" || -f "$state_dir/vodops-addon-present" ]]; then
    candidate=".vodops.rollback.$stamp"
    cp -a "$backup_dir" "$candidate"
    rm -rf "$candidate/.vodops-deploy-state"
    while IFS= read -r -d '' php_file; do
      php -l "$php_file" >/dev/null
    done < <(find "$candidate" -type f -name '*.php' -print0)
  fi
  if [[ -d "$state_dir/addons/douban" ]]; then
    legacy_candidate=".douban.rollback.$stamp"
    cp -a "$state_dir/addons/douban" "$legacy_candidate"
    while IFS= read -r -d '' php_file; do
      php -l "$php_file" >/dev/null
    done < <(find "$legacy_candidate" -type f -name '*.php' -print0)
  fi

  vodops_controller_target="$maccms_root/application/admin/controller/Vodops.php"
  douban_controller_target="$maccms_root/application/admin/controller/Douban.php"
  view_target="$maccms_root/application/admin/view_new/vodops/index.html"
  legacy_index_controller_target="$maccms_root/application/index/controller/Douban.php"
  payload_backup_dir="$maccms_root/runtime/vodops-rollback-payload.$stamp"
  mkdir -p "$payload_backup_dir"
  if [[ -f "$vodops_controller_target" ]]; then
    cp -a "$vodops_controller_target" "$payload_backup_dir/Vodops.php"
  fi
  if [[ -f "$douban_controller_target" ]]; then
    cp -a "$douban_controller_target" "$payload_backup_dir/Douban.admin.php"
  fi
  if [[ -f "$view_target" ]]; then
    cp -a "$view_target" "$payload_backup_dir/vodops-index.html"
  fi
  if [[ -f "$legacy_index_controller_target" ]]; then
    cp -a "$legacy_index_controller_target" "$payload_backup_dir/Douban.index.php"
  fi

  previous_addon=""
  if [[ -d "$VODOPS_ADDON_NAME" ]]; then
    previous_addon="vodops.failed.$stamp"
    mv "$VODOPS_ADDON_NAME" "$previous_addon"
  fi
  previous_douban=""
  if [[ -d "douban" ]]; then
    previous_douban="douban.failed.$stamp"
    mv "douban" "$previous_douban"
  fi

  switch_failed=0
  if [[ -n "$candidate" ]] && ! mv "$candidate" "$VODOPS_ADDON_NAME"; then
    switch_failed=1
  fi
  if [[ "$switch_failed" == "0" && -n "$legacy_candidate" ]] && ! mv "$legacy_candidate" "douban"; then
    switch_failed=1
  fi
  if [[ "$switch_failed" != "0" ]]; then
    rm -rf "$VODOPS_ADDON_NAME" "douban"
    if [[ -n "$previous_addon" && -d "$previous_addon" ]]; then
      mv "$previous_addon" "$VODOPS_ADDON_NAME"
    fi
    if [[ -n "$previous_douban" && -d "$previous_douban" ]]; then
      mv "$previous_douban" "douban"
    fi
    echo "VodOps addon rollback failed; restored the previous addon directories." >&2
    exit 1
  fi

  restore_failed=0
  if [[ -d "$state_dir" ]]; then
    restore_optional_file "$state_dir/application/admin/controller/Vodops.php" "$vodops_controller_target" || restore_failed=1
    restore_optional_file "$state_dir/application/admin/controller/Douban.php" "$douban_controller_target" || restore_failed=1
    restore_optional_file "$state_dir/application/admin/view_new/vodops/index.html" "$view_target" || restore_failed=1
    restore_optional_file "$state_dir/application/index/controller/Douban.php" "$legacy_index_controller_target" || restore_failed=1
  else
    vodops_controller_source="$addons_dir/$VODOPS_ADDON_NAME/application/admin/controller/Vodops.php"
    douban_controller_source="$addons_dir/$VODOPS_ADDON_NAME/application/admin/controller/Douban.php"
    view_source="$addons_dir/$VODOPS_ADDON_NAME/application/admin/view_new/vodops/index.html"
    if ! cp -a "$vodops_controller_source" "$vodops_controller_target" \
      || ! cp -a "$douban_controller_source" "$douban_controller_target" \
      || ! cp -a "$view_source" "$view_target"; then
      restore_failed=1
    fi
    rm -f "$legacy_index_controller_target"
  fi
  for target in "$vodops_controller_target" "$douban_controller_target" "$legacy_index_controller_target"; do
    if [[ -f "$target" ]] && ! php -l "$target" >/dev/null; then
      restore_failed=1
    fi
  done
  if [[ -f "$view_target" ]] && ! grep -Fq 'X-CSRF-Token' "$view_target"; then
    restore_failed=1
  fi

  if [[ "$restore_failed" != "0" ]]; then
    rm -rf "$addons_dir/$VODOPS_ADDON_NAME"
    rm -rf "$addons_dir/douban"
    if [[ -n "$previous_addon" && -d "$addons_dir/$previous_addon" ]]; then
      mv "$addons_dir/$previous_addon" "$addons_dir/$VODOPS_ADDON_NAME"
    fi
    if [[ -n "$previous_douban" && -d "$addons_dir/$previous_douban" ]]; then
      mv "$addons_dir/$previous_douban" "$addons_dir/douban"
    fi
    restore_optional_file "$payload_backup_dir/Vodops.php" "$vodops_controller_target" || true
    restore_optional_file "$payload_backup_dir/Douban.admin.php" "$douban_controller_target" || true
    restore_optional_file "$payload_backup_dir/vodops-index.html" "$view_target" || true
    restore_optional_file "$payload_backup_dir/Douban.index.php" "$legacy_index_controller_target" || true
    echo "VodOps application payload rollback failed; restored the previous addon and payload." >&2
    exit 1
  fi

  echo "Rolled back ${VODOPS_ADDON_NAME} from ${backup}"
  if [[ -n "$previous_addon" ]]; then
    echo "Previous live addon moved to ${previous_addon}"
  fi
  if [[ -n "$previous_douban" ]]; then
    echo "Previous live Douban addon moved to ${previous_douban}"
  fi
  echo "Database tables were preserved."
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

if [[ "$ROLLBACK_SCOPE" == "vodops" ]]; then
  rollback_vodops
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
