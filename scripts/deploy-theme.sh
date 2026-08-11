#!/usr/bin/env bash
set -euo pipefail

deploy_tmp_dir=""

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH host or IP address.}"
: "${DEPLOY_USER:?Set DEPLOY_USER to the SSH user.}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH to the remote MacCMS template directory.}"

DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-all}"
DEPLOY_CLEAR_CACHE="${DEPLOY_CLEAR_CACHE:-1}"
VODOPS_INSTALL_CRON="${VODOPS_INSTALL_CRON:-1}"
DEPLOY_SITE_HOST="${DEPLOY_SITE_HOST:-}"
DEPLOY_SITE_SCHEME="${DEPLOY_SITE_SCHEME:-https}"
DEPLOY_SITE_MARKER="${DEPLOY_SITE_MARKER:-}"
THEME_NAME="pingfangvideo"
ADDON_NAME="pingfangdevice"
VODOPS_ADDON_NAME="vodops"
ARCHIVE="dist/pingfangvideo.tar.gz"
ADDON_ARCHIVE="dist/pingfangdevice.tar.gz"
VODOPS_ADDON_ARCHIVE="dist/vodops.tar.gz"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
REMOTE_TMP="${DEPLOY_REMOTE_TMP:-/tmp/${THEME_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"
REMOTE_ADDON_TMP="${DEPLOY_REMOTE_ADDON_TMP:-/tmp/${ADDON_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"
REMOTE_VODOPS_ADDON_TMP="${DEPLOY_REMOTE_VODOPS_ADDON_TMP:-/tmp/${VODOPS_ADDON_NAME}.$(date +%Y%m%d%H%M%S).tar.gz}"

if [[ -n "$DEPLOY_SITE_HOST" && ! "$DEPLOY_SITE_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DEPLOY_SITE_HOST must be a hostname without a scheme or path." >&2
  exit 1
fi
if [[ "$DEPLOY_SCOPE" != "all" && "$DEPLOY_SCOPE" != "vodops" ]]; then
  echo "DEPLOY_SCOPE must be all or vodops." >&2
  exit 1
fi
if [[ "$VODOPS_INSTALL_CRON" != "0" && "$VODOPS_INSTALL_CRON" != "1" ]]; then
  echo "VODOPS_INSTALL_CRON must be 0 or 1." >&2
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
npm run lint
npm run lint:template
npm run verify:compat
npm run verify:preview
npm run package
npm run verify:release

if [[ "$DEPLOY_SCOPE" == "all" ]]; then
  "${scp_command[@]}" "$ARCHIVE" "${REMOTE}:${REMOTE_TMP}"
  "${scp_command[@]}" "$ADDON_ARCHIVE" "${REMOTE}:${REMOTE_ADDON_TMP}"
fi
"${scp_command[@]}" "$VODOPS_ADDON_ARCHIVE" "${REMOTE}:${REMOTE_VODOPS_ADDON_TMP}"

remote_env=(
  "DEPLOY_PATH=$(printf "%q" "$DEPLOY_PATH")"
  "REMOTE_TMP=$(printf "%q" "$REMOTE_TMP")"
  "REMOTE_ADDON_TMP=$(printf "%q" "$REMOTE_ADDON_TMP")"
  "REMOTE_VODOPS_ADDON_TMP=$(printf "%q" "$REMOTE_VODOPS_ADDON_TMP")"
  "THEME_NAME=$(printf "%q" "$THEME_NAME")"
  "ADDON_NAME=$(printf "%q" "$ADDON_NAME")"
  "VODOPS_ADDON_NAME=$(printf "%q" "$VODOPS_ADDON_NAME")"
  "DEPLOY_SCOPE=$(printf "%q" "$DEPLOY_SCOPE")"
  "DEPLOY_CLEAR_CACHE=$(printf "%q" "$DEPLOY_CLEAR_CACHE")"
  "VODOPS_INSTALL_CRON=$(printf "%q" "$VODOPS_INSTALL_CRON")"
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
  local port verify_url verify_file status bytes attempt

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
  for attempt in 1 2; do
    if status="$(curl -k -sS -L --max-time 30 \
      --resolve "${DEPLOY_SITE_HOST}:${port}:127.0.0.1" \
      -o "$verify_file" -w '%{http_code}' "$verify_url")"; then
      break
    fi
    if [[ "$attempt" == "2" ]]; then
      echo "Deployed site verification request failed for ${verify_url}" >&2
      exit 1
    fi
    echo "Deployed site warm-up request failed; retrying ${verify_url}" >&2
  done

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

install_device_addon() {
  local maccms_root addon_dir backup tmp_dir application_source application_target application_backup

  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$ADDON_NAME"
  application_target="$maccms_root/application/index/controller/Pingfangdevice.php"
  backup=""
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

  if [[ -n "$backup" && -f "$maccms_root/addons/$backup/config.php" ]]; then
    EXISTING_ADDON_CONFIG="$maccms_root/addons/$backup/config.php" NEW_ADDON_CONFIG="$addon_dir/config.php" php <<'PHP_ADDON_CONFIG'
<?php
$existingPath = getenv('EXISTING_ADDON_CONFIG');
$newPath = getenv('NEW_ADDON_CONFIG');
$existing = include $existingPath;
$new = include $newPath;
if (!is_array($existing) || !is_array($new)) {
    file_put_contents('php://stderr', "Addon config preservation failed: invalid config file.\n");
    exit(1);
}
$values = [];
foreach ($existing as $item) {
    if (is_array($item) && isset($item['name'])) {
        $values[(string) $item['name']] = $item['value'] ?? '';
    }
}
foreach ($new as &$item) {
    if (is_array($item) && isset($item['name']) && array_key_exists((string) $item['name'], $values)) {
        $item['value'] = $values[(string) $item['name']];
    }
}
unset($item);
$content = "<?php\n\nreturn " . var_export($new, true) . ";\n";
$tempPath = $newPath . '.tmp.' . getmypid();
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $newPath)) {
    @unlink($tempPath);
    file_put_contents('php://stderr', "Addon config preservation failed: unable to update config.\n");
    exit(1);
}
PHP_ADDON_CONFIG
  fi

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
    file_put_contents('php://stderr', "Failed to back up addon hook config.\n");
    exit(1);
}
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $path)) {
    @unlink($tempPath);
    file_put_contents('php://stderr', "Failed to update addon hook config.\n");
    exit(1);
}
if (function_exists('opcache_invalidate')) {
    opcache_invalidate($path, true);
}
$verified = include $path;
if (!in_array($addon, $verified['hooks']['app_begin'] ?? [], true)) {
    file_put_contents('php://stderr', "Addon app_begin hook verification failed.\n");
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
    file_put_contents('php://stderr', "MacCMS database config or addon install.sql is missing.\n");
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
    if ($trimmed === '' || strncmp($trimmed, '--', 2) === 0 || strncmp($trimmed, '/*', 2) === 0) {
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
    file_put_contents('php://stderr', "Device session schema verification failed.\n");
    exit(1);
}
PHP_SQL

  php -l "$addon_dir/service/DeviceSession.php" >/dev/null
  php -l "$application_target" >/dev/null

  echo "Installed and verified ${ADDON_NAME} addon under ${addon_dir}"
}

install_vodops_worker_cron() {
  local mode maccms_root marker current_file error_file next_file php_binary flock_binary cron_line count backup_file required_command

  mode="${1:-install}"
  if [[ "$VODOPS_INSTALL_CRON" == "0" ]]; then
    if [[ "$mode" == "install" ]]; then
      echo "Skipped VodOps Cron installation because VODOPS_INSTALL_CRON=0"
    fi
    return
  fi
  for required_command in crontab flock php; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
      echo "${required_command} is required to install the VodOps worker Cron." >&2
      exit 1
    fi
  done

  maccms_root="$(dirname "$DEPLOY_PATH")"
  if [[ "$maccms_root" == *$'\n'* || "$maccms_root" == *"'"* || "$maccms_root" == *"%"* ]]; then
    echo "MacCMS root contains characters that cannot be safely written to Cron." >&2
    exit 1
  fi
  marker="# vodops-worker:${maccms_root}"
  current_file="$deploy_tmp_dir/vodops.crontab.current"
  error_file="$deploy_tmp_dir/vodops.crontab.error"
  next_file="$deploy_tmp_dir/vodops.crontab.next"
  if ! crontab -l >"$current_file" 2>"$error_file"; then
    if [[ -s "$error_file" ]] && ! grep -qi 'no crontab' "$error_file"; then
      cat "$error_file" >&2
      echo "Unable to read the existing crontab; refusing to replace it." >&2
      exit 1
    fi
    : >"$current_file"
  fi
  if [[ "$mode" == "preflight" ]]; then
    return
  fi

  mkdir -p "$maccms_root/runtime/log"
  php_binary="$(command -v php)"
  flock_binary="$(command -v flock)"
  cron_line="* * * * * '${flock_binary}' -n '${maccms_root}/runtime/vodops-worker.lock' '${php_binary}' '${maccms_root}/addons/${VODOPS_ADDON_NAME}/bin/vodops-worker.php' --max-chunks=20 --max-seconds=50 >> '${maccms_root}/runtime/log/vodops-worker.log' 2>&1 ${marker}"
  {
    grep -Fv -- "$marker" "$current_file" || true
    printf '%s\n' "$cron_line"
  } >"$next_file"

  if ! cmp -s "$current_file" "$next_file"; then
    if [[ -s "$current_file" ]]; then
      backup_file="$maccms_root/runtime/vodops.crontab.backup.$(date +%Y%m%d%H%M%S)"
      cp -a "$current_file" "$backup_file"
    fi
    crontab "$next_file"
  fi
  count="$(crontab -l | grep -Fc -- "$marker" || true)"
  if [[ "$count" != "1" ]]; then
    echo "VodOps worker Cron verification failed." >&2
    exit 1
  fi
  echo "Installed and verified single-instance VodOps worker Cron"
}

install_vodops_addon() {
  local maccms_root addon_dir legacy_douban_dir backup backup_dir state_dir stamp tmp_dir
  local controller_source controller_target controller_backup douban_controller_source douban_controller_target douban_controller_backup
  local legacy_index_controller_target view_source view_target view_backup required_file

  install_vodops_worker_cron preflight
  maccms_root="$(dirname "$DEPLOY_PATH")"
  addon_dir="$maccms_root/addons/$VODOPS_ADDON_NAME"
  legacy_douban_dir="$maccms_root/addons/douban"
  controller_target="$maccms_root/application/admin/controller/Vodops.php"
  douban_controller_target="$maccms_root/application/admin/controller/Douban.php"
  legacy_index_controller_target="$maccms_root/application/index/controller/Douban.php"
  view_target="$maccms_root/application/admin/view_new/vodops/index.html"
  backup=""
  mkdir -p "$maccms_root/addons"

  tmp_dir="$deploy_tmp_dir/vodops-addon"
  mkdir -p "$tmp_dir"
  tar -xzf "$REMOTE_VODOPS_ADDON_TMP" -C "$tmp_dir"
  for required_file in \
    "Vodops.php" \
    "info.ini" \
    "install.sql" \
    "schema.php" \
    "application/admin/controller/Douban.php" \
    "application/admin/controller/Vodops.php" \
    "application/admin/view_new/vodops/index.html" \
    "backend/DoubanController.php" \
    "bin/vodops-worker.php" \
    "service/DoubanAiReviewer.php" \
    "service/DoubanActionException.php" \
    "service/DoubanData.php" \
    "service/DoubanGateway.php" \
    "service/DoubanMatcher.php" \
    "service/VodQualityAnalyzer.php" \
    "service/VodQualityRepair.php" \
    "service/VodQualityScanner.php" \
    "view/index/index.html"
  do
    if [[ ! -f "$tmp_dir/$VODOPS_ADDON_NAME/$required_file" ]]; then
      echo "Uploaded vodops archive is missing ${required_file}" >&2
      exit 1
    fi
  done
  while IFS= read -r -d '' php_file; do
    php -l "$php_file" >/dev/null
  done < <(find "$tmp_dir/$VODOPS_ADDON_NAME" -type f -name '*.php' -print0)

  MACCMS_ROOT="$maccms_root" VODOPS_STAGED_ADDON="$tmp_dir/$VODOPS_ADDON_NAME" php <<'PHP_VODOPS_SCHEMA_PREFLIGHT'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$stagedAddon = rtrim(getenv('VODOPS_STAGED_ADDON'), '/');
$dbFile = $root . '/application/database.php';
$schemaFile = $stagedAddon . '/schema.php';
if (!is_file($dbFile) || !is_file($schemaFile)) {
    file_put_contents('php://stderr', "MacCMS database config or VodOps schema manifest is missing.\n");
    exit(1);
}
$db = include $dbFile;
$schema = include $schemaFile;
if (!is_array($db) || !is_array($schema)) {
    file_put_contents('php://stderr', "MacCMS database config or VodOps schema manifest is invalid.\n");
    exit(1);
}
$prefix = isset($db['prefix']) ? $db['prefix'] : '';
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
$tableCheck = $pdo->prepare(
    'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
);
$columnQuery = $pdo->prepare(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
);
$incompatible = [];
foreach ($schema as $table => $requiredColumns) {
    $tableName = $prefix . $table;
    $tableCheck->execute([$tableName]);
    $engine = $tableCheck->fetchColumn();
    if ($engine === false) {
        continue;
    }
    if (strtolower((string)$engine) !== 'innodb') {
        $incompatible[] = $tableName . ': ENGINE=' . (string)$engine . ', expected InnoDB';
    }
    $columnQuery->execute([$tableName]);
    $actualColumns = array_map('strtolower', $columnQuery->fetchAll(PDO::FETCH_COLUMN));
    $missing = array_values(array_diff($requiredColumns, $actualColumns));
    if (!empty($missing)) {
        $incompatible[] = $tableName . ': ' . implode(',', $missing);
    }
}
if (!empty($incompatible)) {
    file_put_contents(
        'php://stderr',
        "VodOps Douban schema preflight failed; no addon files were replaced. Incompatible legacy schema:\n- " .
        implode("\n- ", $incompatible) .
        "\nBack up and migrate the listed legacy tables before retrying.\n"
    );
    exit(1);
}
PHP_VODOPS_SCHEMA_PREFLIGHT

  stamp="$(date +%Y%m%d%H%M%S)"
  backup="${VODOPS_ADDON_NAME}.backup.${stamp}"
  backup_dir="$maccms_root/addons/$backup"
  if [[ -e "$backup_dir" ]]; then
    echo "VodOps backup target already exists: $backup_dir" >&2
    exit 1
  fi
  if [[ -d "$addon_dir" ]]; then
    cp -a "$addon_dir" "$backup_dir"
  else
    mkdir -p "$backup_dir"
  fi
  state_dir="$backup_dir/.vodops-deploy-state"
  mkdir -p \
    "$state_dir/addons" \
    "$state_dir/application/admin/controller" \
    "$state_dir/application/admin/view_new/vodops" \
    "$state_dir/application/index/controller"
  if [[ -d "$addon_dir" ]]; then
    touch "$state_dir/vodops-addon-present"
  fi
  if [[ -d "$legacy_douban_dir" ]]; then
    cp -a "$legacy_douban_dir" "$state_dir/addons/douban"
  fi
  if [[ -f "$controller_target" ]]; then
    cp -a "$controller_target" "$state_dir/application/admin/controller/Vodops.php"
  fi
  if [[ -f "$douban_controller_target" ]]; then
    cp -a "$douban_controller_target" "$state_dir/application/admin/controller/Douban.php"
  fi
  if [[ -f "$view_target" ]]; then
    cp -a "$view_target" "$state_dir/application/admin/view_new/vodops/index.html"
  fi
  if [[ -f "$legacy_index_controller_target" ]]; then
    cp -a "$legacy_index_controller_target" "$state_dir/application/index/controller/Douban.php"
  fi

  rm -rf "$addon_dir"
  rm -rf "$legacy_douban_dir"
  rm -f "$legacy_index_controller_target"
  mv "$tmp_dir/$VODOPS_ADDON_NAME" "$addon_dir"

  if [[ -n "$backup" && -f "$maccms_root/addons/$backup/config.php" ]]; then
    EXISTING_ADDON_CONFIG="$maccms_root/addons/$backup/config.php" NEW_ADDON_CONFIG="$addon_dir/config.php" php <<'PHP_VODOPS_CONFIG'
<?php
$existingPath = getenv('EXISTING_ADDON_CONFIG');
$newPath = getenv('NEW_ADDON_CONFIG');
$existing = include $existingPath;
$new = include $newPath;
if (!is_array($existing) || !is_array($new)) {
    file_put_contents('php://stderr', "Vodops config preservation failed: invalid config file.\n");
    exit(1);
}
$values = [];
foreach ($existing as $item) {
    if (is_array($item) && isset($item['name'])) {
        $values[(string) $item['name']] = $item['value'] ?? '';
    }
}
foreach ($new as &$item) {
    if (is_array($item) && isset($item['name']) && array_key_exists((string) $item['name'], $values)) {
        $item['value'] = $values[(string) $item['name']];
    }
}
unset($item);
$content = "<?php\n\nreturn " . var_export($new, true) . ";\n";
$tempPath = $newPath . '.tmp.' . getmypid();
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $newPath)) {
    @unlink($tempPath);
    file_put_contents('php://stderr', "Vodops config preservation failed: unable to update config.\n");
    exit(1);
}
PHP_VODOPS_CONFIG
  fi

  controller_source="$addon_dir/application/admin/controller/Vodops.php"
  douban_controller_source="$addon_dir/application/admin/controller/Douban.php"
  view_source="$addon_dir/application/admin/view_new/vodops/index.html"
  mkdir -p "$(dirname "$controller_target")" "$(dirname "$view_target")"
  if [[ -f "$controller_target" ]]; then
    controller_backup="${controller_target}.backup.${stamp}"
    cp -a "$controller_target" "$controller_backup"
  fi
  if [[ -f "$douban_controller_target" ]]; then
    douban_controller_backup="${douban_controller_target}.backup.${stamp}"
    cp -a "$douban_controller_target" "$douban_controller_backup"
  fi
  if [[ -f "$view_target" ]]; then
    view_backup="${view_target}.backup.${stamp}"
    cp -a "$view_target" "$view_backup"
  fi
  cp -a "$controller_source" "$controller_target"
  cp -a "$douban_controller_source" "$douban_controller_target"
  cp -a "$view_source" "$view_target"

  MACCMS_ROOT="$maccms_root" php <<'PHP_VODOPS_MENU'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$path = $root . '/application/extra/quickmenu.php';
$menu = is_file($path) ? include $path : [];
if (!is_array($menu)) {
    file_put_contents('php://stderr', "Vodops quick menu config is not an array.\n");
    exit(1);
}
$entry = '视频数据中心,vodops/index';
$legacyEntries = [
    '视频数据质量,vodops/index',
    '豆瓣评分,admin/douban/index',
    '豆瓣数据,admin/douban/index',
];
$menu = array_values(array_filter($menu, static function ($item) use ($legacyEntries, $entry) {
    return $item === $entry || !in_array($item, $legacyEntries, true);
}));
if (!in_array($entry, $menu, true)) {
    $menu[] = $entry;
}
$content = "<?php\nreturn " . var_export(array_values($menu), true) . ";\n";
$tempPath = $path . '.tmp.' . getmypid();
if (is_file($path) && !copy($path, $path . '.backup.' . date('YmdHis') . '.' . getmypid())) {
    file_put_contents('php://stderr', "Failed to back up quick menu config.\n");
    exit(1);
}
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $path)) {
    @unlink($tempPath);
    file_put_contents('php://stderr', "Failed to update quick menu config.\n");
    exit(1);
}
if (function_exists('opcache_invalidate')) {
    opcache_invalidate($path, true);
}
$verified = include $path;
if (!is_array($verified) || !in_array($entry, $verified, true)) {
    file_put_contents('php://stderr', "Vodops quick menu verification failed.\n");
    exit(1);
}
PHP_VODOPS_MENU

  MACCMS_ROOT="$maccms_root" VODOPS_ADDON_NAME="$VODOPS_ADDON_NAME" php <<'PHP_VODOPS_SQL'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$addon = getenv('VODOPS_ADDON_NAME');
$dbFile = $root . '/application/database.php';
$sqlFile = $root . '/addons/' . $addon . '/install.sql';
if (!is_file($dbFile) || !is_file($sqlFile)) {
    file_put_contents('php://stderr', "MacCMS database config or vodops install.sql is missing.\n");
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
    if ($trimmed === '' || strncmp($trimmed, '--', 2) === 0 || strncmp($trimmed, '/*', 2) === 0) {
        continue;
    }
    $statement .= $line . "\n";
    if (substr($trimmed, -1) === ';') {
        $pdo->exec($statement);
        $statement = '';
    }
}
$check = $pdo->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
foreach ([
    'vodops_lock',
    'vodops_scan',
    'vodops_issue',
    'vodops_fingerprint',
    'vodops_repair_log',
    'douban_config',
    'douban_vod_meta',
    'douban_task',
    'douban_log',
    'douban_review_candidate',
    'douban_scan',
    'douban_scan_issue',
] as $table) {
    $check->execute([$prefix . $table]);
    if (strtolower((string)$check->fetchColumn()) !== 'innodb') {
        file_put_contents('php://stderr', "Vodops schema verification failed for {$table}.\n");
        exit(1);
    }
}
$columnCheck = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
$schema = include $root . '/addons/' . $addon . '/schema.php';
foreach ($schema as $table => $requiredColumns) {
    foreach ($requiredColumns as $column) {
        $columnCheck->execute([$prefix . $table, $column]);
        if ((int)$columnCheck->fetchColumn() !== 1) {
            file_put_contents('php://stderr', "Vodops retained schema verification failed: {$table}.{$column}.\n");
            exit(1);
        }
    }
}
$columnCheck->execute([$prefix . 'vodops_scan', 'scope_json']);
if ((int)$columnCheck->fetchColumn() !== 1) {
    file_put_contents('php://stderr', "Vodops scope column verification failed.\n");
    exit(1);
}
foreach (['execution_mode', 'lease_until', 'next_run_at'] as $column) {
    $columnCheck->execute([$prefix . 'vodops_scan', $column]);
    if ((int)$columnCheck->fetchColumn() !== 1) {
        file_put_contents('php://stderr', "Vodops worker column verification failed: {$column}.\n");
        exit(1);
    }
}
$lockTable = $prefix . 'vodops_lock';
if (!preg_match('/^[A-Za-z0-9_]+$/', $lockTable)) {
    file_put_contents('php://stderr', "Vodops lock table name is invalid.\n");
    exit(1);
}
$lockCheck = $pdo->prepare("SELECT COUNT(*) FROM `{$lockTable}` WHERE `lock_name` = ?");
foreach (['scan_start', 'douban_enqueue'] as $lockName) {
    $lockCheck->execute([$lockName]);
    if ((int)$lockCheck->fetchColumn() !== 1) {
        file_put_contents('php://stderr', "Vodops mutex row verification failed: {$lockName}.\n");
        exit(1);
    }
}
PHP_VODOPS_SQL

  MACCMS_ROOT="$maccms_root" VODOPS_ADDON_NAME="$VODOPS_ADDON_NAME" php <<'PHP_VODOPS_HOOK'
<?php
$root = rtrim(getenv('MACCMS_ROOT'), '/');
$addon = getenv('VODOPS_ADDON_NAME');
$path = $root . '/application/extra/addons.php';
$config = is_file($path) ? include $path : [];
if (!is_array($config)) {
    file_put_contents('php://stderr', "Vodops addon hook config is not an array.\n");
    exit(1);
}
$config += ['autoload' => false, 'hooks' => [], 'route' => []];
if (!is_array($config['hooks'])) {
    $config['hooks'] = [];
}
if (isset($config['hooks']['response_end']) && !is_array($config['hooks']['response_end'])) {
    file_put_contents('php://stderr', "Vodops response_end hook config is invalid.\n");
    exit(1);
}
if (isset($config['hooks']['response_end'])) {
    $config['hooks']['response_end'] = array_values(array_filter(
        $config['hooks']['response_end'],
        static function ($hook) use ($addon) {
            return $hook !== $addon;
        }
    ));
}
$content = "<?php\n\nreturn " . var_export($config, true) . ";\n";
$tempPath = $path . '.tmp.' . getmypid();
if (is_file($path) && !copy($path, $path . '.backup.' . date('YmdHis') . '.' . getmypid())) {
    file_put_contents('php://stderr', "Failed to back up Vodops addon hook config.\n");
    exit(1);
}
if (file_put_contents($tempPath, $content) === false || !rename($tempPath, $path)) {
    @unlink($tempPath);
    file_put_contents('php://stderr', "Failed to update Vodops addon hook config.\n");
    exit(1);
}
if (function_exists('opcache_invalidate')) {
    opcache_invalidate($path, true);
}
$verified = include $path;
if (in_array($addon, $verified['hooks']['response_end'] ?? [], true)) {
    file_put_contents('php://stderr', "Vodops response_end hook removal failed.\n");
    exit(1);
}
PHP_VODOPS_HOOK

  php -l "$controller_target" >/dev/null
  php -l "$douban_controller_target" >/dev/null
  php -l "$addon_dir/bin/vodops-worker.php" >/dev/null
  php -l "$addon_dir/backend/DoubanController.php" >/dev/null
  php -l "$addon_dir/service/DoubanData.php" >/dev/null
  php -l "$addon_dir/service/VodQualityScanner.php" >/dev/null
  grep -Fq 'X-CSRF-Token' "$view_target"
  grep -Fq 'X-CSRF-Token' "$addon_dir/view/index/index.html"
  grep -Fq '同步不会修改现有图片' "$addon_dir/view/index/index.html"
  install_vodops_worker_cron

  echo "Installed and verified ${VODOPS_ADDON_NAME} addon under ${addon_dir}"
}

if [[ ! -d "$DEPLOY_PATH" ]]; then
  echo "Remote template directory does not exist: $DEPLOY_PATH" >&2
  exit 1
fi

deploy_tmp_dir="$(mktemp -d)"
trap 'rm -rf "$deploy_tmp_dir" "$REMOTE_TMP" "$REMOTE_ADDON_TMP" "$REMOTE_VODOPS_ADDON_TMP"' EXIT

if [[ "$DEPLOY_SCOPE" == "vodops" ]]; then
  install_vodops_addon
else
  install_device_addon
  install_vodops_addon

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
fi

if [[ "$DEPLOY_CLEAR_CACHE" != "0" ]]; then
  clear_maccms_cache
fi

verify_deployed_site
REMOTE_SCRIPT

if [[ "$DEPLOY_SCOPE" == "vodops" ]]; then
  echo "Deployed ${VODOPS_ADDON_NAME} to ${REMOTE}:$(dirname "$DEPLOY_PATH")/addons/${VODOPS_ADDON_NAME}"
else
  echo "Deployed ${THEME_NAME} to ${REMOTE}:${DEPLOY_PATH}/${THEME_NAME}"
fi
