#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"
: "${DEPLOY_SITE_HOST:?Set DEPLOY_SITE_HOST to the public site hostname.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_SITE_SCHEME="${DEPLOY_SITE_SCHEME:-https}"
DEPLOY_GAME_ALLOWED_ORIGINS="${DEPLOY_GAME_ALLOWED_ORIGINS:-}"
GAME_SERVER_ARCHIVE="dist/pingfanggames-server.tar.gz"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_GAME_SERVER_TMP="${DEPLOY_REMOTE_GAME_SERVER_TMP:-/tmp/pingfanggames-server.$(date +%Y%m%d%H%M%S).tar.gz}"

if [[ ! "$DEPLOY_SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DEPLOY_SITE_HOST must be a hostname without a scheme or path." >&2
  exit 1
fi
if [[ "$DEPLOY_SITE_SCHEME" != "http" && "$DEPLOY_SITE_SCHEME" != "https" ]]; then
  echo "DEPLOY_SITE_SCHEME must be http or https." >&2
  exit 1
fi
origin_list_pattern='^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?(,https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?)*$'
if [[ -n "$DEPLOY_GAME_ALLOWED_ORIGINS" && ! "$DEPLOY_GAME_ALLOWED_ORIGINS" =~ $origin_list_pattern ]]; then
  echo "DEPLOY_GAME_ALLOWED_ORIGINS must contain exact HTTP origins separated by commas." >&2
  exit 1
fi

ssh_options=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
scp_options=(-P "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)

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

if [[ "${DEPLOY_SKIP_GAME_VERIFY:-0}" != "1" ]]; then
  npm test
  npm run lint
  npm run lint:template
  npm run verify:compat
  npm run verify:preview
  npm run package:games
  npm run verify:game-server-release
fi

if [[ ! -f "$GAME_SERVER_ARCHIVE" ]]; then
  echo "Game server archive does not exist: $GAME_SERVER_ARCHIVE" >&2
  exit 1
fi

"${scp_command[@]}" "$GAME_SERVER_ARCHIVE" "${REMOTE}:${REMOTE_GAME_SERVER_TMP}"

remote_env=(
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "DEPLOY_SITE_HOST=$(printf "%q" "$DEPLOY_SITE_HOST")"
  "DEPLOY_SITE_SCHEME=$(printf "%q" "$DEPLOY_SITE_SCHEME")"
  "DEPLOY_GAME_ALLOWED_ORIGINS=$(printf "%q" "$DEPLOY_GAME_ALLOWED_ORIGINS")"
  "REMOTE_GAME_SERVER_TMP=$(printf "%q" "$REMOTE_GAME_SERVER_TMP")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

service_name="pingfanggames.service"
service_unit="/etc/systemd/system/$service_name"
service_env="/etc/pingfanggames.env"
service_root="/opt/pingfanggames"
release_id="$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$service_root/releases/$release_id"
current_link="$service_root/current"
backup_dir="$service_root/backups/$release_id"
maccms_root="$(dirname "$DEPLOY_PATH")"
plugin_config="$maccms_root/addons/pingfangdevice/config.php"
plugin_ticket="$maccms_root/addons/pingfangdevice/service/GameAccessTicket.php"
nginx_dir="/www/server/panel/vhost/nginx/extension/$DEPLOY_SITE_HOST"
nginx_conf="$nginx_dir/pingfanggames.conf"
extract_dir=""
previous_link=""
had_current=0
had_env=0
had_unit=0
had_nginx=0
was_active=0
was_enabled=0

reload_nginx() {
  if systemctl is-active --quiet nginx; then
    systemctl reload nginx
  elif [[ -x /etc/init.d/nginx ]]; then
    /etc/init.d/nginx reload
  else
    nginx -s reload
  fi
}

cleanup() {
  [[ -n "$extract_dir" ]] && rm -rf "$extract_dir"
  rm -f "$REMOTE_GAME_SERVER_TMP"
}

rollback() {
  local exit_code=$?
  trap - ERR
  set +e
  echo "Game service deployment failed; restoring the previous release." >&2
  systemctl stop "$service_name" >/dev/null 2>&1
  if [[ "$had_env" == "1" ]]; then
    cp -a "$backup_dir/pingfanggames.env" "$service_env"
  else
    rm -f "$service_env"
  fi
  if [[ "$had_unit" == "1" ]]; then
    cp -a "$backup_dir/pingfanggames.service" "$service_unit"
  else
    rm -f "$service_unit"
  fi
  if [[ "$had_nginx" == "1" ]]; then
    cp -a "$backup_dir/pingfanggames.nginx.conf" "$nginx_conf"
  else
    rm -f "$nginx_conf"
  fi
  cp -a "$backup_dir/pingfangdevice-config.php" "$plugin_config"
  if [[ "$had_current" == "1" ]]; then
    ln -sfn "$previous_link" "$current_link.rollback"
    mv -Tf "$current_link.rollback" "$current_link"
  else
    rm -f "$current_link"
  fi
  systemctl daemon-reload >/dev/null 2>&1
  if [[ "$was_enabled" == "1" ]]; then
    systemctl enable "$service_name" >/dev/null 2>&1
  else
    systemctl disable "$service_name" >/dev/null 2>&1
  fi
  if [[ "$was_active" == "1" ]]; then
    systemctl restart "$service_name" >/dev/null 2>&1
  fi
  nginx -t >/dev/null 2>&1 && reload_nginx >/dev/null 2>&1
  rm -rf "$release_dir"
  exit "$exit_code"
}

trap cleanup EXIT

for required in "$REMOTE_GAME_SERVER_TMP" "$plugin_config" "$plugin_ticket"; do
  if [[ ! -f "$required" ]]; then
    echo "Required deployment input is missing: $required" >&2
    false
  fi
done
if [[ ! -d "$nginx_dir" ]]; then
  echo "Nginx extension directory is missing: $nginx_dir" >&2
  false
fi

while IFS= read -r conflict; do
  if [[ "$conflict" != "$nginx_conf" ]]; then
    echo "Another Nginx config already owns /game-socket: $conflict" >&2
    false
  fi
done < <(grep -RIlF 'location = /game-socket' /www/server/panel/vhost/nginx 2>/dev/null || true)

if [[ -L "$current_link" ]]; then
  had_current=1
  previous_link="$(readlink "$current_link")"
elif [[ -e "$current_link" ]]; then
  echo "Current service path is not a symlink: $current_link" >&2
  false
fi
[[ -f "$service_env" ]] && had_env=1
[[ -f "$service_unit" ]] && had_unit=1
[[ -f "$nginx_conf" ]] && had_nginx=1
systemctl is-active --quiet "$service_name" && was_active=1
systemctl is-enabled --quiet "$service_name" && was_enabled=1

install -d -o root -g root -m 755 "$service_root/releases" "$service_root/backups" "$backup_dir"
cp -a "$plugin_config" "$backup_dir/pingfangdevice-config.php"
[[ "$had_env" == "1" ]] && cp -a "$service_env" "$backup_dir/pingfanggames.env"
[[ "$had_unit" == "1" ]] && cp -a "$service_unit" "$backup_dir/pingfanggames.service"
[[ "$had_nginx" == "1" ]] && cp -a "$nginx_conf" "$backup_dir/pingfanggames.nginx.conf"
trap rollback ERR

extract_dir="$(mktemp -d /tmp/pingfanggames-extract.XXXXXX)"
tar -xzf "$REMOTE_GAME_SERVER_TMP" -C "$extract_dir"
test -f "$extract_dir/pingfanggames-server/index.mjs"
test -f "$extract_dir/pingfanggames-server/node_modules/ws/package.json"
install -d -o root -g root -m 755 "$release_dir"
cp -a "$extract_dir/pingfanggames-server/." "$release_dir/"
chown -R root:root "$release_dir"
find "$release_dir" -type d -exec chmod go-w {} +
find "$release_dir" -type f -exec chmod go-w {} +
ln -s "$release_dir" "$current_link.new-$release_id"
mv -Tf "$current_link.new-$release_id" "$current_link"

requested_origins="$DEPLOY_GAME_ALLOWED_ORIGINS"
existing_secret=""
existing_origins=""
if [[ "$had_env" == "1" ]]; then
  while IFS= read -r env_line || [[ -n "$env_line" ]]; do
    case "$env_line" in
      GAME_TICKET_SECRET=*) existing_secret="${env_line#*=}" ;;
      GAME_ALLOWED_ORIGINS=*) existing_origins="${env_line#*=}" ;;
    esac
  done < "$service_env"
fi
game_secret="$existing_secret"
allowed_origins="${requested_origins:-$existing_origins}"
secret_pattern='^[A-Za-z0-9._~+/=-]{32,256}$'
if [[ ! "$game_secret" =~ $secret_pattern ]]; then
  game_secret="$(GAME_CONFIG_PATH="$plugin_config" php -r '
    $config = include getenv("GAME_CONFIG_PATH");
    foreach ($config as $item) {
        if (($item["name"] ?? "") === "game_ticket_secret") {
            echo (string) ($item["value"] ?? "");
            break;
        }
    }
  ')"
fi
if [[ ! "$game_secret" =~ $secret_pattern ]]; then
  game_secret="$(openssl rand -base64 48 | tr -d '\n')"
fi
if [[ -z "$allowed_origins" ]]; then
  allowed_origins="${DEPLOY_SITE_SCHEME}://${DEPLOY_SITE_HOST}"
fi
origin_list_pattern='^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?(,https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?)*$'
if [[ ! "$allowed_origins" =~ $origin_list_pattern ]]; then
  echo "GAME_ALLOWED_ORIGINS must contain exact HTTP origins separated by commas." >&2
  false
fi

env_tmp="$(mktemp /tmp/pingfanggames-env.XXXXXX)"
chmod 600 "$env_tmp"
{
  printf 'GAME_TICKET_SECRET=%s\n' "$game_secret"
  printf 'GAME_ALLOWED_ORIGINS=%s\n' "$allowed_origins"
  printf 'GAME_HOST=127.0.0.1\n'
  printf 'GAME_PORT=8787\n'
  printf 'GAME_SOCKET_PATH=/game-socket\n'
} > "$env_tmp"
install -o root -g root -m 600 "$env_tmp" "$service_env"
rm -f "$env_tmp"

GAME_CONFIG_PATH="$plugin_config" GAME_TICKET_SECRET="$game_secret" php <<'PHP_CONFIG'
<?php
$path = getenv('GAME_CONFIG_PATH');
$secret = getenv('GAME_TICKET_SECRET');
$config = include $path;
$secretFound = false;
$pathFound = false;
foreach ($config as &$item) {
    if (!is_array($item)) {
        continue;
    }
    if (($item['name'] ?? '') === 'game_ticket_secret') {
        $item['value'] = $secret;
        $secretFound = true;
    }
    if (($item['name'] ?? '') === 'game_websocket_path') {
        $item['value'] = '/game-socket';
        $pathFound = true;
    }
}
unset($item);
if (!$secretFound || !$pathFound) {
    file_put_contents('php://stderr', "Required game settings are missing from pingfangdevice config.\n");
    exit(1);
}
$content = "<?php\n\nreturn " . var_export($config, true) . ";\n";
$tempPath = $path . '.tmp.' . getmypid();
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $path)) {
    @unlink($tempPath);
    file_put_contents('php://stderr', "Unable to update pingfangdevice game config.\n");
    exit(1);
}
PHP_CONFIG
php -l "$plugin_config" >/dev/null
php -l "$plugin_ticket" >/dev/null

install -o root -g root -m 644 "$release_dir/deploy/pingfanggames.service.example" "$service_unit"
nginx_tmp="$(mktemp /tmp/pingfanggames-nginx.XXXXXX)"
{
  printf '%s\n' 'location = /game-socket {'
  printf '%s\n' '    proxy_pass http://127.0.0.1:8787;'
  printf '%s\n' '    proxy_http_version 1.1;'
  printf '%s\n' '    proxy_set_header Upgrade $http_upgrade;'
  printf '%s\n' '    proxy_set_header Connection "upgrade";'
  printf '%s\n' '    proxy_set_header Host $host;'
  printf '%s\n' '    proxy_set_header Origin $http_origin;'
  printf '%s\n' '    proxy_read_timeout 75s;'
  printf '%s\n' '    proxy_send_timeout 75s;'
  printf '%s\n' '}'
} > "$nginx_tmp"
install -o root -g root -m 600 "$nginx_tmp" "$nginx_conf"
rm -f "$nginx_tmp"

nginx -t
systemctl daemon-reload
systemctl enable "$service_name" >/dev/null
systemctl restart "$service_name"
health=""
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if health="$(curl --silent --show-error --fail --max-time 2 http://127.0.0.1:8787/healthz 2>/dev/null)"; then
    break
  fi
  sleep 1
done
if [[ "$health" != '{"ok":true}' ]]; then
  echo "Game service health check failed." >&2
  false
fi
reload_nginx

trap - ERR
echo "Deployed pingfanggames release $release_id"
echo "Verified game service health: $health"
REMOTE_SCRIPT

echo "Deployed pingfanggames to ${REMOTE}:/opt/pingfanggames/current"
