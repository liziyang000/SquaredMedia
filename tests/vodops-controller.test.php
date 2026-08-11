<?php

namespace app\admin\controller {
    class Base
    {
        public $_admin = ['admin_id' => 7];
        public $assigned = [];
        public $fetchedTemplate = '';
        public $view;

        public function __construct()
        {
            $this->view = new class {
                public $path = '';

                public function config($name, $value)
                {
                    if ($name === 'view_path') {
                        $this->path = $value;
                    }
                }
            };
        }

        public function assign($name, $value)
        {
            $this->assigned[$name] = $value;
        }

        public function fetch($template = '')
        {
            $this->fetchedTemplate = $template;
            return 'rendered';
        }

        public function error($message)
        {
            return ['error' => $message];
        }
    }
}

namespace addons\vodops\service {
    class VodQualityActionException extends \RuntimeException
    {
    }

    class VodQualityExportException extends \RuntimeException
    {
    }

    class VodQualityRepairException extends \RuntimeException
    {
    }

    class VodQualityRepair
    {
        public static $calls = [];
        public static $actionError = null;

        public static function decorateIssues(array $issues, $scanStatus = '')
        {
            self::$calls[] = ['decorate', $scanStatus];
            return $issues;
        }

        public static function repairInfo($issueId)
        {
            self::$calls[] = ['info', $issueId];
            return ['issue_id' => $issueId, 'supported' => true];
        }

        public static function apply($issueId, $newValue, $source, $adminId)
        {
            if (self::$actionError instanceof \Throwable) {
                throw self::$actionError;
            }
            self::$calls[] = ['apply', $issueId, $newValue, $source, $adminId];
            return ['repair_id' => 31, 'result_status' => 'fixed'];
        }

        public static function recheck($issueId, $adminId)
        {
            self::$calls[] = ['recheck', $issueId, $adminId];
            return ['repair_id' => 32, 'result_status' => 'fixed'];
        }

        public static function rollback($repairId, $adminId)
        {
            self::$calls[] = ['rollback', $repairId, $adminId];
            return ['repair_id' => 33, 'result_status' => 'open'];
        }
    }

    class VodQualityScanner
    {
        public static $calls = [];
        public static $actionError = null;
        public static $exportError = null;
        public static $lastScanLimit = 0;

        public static function listScans($limit = 20)
        {
            self::$lastScanLimit = $limit;
            return [['run_id' => 12, 'status' => 'completed']];
        }

        public static function getScan($runId = 0)
        {
            return ['run_id' => $runId > 0 ? $runId : 12, 'status' => 'completed'];
        }

        public static function issueSummary($runId)
        {
            return ['year_missing' => 2];
        }

        public static function listIssues($runId, $issueType, $query, $page, $limit)
        {
            return ['list' => [], 'page' => $page, 'pagecount' => 0, 'total' => 0, 'limit' => $limit];
        }

        public static function issueTypes()
        {
            return ['year_missing' => '年份缺失'];
        }

        public static function categoryOptions()
        {
            return [['type_id' => 10, 'label' => '电影']];
        }

        public static function startScan($adminId, $batchSize, $scopeTypeId, $workerMode)
        {
            if (self::$actionError instanceof \Throwable) {
                throw self::$actionError;
            }
            self::$calls[] = ['start', $adminId, $batchSize, $scopeTypeId, $workerMode];
            return ['run_id' => 13, 'status' => 'running'];
        }

        public static function runChunk($runId)
        {
            self::$calls[] = ['run', $runId];
            return ['run_id' => $runId, 'status' => 'completed'];
        }

        public static function cancelScan($runId, $adminId)
        {
            self::$calls[] = ['cancel', $runId, $adminId];
            return ['run_id' => $runId, 'status' => 'cancelled'];
        }

        public static function deleteScan($runId, $adminId)
        {
            self::$calls[] = ['delete', $runId, $adminId];
            return ['run_id' => $runId, 'deleted' => true];
        }

        public static function exportIssues($runId, $issueType, $query)
        {
            if (self::$exportError instanceof \Throwable) {
                throw self::$exportError;
            }
            self::$calls[] = ['export', $runId, $issueType, $query];
            return [
                'filename' => 'vodops-run-12.csv',
                'content' => "issue_id,vod_id\n1,100\n",
            ];
        }
    }

    class DoubanData
    {
        public static $calls = [];

        public static function dashboard()
        {
            self::$calls[] = ['dashboard'];
            return [
                'config' => ['batch_size' => 100],
                'stats' => ['total' => 2],
                'task_stats' => ['PENDING' => 1],
                'logs' => [],
                'categories' => [['type_id' => 20, 'display_name' => '电视剧']],
            ];
        }

        public static function listVideos($status, $page, $limit, $q, $typeId, $year)
        {
            self::$calls[] = ['videos', $status, $page, $limit, $q, $typeId, $year];
            return [
                'data' => [['vod_id' => 88]],
                'page' => $page,
                'has_prev' => false,
                'has_next' => true,
            ];
        }

        public static function listTasks($status, $limit)
        {
            self::$calls[] = ['tasks', $status, $limit];
            return [['task_id' => 9]];
        }

        public static function auditDashboard($scanId, $code, $page, $limit, $q)
        {
            self::$calls[] = ['audit', $scanId, $code, $page, $limit, $q];
            return [
                'scan' => [],
                'issues' => [],
                'stats' => [],
                'codes' => [],
                'filters' => ['code' => '', 'q' => ''],
                'pagination' => [
                    'page' => 1,
                    'has_prev' => false,
                    'has_next' => false,
                ],
            ];
        }
    }
}

namespace {
    if (!defined('APP_PATH')) {
        define('APP_PATH', '/application/');
    }

    $vodopsInput = [];
    $vodopsRequest = new class {
        public $post = true;
        public $ajax = true;

        public function isPost()
        {
            return $this->post;
        }

        public function isAjax()
        {
            return $this->ajax;
        }
    };

    function request()
    {
        global $vodopsRequest;
        return $vodopsRequest;
    }

    function input($name = null, $default = null)
    {
        global $vodopsInput;
        if ($name === null) {
            return $vodopsInput;
        }
        $key = preg_replace('/\/[a-z]$/i', '', $name);
        return $vodopsInput[$key] ?? $default;
    }

    function json($data, $status = 200)
    {
        return ['status' => $status, 'data' => $data];
    }

    function response($content, $status = 200, array $headers = [])
    {
        return ['status' => $status, 'content' => $content, 'headers' => $headers];
    }

    function url($route, array $params = [])
    {
        return $route . (empty($params) ? '' : '?' . http_build_query($params));
    }

    function vodops_controller_fail(string $message): void
    {
        fwrite(STDERR, $message . "\n");
        exit(1);
    }

    function vodops_controller_assert_same($expected, $actual, string $message): void
    {
        if ($expected !== $actual) {
            vodops_controller_fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    }

    $root = dirname(__DIR__);
    require $root . '/addons/vodops/application/admin/controller/Vodops.php';

    $controller = new \app\admin\controller\Vodops();
    vodops_controller_assert_same('rendered', $controller->index(), 'The admin index should render through the native admin controller.');
    vodops_controller_assert_same('vodops/index', $controller->fetchedTemplate, 'The admin index should render the view_new template explicitly.');
    vodops_controller_assert_same(12, $controller->assigned['scan']['run_id'] ?? null, 'The latest scan should be selected by default.');
    vodops_controller_assert_same(50, \addons\vodops\service\VodQualityScanner::$lastScanLimit, 'The history selector should expose enough terminal scans for manual management.');
    vodops_controller_assert_same(10, $controller->assigned['categories'][0]['type_id'] ?? null, 'The scan form should receive native category choices.');
    vodops_controller_assert_same([['decorate', 'completed']], \addons\vodops\service\VodQualityRepair::$calls, 'Issue rows should be decorated with their latest repair status.');

    $vodopsInput = ['workspace' => 'douban', 'q' => '霸王别姬', 'page' => 2];
    \addons\vodops\service\DoubanData::$calls = [];
    $doubanWorkspace = new \app\admin\controller\Vodops();
    vodops_controller_assert_same('rendered', $doubanWorkspace->index(), 'The Douban module should render through the single Vodops workbench.');
    vodops_controller_assert_same('douban', $doubanWorkspace->assigned['workspace'] ?? null, 'The unified workbench should retain the selected module.');
    vodops_controller_assert_same(88, $doubanWorkspace->assigned['videos'][0]['vod_id'] ?? null, 'The unified workbench should receive Douban video data.');
    vodops_controller_assert_same(
        'vodops/index?workspace=douban&status=all&task_status=PENDING&q=%E9%9C%B8%E7%8E%8B%E5%88%AB%E5%A7%AC&type_id=0&year=&limit=20&page=3',
        $doubanWorkspace->assigned['pagination']['next_url'] ?? null,
        'Douban pagination should stay inside the single Vodops workbench.'
    );

    \addons\vodops\service\VodQualityScanner::$calls = [];
    $vodopsInput = ['batch_size' => 500, 'scope_type_id' => 10, 'worker_mode' => 1];
    $response = $controller->startScan();
    vodops_controller_assert_same(1, $response['data']['code'], 'A valid scan request should succeed.');
    vodops_controller_assert_same([['start', 7, 500, 10, true]], \addons\vodops\service\VodQualityScanner::$calls, 'The native admin ID, batch size, category scope, and worker mode must reach the scanner.');

    \addons\vodops\service\VodQualityScanner::$calls = [];
    $vodopsInput['worker_mode'] = 0;
    $response = $controller->startScan();
    vodops_controller_assert_same(1, $response['data']['code'], 'An administrator should be able to resume in page-only mode.');
    vodops_controller_assert_same([['start', 7, 500, 10, false]], \addons\vodops\service\VodQualityScanner::$calls, 'An unchecked worker option must reach the scanner as an explicit disable request.');

    \addons\vodops\service\VodQualityScanner::$actionError = new \addons\vodops\service\VodQualityActionException('已有“全部分类”扫描正在进行，请先继续或结束该任务。');
    $response = $controller->startScan();
    vodops_controller_assert_same(409, $response['status'], 'A conflicting active scope should return an actionable conflict response.');
    vodops_controller_assert_same('已有“全部分类”扫描正在进行，请先继续或结束该任务。', $response['data']['msg'] ?? null, 'Expected scope conflicts should remain visible to the administrator.');
    \addons\vodops\service\VodQualityScanner::$actionError = null;

    \addons\vodops\service\VodQualityScanner::$calls = [];
    $vodopsRequest->ajax = false;
    $response = $controller->startScan();
    vodops_controller_assert_same(405, $response['status'], 'Scan actions must require same-origin Ajax requests.');
    vodops_controller_assert_same([], \addons\vodops\service\VodQualityScanner::$calls, 'Rejected requests must not start scans.');

    $vodopsRequest->ajax = true;
    $vodopsRequest->post = false;
    $response = $controller->runChunk();
    vodops_controller_assert_same(405, $response['status'], 'Scan chunks must reject GET requests.');

    $vodopsRequest->post = true;
    $vodopsInput = ['run_id' => 13];
    $response = $controller->runChunk();
    vodops_controller_assert_same(1, $response['data']['code'], 'A valid scan chunk should succeed.');
    vodops_controller_assert_same(['run', 13], \addons\vodops\service\VodQualityScanner::$calls[0] ?? null, 'The selected run should be processed.');

    \addons\vodops\service\VodQualityScanner::$calls = [];
    $response = $controller->cancelScan();
    vodops_controller_assert_same(1, $response['data']['code'], 'An active scan should be cancellable.');
    vodops_controller_assert_same([['cancel', 13, 7]], \addons\vodops\service\VodQualityScanner::$calls, 'Cancellation must record the acting admin.');

    \addons\vodops\service\VodQualityScanner::$calls = [];
    $vodopsRequest->post = false;
    $vodopsInput = ['run_id' => 12];
    $response = $controller->deleteScan();
    vodops_controller_assert_same(405, $response['status'], 'Result deletion must reject GET requests.');
    vodops_controller_assert_same([], \addons\vodops\service\VodQualityScanner::$calls, 'Rejected deletion requests must preserve audit results.');

    $vodopsRequest->post = true;
    $response = $controller->deleteScan();
    vodops_controller_assert_same(1, $response['data']['code'], 'A completed audit result should be deletable explicitly.');
    vodops_controller_assert_same([['delete', 12, 7]], \addons\vodops\service\VodQualityScanner::$calls, 'Deletion must stay scoped to the selected scan and acting admin.');

    \addons\vodops\service\VodQualityScanner::$calls = [];
    $vodopsInput = ['run_id' => 12, 'issue_type' => 'year_missing', 'q' => '测试'];
    $response = $controller->export();
    vodops_controller_assert_same('text/csv; charset=UTF-8', $response['headers']['Content-Type'] ?? null, 'Exports should use an explicit CSV content type.');
    vodops_controller_assert_same('attachment; filename="vodops-run-12.csv"', $response['headers']['Content-Disposition'] ?? null, 'Exports should use a safe attachment name.');
    vodops_controller_assert_same([['export', 12, 'year_missing', '测试']], \addons\vodops\service\VodQualityScanner::$calls, 'Export filters must match the visible list.');

    \addons\vodops\service\VodQualityScanner::$exportError = new \addons\vodops\service\VodQualityExportException(
        '导出结果超过 50000 条，请先选择异常类型或搜索条件。'
    );
    $response = $controller->export();
    vodops_controller_assert_same(
        '导出结果超过 50000 条，请先选择异常类型或搜索条件。',
        $response['error'] ?? null,
        'Expected export limits should remain actionable to the administrator.'
    );

    \addons\vodops\service\VodQualityScanner::$exportError = new \RuntimeException('sensitive database failure');
    $response = $controller->export();
    vodops_controller_assert_same('导出扫描结果失败，请查看服务端日志。', $response['error'] ?? null, 'Export failures should not expose internal exception messages.');
    if (strpos((string) ($response['error'] ?? ''), 'sensitive database failure') !== false) {
        vodops_controller_fail('Export failures must remain server-log only.');
    }

    \addons\vodops\service\VodQualityRepair::$calls = [];
    $vodopsRequest->post = true;
    $vodopsRequest->ajax = true;
    $vodopsInput = ['issue_id' => 21];
    $response = $controller->repairInfo();
    vodops_controller_assert_same(1, $response['data']['code'] ?? null, 'A repair drawer should load a fresh issue snapshot through Ajax POST.');
    vodops_controller_assert_same([['info', 21]], \addons\vodops\service\VodQualityRepair::$calls, 'Repair info must stay scoped to the requested issue.');

    \addons\vodops\service\VodQualityRepair::$calls = [];
    $vodopsInput = ['issue_id' => 21, 'new_value' => '2024', 'source' => 'manual'];
    $response = $controller->applyRepair();
    vodops_controller_assert_same(1, $response['data']['code'] ?? null, 'A reviewed repair should reach the repair service.');
    vodops_controller_assert_same([['apply', 21, '2024', 'manual', 7]], \addons\vodops\service\VodQualityRepair::$calls, 'Repair writes must record the issue, reviewed value, source, and acting admin.');

    \addons\vodops\service\VodQualityRepair::$calls = [];
    $vodopsInput = ['issue_id' => 21];
    $response = $controller->recheckIssue();
    vodops_controller_assert_same([['recheck', 21, 7]], \addons\vodops\service\VodQualityRepair::$calls, 'File restoration and native edits should be rechecked without a source write.');

    \addons\vodops\service\VodQualityRepair::$calls = [];
    $vodopsInput = ['repair_id' => 31];
    $response = $controller->rollbackRepair();
    vodops_controller_assert_same([['rollback', 31, 7]], \addons\vodops\service\VodQualityRepair::$calls, 'Rollback must target one audited repair and record the acting admin.');

    \addons\vodops\service\VodQualityRepair::$actionError = new \addons\vodops\service\VodQualityRepairException('视频数据已变化，本次修改已停止。');
    $vodopsInput = ['issue_id' => 21, 'new_value' => '2024', 'source' => 'manual'];
    $response = $controller->applyRepair();
    vodops_controller_assert_same(409, $response['status'] ?? null, 'Expected repair conflicts should return an actionable conflict response.');
    vodops_controller_assert_same('视频数据已变化，本次修改已停止。', $response['data']['msg'] ?? null, 'Safe repair validation messages should remain visible.');
    \addons\vodops\service\VodQualityRepair::$actionError = null;

    $vodopsRequest->ajax = false;
    $response = $controller->applyRepair();
    vodops_controller_assert_same(405, $response['status'] ?? null, 'Repair writes must reject non-Ajax requests.');

    if (is_file($root . '/addons/vodops/controller/Index.php')) {
        vodops_controller_fail('Vodops must not expose a public addon controller.');
    }

    echo "Vodops controller tests passed\n";
}
