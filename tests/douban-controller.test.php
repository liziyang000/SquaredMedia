<?php

namespace think {
    class Request
    {
        private $actionName;
        public $routeData = [];

        public function __construct(string $actionName = 'index')
        {
            $this->actionName = $actionName;
        }

        public static function instance()
        {
            return new self();
        }

        public function action()
        {
            return $this->actionName;
        }

        public function route(array $route)
        {
            $this->routeData = $route;
            return $this;
        }
    }
}

namespace think\addons {
    class Controller
    {
        public $parentRequest;

        public function __construct(?\think\Request $request = null)
        {
            $this->parentRequest = $request;
        }
    }
}

namespace {
    function failControllerTest(string $message): void
    {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }

    $root = dirname(__DIR__);
    require $root . '/addons/vodops/backend/DoubanController.php';
    require $root . '/addons/vodops/application/admin/controller/Douban.php';

    $request = new \think\Request('previewCalibration');
    $controller = new \app\admin\controller\Douban($request);
    if (!$controller instanceof \addons\vodops\backend\DoubanController) {
        failControllerTest('Admin controller should inherit the private backend implementation');
    }
    if ($controller->parentRequest !== $request) {
        failControllerTest('Admin controller should pass the same request to the addon base controller');
    }
    if ($request->routeData !== [
        'addon' => 'vodops',
        'controller' => 'index',
        'action' => 'previewCalibration',
    ]) {
        failControllerTest('Admin controller should bind the expected addon view route');
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
    if (!preg_match('/public function exportAudit\(\)[\s\S]*?if \(!\$this->isAdmin\(\)\)[\s\S]*?DoubanData::auditIssueExportBatch/', $backendSource)) {
        failControllerTest('Audit CSV export should verify the administrator session before reading report rows');
    }
    $csvCell = $backend->getMethod('csvCell');
    $csvCell->setAccessible(true);
    if ($csvCell->invoke($controller, '=WEBSERVICE("https://example.invalid")') !== '\'=WEBSERVICE("https://example.invalid")'
        || $csvCell->invoke($controller, '普通影片') !== '普通影片') {
        failControllerTest('Audit CSV export should neutralize spreadsheet formulas without changing normal text');
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
