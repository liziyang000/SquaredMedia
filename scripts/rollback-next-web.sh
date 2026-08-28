#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
NEXT_ROOT="/www/wwwroot/squaredMediaOnline"
NEXT_SITE_HOST="www.ping2.my"
NEXT_PORT="3100"
NEXT_SERVICE="squaredmedia-next.service"
NEXT_NGINX_EXTENSION="/www/server/panel/vhost/nginx/extension/www.ping2.my/react-spa.conf"
NEXT_UNIT_PATH="/etc/systemd/system/$NEXT_SERVICE"
ROLLBACK_RELEASE="${NEXT_ROLLBACK_RELEASE:-}"
ROLLBACK_FAILED_EXIT_STATUS=95
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
  "ROLLBACK_FAILED_EXIT_STATUS=$(printf '%q' "$ROLLBACK_FAILED_EXIT_STATUS")"
)

"${ssh_command[@]}" "$REMOTE" "${remote_env[*]} bash -s" <<'REMOTE_ROLLBACK'
set -euo pipefail

for command in curl find nginx php sed systemctl wc; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "$command is required on the staging server." >&2
    exit 1
  fi
done

read_next_release_metadata() {
  local target="$1"
  local expected_release="${target##*/}"
  local env_file="$target/release.env"
  local json_file="$target/release.json"
  local env_release json_release

  if [[ ! -f "$env_file" || -L "$env_file" || ! -f "$json_file" || -L "$json_file" ]]; then
    echo "Rollback target is missing trusted release metadata: $target" >&2
    return 1
  fi
  env_release="$(sed -n 's/^SQUAREDMEDIA_RELEASE_ID=//p' "$env_file")"
  if [[ "$(wc -l < "$env_file")" -ne 1 || ! "$env_release" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]]; then
    echo "Rollback release.env is invalid: $env_file" >&2
    return 1
  fi
  json_release="$(RELEASE_JSON_FILE="$json_file" php -r '
    $payload = json_decode(file_get_contents(getenv("RELEASE_JSON_FILE")), true);
    $release = is_array($payload) ? ($payload["release"] ?? null) : null;
    if (!is_string($release)) exit(1);
    echo $release;
  ')" || {
    echo "Rollback release.json is invalid: $json_file" >&2
    return 1
  }
  if [[ "$env_release" != "$expected_release" || "$json_release" != "$expected_release" ]]; then
    echo "Rollback release metadata does not match its directory: $target" >&2
    return 1
  fi
  printf '%s\n' "$expected_release"
}

healthz_matches_release() {
  local expected_release="$1"
  shift
  local payload
  payload="$(curl "$@")" || return 1
  HEALTHZ_PAYLOAD="$payload" EXPECTED_RELEASE="$expected_release" php -r '
    $payload = json_decode(getenv("HEALTHZ_PAYLOAD"), true);
    if (!is_array($payload)
        || ($payload["status"] ?? null) !== "ok"
        || ($payload["release"] ?? null) !== getenv("EXPECTED_RELEASE")) {
      exit(1);
    }
  '
}

validate_rollback_api_response() {
  local kind="$1"
  local response_file="$2"
  local http_status="$3"
  API_RESPONSE_KIND="$kind" API_RESPONSE_FILE="$response_file" API_HTTP_STATUS="$http_status" php -r '
    $payload = json_decode(file_get_contents(getenv("API_RESPONSE_FILE")), true);
    $status = getenv("API_HTTP_STATUS");
    $kind = getenv("API_RESPONSE_KIND");
    $data = is_array($payload) && is_array($payload["data"] ?? null) ? $payload["data"] : [];
    $policy = $status === "403"
      && is_array($payload)
      && (string)($payload["code"] ?? "") === "403"
      && (string)($payload["msg"] ?? "") === "当前地区不可访问";
    if ($policy) exit(0);
    if ($status !== "200" || !is_array($payload) || (string)($payload["code"] ?? "") !== "1") exit(1);
    if ($kind === "home") {
      if (!is_string($data["siteName"] ?? null)
          || trim($data["siteName"]) === ""
          || !is_int($data["todayUpdated"] ?? null)
          || $data["todayUpdated"] < 0
          || !is_array($data["categories"] ?? null)
          || !is_array($data["hero"] ?? null)
          || !is_array($data["ranking"] ?? null)
          || !is_array($data["latest"] ?? null)
          || !is_array($data["latestByCategory"] ?? null)) {
        exit(1);
      }
    }
    if ($kind === "content") {
      $context = is_array($data["categoryContext"] ?? null) ? $data["categoryContext"] : [];
      $facets = is_array($data["facets"] ?? null) ? $data["facets"] : [];
      if (!is_string($data["siteName"] ?? null)
          || trim($data["siteName"]) === ""
          || !is_array($data["categories"] ?? null)
          || !array_key_exists("current", $context)
          || !array_key_exists("parent", $context)
          || !is_array($context["children"] ?? null)
          || !is_array($facets["areas"] ?? null)
          || !is_array($facets["years"] ?? null)
          || !is_array($facets["langs"] ?? null)
          || !is_array($facets["classes"] ?? null)
          || !is_array($data["videos"] ?? null)
          || count($data["videos"]) > 24
          || !is_int($data["total"] ?? null)
          || $data["total"] < 0
          || !is_int($data["page"] ?? null)
          || $data["page"] < 1
          || !is_int($data["totalPages"] ?? null)
          || $data["totalPages"] < 0) {
        exit(1);
      }
    }
  '
}

smoke_rollback_api() {
  local route="$1"
  local kind="$2"
  local response_file http_status
  response_file="$(mktemp /tmp/squaredmedia-rollback-api.XXXXXX.json)"
  if http_status="$(curl -ksS --max-time 10 "${resolve_args[@]}" -H 'Accept: application/json' -o "$response_file" -w '%{http_code}' "$base_url$route")" &&
    validate_rollback_api_response "$kind" "$response_file" "$http_status"; then
    rm -f -- "$response_file"
    return 0
  fi
  rm -f -- "$response_file"
  return 1
}

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
target_resolved="$(readlink -f "$target" 2>/dev/null || true)"
if [[ -z "$target" || "$target" != "$NEXT_ROOT"/releases/* || -L "$target" || ! -d "$target" ||
  "$target_resolved" != "$target" || "$target" == "$current_before" ]]; then
  echo "Rollback target is invalid or already current: ${target:-missing}" >&2
  exit 1
fi

target_release=""
if [[ -f "$target/apps/web/server.js" ]]; then
  target_release="$(read_next_release_metadata "$target")"
fi

unsafe_path="$(find "$target" \
  -path "$target/apps/web/.next/cache" -prune -o \
  \( -type l -o ! -user root -o ! -group root -o -perm /022 \) -print -quit)"
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
  local restore_status=0
  trap - EXIT
  set +e
  rm -f -- "$NEXT_ROOT/.current.rollback-failed"
  if ! ln -s "$current_before" "$NEXT_ROOT/.current.rollback-failed" ||
    ! mv -Tf "$NEXT_ROOT/.current.rollback-failed" "$NEXT_ROOT/current"; then
    restore_status=1
  fi
  if [[ "$nginx_existed" == "1" ]]; then
    if ! install -m 0644 "$nginx_backup" "$NEXT_NGINX_EXTENSION"; then
      restore_status=1
    fi
  elif ! rm -f -- "$NEXT_NGINX_EXTENSION"; then
    restore_status=1
  fi
  if [[ "$unit_existed" == "1" ]]; then
    if ! install -m 0644 "$unit_backup" "$NEXT_UNIT_PATH"; then
      restore_status=1
    fi
  elif ! rm -f -- "$NEXT_UNIT_PATH"; then
    restore_status=1
  fi
  if ! systemctl daemon-reload; then
    restore_status=1
  fi
  if [[ "$service_was_active" == "1" ]]; then
    if ! systemctl restart "$NEXT_SERVICE" || ! systemctl is-active --quiet "$NEXT_SERVICE"; then
      restore_status=1
    fi
  else
    systemctl stop "$NEXT_SERVICE" 2>/dev/null || true
    if systemctl is-active --quiet "$NEXT_SERVICE"; then
      restore_status=1
    fi
  fi
  if [[ "$service_was_enabled" == "1" ]]; then
    if ! systemctl enable "$NEXT_SERVICE" >/dev/null 2>&1 ||
      ! systemctl is-enabled --quiet "$NEXT_SERVICE"; then
      restore_status=1
    fi
  else
    systemctl disable "$NEXT_SERVICE" >/dev/null 2>&1 || true
    if systemctl is-enabled --quiet "$NEXT_SERVICE"; then
      restore_status=1
    fi
  fi
  if ! reload_nginx; then
    restore_status=1
  fi
  rm -f -- "$NEXT_ROOT/.current.rollback"
  if [[ "$restore_status" -ne 0 ]]; then
    echo "CRITICAL: failed to restore the pre-rollback Web release." >&2
    echo "CRITICAL: preserved Nginx backup at $nginx_backup" >&2
    echo "CRITICAL: preserved systemd backup at $unit_backup" >&2
    exit "$ROLLBACK_FAILED_EXIT_STATUS"
  fi
  rm -f -- "$nginx_backup" "$unit_backup"
  exit "$status"
}
trap restore_failed_rollback EXIT

rm -f -- "$NEXT_ROOT/.current.rollback"
ln -s "$target" "$NEXT_ROOT/.current.rollback"
mv -Tf "$NEXT_ROOT/.current.rollback" "$NEXT_ROOT/current"

if [[ -n "$target_release" && -f "$target/.deploy/nginx.conf" && -f "$target/.deploy/$NEXT_SERVICE" ]]; then
  install -m 0644 "$target/.deploy/nginx.conf" "$NEXT_NGINX_EXTENSION"
  install -m 0644 "$target/.deploy/$NEXT_SERVICE" "$NEXT_UNIT_PATH"
  systemctl daemon-reload
  systemctl enable "$NEXT_SERVICE" >/dev/null
  systemctl restart "$NEXT_SERVICE"
  ready=0
  for _ in $(seq 1 45); do
    if healthz_matches_release "$target_release" -fsS --max-time 3 "http://127.0.0.1:$NEXT_PORT/healthz"; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    echo "Rolled-back Next.js release did not become healthy." >&2
    exit 1
  fi
elif [[ -z "$target_release" && -f "$target/index.html" && -f "$NEXT_ROOT/config-backups/pre-next-react-spa.conf" ]]; then
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
base_url="https://$NEXT_SITE_HOST"
resolve_args=(--noproxy '*' --resolve "$NEXT_SITE_HOST:443:127.0.0.1")
if [[ -n "$target_release" ]]; then
  public_release_ready=0
  for _ in $(seq 1 15); do
    if healthz_matches_release "$target_release" -kfsS --max-time 3 "${resolve_args[@]}" "$base_url/healthz"; then
      public_release_ready=1
      break
    fi
    sleep 1
  done
  if [[ "$public_release_ready" != "1" ]]; then
    echo "Rolled-back staging health endpoint did not report release $target_release." >&2
    exit 1
  fi
fi
rollback_ready=0
for _ in $(seq 1 15); do
  status="$(curl -ksS --max-time 3 "${resolve_args[@]}" -o /dev/null -w '%{http_code}' "$base_url/")"
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
if ! smoke_rollback_api "/index.php/pingfangapi/index?action=home_v2&compact=1" home; then
  echo "Rolled-back staging is incompatible with the current home API." >&2
  exit 1
fi
if ! smoke_rollback_api "/index.php/pingfangapi/index?action=content&compact=1&scope=library&sort=latest&page=1&page_size=24&include_facets=1" content; then
  echo "Rolled-back staging is incompatible with the current content API." >&2
  exit 1
fi

rm -f -- "$NEXT_ROOT/.previous.rollback"
ln -s "$current_before" "$NEXT_ROOT/.previous.rollback"
mv -Tf "$NEXT_ROOT/.previous.rollback" "$NEXT_ROOT/previous"
rm -f -- "$nginx_backup" "$unit_backup"
trap - EXIT
echo "Rolled back staging from $current_before to $target"
REMOTE_ROLLBACK
