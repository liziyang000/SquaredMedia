<?php

namespace app\admin\controller {
    class Base
    {
        public $_admin = ['admin_id' => 7];
        public $baseInitialized = false;

        public function __construct()
        {
            $this->baseInitialized = true;
        }

        public function assign($name, $value)
        {
        }

        public function fetch($template = '')
        {
            return $template;
        }
    }
}

namespace {
    $doubanControllerTraces = [];

    function json($data, $status = 200)
    {
        return ['status' => $status, 'data' => $data];
    }

    function url($route, array $params = [])
    {
        return $route . (empty($params) ? '' : '?' . http_build_query($params));
    }

    function redirect($target)
    {
        return ['redirect' => $target];
    }

    function trace($message, $level = '')
    {
        global $doubanControllerTraces;
        $doubanControllerTraces[] = [$message, $level];
    }

    function failControllerTest(string $message): void
    {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }

    $root = dirname(__DIR__);
    require $root . '/addons/vodops/service/DoubanActionException.php';
    require $root . '/addons/vodops/backend/DoubanController.php';
    require $root . '/addons/vodops/application/admin/controller/Douban.php';

    $controller = new \app\admin\controller\Douban();
    if (!$controller instanceof \addons\vodops\backend\DoubanController) {
        failControllerTest('Admin controller should inherit the private backend implementation');
    }
    if (!$controller instanceof \app\admin\controller\Base || !$controller->baseInitialized) {
        failControllerTest('Douban actions must run through the native MacCMS admin permission base');
    }
    $legacyIndex = $controller->index();
    if (($legacyIndex['redirect'] ?? '') !== 'vodops/index?workspace=douban') {
        failControllerTest('The legacy Douban index should redirect into the single Vodops workbench');
    }

    $backend = new ReflectionClass(\addons\vodops\backend\DoubanController::class);
    foreach ([
        'index',
        'saveConfig',
        'enqueue',
        'previewTargeted',
        'enqueueTargeted',
        'run',
        'retryFailed',
        'fetchVod',
        'sync',
        'rollbackPic',
        'calibrate',
        'previewCalibration',
        'calibrateByType',
        'setDoubanId',
        'lock',
        'ignore',
        'startAudit',
        'runAuditBatch',
        'pauseAudit',
        'resumeAudit',
        'exportAudit',
    ] as $method) {
        if (!$backend->hasMethod($method)) {
            failControllerTest('Backend controller is missing action: ' . $method);
        }
    }
    $backendSource = file_get_contents($root . '/addons/vodops/backend/DoubanController.php');
    $bridgeSource = file_get_contents($root . '/addons/vodops/application/admin/controller/Douban.php');
    if (!preg_match('/class DoubanController extends Base/', $backendSource)
        || preg_match('/model\([\'\"]Admin[\'\"]\)->checkLogin/', $backendSource)) {
        failControllerTest('Douban should inherit native Base authorization instead of performing login-only checks');
    }
    if (preg_match('/->route\s*\(/', $bridgeSource)) {
        failControllerTest('Douban must not rewrite the native controller route used by action permissions');
    }
    if (preg_match('/fetch\([\'"]index\/index/', $backendSource)) {
        failControllerTest('Douban must not render a second standalone workbench');
    }
    if (strpos($backendSource, 'view_path') !== false) {
        failControllerTest('Douban action routes must not configure a second private page renderer');
    }
    $csvCell = $backend->getMethod('csvCell');
    $csvCell->setAccessible(true);
    if ($csvCell->invoke($controller, '=WEBSERVICE("https://example.invalid")') !== '\'=WEBSERVICE("https://example.invalid")'
        || $csvCell->invoke($controller, '普通影片') !== '普通影片') {
        failControllerTest('Audit CSV export should neutralize spreadsheet formulas without changing normal text');
    }

    $errorJson = $backend->getMethod('errorJson');
    $errorJson->setAccessible(true);
    $internalError = $errorJson->invoke($controller, new \RuntimeException('SQLSTATE sensitive failure'));
    if (($internalError['status'] ?? 0) !== 500
        || ($internalError['data']['msg'] ?? '') !== '豆瓣操作失败，请查看服务端日志。'
        || strpos((string) ($internalError['data']['msg'] ?? ''), 'SQLSTATE') !== false
        || empty($doubanControllerTraces)) {
        failControllerTest('Unexpected backend failures must be logged without exposing internal exception messages');
    }
    $actionError = $errorJson->invoke(
        $controller,
        new \addons\vodops\service\DoubanActionException('视频数据已变化，请刷新后重试。')
    );
    if (($actionError['status'] ?? 0) !== 409
        || ($actionError['data']['msg'] ?? '') !== '视频数据已变化，请刷新后重试。') {
        failControllerTest('Expected data conflicts should remain actionable to administrators');
    }

    if (is_file($root . '/addons/vodops/application/index/controller/Douban.php')) {
        failControllerTest('Douban must not install an index-module controller');
    }
    if (is_file($root . '/addons/vodops/controller/Index.php')) {
        failControllerTest('Douban must not expose a public addon controller');
    }
    $info = file_get_contents($root . '/addons/vodops/info.ini');
    if (!preg_match('/^url\s*=\s*$/m', $info) || preg_match('#(?:index\.php|addons)/douban#', $info)) {
        failControllerTest('Douban info.ini must not declare a public URL');
    }

    echo "Douban controller tests passed\n";
}
