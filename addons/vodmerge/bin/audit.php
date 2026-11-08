<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
$usage = "Usage: php addons/vodmerge/bin/audit.php [--status] [--start [--weekly|--no-weekly]] [--work [--max-chunks=10] [--max-seconds=20]]\n"
    . "Read-only video audit; writes audit records only. Run as the PHP site owner.\n";
$start = false;
$work = false;
$weekly = true;
$weeklySet = false;
$chunks = 10;
$seconds = 20;
$before = [];
foreach (array_slice($argv, 1) as $argument) {
    if ($argument === '--help') {
        echo $usage;
        exit(0);
    }
    if ($argument === '--status') {
        continue;
    }
    if ($argument === '--start') {
        $start = true;
    } elseif ($argument === '--work') {
        $work = true;
    } elseif ($argument === '--weekly' || $argument === '--no-weekly') {
        $weekly = $argument === '--weekly';
        $weeklySet = true;
    } elseif (preg_match('/^--max-(chunks|seconds)=([0-9]+)$/D', $argument, $match)) {
        $number = (int) $match[2];
        if ($number < 1 || $number > ($match[1] === 'chunks' ? 100 : 50)) {
            fwrite(STDERR, "执行预算超出范围。\n" . $usage);
            exit(2);
        }
        if ($match[1] === 'chunks') {
            $chunks = $number;
        } else {
            $seconds = $number;
        }
    } else {
        fwrite(STDERR, "参数错误。\n" . $usage);
        exit(2);
    }
}
if ($weeklySet && !$start) {
    fwrite(STDERR, "周扫描选项须与 --start 一起使用。\n" . $usage);
    exit(2);
}
require __DIR__ . '/cli-bootstrap.php';
try {
    $audit = \addons\vodmerge\service\Runtime::audit();
    if ($start || $work) {
        $lock = @fopen(RUNTIME_PATH . 'vodmerge-audit.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
            echo "audit_worker=busy\n";
            exit(0);
        }
        if ($start) {
            $audit->start($weekly);
        }
        if ($work) {
            $before = $audit->summary();
            $deadline = microtime(true) + $seconds;
            for ($index = 0; $index < $chunks && microtime(true) < $deadline; $index++) {
                $summary = $audit->tick();
                if (($summary['run']['status'] ?? '') === 'error') {
                    throw new \RuntimeException('本批排查未完成，留待下一次重试。');
                }
                if (!$summary['active_run_id']) {
                    break;
                }
            }
        }
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    $result = $audit->summary();
    if (!$work || $start || ($before['latest_run'] ?? null) !== ($result['latest_run'] ?? null)) {
        echo \addons\vodmerge\service\Payload::json($result) . "\n";
    }
} catch (\Throwable $error) {
    error_log('[vodmerge] Library audit failed: ' . get_class($error));
    fwrite(STDERR, "影片排查本次未完成，进度已保留，请查看服务端日志后重试。\n");
    exit(1);
}
