<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
$usage = "Usage: php addons/vodmerge/bin/assess.php --work [--max-seconds=20]\n"
    . "Classifies saved audit evidence in bounded batches; writes plugin issue records only. Does not rescan, modify videos or call AI.\n";
$work = false;
$seconds = 20;
foreach (array_slice($argv, 1) as $argument) {
    if ($argument === '--help') {
        echo $usage;
        exit(0);
    }
    if ($argument === '--work') {
        $work = true;
    } elseif (preg_match('/^--max-seconds=([0-9]+)$/D', $argument, $match) && (int) $match[1] >= 1 && (int) $match[1] <= 50) {
        $seconds = (int) $match[1];
    } else {
        fwrite(STDERR, "参数错误或执行预算超出范围。\n" . $usage);
        exit(2);
    }
}
if (!$work) {
    echo $usage;
    exit(0);
}
require __DIR__ . '/cli-bootstrap.php';
try {
    $lock = @fopen(RUNTIME_PATH . 'vodmerge-assess.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        echo "assessment_worker=busy\n";
        exit(0);
    }
    $audit = \addons\vodmerge\service\Runtime::audit();
    $deadline = microtime(true) + $seconds;
    $processed = 0;
    $skipped = 0;
    do {
        $result = $audit->assessBatch();
        $processed += $result['processed'];
        $skipped += $result['skipped'];
        if ($result['remaining'] === 0 || $result['processed'] === 0) {
            break;
        }
    } while (microtime(true) < $deadline);
    flock($lock, LOCK_UN);
    fclose($lock);
    echo \addons\vodmerge\service\Payload::json(['processed' => $processed, 'remaining' => $result['remaining'],
        'skipped' => $skipped, 'assessment_version' => \addons\vodmerge\service\AuditMatch::VERSION]) . "\n";
} catch (\Throwable $error) {
    error_log('[vodmerge] Audit assessment failed: ' . get_class($error));
    fwrite(STDERR, "历史结果分级本次未完成，已保存的分级保留，请检查排查数据表升级后重试。\n");
    exit(1);
}
