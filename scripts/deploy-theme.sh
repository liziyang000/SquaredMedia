#!/usr/bin/env bash
set -euo pipefail

deploy_tmp_dir=""

DEPLOY_HOST="${DEPLOY_HOST:-ping2.my}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/www/wwwroot/ping2.my/template}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}"
THEME_NAME="pingfangvideo"
ADDON_NAME="pingfangdevice"
ARCHIVE="dist/pingfangvideo.tar.gz"
ADDON_ARCHIVE="dist/pingfangdevice.tar.gz"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_TMP="${DEPLOY_REMOTE_TMP:-/tmp/${THEME_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"
REMOTE_ADDON_TMP="${DEPLOY_REMOTE_ADDON_TMP:-/tmp/${ADDON_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"

ssh_options=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
scp_options=(-P "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)

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

remote_env=(
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "REMOTE_TMP=$(printf "%q" "$REMOTE_TMP")"
  "REMOTE_ADDON_TMP=$(printf "%q" "$REMOTE_ADDON_TMP")"
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
  "ADDON_NAME=$(printf "%q" "$ADDON_NAME")"
  "DEPLOY_CLEAR_CACHE=$(printf "%q" "$DEPLOY_CLEAR_CACHE")"
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

install_device_addon() {
  local maccms_root addon_dir backup tmp_dir bridge_source bridge_target bridge_backup

  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$ADDON_NAME"
  bridge_target="$maccms_root/application/index/controller/Pingfangdevice.php"
  mkdir -p "$maccms_root/addons"

  tmp_dir="$deploy_tmp_dir/addon"
  mkdir -p "$tmp_dir"

  tar -xzf "$REMOTE_ADDON_TMP" -C "$tmp_dir"
  if [[ ! -f "$tmp_dir/$ADDON_NAME/info.ini" || ! -f "$tmp_dir/$ADDON_NAME/install.sql" ]]; then
    echo "Uploaded addon archive does not contain $ADDON_NAME/info.ini and install.sql" >&2
    exit 1
  fi

  if [[ -d "$addon_dir" ]]; then
    backup="${ADDON_NAME}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$addon_dir" "$maccms_root/addons/$backup"
  fi

  rm -rf "$addon_dir"
  mv "$tmp_dir/$ADDON_NAME" "$addon_dir"

  bridge_source="$addon_dir/bridge/Pingfangdevice.php"
  if [[ ! -f "$bridge_source" ]]; then
    echo "Addon archive does not contain bridge/Pingfangdevice.php" >&2
    exit 1
  fi
  if [[ -f "$bridge_target" ]]; then
    bridge_backup="${bridge_target}.backup.$(date +%Y%m%d%H%M%S)"
    cp -a "$bridge_target" "$bridge_backup"
  fi
  cp -a "$bridge_source" "$bridge_target"

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
file_put_contents($path, "<?php\n\nreturn " . var_export($config, true) . ";\n");
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
PHP_SQL

  echo "Installed ${ADDON_NAME} addon under ${addon_dir}"
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

deploy_tmp_dir="$(mktemp -d)"
trap 'rm -rf "$deploy_tmp_dir" "$REMOTE_TMP" "$REMOTE_ADDON_TMP"' EXIT

install_device_addon

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
REMOTE_SCRIPT

echo "Deployed ${THEME_NAME} to ${REMOTE}:${DEPLOY_PATH}/${THEME_NAME}"
