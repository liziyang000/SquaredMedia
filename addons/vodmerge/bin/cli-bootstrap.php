<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
$vodmergeRoot = dirname(__DIR__, 3);
if (!is_file($vodmergeRoot . '/thinkphp/base.php')) {
    fwrite(STDERR, "请把插件安装到完整 MacCMS 站点后再运行此命令。\n");
    exit(1);
}
chdir($vodmergeRoot);
defined('ROOT_PATH') || define('ROOT_PATH', $vodmergeRoot . DIRECTORY_SEPARATOR);
defined('APP_PATH') || define('APP_PATH', ROOT_PATH . 'application' . DIRECTORY_SEPARATOR);
defined('MAC_COMM') || define('MAC_COMM', APP_PATH . 'common/common/');
defined('MAC_HOME_COMM') || define('MAC_HOME_COMM', APP_PATH . 'index/common/');
defined('MAC_ADMIN_COMM') || define('MAC_ADMIN_COMM', APP_PATH . 'admin/common/');
defined('MAC_START_TIME') || define('MAC_START_TIME', microtime(true));
defined('ENTRANCE') || define('ENTRANCE', 'cli');
defined('IN_FILE') || define('IN_FILE', '/addons/vodmerge/bin/worker.php');
$_SERVER += ['HTTP_HOST' => 'localhost', 'REQUEST_METHOD' => 'CLI', 'REQUEST_URI' => '/vodmerge-worker',
    'SCRIPT_FILENAME' => __FILE__, 'SCRIPT_NAME' => IN_FILE];
require ROOT_PATH . 'thinkphp/base.php';
\think\App::initCommon();
require_once dirname(__DIR__) . '/bootstrap.php';
unset($vodmergeRoot);
