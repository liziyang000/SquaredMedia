<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

function vodmergeUpgradeAudit(\PDO $db, string $prefix): array
{
    if (!preg_match('/^[a-zA-Z0-9_]{0,40}$/D', $prefix)) {
        throw new \RuntimeException('表前缀不合法。');
    }
    if ($db->getAttribute(\PDO::ATTR_DRIVER_NAME) !== 'mysql') {
        throw new \RuntimeException('此升级命令需要 MySQL。');
    }
    $table = '`' . $prefix . 'vodmerge_audit_issue`';
    $columns = [];
    foreach ($db->query('SHOW COLUMNS FROM ' . $table)->fetchAll(\PDO::FETCH_ASSOC) as $column) {
        $columns[$column['Field']] = $column;
    }
    $definitions = ['assessment' => "varchar(20) NOT NULL DEFAULT 'unrated'",
        'priority' => 'tinyint unsigned NOT NULL DEFAULT 0', 'assessment_version' => 'smallint unsigned NOT NULL DEFAULT 0'];
    $types = ['assessment' => '/^varchar\(20\)$/D', 'priority' => '/^tinyint(?:\([0-9]+\))? unsigned$/D',
        'assessment_version' => '/^smallint(?:\([0-9]+\))? unsigned$/D'];
    $defaults = ['assessment' => 'unrated', 'priority' => '0', 'assessment_version' => '0'];
    $changes = [];
    $addedColumns = [];
    foreach ($definitions as $name => $definition) {
        if (!isset($columns[$name])) {
            $changes[] = 'ADD COLUMN `' . $name . '` ' . $definition;
            $addedColumns[] = $name;
        } elseif (!preg_match($types[$name], strtolower($columns[$name]['Type']))
            || $columns[$name]['Null'] !== 'NO' || (string) $columns[$name]['Default'] !== $defaults[$name]) {
            throw new \RuntimeException('排查分级字段已存在但结构不同，请先检查：' . $name);
        }
    }
    $indexes = [];
    foreach ($db->query('SHOW INDEX FROM ' . $table)->fetchAll(\PDO::FETCH_ASSOC) as $index) {
        $indexes[$index['Key_name']][(int) $index['Seq_in_index']] = $index['Column_name'];
    }
    $expected = ['audit_quality' => ['run_id', 'assessment', 'priority', 'issue_id'],
        'audit_priority' => ['run_id', 'priority', 'issue_id'], 'audit_assessment_pending' => ['assessment_version', 'issue_id']];
    $addedIndexes = [];
    foreach ($expected as $name => $fields) {
        if (!isset($indexes[$name])) {
            $changes[] = 'ADD INDEX `' . $name . '` (`' . implode('`,`', $fields) . '`)';
            $addedIndexes[] = $name;
        } else {
            ksort($indexes[$name]);
            if (array_values($indexes[$name]) !== $fields) {
                throw new \RuntimeException('排查分级索引已存在但结构不同，请先检查：' . $name);
            }
        }
    }
    if ($changes) {
        $db->exec('ALTER TABLE ' . $table . ' ' . implode(',', $changes));
    }
    return ['changed' => (bool) $changes, 'columns_added' => $addedColumns, 'indexes_added' => $addedIndexes];
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) {
    return;
}
if (count($argv) !== 2 || $argv[1] !== '--apply') {
    echo "Usage: php addons/vodmerge/bin/upgrade-audit.php --apply\n"
        . "Adds quality columns and indexes to the plugin audit issue table only; safe to repeat. Does not rescan or modify videos.\n";
    exit(count($argv) > 1 && $argv[1] !== '--help' ? 2 : 0);
}
require __DIR__ . '/cli-bootstrap.php';
try {
    [$db, $prefix] = \addons\vodmerge\service\Runtime::database();
    echo \addons\vodmerge\service\Payload::json(vodmergeUpgradeAudit($db, $prefix)) . "\n";
} catch (\Throwable $error) {
    error_log('[vodmerge] Audit schema upgrade failed: ' . get_class($error));
    fwrite(STDERR, $error instanceof \PDOException ? "排查分级升级失败，请核对插件表结构、ALTER 权限与可用空间。\n" : $error->getMessage() . "\n");
    exit(1);
}
