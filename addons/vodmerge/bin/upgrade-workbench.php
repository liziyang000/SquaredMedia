<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

function vodmergeUpgradeWorkbench(\PDO $db, string $prefix): void
{
    if (!preg_match('/^[a-zA-Z0-9_]{0,40}$/D', $prefix) || $db->getAttribute(\PDO::ATTR_DRIVER_NAME) !== 'mysql') {
        throw new \RuntimeException('审核工作台升级需要有效 MySQL 配置。');
    }
    foreach (explode(';', str_replace('__PREFIX__', $prefix, file_get_contents(dirname(__DIR__) . '/workbench.sql'))) as $sql) {
        if (trim($sql) !== '') {
            $db->exec($sql);
        }
    }
    $columns = $db->query('SHOW COLUMNS FROM `' . $prefix . 'vodmerge_case`')->fetchAll(\PDO::FETCH_COLUMN);
    if (!in_array('search_text', $columns, true)) {
        $db->exec('ALTER TABLE `' . $prefix . 'vodmerge_case` ADD COLUMN search_text TEXT NULL');
    }
    $caseIndexes = $db->query('SHOW INDEX FROM `' . $prefix . 'vodmerge_case`')->fetchAll(\PDO::FETCH_ASSOC);
    if (!in_array('case_right', array_column($caseIndexes, 'Key_name'), true)) {
        $db->exec('ALTER TABLE `' . $prefix . 'vodmerge_case` ADD INDEX case_right (right_id,left_id)');
    }
    if (!in_array('case_review', array_column($caseIndexes, 'Key_name'), true)) {
        $db->exec('ALTER TABLE `' . $prefix . 'vodmerge_case` ADD INDEX case_review (identity_signature,job_id,priority,issue_id,assessment)');
    }
    $indexes = $db->query('SHOW INDEX FROM `' . $prefix . 'vodmerge_audit_issue`')->fetchAll(\PDO::FETCH_ASSOC);
    $found = [];
    foreach ($indexes as $index) {
        if ($index['Key_name'] === 'audit_library_pair') {
            $found[(int) $index['Seq_in_index']] = $index['Column_name'];
        }
    }
    if (!$found) {
        $db->exec('ALTER TABLE `' . $prefix . 'vodmerge_audit_issue` ADD INDEX audit_library_pair (left_id,right_id,issue_id)');
    } else {
        ksort($found);
        if (array_values($found) !== ['left_id', 'right_id', 'issue_id']) {
            throw new \RuntimeException('已有影片对索引结构不同，请先核对。');
        }
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}
if (count($argv) !== 2 || $argv[1] !== '--apply') {
    echo "Usage: php addons/vodmerge/bin/upgrade-workbench.php --apply\nCreates review tables and imports existing issue/job references. Does not rescan, call AI or modify videos.\n";
    exit(0);
}
require __DIR__ . '/cli-bootstrap.php';
try {
    [$db, $prefix] = \addons\vodmerge\service\Runtime::database();
    vodmergeUpgradeWorkbench($db, $prefix);
    $workbench = new \addons\vodmerge\service\Workbench($db, $prefix, new \addons\vodmerge\service\Service($db, $prefix, (array) config('vodplayer')));
    echo json_encode(['cases' => $workbench->importIssues(), 'library_jobs' => $workbench->importJobs()]) . "\n";
} catch (\Throwable $error) {
    error_log('[vodmerge] Workbench upgrade failed: ' . get_class($error));
    fwrite(STDERR, "审核工作台升级未完成，请核对插件表结构、权限和可用空间。\n");
    exit(1);
}
