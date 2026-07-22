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
NEXT_SERVICE="squaredmedia-next.service"
NEXT_NGINX_EXTENSION="/www/server/panel/vhost/nginx/extension/react.ping2.my/react-spa.conf"
NEXT_UNIT_PATH="/etc/systemd/system/$NEXT_SERVICE"
ROLLBACK_RELEASE="${NEXT_ROLLBACK_RELEASE:-}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [[ -n "$ROLLBACK_RELEASE" && ! "$ROLLBACK_RELEASE" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]]; then
  echo "NEXT_ROLLBACK_RELEASE must be a single release id." >&2
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
    echo "DEPLOY_PASSWORD requires sshpass; SSH key authentication is preferred." >&2
    exit 1
  fi
  export SSHPASS="$DEPLOY_PASSWORD"
  ssh_command=(sshpass -e ssh "${ssh_options[@]}")
else
  ssh_command=(ssh "${ssh_options[@]}")
fi

remote_env=(
  "NEXT_ROOT=$(printf '%q' "$NEXT_ROOT")"
  "NEXT_SITE_HOST=$(printf '%q' "$NEXT_SITE_HOST")"
  "NEXT_PORT=$(printf '%q' "$NEXT_PORT")"
  "NEXT_SERVICE=$(printf '%q' "$NEXT_SERVICE")"
  "NEXT_NGINX_EXTENSION=$(printf '%q' "$NEXT_NGINX_EXTENSION")"
  "NEXT_UNIT_PATH=$(printf '%q' "$NEXT_UNIT_PATH")"
  "ROLLBACK_RELEASE=$(printf '%q' "$ROLLBACK_RELEASE")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_ROLLBACK'
set -euo pipefail

current_before="$(readlink -f "$NEXT_ROOT/current" 2>/dev/null || true)"
if [[ -z "$current_before" || "$current_before" != "$NEXT_ROOT"/releases/* ]]; then
  echo "Current staging release is invalid." >&2
  exit 1
fi

if [[ -n "$ROLLBACK_RELEASE" ]]; then
  target="$NEXT_ROOT/releases/$ROLLBACK_RELEASE"
else
  target="$(readlink -f "$NEXT_ROOT/previous" 2>/dev/null || true)"
fi
if [[ -z "$target" || "$target" != "$NEXT_ROOT"/releases/* || ! -d "$target" || "$target" == "$current_before" ]]; then
  echo "Rollback target is invalid or already current: ${target:-missing}" >&2
  exit 1
fi

unsafe_path="$(find "$target" \
  -path "$target/apps/web/.next/cache" -prune -o \
  \( ! -user root -o ! -group root -o -perm /022 \) -print -quit)"
if [[ -n "$unsafe_path" ]]; then
  echo "Rollback target contains an untrusted writable path: $unsafe_path" >&2
  exit 1
fi

nginx_backup="$(mktemp /tmp/squaredmedia-next-rollback.XXXXXX.conf)"
nginx_existed=0
if [[ -f "$NEXT_NGINX_EXTENSION" ]]; then
  cp -a "$NEXT_NGINX_EXTENSION" "$nginx_backup"
  nginx_existed=1
fi
unit_backup="$(mktemp /tmp/squaredmedia-next-rollback.XXXXXX.service)"
unit_existed=0
if [[ -f "$NEXT_UNIT_PATH" ]]; then
  cp -a "$NEXT_UNIT_PATH" "$unit_backup"
  unit_existed=1
fi
service_was_active=0
if systemctl is-active --quiet "$NEXT_SERVICE"; then
  service_was_active=1
fi
service_was_enabled=0
if systemctl is-enabled --quiet "$NEXT_SERVICE"; then
  service_was_enabled=1
fi

reload_nginx() {
  nginx -t
  if systemctl is-active --quiet nginx.service; then
    systemctl reload nginx.service
  else
    nginx -s reload
  fi
}

restore_failed_rollback() {
  local status=$?
  trap - EXIT
  set +e
  ln -s "$current_before" "$NEXT_ROOT/.current.rollback-failed"
  mv -Tf "$NEXT_ROOT/.current.rollback-failed" "$NEXT_ROOT/current"
  if [[ "$nginx_existed" == "1" ]]; then
    install -m 0644 "$nginx_backup" "$NEXT_NGINX_EXTENSION"
  else
    rm -f -- "$NEXT_NGINX_EXTENSION"
  fi
  if [[ "$unit_existed" == "1" ]]; then
    install -m 0644 "$unit_backup" "$NEXT_UNIT_PATH"
  else
    rm -f -- "$NEXT_UNIT_PATH"
  fi
  systemctl daemon-reload
  if [[ "$service_was_active" == "1" ]]; then
    systemctl restart "$NEXT_SERVICE" || true
  else
    systemctl stop "$NEXT_SERVICE" || true
  fi
  if [[ "$service_was_enabled" == "1" ]]; then
    systemctl enable "$NEXT_SERVICE" >/dev/null 2>&1 || true
  else
    systemctl disable "$NEXT_SERVICE" >/dev/null 2>&1 || true
  fi
  reload_nginx || true
  rm -f -- "$nginx_backup" "$unit_backup"
  exit "$status"
}
trap restore_failed_rollback EXIT

ln -s "$target" "$NEXT_ROOT/.current.rollback"
mv -Tf "$NEXT_ROOT/.current.rollback" "$NEXT_ROOT/current"

if [[ -f "$target/apps/web/server.js" && -f "$target/.deploy/nginx.conf" && -f "$target/.deploy/$NEXT_SERVICE" ]]; then
  install -m 0644 "$target/.deploy/nginx.conf" "$NEXT_NGINX_EXTENSION"
  install -m 0644 "$target/.deploy/$NEXT_SERVICE" "$NEXT_UNIT_PATH"
  systemctl daemon-reload
  systemctl enable "$NEXT_SERVICE" >/dev/null
  systemctl restart "$NEXT_SERVICE"
  ready=0
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$NEXT_PORT/healthz" >/dev/null; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    echo "Rolled-back Next.js release did not become healthy." >&2
    exit 1
  fi
elif [[ -f "$target/index.html" && -f "$NEXT_ROOT/config-backups/pre-next-react-spa.conf" ]]; then
  install -m 0644 "$NEXT_ROOT/config-backups/pre-next-react-spa.conf" "$NEXT_NGINX_EXTENSION"
  systemctl stop "$NEXT_SERVICE" 2>/dev/null || true
  systemctl disable "$NEXT_SERVICE" 2>/dev/null || true
  rm -f -- "$NEXT_UNIT_PATH"
  systemctl daemon-reload
else
  echo "Rollback target is neither a valid Next.js release nor the preserved static release." >&2
  exit 1
fi

reload_nginx
rollback_ready=0
for _ in $(seq 1 15); do
  status="$(curl -ksS --noproxy '*' --resolve "$NEXT_SITE_HOST:443:127.0.0.1" --max-time 3 -o /dev/null -w '%{http_code}' "https://$NEXT_SITE_HOST/")"
  if [[ "$status" == "200" ]]; then
    rollback_ready=1
    break
  fi
  sleep 1
done
if [[ "$rollback_ready" != "1" ]]; then
  echo "Rolled-back staging homepage did not become ready." >&2
  exit 1
fi

ln -s "$current_before" "$NEXT_ROOT/.previous.rollback"
mv -Tf "$NEXT_ROOT/.previous.rollback" "$NEXT_ROOT/previous"
rm -f -- "$nginx_backup" "$unit_backup"
trap - EXIT
echo "Rolled back staging from $current_before to $target"
REMOTE_ROLLBACK
