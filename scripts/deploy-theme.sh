#!/usr/bin/env bash
set -euo pipefail

deploy_tmp_dir=""

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}"
DEPLOY_SITE_HOST="${DEPLOY_SITE_HOST:-}"
DEPLOY_SITE_SCHEME="${DEPLOY_SITE_SCHEME:-https}"
DEPLOY_SITE_MARKER="${DEPLOY_SITE_MARKER:-}"
THEME_NAME="pingfangvideo"
ADDON_NAME="pingfangdevice"
DOUBAN_ADDON_NAME="douban"
ARCHIVE="dist/pingfangvideo.tar.gz"
ADDON_ARCHIVE="dist/pingfangdevice.tar.gz"
DOUBAN_ADDON_ARCHIVE="dist/douban.tar.gz"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_TMP="${DEPLOY_REMOTE_TMP:-/tmp/${THEME_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"
REMOTE_ADDON_TMP="${DEPLOY_REMOTE_ADDON_TMP:-/tmp/${ADDON_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"
REMOTE_DOUBAN_ADDON_TMP="${DEPLOY_REMOTE_DOUBAN_ADDON_TMP:-/tmp/${DOUBAN_ADDON_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"

if [[ -n "$DEPLOY_SITE_HOST" && ! "$DEPLOY_SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DEPLOY_SITE_HOST must be a hostname without a scheme or path." >&2
  exit 1
fi
if [[ "$DEPLOY_SITE_SCHEME" != "http" && "$DEPLOY_SITE_SCHEME" != "https" ]]; then
  echo "DEPLOY_SITE_SCHEME must be http or https." >&2
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

npm test
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release

"${scp_command[@]}" "$ARCHIVE" "${REMOTE}:${REMOTE_TMP}"
"${scp_command[@]}" "$ADDON_ARCHIVE" "${REMOTE}:${REMOTE_ADDON_TMP}"
"${scp_command[@]}" "$DOUBAN_ADDON_ARCHIVE" "${REMOTE}:${REMOTE_DOUBAN_ADDON_TMP}"

remote_env=(
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "REMOTE_TMP=$(printf "%q" "$REMOTE_TMP")"
  "REMOTE_ADDON_TMP=$(printf "%q" "$REMOTE_ADDON_TMP")"
  "REMOTE_DOUBAN_ADDON_TMP=$(printf "%q" "$REMOTE_DOUBAN_ADDON_TMP")"
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
  "ADDON_NAME=$(printf "%q" "$ADDON_NAME")"
  "DOUBAN_ADDON_NAME=$(printf "%q" "$DOUBAN_ADDON_NAME")"
  "DEPLOY_CLEAR_CACHE=$(printf "%q" "$DEPLOY_CLEAR_CACHE")"
  "DEPLOY_SITE_HOST=$(printf "%q" "$DEPLOY_SITE_HOST")"
  "DEPLOY_SITE_SCHEME=$(printf "%q" "$DEPLOY_SITE_SCHEME")"
  "DEPLOY_SITE_MARKER=$(printf "%q" "$DEPLOY_SITE_MARKER")"
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
}

apply_addon_sql() {
  local maccms_root addon_name

  maccms_root="$1"
  addon_name="$2"

  MACCMS_ROOT="$maccms_root" ADDON_NAME="$addon_name" php <<'PHP_SQL'
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
PHP_SQL
}

install_device_addon() {
  local maccms_root addon_dir backup tmp_dir application_source application_target application_backup

  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$ADDON_NAME"
  application_target="$maccms_root/application/index/controller/Pingfangdevice.php"
  mkdir -p "$maccms_root/addons"

  tmp_dir="$deploy_tmp_dir/addon"
  mkdir -p "$tmp_dir"

  tar -xzf "$REMOTE_ADDON_TMP" -C "$tmp_dir"
  if [[ ! -f "$tmp_dir/$ADDON_NAME/info.ini" || ! -f "$tmp_dir/$ADDON_NAME/install.sql" ]]; then
    echo "Uploaded addon archive does not contain $ADDON_NAME/info.ini and install.sql" >&2
    exit 1
  fi
  while IFS= read -r -d '' php_file; do
    php -l "$php_file" >/dev/null
  done < <(find "$tmp_dir/$ADDON_NAME" -type f -name '*.php' -print0)

  if [[ -d "$addon_dir" ]]; then
    backup="${ADDON_NAME}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$addon_dir" "$maccms_root/addons/$backup"
  fi

  rm -rf "$addon_dir"
  mv "$tmp_dir/$ADDON_NAME" "$addon_dir"

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
$check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
$check->execute([$table, 'login_check_hash']);
if ((int)$check->fetchColumn() !== 1) {
    fwrite(STDERR, "Device session schema verification failed.\n");
    exit(1);
}
PHP_SQL

  php -l "$addon_dir/service/DeviceSession.php" >/dev/null
  php -l "$application_target" >/dev/null

  echo "Installed and verified ${ADDON_NAME} addon under ${addon_dir}"
}

install_simple_addon() {
  local addon_name remote_tmp maccms_root addon_dir backup tmp_dir bridge_controller_source bridge_controller_target admin_bridge_source admin_bridge_target gateway_source gateway_target target_backup

  addon_name="$1"
  remote_tmp="$2"
  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$addon_name"
  mkdir -p "$maccms_root/addons"

  tmp_dir="$deploy_tmp_dir/$addon_name"
  mkdir -p "$tmp_dir"

  tar -xzf "$remote_tmp" -C "$tmp_dir"
  if [[ ! -f "$tmp_dir/$addon_name/info.ini" || ! -f "$tmp_dir/$addon_name/install.sql" ]]; then
    echo "Uploaded addon archive does not contain $addon_name/info.ini and install.sql" >&2
    exit 1
  fi

  if [[ -d "$addon_dir" ]]; then
    backup="${addon_name}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$addon_dir" "$maccms_root/addons/$backup"
  fi

  rm -rf "$addon_dir"
  mv "$tmp_dir/$addon_name" "$addon_dir"
  apply_addon_sql "$maccms_root" "$addon_name"

  if [[ "$addon_name" == "$DOUBAN_ADDON_NAME" ]]; then
    bridge_controller_source="$addon_dir/bridge/Douban.php"
    bridge_controller_target="$maccms_root/application/index/controller/Douban.php"
    admin_bridge_source="$addon_dir/bridge/DoubanAdmin.php"
    admin_bridge_target="$maccms_root/application/admin/controller/Douban.php"
    gateway_source="$addon_dir/bridge/DoubanEndpoint.php"
    gateway_target="$maccms_root/extend/douban.php"
    if [[ ! -f "$bridge_controller_source" || ! -f "$admin_bridge_source" || ! -f "$gateway_source" ]]; then
      echo "Douban addon archive does not contain required bridge files" >&2
      exit 1
    fi
    mkdir -p "$(dirname "$bridge_controller_target")" "$(dirname "$admin_bridge_target")" "$(dirname "$gateway_target")"
    for target in "$bridge_controller_target" "$admin_bridge_target" "$gateway_target"
    do
      if [[ -f "$target" ]]; then
        target_backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
        cp -a "$target" "$target_backup"
      fi
    done
    cp -a "$bridge_controller_source" "$bridge_controller_target"
    cp -a "$admin_bridge_source" "$admin_bridge_target"
    cp -a "$gateway_source" "$gateway_target"
  fi

  echo "Installed ${addon_name} addon under ${addon_dir}"
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

deploy_tmp_dir="$(mktemp -d)"
trap 'rm -rf "$deploy_tmp_dir" "$REMOTE_TMP" "$REMOTE_ADDON_TMP" "$REMOTE_DOUBAN_ADDON_TMP"' EXIT

install_device_addon
install_simple_addon "$DOUBAN_ADDON_NAME" "$REMOTE_DOUBAN_ADDON_TMP"

cd "$DEPLOY_PATH"

if [[ -d "$THEME_NAME" ]]; then
  backup="pingfangvideo.backup.$(date +%Y%m%d%H%M%S)"
  cp -a "$THEME_NAME" "$backup"
fi

tmp_dir="$deploy_tmp_dir/theme"
mkdir -p "$tmp_dir"

tar -xzf "$REMOTE_TMP" -C "$tmp_dir"

if [[ ! -f "$tmp_dir/$THEME_NAME/info.ini" ]]; then
  echo "Uploaded archive does not contain $THEME_NAME/info.ini" >&2
  exit 1
fi

rm -rf "$THEME_NAME"
mv "$tmp_dir/$THEME_NAME" "$THEME_NAME"

if [[ "$DEPLOY_CLEAR_CACHE" != "0" ]]; then
  clear_maccms_cache
fi

verify_deployed_site
REMOTE_SCRIPT

echo "Deployed ${THEME_NAME} to ${REMOTE}:${DEPLOY_PATH}/${THEME_NAME}"
