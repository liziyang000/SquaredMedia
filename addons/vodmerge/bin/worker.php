<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
if (in_array('--help', $argv, true)) {
    echo "Usage: php addons/vodmerge/bin/worker.php [--limit=1..10]\nRun as the PHP site owner, once per minute.\n";
    exit(0);
}
$limit = 1;
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/^--limit=([1-9]|10)$/D', $argument, $match)) {
        fwrite(STDERR, "参数错误，请使用 --help。\n");
        exit(2);
    }
    $limit = (int) $match[1];
}
require __DIR__ . '/cli-bootstrap.php';
try {
    $lock = fopen(RUNTIME_PATH . 'vodmerge-worker.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        exit(0);
    }
    $result = \addons\vodmerge\service\Runtime::service()->run($limit, \addons\vodmerge\service\Runtime::autoBound(), \addons\vodmerge\service\Runtime::autoFirst());
    if ($result) {
        \addons\vodmerge\service\Runtime::invalidate();
        echo \addons\vodmerge\service\Payload::json($result) . "\n";
    }
    flock($lock, LOCK_UN);
    fclose($lock);
} catch (\Throwable $error) {
    error_log('[vodmerge] Worker failed: ' . get_class($error));
    fwrite(STDERR, "Worker 未完成，请检查安装、目录权限和任务快照。\n");
    exit(1);
}
