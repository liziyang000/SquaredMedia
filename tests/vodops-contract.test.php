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
    'addons/vodops/service/VodPosterCandidate.php',
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
vodops_contract_match('/workspace[\s\S]*?DoubanData::dashboard\(\)/', $controller, 'The native Vodops index must load the absorbed Douban module in the same workbench.');

$doubanController = file_get_contents($root . '/addons/vodops/backend/DoubanController.php');
vodops_contract_match('/class DoubanController extends Base/', $doubanController, 'Douban actions must inherit native MacCMS admin authorization.');
if (preg_match('/model\([\'\"]Admin[\'\"]\)->checkLogin/', $doubanController)) {
    vodops_contract_fail('Douban must not replace action authorization with a login-only check.');
}
vodops_contract_match('/instanceof DoubanActionException[\s\S]*?409/', $doubanController, 'Expected Douban conflicts should remain actionable.');
vodops_contract_match('/logFailure\(\'豆瓣操作\'[\s\S]*?豆瓣操作失败，请查看服务端日志/', $doubanController, 'Unexpected Douban failures must remain server-log only.');
vodops_contract_match('/trace\(/', $doubanController, 'Unexpected Douban failures must be written to the server log.');
vodops_contract_match('/public function index\(\)[\s\S]*?redirect\(url\(\'vodops\/index\',[\s\S]*?workspace[\s\S]*?douban/', $doubanController, 'The legacy Douban index must redirect to the single Vodops workbench.');
if (preg_match('/fetch\([\'"]index\/index/', $doubanController)) {
    vodops_contract_fail('The integrated addon must not render a second standalone Douban workbench.');
}
if (strpos($doubanController, 'view_path') !== false) {
    vodops_contract_fail('Legacy Douban actions must not configure a second private page renderer.');
}

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
vodops_contract_match('/workspace[\s\S]*?douban/', $view, 'The single workbench navigation should expose the absorbed Douban module.');
vodops_contract_match('/addons\/vodops\/view\/index\/index/', $view, 'The single native workbench should include the Douban module partial.');
$doubanView = file_get_contents($root . '/addons/vodops/view/index/index.html');
vodops_contract_match('/X-CSRF-Token/', $doubanView, 'Douban Ajax requests should forward the native admin CSRF token when available.');
if (preg_match('/<!doctype|<html|<body|豆瓣匹配工作台/i', $doubanView)) {
    vodops_contract_fail('The Douban module must be an embedded partial, not a second HTML workbench.');
}
if (preg_match('/url\(\'douban\/index\'/', $doubanView)) {
    vodops_contract_fail('Douban filters must stay on the single Vodops workbench route.');
}
vodops_contract_match('/\.douban-workspace \.system-box/', $doubanView, 'Embedded Douban styles must stay inside the module root.');
vodops_contract_match('/@keyframes douban-status-pulse/', $doubanView, 'Embedded Douban animations must use a module-specific name.');
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
vodops_contract_match('/endpointTarget\(\$url\)[\s\S]*?FILTER_FLAG_NO_PRIV_RANGE[\s\S]*?FILTER_FLAG_NO_RES_RANGE/', $doubanData, 'Custom Douban endpoints must reject private and reserved network targets.');
vodops_contract_match('/CURLOPT_RESOLVE/', $doubanData, 'Custom Douban requests must pin the validated DNS address.');
vodops_contract_match('/CURLOPT_FOLLOWLOCATION\s*=>\s*false/', $doubanData, 'Custom Douban requests must reject redirects.');
vodops_contract_match('/CUSTOM_ENDPOINT_MAX_BYTES/', $doubanData, 'Custom Douban responses must have a fixed size limit.');
vodops_contract_match('/REPAIR_CANDIDATE_MAX_RATE_WAIT_SECONDS\s*=\s*1[\s\S]*?repairCandidates[\s\S]*?fetchDouban(?:Data|Candidates)\([^;]*REPAIR_CANDIDATE_MAX_RATE_WAIT_SECONDS/', $doubanData, 'Interactive repair candidates must not wait behind an unbounded shared Douban queue.');
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
preg_match('/private const EXTERNAL_CANDIDATE_ISSUES = \[([\s\S]*?)\];/', $repair, $candidateIssueMatch);
$candidateIssueBlock = $candidateIssueMatch[1] ?? '';
foreach ([
    'year_missing' => 'vod_year',
    'year_invalid' => 'vod_year',
    'area_missing' => 'vod_area',
    'lang_missing' => 'vod_lang',
    'poster_missing' => 'vod_pic',
    'poster_file_missing' => 'vod_pic',
] as $issueType => $fieldName) {
    vodops_contract_match(
        "/'" . preg_quote($issueType, '/') . "'\\s*=>\\s*'" . preg_quote($fieldName, '/') . "'/",
        $candidateIssueBlock,
        'External candidate repair mapping is missing or unsafe for: ' . $issueType
    );
}
foreach (['type_parent_mismatch', 'play_source_missing', 'play_group_mismatch', 'exact_duplicate'] as $unsafeType) {
    if (strpos($candidateIssueBlock, "'" . $unsafeType . "'") !== false) {
        vodops_contract_fail('Non-metadata issue types must not search external candidates: ' . $unsafeType);
    }
}
vodops_contract_match('/candidateContext\([\s\S]*?EXTERNAL_CANDIDATE_ISSUES[\s\S]*?hasIssue[\s\S]*?field_name[\s\S]*?context_token/', $repair, 'Only live whitelisted metadata issues should expose a candidate context.');
vodops_contract_match('/candidateContextToken[\s\S]*?field_name[\s\S]*?vod_name[\s\S]*?vod_year[\s\S]*?\$snapshot\[\$field\]/', $repair, 'Candidate tokens must bind the title, release year, and current target field.');
vodops_contract_match('/candidateContextToken[\s\S]*?hash_equals[\s\S]*?重新搜索候选/', $repair, 'A selected external candidate must be rejected after its matching snapshot changes.');

$posterCandidate = file_get_contents($root . '/addons/vodops/service/VodPosterCandidate.php');
vodops_contract_match('/class VodPosterCandidate/', $posterCandidate, 'Poster searches should use a dedicated read-only service.');
vodops_contract_match('/collect_type[\s\S]*?collect_mid[\s\S]*?MAX_PROVIDERS/', $posterCandidate, 'Poster searches must stay bounded to enabled video collection providers.');
vodops_contract_match('/MAX_CANDIDATES_PER_PROVIDER[\s\S]*?providerCandidateCount/', $posterCandidate, 'One provider must not crowd out the manually reviewed candidate list.');
vodops_contract_match('/MAX_CANDIDATES\s*=\s*12[\s\S]*?PROVIDER_CONCURRENCY\s*=\s*8[\s\S]*?REQUEST_TIMEOUT_SECONDS\s*=\s*6/', $posterCandidate, 'Candidate fan-out and network timeouts must stay below the admin request budget.');
vodops_contract_match('/CURLOPT_PROXY[\s\S]*?CURLOPT_FOLLOWLOCATION[\s\S]*?CURLOPT_RESOLVE/', $posterCandidate, 'External poster requests must disable ambient proxies and pin validated public DNS targets without redirects.');
vodops_contract_match('/publicTarget[\s\S]*?static \$targetCache[\s\S]*?array_key_exists/', $posterCandidate, 'One candidate request should reuse validated DNS results for repeated image hosts.');
vodops_contract_match('/JSON_MAX_BYTES[\s\S]*?IMAGE_MAX_BYTES/', $posterCandidate, 'Provider JSON and poster probes must have explicit response limits.');
vodops_contract_match('/matchesImageMagic/', $posterCandidate, 'Poster candidates must verify image bytes instead of trusting Content-Type alone.');

$vodopsController = file_get_contents($root . '/addons/vodops/application/admin/controller/Vodops.php');
vodops_contract_match('/function posterCandidates\(\)[\s\S]*?guardAjaxPost[\s\S]*?VodPosterCandidate::search/', $vodopsController, 'Poster candidate lookup must stay behind the native Ajax POST guard.');
vodops_contract_match('/\$providerIds\s*=\s*\$this->providerIds\(input\(\'provider_ids\/a\',\s*\[\]\)\)/', $vodopsController, 'Candidate lookup must sanitize selected source IDs before invoking the search service.');
vodops_contract_match('/private function providerSelectionInitialized\([\s\S]*?is_bool\(\$value\)[\s\S]*?return \$value[\s\S]*?\$value === 1 \|\| \$value === \'1\'/', $vodopsController, 'Candidate lookup must normalize only boolean and explicit 0/1 initialization input to a strict boolean.');
vodops_contract_match('/VodPosterCandidate::search\(\s*intval\(input\(\'issue_id\/d\',\s*0\)\),\s*\$providerIds,\s*null,\s*null,\s*null,\s*\[\'provider_selection_initialized\'\s*=>\s*\$selectionInitialized\]\s*\)/', $vodopsController, 'Candidate lookup must pass sanitized source IDs as argument two and strict boolean initialization context as argument six.');
vodops_contract_match('/private function providerIds[\s\S]*?is_array[\s\S]*?preg_match[\s\S]*?2147483647[\s\S]*?count\(\$ids\) >= 8/', $vodopsController, 'Source ID cleaning must reject non-canonical values, deduplicate IDs, and bound the selection.');
vodops_contract_match('/errorJson\(\'搜索外部候选\'/', $vodopsController, 'Unexpected candidate-provider failures must use a generic public error.');
vodops_contract_match('/candidate_context[\s\S]*?VodQualityRepair::apply|VodQualityRepair::apply[\s\S]*?candidate_context/', $vodopsController, 'A selected poster candidate must carry its stale-data context into the guarded repair write.');

$vodopsView = file_get_contents($root . '/addons/vodops/application/admin/view_new/vodops/index.html');
vodops_contract_match('/id="vodopsPosterCandidates"/', $vodopsView, 'The repair drawer should expose a dedicated poster candidate region.');
vodops_contract_match('/vodops\/posterCandidates/', $vodopsView, 'Poster candidates should load asynchronously from the protected endpoint.');
vodops_contract_match('/candidate_context/', $vodopsView, 'The selected candidate context should be submitted only with the final reviewed repair.');
vodops_contract_match('/候选来源/', $vodopsView, 'The final confirmation should identify the selected external source.');
vodops_contract_match('/referrerPolicy[\s\S]*?no-referrer/', $vodopsView, 'External poster previews must not leak the admin URL as a referrer.');
vodops_contract_match('/external_candidates_supported[\s\S]*?loadCandidates/', $vodopsView, 'Year, area, language, and poster repairs should share the reviewed candidate flow.');
vodops_contract_match('/checkbox\.type = "checkbox"[\s\S]*?selectedProviderIds\(\)[\s\S]*?provider_ids\[\]/', $vodopsView, 'Collection sources must be explicitly selected before they are queried.');
vodops_contract_match('/providerSelectionInitialized\s*=\s*false[\s\S]*?function resetCandidates\(\)[\s\S]*?providerSelectionInitialized\s*=\s*false[\s\S]*?function renderCandidateProviders[\s\S]*?providerSelectionInitialized\s*=\s*true/', $vodopsView, 'Each repair drawer must start uninitialized until collection-source options have been rendered.');
vodops_contract_match('/function loadCandidates\(\)[\s\S]*?var selectionInitialized\s*=\s*providerSelectionInitialized[\s\S]*?data\.append\("provider_selection_initialized",\s*selectionInitialized\s*\?\s*"1"\s*:\s*"0"\)/', $vodopsView, 'Every candidate search must snapshot and send source-selection state even when no source ID is selected.');
vodops_contract_match('/function renderCandidateProviders[\s\S]*?providerSelectionInitialized\s*=\s*true[\s\S]*?candidateReload\.addEventListener\("click",\s*loadCandidates\)/', $vodopsView, 'A search repeated after source rendering must carry initialized state so manual all-unselected mode is preserved.');
foreach (['播放组推断', '默认可信', '手工模式'] as $selectionModeLabel) {
    if (strpos($vodopsView, $selectionModeLabel) === false) {
        vodops_contract_fail('The source selector must explain its selection modes: ' . $selectionModeLabel);
    }
}
if (strpos($vodopsView, '默认不启用') !== false) {
    vodops_contract_fail('The source selector must not claim that every collection source is disabled by default.');
}
vodops_contract_match('/敏感(?:采集)?源.{0,16}(?:不|不会)自动|(?:不|不会)自动.{0,16}敏感(?:采集)?源/', $vodopsView, 'The source selector must state that sensitive sources are never enabled automatically.');
vodops_contract_match('/repairValue\.addEventListener\("input"[\s\S]*?clearCandidateSelection\(true\)/', $vodopsView, 'Typing a value manually must discard candidate context and return the source to manual.');
vodops_contract_match('/manualRepairValue[\s\S]*?restoreManualValue[\s\S]*?repairValue\.value\s*=\s*manualRepairValue/', $vodopsView, 'Invalidating a selected candidate must restore the last manually reviewed value.');
vodops_contract_match('/checkbox\.addEventListener\("change"[\s\S]*?clearCandidateSelection\(true\)[\s\S]*?updateRepairDiff/', $vodopsView, 'Changing selected collection sources must invalidate the old candidate value and context.');
vodops_contract_match('/candidateKind === "poster"[\s\S]*?createElement\("img"\)/', $vodopsView, 'Only poster candidates should render remote image previews.');
vodops_contract_match('/preview\.referrerPolicy\s*=\s*"no-referrer"[\s\S]*?preview\.src\s*=/', $vodopsView, 'Poster previews must apply the no-referrer policy before assigning the remote URL.');
vodops_contract_match('/repairRequestSequence[\s\S]*?requestId !== repairRequestSequence[\s\S]*?info\.issue_id/', $vodopsView, 'Stale repair-info responses must not replace the active drawer issue.');
vodops_contract_match('/result\.issue_id[\s\S]*?候选响应与当前异常不一致/', $vodopsView, 'Candidate responses must identify the same issue before they are rendered.');
vodops_contract_match('/context_token[\s\S]*?\{64\}[\s\S]*?候选上下文无效/', $vodopsView, 'External candidates must carry a complete stale-data token before they can be selected.');
vodops_contract_match('/function abortRequest[\s\S]*?controller\.abort[\s\S]*?abortRequest\(candidateRequestController\)/', $vodopsView, 'Closing or replacing a candidate search should cancel the obsolete browser request when supported.');
vodops_contract_match('/function closeRepair\(\)[\s\S]*?repairBusy[\s\S]*?return/', $vodopsView, 'A repair drawer must not close while a confirmed mutation is still running.');
vodops_contract_match('/function closeRepair\(\)[\s\S]*?removeAttribute\("inert"[\s\S]*?repairReturnFocus\.focus/', $vodopsView, 'Closing the modal repair drawer must restore the background and prior focus.');
vodops_contract_match('/function openRepair\(issueId\)[\s\S]*?setAttribute\("inert"/', $vodopsView, 'Opening the modal repair drawer must isolate background controls.');
vodops_contract_match('/event\.key !== "Tab"[\s\S]*?repairFocusableElements[\s\S]*?last\.focus\(\)[\s\S]*?first\.focus\(\)/', $vodopsView, 'Keyboard focus must remain inside the open repair drawer.');
if (preg_match('/radio\.checked\s*=\s*true/', $vodopsView)) {
    vodops_contract_fail('External repair candidates must never be selected by default.');
}
if (strpos($vodopsView, 'candidate.selected') !== false) {
    vodops_contract_fail('The repair drawer must ignore any server-side candidate selection hint.');
}

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
vodops_contract_match('/\$singleWorkbenchRoutes[\s\S]*?vodops\/index[\s\S]*?admin\/vodops\/index[\s\S]*?douban\/index[\s\S]*?admin\/douban\/index/', $deployScript, 'SSH deployment must collapse every legacy Vodops and Douban shortcut route into one workbench entry.');
vodops_contract_match('/count\(array_keys\(\$verified, \$entry, true\)\) !== 1/', $deployScript, 'SSH deployment must verify that exactly one canonical workbench shortcut remains.');
vodops_contract_match('/workspace eq \'douban\'[\s\S]*?addons\/vodops\/view\/index\/index[\s\S]*?Vodops single-workbench verification failed/', $deployScript, 'SSH deployment must verify the installed unified view and reject a standalone Douban renderer.');
vodops_contract_match('/hooks[\s\S]*?response_end[\s\S]*?array_filter[\s\S]*?Vodops response_end hook removal failed/', $deployScript, 'SSH deployment must remove the obsolete per-response worker hook without touching other addons.');
vodops_contract_match('/for required_file in[\s\S]*?"bin\/vodops-worker\.php"[\s\S]*?Uploaded vodops archive is missing/', $deployScript, 'Remote installation must require the CLI worker.');
vodops_contract_match('/for required_file in[\s\S]*?"service\/VodPosterCandidate\.php"[\s\S]*?Uploaded vodops archive is missing/', $deployScript, 'Remote installation must require the poster candidate service.');
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
vodops_contract_match('/restore_vodops_deploy_snapshot\(\)[\s\S]*?quickmenu\.php[\s\S]*?application\/extra\/addons\.php[\s\S]*?crontab/', $deployScript, 'Automatic rollback must restore every non-database payload changed by the VodOps deployment.');
vodops_contract_match('/trap remote_deploy_exit EXIT[\s\S]*?vodops_auto_rollback_backup="\$backup_dir"[\s\S]*?rm -rf "\$addon_dir"/', $deployScript, 'Automatic rollback must be armed only after the snapshot and before addon replacement.');
vodops_contract_match('/install_vodops_worker_cron[\s\S]*?if \[\[ "\$DEPLOY_SCOPE" != "vodops" \]\]; then[\s\S]*?vodops_auto_rollback_backup=""/', $deployScript, 'Full deployment may disarm VodOps rollback only after Cron verification succeeds.');
vodops_contract_match('/verify_deployed_site\s+if \[\[ "\$DEPLOY_SCOPE" == "vodops" \]\]; then[\s\S]*?vodops_auto_rollback_backup=""/', $deployScript, 'Vodops-only deployment must remain rollback-protected through final site verification.');
vodops_contract_match('/verify_deployed_site\(\)[\s\S]*?--max-time 60/', $deployScript, 'Cold-cache site verification must allow the observed MacCMS template query to finish.');
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
$configRows = require $root . '/addons/vodops/config.php';
$configByName = [];
foreach ($configRows as $configRow) {
    if (is_array($configRow) && isset($configRow['name'])) {
        $configByName[(string) $configRow['name']] = $configRow;
    }
}
foreach (['candidate_follow_play_group', 'candidate_default_providers'] as $setting) {
    if (!isset($configByName[$setting])) {
        vodops_contract_fail('Vodops config must expose candidate-source setting: ' . $setting);
    }
}
if ((string) ($configByName['candidate_follow_play_group']['value'] ?? '') !== '1') {
    vodops_contract_fail('Playback-group candidate-source inference must be enabled by default.');
}
if (($configByName['candidate_follow_play_group']['type'] ?? '') !== 'radio') {
    vodops_contract_fail('Playback-group candidate-source inference must use a native MacCMS radio setting.');
}
$defaultProviders = trim((string) ($configByName['candidate_default_providers']['value'] ?? ''));
if ($defaultProviders === '') {
    vodops_contract_fail('Vodops config must provide a non-empty default trusted source-name list.');
}
$normalizedDefaultProviders = strtolower($defaultProviders);
foreach (['成人', '伦理', '情色', '福利', '18禁', '色情', '黄色', '搜av'] as $sensitiveKeyword) {
    if (strpos($normalizedDefaultProviders, $sensitiveKeyword) !== false) {
        vodops_contract_fail('Default trusted source names must exclude sensitive sources: ' . $sensitiveKeyword);
    }
}

$worker = file_get_contents($root . '/addons/vodops/bin/vodops-worker.php');
vodops_contract_match('/PHP_SAPI[\s\S]*?cli/', $worker, 'Vodops worker must reject web execution.');
vodops_contract_match('/thinkphp[\s\S]*?base\.php[\s\S]*?App::initCommon/', $worker, 'Vodops worker must initialize the native MacCMS runtime without dispatching a web route.');
vodops_contract_match('/ensureScheduledScan[\s\S]*?runWorker/', $worker, 'Vodops worker must create due configured scans before processing chunks.');

echo "Vodops release contract tests passed\n";
