<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
if (count($argv) !== 2 || $argv[1] !== '--apply') {
    echo "Usage: php addons/vodmerge/bin/install.php --apply\n"
        . "Creates plugin tables and copies three application files. Does not modify video records or credentials.\n";
    exit(0);
}
require __DIR__ . '/cli-bootstrap.php';
try {
    $files = ['admin/controller/Vodmerge.php', 'api/controller/Vodmerge.php', 'admin/view_new/vodmerge/index.html'];
    foreach ($files as $file) {
        $source = dirname(__DIR__) . '/application/' . $file;
        $target = APP_PATH . $file;
        if (!is_file($source) || (is_file($target) && hash_file('sha256', $source) !== hash_file('sha256', $target))) {
            throw new \RuntimeException('应用文件已存在且内容不同，须先备份并确认版本：' . $file);
        }
    }
    [$db, $prefix] = \addons\vodmerge\service\Runtime::database();
    if (!preg_match('/^[a-zA-Z0-9_]{0,40}$/D', $prefix)) {
        throw new \RuntimeException('表前缀不合法。');
    }
    $sql = str_replace('__PREFIX__', $prefix, file_get_contents(dirname(__DIR__) . '/install.sql'));
    foreach (explode(';', $sql) as $statement) {
        if (trim($statement) !== '') {
            $db->exec($statement);
        }
    }
    require __DIR__ . '/upgrade-audit.php';
    vodmergeUpgradeAudit($db, $prefix);
    require __DIR__ . '/upgrade-workbench.php';
    vodmergeUpgradeWorkbench($db, $prefix);
    foreach ($files as $file) {
        $target = APP_PATH . $file;
        if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0755, true)) {
            throw new \RuntimeException('无法创建应用目录。');
        }
        if (!copy(dirname(__DIR__) . '/application/' . $file, $target)) {
            throw new \RuntimeException('应用文件复制失败。');
        }
        chmod($target, 0644);
    }
    echo "已创建插件表并安装应用文件。请配置采集签名密钥，再使用超级管理员打开后台入口/admin/vodmerge/index.html 配置 Jev Token。\n";
} catch (\Throwable $error) {
    fwrite(STDERR, $error instanceof \PDOException ? "数据库安装失败，请核对 CREATE 权限与表结构。\n" : $error->getMessage() . "\n");
    exit(1);
}
