<?php

declare(strict_types=1);

function vodops_contract_fail(string $message): void
{
    fwrite(STDERR, $message . "\n");
    exit(1);
}

function vodops_contract_match(string $pattern, string $content, string $message): void
{
    if (!preg_match($pattern, $content)) {
        vodops_contract_fail($message);
    }
}

$root = dirname(__DIR__);
$required = [
    'addons/vodops/Vodops.php',
    'addons/vodops/config.php',
    'addons/vodops/info.ini',
    'addons/vodops/install.sql',
    'addons/vodops/schema.php',
    'addons/vodops/application/admin/controller/Douban.php',
    'addons/vodops/application/admin/controller/Vodops.php',
    'addons/vodops/application/admin/view_new/vodops/index.html',
    'addons/vodops/backend/DoubanController.php',
    'addons/vodops/bin/vodops-worker.php',
    'addons/vodops/service/DoubanAiReviewer.php',
    'addons/vodops/service/DoubanActionException.php',
    'addons/vodops/service/DoubanData.php',
    'addons/vodops/service/DoubanGateway.php',
    'addons/vodops/service/DoubanMatcher.php',
    'addons/vodops/service/VodQualityAnalyzer.php',
    'addons/vodops/service/VodQualityRepair.php',
    'addons/vodops/service/VodQualityScanner.php',
    'addons/vodops/view/index/index.html',
];
foreach ($required as $file) {
    if (!is_file($root . '/' . $file)) {
        vodops_contract_fail('Missing vodops release file: ' . $file);
    }
}

$info = file_get_contents($root . '/addons/vodops/info.ini');
vodops_contract_match('/^name\s*=\s*vodops$/m', $info, 'Vodops info.ini must declare the lowercase addon ID.');
vodops_contract_match('/^url\s*=\s*$/m', $info, 'Vodops must not declare a public addon route.');
if (is_file($root . '/addons/vodops/controller/Index.php')) {
    vodops_contract_fail('Vodops must not ship a public addon controller.');
}
if (is_dir($root . '/addons/douban')) {
    vodops_contract_fail('Douban must be absorbed into the single vodops addon directory.');
}

$controller = file_get_contents($root . '/addons/vodops/application/admin/controller/Vodops.php');
vodops_contract_match('/class Vodops extends Base/', $controller, 'Vodops must use the native MacCMS admin controller base.');
vodops_contract_match('/isPost\(\).*isAjax\(\)/s', $controller, 'Vodops scan actions must require Ajax POST requests.');
vodops_contract_match('/public function deleteScan\(\)/', $controller, 'Vodops should expose an authenticated admin action for explicit result cleanup.');
foreach (['repairInfo', 'applyRepair', 'recheckIssue', 'rollbackRepair'] as $action) {
    vodops_contract_match('/public function ' . $action . '\(\)/', $controller, 'Vodops should expose the reviewed repair action: ' . $action);
}
vodops_contract_match('/catch \(VodQualityActionException \$e\)/', $controller, 'Expected category conflicts should remain actionable without exposing internal errors.');
vodops_contract_match('/catch \(VodQualityRepairException \$e\)/', $controller, 'Expected repair conflicts should remain actionable without exposing internal errors.');

$doubanController = file_get_contents($root . '/addons/vodops/backend/DoubanController.php');
vodops_contract_match('/class DoubanController extends Base/', $doubanController, 'Douban actions must inherit native MacCMS admin authorization.');
if (preg_match('/model\([\'\"]Admin[\'\"]\)->checkLogin/', $doubanController)) {
    vodops_contract_fail('Douban must not replace action authorization with a login-only check.');
}
vodops_contract_match('/instanceof DoubanActionException[\s\S]*?409/', $doubanController, 'Expected Douban conflicts should remain actionable.');
vodops_contract_match('/logFailure\(\'豆瓣操作\'[\s\S]*?豆瓣操作失败，请查看服务端日志/', $doubanController, 'Unexpected Douban failures must remain server-log only.');
vodops_contract_match('/trace\(/', $doubanController, 'Unexpected Douban failures must be written to the server log.');

$hook = file_get_contents($root . '/addons/vodops/Vodops.php');
if (strpos($hook, 'responseEnd') !== false || strpos($hook, 'runTrafficChunk') !== false) {
    vodops_contract_fail('Vodops must not query scan state from every front-end response.');
}

$view = file_get_contents($root . '/addons/vodops/application/admin/view_new/vodops/index.html');
vodops_contract_match('/application\/admin\/view_new\/public\/head/', $view, 'Vodops should reuse the native admin page head.');
vodops_contract_match('/X-CSRF-Token/', $view, 'Vodops Ajax requests should forward the native admin CSRF token.');
vodops_contract_match('/不会自动修复、删除、合并或优化/', $view, 'The read-only boundary should be visible in the admin page.');
vodops_contract_match('/只删除 VodOps 扫描结果，不会修改 mac_vod/', $view, 'Result deletion should state its exact non-source scope before confirmation.');
vodops_contract_match('/url\(\'vod\/info\',[\s\S]*?vod_id/', $view, 'Every issue should link to the native video editor.');
vodops_contract_match('/data-vodops-action="repair"/', $view, 'Supported terminal issues should expose the repair drawer.');
vodops_contract_match('/确认修改并复检/', $view, 'Repair writes must show an explicit preview and confirmation step.');
vodops_contract_match('/vodops\/rollbackRepair/', $view, 'The repair drawer should expose conditional rollback.');
vodops_contract_match('/status\'\] neq \'running\'[\s\S]*?vodops\/export/', $view, 'Running scans should not expose a misleading export link.');
vodops_contract_match('/id="vodopsScopeTypeId"[\s\S]*?scope_type_id/', $view, 'The scan form must expose an explicit category scope.');
vodops_contract_match('/scope_label/', $view, 'Scan history and progress should identify their frozen category scope.');
vodops_contract_match('/history\.scope_label\|htmlspecialchars/', $view, 'Persisted category labels must be escaped in scan history.');
vodops_contract_match('/id="vodopsWorkerMode"[\s\S]*?worker_mode/', $view, 'The administrator must explicitly control CLI worker continuation.');
vodops_contract_match('/runner_state_label/', $view, 'The admin page should expose worker heartbeat and recovery state.');
vodops_contract_match('/douban\/index/', $view, 'The unified navigation should expose the absorbed Douban module.');
$doubanView = file_get_contents($root . '/addons/vodops/view/index/index.html');
vodops_contract_match('/X-CSRF-Token/', $doubanView, 'Douban Ajax requests should forward the native admin CSRF token when available.');
if (preg_match('/\{volist\s+name="issue_types"/', $view)) {
    vodops_contract_fail('Associative issue type maps must use foreach because ThinkPHP volist applies modulo to string keys on PHP 8.');
}
if (substr_count($view, '{foreach name="issue_types" item="label" key="key"}') !== 2) {
    vodops_contract_fail('Both issue type selectors must iterate the associative map with foreach.');
}

$sql = file_get_contents($root . '/addons/vodops/install.sql');
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
    vodops_contract_match('/CREATE TABLE IF NOT EXISTS `__PREFIX__' . $table . '`/', $sql, 'Missing additive table: ' . $table);
}
if (substr_count($sql, 'ENGINE=InnoDB') !== 12) {
    vodops_contract_fail('Every integrated plugin table must use InnoDB.');
}
vodops_contract_match('/`guard_json` text NULL/', $sql, 'Repair audits must preserve dependency guards used for safe rollback.');
vodops_contract_match('/INSERT IGNORE INTO `__PREFIX__vodops_lock`[\s\S]*?scan_start/', $sql, 'The scan-start mutex row should be installed idempotently.');
vodops_contract_match('/`scope_json` text NULL/', $sql, 'New scan tables must persist their frozen category scope.');
vodops_contract_match('/`execution_mode` varchar\(16\) NOT NULL DEFAULT \'manual\'/', $sql, 'New scans must default to page-only execution.');
vodops_contract_match('/`lease_until` int\(10\) unsigned NOT NULL DEFAULT 0/', $sql, 'Traffic workers need an expiring concurrency lease.');
vodops_contract_match('/`next_run_at` int\(10\) unsigned NOT NULL DEFAULT 0/', $sql, 'Traffic workers should throttle follow-up chunks.');
vodops_contract_match('/information_schema\.COLUMNS[\s\S]*?COLUMN_NAME = \'scope_json\'[\s\S]*?ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `scope_json` text NULL/', $sql, 'Existing installations must add only the missing scope column idempotently.');
if (substr_count($sql, 'UPDATE `__PREFIX__douban_config`') !== 1) {
    vodops_contract_fail('The integrated installer must retain exactly one legacy endpoint migration.');
}
$sqlWithoutEndpointMigration = str_replace('UPDATE `__PREFIX__douban_config`', '', $sql);
if (preg_match('/\b(?:DROP|DELETE|UPDATE|OPTIMIZE|REPAIR|RENAME|TRUNCATE)\b/i', $sqlWithoutEndpointMigration)) {
    vodops_contract_fail('Vodops install.sql must not perform destructive data or table migrations.');
}
foreach (['execution_mode', 'lease_until', 'next_run_at'] as $column) {
    vodops_contract_match('/information_schema\.COLUMNS[\s\S]*?COLUMN_NAME = \'' . $column . '\'[\s\S]*?ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `' . $column . '`/', $sql, 'Existing installations must add worker column idempotently: ' . $column);
}
$schema = include $root . '/addons/vodops/schema.php';
foreach ([
    'douban_config' => ['config_key', 'config_value', 'updated_at'],
    'douban_vod_meta' => ['vod_id', 'douban_id', 'douban_review_status', 'douban_ignore_until', 'updated_at'],
    'douban_task' => ['task_id', 'vod_id', 'task_type', 'status', 'run_after', 'attempts', 'payload', 'updated_at'],
    'douban_log' => ['log_id', 'vod_id', 'action', 'old_values', 'new_values', 'reason', 'operator', 'created_at'],
    'douban_review_candidate' => ['id', 'vod_id', 'douban_id', 'score_total', 'score_detail', 'conflicts', 'rank'],
    'douban_scan' => ['scan_id', 'status', 'high_water_vod_id', 'cursor_vod_id', 'batch_lock_until'],
    'douban_scan_issue' => ['issue_id', 'scan_id', 'vod_id', 'issue_code', 'snapshot'],
] as $table => $requiredColumns) {
    if (!isset($schema[$table]) || array_diff($requiredColumns, $schema[$table])) {
        vodops_contract_fail('Douban compatibility schema is incomplete for ' . $table);
    }
}
foreach ($schema as $table => $requiredColumns) {
    if (!preg_match('/CREATE TABLE IF NOT EXISTS `__PREFIX__' . $table . '` \(([\s\S]*?)\) ENGINE=InnoDB/', $sql, $tableMatch)) {
        vodops_contract_fail('Douban compatibility schema has no matching install table: ' . $table);
    }
    preg_match_all('/^\s*`([a-z_]+)`\s+/m', $tableMatch[1], $columnMatches);
    if (($columnMatches[1] ?? []) !== $requiredColumns) {
        vodops_contract_fail('Douban compatibility schema must exactly match install.sql columns for ' . $table);
    }
}

$doubanData = file_get_contents($root . '/addons/vodops/service/DoubanData.php');
vodops_contract_match('/ACTION_AUTO_SYNC_PENDING/', $doubanData, 'Douban source writes must create a pending audit first.');
vodops_contract_match('/conditionalVodUpdate\(\$vodId, \$oldValues, \$updates\)/', $doubanData, 'Douban source writes must use audited old values as optimistic guards.');
vodops_contract_match('/ACTION_AUTO_SYNC_CONFLICT/', $doubanData, 'Rejected stale Douban writes must remain auditable.');
vodops_contract_match('/failureMessage\(\$e, \'任务执行失败，请查看服务端日志\'\)[\s\S]*?\'last_error\'\s*=>\s*\$message/', $doubanData, 'Worker task state must not expose unexpected backend exception details.');
vodops_contract_match('/failureMessage\(\$e, \'体检批次执行失败，请查看服务端日志\'\)[\s\S]*?\'error_message\'\s*=>\s*\$failureMessage/', $doubanData, 'Audit task state must not expose unexpected backend exception details.');
vodops_contract_match('/withEnqueueLock[\s\S]*?LOCK_TABLE[\s\S]*?lock\(true\)/', $doubanData, 'Concurrent task generation must serialize on the plugin lock table.');
vodops_contract_match('/TASK_CALIBRATE\s*=\s*\'CALIBRATE_SCORE\'/', $doubanData, 'Score calibration must use the bounded task queue.');
if (preg_match('/UPDATE \{\$vodTable\} SET vod_(?:douban_)?score/', $doubanData)) {
    vodops_contract_fail('Score calibration must not execute whole-table score updates.');
}
$allowedAlterColumns = ['scope_json', 'execution_mode', 'lease_until', 'next_run_at'];
preg_match_all('/ALTER TABLE `__PREFIX__vodops_scan` ADD COLUMN `([a-z_]+)`/', $sql, $alterMatches);
if (($alterMatches[1] ?? []) !== $allowedAlterColumns) {
    vodops_contract_fail('Vodops upgrades may only add the documented scan scope and worker columns.');
}

$scanner = file_get_contents($root . '/addons/vodops/service/VodQualityScanner.php');
if (strpos($scanner, 'class VodQualityExportException extends \\RuntimeException') === false) {
    vodops_contract_fail('Expected export validation should use a dedicated safe exception type.');
}
vodops_contract_match('/private const LOCK_TABLE = \'vodops_lock\';/', $scanner, 'Vodops should use its own transactional lock table.');
vodops_contract_match('/public static function startScan[\s\S]*?Db::startTrans\(\)[\s\S]*?self::LOCK_TABLE[\s\S]*?->lock\(true\)/', $scanner, 'Concurrent scan starts should serialize on the plugin lock row.');
vodops_contract_match('/normalizeExecutionMode\(\$active\[\'execution_mode\'\][\s\S]*?!== \$executionMode[\s\S]*?\'execution_mode\' => \$executionMode/', $scanner, 'Resuming the same scope should honor an explicit switch between page-only and worker execution.');
vodops_contract_match('/public static function runWorker\(\$maxChunks[\s\S]*?runWorkerChunk\(\)/', $scanner, 'The CLI worker should process a bounded number of chunks per invocation.');
vodops_contract_match('/public static function runWorkerChunk\(\)[\s\S]*?execution_mode[\s\S]*?traffic[\s\S]*?worker[\s\S]*?lease_until[\s\S]*?next_run_at[\s\S]*?->update\(\[[\s\S]*?lease_until/', $scanner, 'Workers should atomically claim new and legacy automatic scans with an expiring lease.');
vodops_contract_match('/releaseWorkerLease[\s\S]*?where\(\'lease_until\', \$claimedUntil\)/', $scanner, 'Only the worker that owns a lease may release it.');
vodops_contract_match('/WORKER_LEASE_SECONDS/', $scanner, 'Worker leases must have a bounded stale-recovery timeout.');
vodops_contract_match('/public static function ensureScheduledScan[\s\S]*?self::LOCK_TABLE[\s\S]*?->lock\(true\)[\s\S]*?execution_mode[\s\S]*?worker/', $scanner, 'Periodic scan creation must recheck due state under the scan-start mutex.');
vodops_contract_match('/class VodQualityActionException extends \\\\RuntimeException/', $scanner, 'Expected category selection failures should use a dedicated safe exception type.');
vodops_contract_match('/scope_json/', $scanner, 'Every scan must persist its frozen category scope.');
vodops_contract_match('/where\(\'type_id\', \'in\', \$scopeTypeIds\)/', $scanner, 'Category scans must filter by resolved type IDs rather than the potentially incorrect parent field.');
vodops_contract_match('/where\(\'vod_id\', \'\>\', intval\(\$scan\[\'last_vod_id\'\]/', $scanner, 'Vodops should scan by an indexed vod_id cursor.');
vodops_contract_match('/MAX_BATCH_SIZE = 1000/', $scanner, 'Vodops must bound each scan request.');
vodops_contract_match('/EXPORT_LIMIT = 50000/', $scanner, 'Vodops must bound in-memory CSV exports.');
vodops_contract_match('/private static function cleanupFingerprints\(\$runId\)/', $scanner, 'Completed or cancelled scans should release temporary duplicate fingerprints.');
vodops_contract_match('/Db::name\(self::FINGERPRINT_TABLE\)[\s\S]*?->delete\(\)/', $scanner, 'Fingerprint cleanup should only delete plugin-owned temporary rows.');
if (substr_count($scanner, 'self::cleanupFingerprints(') < 3) {
    vodops_contract_fail('Fingerprint cleanup must cover both completion paths and cancellation.');
}
vodops_contract_match('/\$newIssueCount\s*=\s*count\(\$issueRows\)\s*\+\s*self::recordDuplicateIssues/', $scanner, 'Chunk progress should update issue totals incrementally.');
if (preg_match('/\'issue_count\'\s*=>\s*intval\(Db::name\(self::ISSUE_TABLE\)/', $scanner)) {
    vodops_contract_fail('Scan progress must not recount the full issue table after every batch.');
}
vodops_contract_match('/public static function cancelScan[\s\S]*?Db::startTrans\(\)[\s\S]*?->lock\(true\)[\s\S]*?Db::commit\(\)/', $scanner, 'Cancellation should serialize with an in-flight scan chunk.');
if (!preg_match('/public static function deleteScan\(\$runId, \$adminId\)([\s\S]*?)public static function listScans/', $scanner, $deleteMatch)) {
    vodops_contract_fail('Vodops should implement explicit scan-result deletion.');
}
$deleteBody = $deleteMatch[1];
vodops_contract_match('/status[\s\S]*?running[\s\S]*?RuntimeException/', $deleteBody, 'A running scan must not be deletable.');
foreach (['ISSUE_TABLE', 'FINGERPRINT_TABLE', 'SCAN_TABLE'] as $tableConstant) {
    vodops_contract_match('/Db::name\(self::' . $tableConstant . '\)[\s\S]*?->delete\(\)/', $deleteBody, 'Result deletion should clean ' . $tableConstant . '.');
}
if (preg_match('/Db::name\([\'\"](?:vod|type)[\'\"]\)[\s\S]*?->delete\(\)/', $deleteBody)) {
    vodops_contract_fail('Result deletion must never delete MacCMS source rows.');
}
vodops_contract_match('/duration_label/', $scanner, 'Scan records should expose a human-readable duration.');
vodops_contract_match('/source_missing_count/', $scanner, 'Completed scans should expose rows missing from the bounded source range.');
vodops_contract_match('/PUBLIC_SCAN_ERROR/', $scanner, 'Scan responses should expose only a stable public failure message.');
if (preg_match('/\'error_message\'\s*=>\s*VodQualityAnalyzer::sanitizeValue\(\$e->getMessage/', $scanner)) {
    vodops_contract_fail('Raw scan exceptions must remain server-log only.');
}
vodops_contract_match('/exportIssues[\s\S]*?status[\s\S]*?running[\s\S]*?VodQualityExportException/', $scanner, 'Direct exports should reject running scans.');
vodops_contract_match('/detail_label/', $scanner, 'Structured issue evidence should be prepared for the admin view.');
vodops_contract_match('/deleteScan\(\$runId, \$adminId\)/', $scanner, 'Result deletion should retain the acting admin for audit logging.');
vodops_contract_match('/trace\([\s\S]*?deleted scan/', $scanner, 'Successful result deletion should leave a server audit log.');

$repair = file_get_contents($root . '/addons/vodops/service/VodQualityRepair.php');
vodops_contract_match('/class VodQualityRepairException extends \\\\RuntimeException/', $repair, 'Expected repair validation should use a dedicated safe exception type.');
vodops_contract_match('/private const REPAIR_TABLE = \'vodops_repair_log\';/', $repair, 'Source writes must have a dedicated repair audit table.');
vodops_contract_match('/private const SUPPORTED_ISSUES = \[[\s\S]*?type_parent_mismatch[\s\S]*?poster_file_missing/', $repair, 'The first repair release should use an explicit issue whitelist.');
preg_match('/private const SUPPORTED_ISSUES = \[([\s\S]*?)\];/', $repair, $supportedRepairMatch);
$supportedRepairBlock = $supportedRepairMatch[1] ?? '';
foreach (['play_source_missing', 'play_group_mismatch', 'exact_duplicate'] as $unsafeType) {
    if (strpos($supportedRepairBlock, "'" . $unsafeType . "'") !== false) {
        vodops_contract_fail('High-risk issue types must not enter the first write whitelist: ' . $unsafeType);
    }
}
vodops_contract_match('/createAudit\([\s\S]*?conditionalVodUpdate/', $repair, 'The original value audit must be created before a MyISAM source update.');
vodops_contract_match('/conditionalVodUpdate[\s\S]*?foreach \(\$expected as \$field => \$value\)[\s\S]*?->where\(\$field, \$value\)[\s\S]*?->update\(\$updates\)/', $repair, 'Every source write must use audited old values as an optimistic guard.');
vodops_contract_match('/latestMutationForIssue[\s\S]*?不能覆盖后续结果/', $repair, 'Rollback must refuse to overwrite a later repair.');
vodops_contract_match('/hasIssue\([\s\S]*?即时复检/', $repair, 'A successful source write must be rechecked with the analyzer.');

$packageScript = file_get_contents($root . '/scripts/package-theme.mjs');
vodops_contract_match('/vodops/', $packageScript, 'The package script must build the vodops archive.');
$releaseVerifier = file_get_contents($root . '/scripts/verify-release.mjs');
vodops_contract_match('/vodops\.tar\.gz/', $releaseVerifier, 'Release verification must inspect the vodops archive.');
$deployScript = file_get_contents($root . '/scripts/deploy-theme.sh');
if (strpos($deployScript, 'str_starts_with') !== false) {
    vodops_contract_fail('Remote deployment snippets must not require PHP 8 string helpers.');
}
vodops_contract_match('/VODOPS_ADDON_NAME="vodops"/', $deployScript, 'SSH deployment must name the vodops addon explicitly.');
vodops_contract_match('/DEPLOY_SCOPE="\$\{DEPLOY_SCOPE:-all\}"/', $deployScript, 'SSH deployment must support an explicit scoped release.');
vodops_contract_match('/if \[\[ "\$DEPLOY_SCOPE" == "vodops" \]\]/', $deployScript, 'Vodops-only deployment must have an explicit remote branch.');
vodops_contract_match('/application\/extra\/quickmenu\.php/', $deployScript, 'SSH deployment must add the native admin shortcut safely.');
vodops_contract_match('/hooks[\s\S]*?response_end[\s\S]*?array_filter[\s\S]*?Vodops response_end hook removal failed/', $deployScript, 'SSH deployment must remove the obsolete per-response worker hook without touching other addons.');
vodops_contract_match('/for required_file in[\s\S]*?"bin\/vodops-worker\.php"[\s\S]*?Uploaded vodops archive is missing/', $deployScript, 'Remote installation must require the CLI worker.');
vodops_contract_match('/crontab -l[\s\S]*?flock[\s\S]*?vodops-worker[\s\S]*?crontab/', $deployScript, 'SSH deployment must install an idempotent single-instance worker cron entry.');
vodops_contract_match('/install_vodops_addon\(\)[\s\S]*?install_vodops_worker_cron preflight[\s\S]*?rm -rf "\$addon_dir"/', $deployScript, 'Cron availability must be checked before the remote addon is replaced.');
vodops_contract_match('/scan_start[\s\S]*?mutex row verification failed/', $deployScript, 'SSH deployment must verify the installed scan mutex row.');
vodops_contract_match('/douban_enqueue[\s\S]*?mutex row verification failed/', $deployScript, 'SSH deployment must verify the task-enqueue mutex row.');
vodops_contract_match('/VodOps Douban schema preflight failed/', $deployScript, 'SSH deployment must report incompatible legacy Douban tables before replacement.');
vodops_contract_match('/VODOPS_STAGED_ADDON[\s\S]*?SELECT ENGINE FROM information_schema\.TABLES[\s\S]*?information_schema\.COLUMNS[\s\S]*?array_diff/', $deployScript, 'The preflight must check existing table engines and required columns from the staged manifest.');
$vodopsInstallStart = strpos($deployScript, 'install_vodops_addon()');
$vodopsPreflight = strpos($deployScript, 'VodOps Douban schema preflight failed', $vodopsInstallStart);
$vodopsReplace = strpos($deployScript, 'rm -rf "$addon_dir"', $vodopsInstallStart);
if ($vodopsPreflight === false || $vodopsReplace === false || $vodopsPreflight > $vodopsReplace) {
    vodops_contract_fail('Douban schema preflight must run before replacing the installed addon.');
}
vodops_contract_match('/COLUMN_NAME = \?[\s\S]*?scope_json[\s\S]*?scope column verification failed/', $deployScript, 'SSH deployment must verify the category-scope migration.');
foreach (['execution_mode', 'lease_until', 'next_run_at'] as $column) {
    vodops_contract_match('/COLUMN_NAME = \?[\s\S]*?' . $column . '/', $deployScript, 'SSH deployment must verify worker column: ' . $column);
}
vodops_contract_match('/vodops_repair_log/', $deployScript, 'SSH deployment must verify the repair audit table.');
foreach (['douban_vod_meta', 'douban_task', 'douban_log', 'douban_review_candidate', 'douban_scan', 'douban_scan_issue'] as $table) {
    vodops_contract_match('/' . $table . '/', $deployScript, 'SSH deployment must verify the retained Douban table: ' . $table);
}
vodops_contract_match('/application\/admin\/controller\/Douban\.php/', $deployScript, 'SSH deployment must install the legacy-compatible Douban admin route from VodOps.');
vodops_contract_match('/legacy_douban_dir="\$maccms_root\/addons\/douban"[\s\S]*?\.vodops-deploy-state[\s\S]*?cp -a "\$legacy_douban_dir" "\$state_dir\/addons\/douban"[\s\S]*?rm -rf "\$legacy_douban_dir"/', $deployScript, 'SSH deployment must snapshot and retire the standalone Douban addon after it has been absorbed.');
vodops_contract_match('/legacy_index_controller_target="\$maccms_root\/application\/index\/controller\/Douban\.php"[\s\S]*?rm -f "\$legacy_index_controller_target"/', $deployScript, 'SSH deployment must snapshot and remove the obsolete public Douban bridge.');
$rollbackScript = file_get_contents($root . '/scripts/rollback-theme.sh');
vodops_contract_match('/\.vodops-deploy-state[\s\S]*?state_dir\/addons\/douban[\s\S]*?restore_optional_file/', $rollbackScript, 'Vodops rollback must understand the pre-merge two-addon snapshot.');
vodops_contract_match('/application\/index\/controller\/Douban\.php/', $rollbackScript, 'Vodops rollback must restore the legacy public bridge only when it existed before deployment.');
$packageJson = json_decode(file_get_contents($root . '/package.json'), true);
if (($packageJson['scripts']['deploy:vodops'] ?? '') !== 'DEPLOY_SCOPE=vodops bash scripts/deploy-theme.sh') {
    vodops_contract_fail('package.json must expose a Vodops-only deployment command.');
}
$ci = file_get_contents($root . '/.github/workflows/ci.yml');
vodops_contract_match('/name: vodops-addon[\s\S]*path: dist\/vodops\.tar\.gz/', $ci, 'CI must publish vodops as a separate artifact.');
$docs = file_get_contents($root . '/docs/addons.md');
vodops_contract_match('/`vodops`/', $docs, 'The current addon index must document vodops.');

$config = file_get_contents($root . '/addons/vodops/config.php');
foreach (['scheduled_scan_hours', 'scheduled_scope_type_id', 'scheduled_batch_size'] as $setting) {
    vodops_contract_match('/\'name\' => \'' . $setting . '\'/', $config, 'Vodops config must expose periodic scan setting: ' . $setting);
}

$worker = file_get_contents($root . '/addons/vodops/bin/vodops-worker.php');
vodops_contract_match('/PHP_SAPI[\s\S]*?cli/', $worker, 'Vodops worker must reject web execution.');
vodops_contract_match('/thinkphp[\s\S]*?base\.php[\s\S]*?App::initCommon/', $worker, 'Vodops worker must initialize the native MacCMS runtime without dispatching a web route.');
vodops_contract_match('/ensureScheduledScan[\s\S]*?runWorker/', $worker, 'Vodops worker must create due configured scans before processing chunks.');

echo "Vodops release contract tests passed\n";
