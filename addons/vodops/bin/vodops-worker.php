<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

function vodopsWorkerUsage()
{
    return "VodOps CLI Worker\n"
        . "Usage: php addons/vodops/bin/vodops-worker.php [options]\n\n"
        . "Options:\n"
        . "  --max-chunks=N   Process 1-100 chunks (default: 20).\n"
        . "  --max-seconds=N  Run for at most 1-300 seconds (default: 50).\n"
        . "  --help           Show this help.\n\n"
        . "Run once per minute from Cron; an external flock prevents overlapping processes.\n";
}

function vodopsWorkerArgumentError($message)
{
    fwrite(STDERR, $message . "\n\n" . vodopsWorkerUsage());
    exit(2);
}

$budgets = [
    'max-chunks' => ['value' => 20, 'min' => 1, 'max' => 100],
    'max-seconds' => ['value' => 50, 'min' => 1, 'max' => 300],
];
$arguments = array_slice($argv, 1);
for ($index = 0; $index < count($arguments); $index++) {
    $argument = (string) $arguments[$index];
    if ($argument === '--help' || $argument === '-h') {
        fwrite(STDOUT, vodopsWorkerUsage());
        exit(0);
    }
    if (!preg_match('/^--(max-chunks|max-seconds)(?:=(.*))?$/', $argument, $match)) {
        vodopsWorkerArgumentError('Unknown option: ' . $argument);
    }
    $name = $match[1];
    $value = isset($match[2]) && $match[2] !== '' ? $match[2] : null;
    if ($value === null && isset($arguments[$index + 1])) {
        $value = (string) $arguments[++$index];
    }
    if ($value === null || !preg_match('/^[0-9]+$/', $value)) {
        vodopsWorkerArgumentError('--' . $name . ' requires an integer value.');
    }
    $number = intval($value);
    if ($number < $budgets[$name]['min'] || $number > $budgets[$name]['max']) {
        vodopsWorkerArgumentError(
            '--' . $name . ' must be between ' . $budgets[$name]['min'] . ' and ' . $budgets[$name]['max'] . '.'
        );
    }
    $budgets[$name]['value'] = $number;
}

$root = dirname(__DIR__, 3);
$baseFile = $root . '/thinkphp/base.php';
if (!is_file($baseFile) || !is_dir($root . '/application')) {
    fwrite(STDERR, "VodOps worker must run from an installed MacCMS site.\n");
    exit(1);
}
if (!chdir($root)) {
    fwrite(STDERR, "VodOps worker could not enter the MacCMS root.\n");
    exit(1);
}

defined('ROOT_PATH') || define('ROOT_PATH', $root . DIRECTORY_SEPARATOR);
defined('APP_PATH') || define('APP_PATH', ROOT_PATH . 'application' . DIRECTORY_SEPARATOR);
defined('MAC_COMM') || define('MAC_COMM', APP_PATH . 'common/common/');
defined('MAC_HOME_COMM') || define('MAC_HOME_COMM', APP_PATH . 'index/common/');
defined('MAC_ADMIN_COMM') || define('MAC_ADMIN_COMM', APP_PATH . 'admin/common/');
defined('MAC_START_TIME') || define('MAC_START_TIME', microtime(true));
defined('ENTRANCE') || define('ENTRANCE', 'cli');
defined('IN_FILE') || define('IN_FILE', '/addons/vodops/bin/vodops-worker.php');

$_SERVER += [
    'HTTP_HOST' => 'localhost',
    'REQUEST_METHOD' => 'CLI',
    'REQUEST_URI' => '/vodops-worker',
    'SCRIPT_FILENAME' => __FILE__,
    'SCRIPT_NAME' => '/addons/vodops/bin/vodops-worker.php',
];

try {
    require $baseFile;
    \think\App::initCommon();
    require_once dirname(__DIR__) . '/service/VodQualityAnalyzer.php';
    require_once dirname(__DIR__) . '/service/VodQualityScanner.php';

    $config = function_exists('get_addon_config') ? get_addon_config('vodops') : [];
    $config = is_array($config) ? $config : [];
    $items = include dirname(__DIR__) . '/config.php';
    foreach (is_array($items) ? $items : [] as $item) {
        if (is_array($item) && isset($item['name'])) {
            if (!array_key_exists((string) $item['name'], $config)) {
                $config[(string) $item['name']] = $item['value'] ?? '';
            }
        }
    }
    $scheduled = ['created' => false];
    $scheduledHours = intval($config['scheduled_scan_hours'] ?? 0);
    if ($scheduledHours > 0) {
        $scheduledHours = max(1, min(720, $scheduledHours));
        $scheduled = \addons\vodops\service\VodQualityScanner::ensureScheduledScan(
            $scheduledHours * 3600,
            max(0, intval($config['scheduled_scope_type_id'] ?? 0)),
            max(100, min(1000, intval($config['scheduled_batch_size'] ?? 500)))
        );
    }

    $result = \addons\vodops\service\VodQualityScanner::runWorker(
        $budgets['max-chunks']['value'],
        $budgets['max-seconds']['value']
    );
    if (!empty($scheduled['created']) || intval($result['chunks'] ?? 0) > 0) {
        $scan = is_array($result['scan'] ?? null) ? $result['scan'] : ($scheduled['scan'] ?? []);
        fwrite(STDOUT, json_encode([
            'scheduled' => !empty($scheduled['created']),
            'chunks' => intval($result['chunks'] ?? 0),
            'run_id' => intval($scan['run_id'] ?? 0),
            'status' => (string) ($scan['status'] ?? ''),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    }
} catch (\Throwable $error) {
    error_log('[vodops] CLI worker failed: ' . $error->getMessage());
    fwrite(STDERR, "VodOps worker failed; see the server error log.\n");
    exit(1);
}
