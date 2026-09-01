<?php

namespace app\admin\controller;

use addons\vodops\service\DoubanData;
use addons\vodops\service\VodPosterCandidate;
use addons\vodops\service\VodLibrary;
use addons\vodops\service\VodQualityActionException;
use addons\vodops\service\VodQualityExportException;
use addons\vodops\service\VodQualityRepair;
use addons\vodops\service\VodQualityRepairException;
use addons\vodops\service\VodQualityScanner;

class Vodops extends Base
{
    public function __construct()
    {
        parent::__construct();
        $this->view->config('view_path', APP_PATH . 'admin/view_new/');
    }

    public function index()
    {
        $params = input();
        $params = is_array($params) ? $params : [];
        $workspace = trim((string) ($params['workspace'] ?? 'videos'));
        unset($params['workspace']);
        $routes = [
            'videos' => 'vodops/videos',
            'quality' => 'vodops/quality',
            'douban' => 'vodops/douban',
        ];
        return redirect(url($routes[$workspace] ?? $routes['videos'], $params));
    }

    public function videos()
    {
        $this->assignPage('videos', '视频管理', '快速筛选、检查和编辑视频；复杂字段仍使用 MacCMS 原生编辑页。');
        $library = $this->videoLibraryData();
        $this->assign('video_library', $library);
        $this->assign('video_rows', $library['data']);
        $this->assign('video_filters', $library['filters']);
        $this->assign('video_pagination', $library);
        $this->assign('video_statuses', VodLibrary::statusOptions());
        $this->assign('categories', VodQualityScanner::categoryOptions());
        return $this->fetch('vodops/index');
    }

    public function videosData()
    {
        if (!request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        try {
            return json([
                'code' => 1,
                'msg' => '视频列表已更新',
                'data' => $this->videoLibraryData(),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson('刷新视频列表', $e);
        }
    }

    public function quality()
    {
        $this->assignPage('quality', '数据质量与修复', '扫描视频数据问题，并在明确预览后逐条修复。');
        $this->assignQualityWorkspace();
        return $this->fetch('vodops/index');
    }

    public function douban()
    {
        $this->assignPage('douban', '豆瓣匹配与同步', '匹配豆瓣 ID，同步资料并查看任务与审计记录。');
        $this->assignDoubanWorkspace();
        return $this->fetch('vodops/index');
    }

    private function assignQualityWorkspace()
    {

        $runId = max(0, intval(input('run_id/d', 0)));
        $scan = VodQualityScanner::getScan($runId);
        if (empty($scan) && $runId > 0) {
            $scan = VodQualityScanner::getScan();
        }

        $issueTypes = VodQualityScanner::issueTypes();
        $issueType = trim((string) input('issue_type/s', ''));
        if (!isset($issueTypes[$issueType])) {
            $issueType = '';
        }
        $query = $this->cleanQuery(input('q/s', ''));
        $page = max(1, intval(input('page/d', 1)));
        $issues = [
            'list' => [],
            'page' => 1,
            'pagecount' => 0,
            'total' => 0,
            'limit' => 30,
        ];
        $summary = [];
        if (!empty($scan)) {
            $runId = intval($scan['run_id'] ?? 0);
            $summary = VodQualityScanner::issueSummary($runId);
            $issues = VodQualityScanner::listIssues($runId, $issueType, $query, $page, 30);
            $issues['list'] = VodQualityRepair::decorateIssues($issues['list'], (string) ($scan['status'] ?? ''));
        }

        $this->assign('scans', VodQualityScanner::listScans(50));
        $this->assign('scan', $scan);
        $this->assign('summary', $summary);
        $this->assign('issues', $issues['list']);
        $this->assign('pagination', $issues);
        $this->assign('issue_types', $issueTypes);
        $this->assign('categories', VodQualityScanner::categoryOptions());
        $this->assign('issue_type', $issueType);
        $this->assign('q', $query);
    }

    public function startScan()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '扫描任务已创建',
                'data' => VodQualityScanner::startScan(
                    $this->adminId(),
                    intval(input('batch_size/d', 500)),
                    intval(input('scope_type_id/d', 0)),
                    intval(input('worker_mode/d', 0)) === 1
                ),
            ]);
        } catch (VodQualityActionException $e) {
            return json(['code' => 1003, 'msg' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            return $this->errorJson('启动扫描', $e);
        }
    }

    public function runChunk()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '扫描批次执行完成',
                'data' => VodQualityScanner::runChunk(intval(input('run_id/d', 0))),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson('执行扫描批次', $e);
        }
    }

    public function cancelScan()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '扫描任务已结束',
                'data' => VodQualityScanner::cancelScan(intval(input('run_id/d', 0)), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson('结束扫描', $e);
        }
    }

    public function deleteScan()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '审计结果已删除',
                'data' => VodQualityScanner::deleteScan(intval(input('run_id/d', 0)), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson('删除审计结果', $e);
        }
    }

    public function export()
    {
        try {
            $runId = intval(input('run_id/d', 0));
            $issueType = trim((string) input('issue_type/s', ''));
            $query = $this->cleanQuery(input('q/s', ''));
            $export = VodQualityScanner::exportIssues($runId, $issueType, $query);
            $filename = preg_replace('/[^A-Za-z0-9._-]/', '', basename((string) $export['filename']));

            return response((string) $export['content'], 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        } catch (VodQualityExportException $e) {
            return $this->error($e->getMessage());
        } catch (\Throwable $e) {
            $this->logFailure('导出扫描结果', $e);
            return $this->error('导出扫描结果失败，请查看服务端日志。');
        }
    }

    public function repairInfo()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '修复信息已加载',
                'data' => VodQualityRepair::repairInfo(intval(input('issue_id/d', 0))),
            ]);
        } catch (VodQualityRepairException $e) {
            return json(['code' => 1003, 'msg' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            return $this->errorJson('加载修复信息', $e);
        }
    }

    public function posterCandidates()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            $providerIds = $this->providerIds(input('provider_ids/a', []));
            $selectionInitialized = $this->providerSelectionInitialized(input('provider_selection_initialized', false));
            return json([
                'code' => 1,
                'msg' => '外部候选已加载',
                'data' => VodPosterCandidate::search(
                    intval(input('issue_id/d', 0)),
                    $providerIds,
                    null,
                    null,
                    null,
                    ['provider_selection_initialized' => $selectionInitialized]
                ),
            ]);
        } catch (VodQualityRepairException $e) {
            return json(['code' => 1003, 'msg' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            return $this->errorJson('搜索外部候选', $e);
        }
    }

    public function applyRepair()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '修改已保存并复检',
                'data' => VodQualityRepair::apply(
                    intval(input('issue_id/d', 0)),
                    (string) input('new_value/s', ''),
                    (string) input('source/s', ''),
                    $this->adminId(),
                    [],
                    (string) input('candidate_context/s', '')
                ),
            ]);
        } catch (VodQualityRepairException $e) {
            return json(['code' => 1003, 'msg' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            return $this->errorJson('保存异常修复', $e);
        }
    }

    public function recheckIssue()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '复检完成',
                'data' => VodQualityRepair::recheck(intval(input('issue_id/d', 0)), $this->adminId()),
            ]);
        } catch (VodQualityRepairException $e) {
            return json(['code' => 1003, 'msg' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            return $this->errorJson('复检异常', $e);
        }
    }

    public function rollbackRepair()
    {
        if (($error = $this->guardAjaxPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '已按审计原值回滚并复检',
                'data' => VodQualityRepair::rollback(intval(input('repair_id/d', 0)), $this->adminId()),
            ]);
        } catch (VodQualityRepairException $e) {
            return json(['code' => 1003, 'msg' => $e->getMessage()], 409);
        } catch (\Throwable $e) {
            return $this->errorJson('回滚异常修复', $e);
        }
    }

    private function assignPage($workspace, $title, $subtitle)
    {
        $this->assign('workspace', $workspace);
        $this->assign('page_title', $title);
        $this->assign('page_subtitle', $subtitle);
        $this->assign('title', $title . ' - 视频数据中心');
    }

    private function videoLibraryData()
    {
        $library = VodLibrary::listVideos([
            'q' => input('q/s', ''),
            'type_id' => intval(input('type_id/d', 0)),
            'status' => input('status/s', 'all'),
            'isend' => input('isend/s', 'all'),
            'source' => input('source/s', ''),
            'seo' => input('seo/s', 'all'),
            'pic' => input('pic/s', 'all'),
            'limit' => intval(input('limit/d', 30)),
            'page' => intval(input('page/d', 1)),
        ]);
        $filters = $library['filters'];
        $page = intval($library['page']);
        $pageQuery = [
            'q' => $filters['q'],
            'type_id' => $filters['type_id'],
            'status' => $filters['status'],
            'isend' => $filters['isend'],
            'source' => $filters['source'],
            'seo' => $filters['seo'],
            'pic' => $filters['pic'],
            'limit' => $filters['limit'],
        ];
        $library['prev_url'] = !empty($library['has_prev'])
            ? url('vodops/videos', array_merge($pageQuery, ['page' => $page - 1]))
            : '';
        $library['next_url'] = !empty($library['has_next'])
            ? url('vodops/videos', array_merge($pageQuery, ['page' => $page + 1]))
            : '';
        return $library;
    }

    private function guardAjaxPost()
    {
        if (!request()->isPost() || !request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        return null;
    }

    private function assignDoubanWorkspace()
    {
        $status = trim((string) input('status', 'all'));
        $q = trim((string) input('q', ''));
        $typeId = max(0, (int) input('type_id/d', 0));
        $year = trim((string) input('year', ''));
        if (!preg_match('/^\d{4}$/', $year) || (int) $year < 1800 || (int) $year > 2100) {
            $year = '';
        }
        $taskStatus = strtoupper(trim((string) input('task_status', 'PENDING')));
        if (!in_array($taskStatus, ['PENDING', 'RUNNING', 'FAILED', 'SUCCESS', 'SKIP', 'ALL'], true)) {
            $taskStatus = 'PENDING';
        }
        $page = max(1, (int) input('page/d', 1));
        $limit = max(10, min(100, (int) input('limit/d', 20)));
        $auditScanId = max(0, (int) input('audit_scan_id/d', 0));
        $auditCode = trim((string) input('audit_code', ''));
        $auditQ = trim((string) input('audit_q', ''));
        $auditPage = max(1, (int) input('audit_page/d', 1));
        $dashboard = DoubanData::dashboard();
        $videos = DoubanData::listVideos($status, $page, $limit, $q, $typeId, $year);
        $tasks = DoubanData::listTasks($taskStatus, 50);
        $audit = DoubanData::auditDashboard($auditScanId, $auditCode, $auditPage, 20, $auditQ);
        $currentPage = (int) ($videos['page'] ?? 1);
        $pageQuery = [
            'status' => $status,
            'task_status' => $taskStatus,
            'q' => $q,
            'type_id' => $typeId,
            'year' => $year,
            'limit' => $limit,
        ];
        $videos['prev_url'] = !empty($videos['has_prev'])
            ? url('vodops/douban', array_merge($pageQuery, ['page' => $currentPage - 1]))
            : '';
        $videos['next_url'] = !empty($videos['has_next'])
            ? url('vodops/douban', array_merge($pageQuery, ['page' => $currentPage + 1]))
            : '';
        $auditPagination = $audit['pagination'];
        $auditCurrentPage = (int) ($auditPagination['page'] ?? 1);
        $auditQuery = array_merge($pageQuery, [
            'page' => $currentPage,
            'audit_scan_id' => (int) ($audit['scan']['scan_id'] ?? 0),
            'audit_code' => (string) ($audit['filters']['code'] ?? ''),
            'audit_q' => (string) ($audit['filters']['q'] ?? ''),
        ]);
        $auditPagination['prev_url'] = !empty($auditPagination['has_prev'])
            ? url('vodops/douban', array_merge($auditQuery, ['audit_page' => $auditCurrentPage - 1]))
            : '';
        $auditPagination['next_url'] = !empty($auditPagination['has_next'])
            ? url('vodops/douban', array_merge($auditQuery, ['audit_page' => $auditCurrentPage + 1]))
            : '';

        $this->assign('config', $dashboard['config']);
        $this->assign('stats', $dashboard['stats']);
        $this->assign('task_stats', $dashboard['task_stats']);
        $this->assign('logs', $dashboard['logs']);
        $this->assign('categories', $dashboard['categories']);
        $this->assign('videos', $videos['data']);
        $this->assign('tasks', $tasks);
        $this->assign('pagination', $videos);
        $this->assign('status', $status);
        $this->assign('task_status', $taskStatus);
        $this->assign('q', $q);
        $this->assign('type_id', $typeId);
        $this->assign('year', $year);
        $this->assign('audit_scan', $audit['scan']);
        $this->assign('audit_issues', $audit['issues']);
        $this->assign('audit_stats', $audit['stats']);
        $this->assign('audit_codes', $audit['codes']);
        $this->assign('audit_filters', $audit['filters']);
        $this->assign('audit_pagination', $auditPagination);
        $this->assign('audit_export_url', !empty($audit['scan'])
            ? url('douban/exportAudit', [
                'scan_id' => (int) ($audit['scan']['scan_id'] ?? 0),
                'code' => (string) ($audit['filters']['code'] ?? ''),
            ])
            : '');
        $this->assign('current_url', url('vodops/douban'));
    }

    private function adminId()
    {
        return intval($this->_admin['admin_id'] ?? 0);
    }

    private function cleanQuery($query)
    {
        $query = trim(strip_tags((string) $query));
        $query = str_replace(["\0", "\r", "\n", "\t"], '', $query);
        if (function_exists('mb_substr')) {
            return mb_substr($query, 0, 80, 'UTF-8');
        }
        return substr($query, 0, 240);
    }

    private function providerIds($values)
    {
        if (!is_array($values)) {
            return [];
        }

        $ids = [];
        foreach ($values as $value) {
            if (!is_int($value) && !is_string($value)) {
                continue;
            }
            $value = (string) $value;
            if (!preg_match('/^[1-9][0-9]{0,9}$/D', $value)) {
                continue;
            }
            $id = intval($value);
            if ($id < 1 || $id > 2147483647 || isset($ids[$id])) {
                continue;
            }
            $ids[$id] = $id;
            if (count($ids) >= 8) {
                break;
            }
        }
        return array_values($ids);
    }

    private function providerSelectionInitialized($value)
    {
        if (is_bool($value)) {
            return $value;
        }
        return $value === 1 || $value === '1';
    }

    private function errorJson($action, \Throwable $error)
    {
        $this->logFailure($action, $error);
        return json(['code' => 1002, 'msg' => $action . '失败，请查看服务端日志。'], 500);
    }

    private function logFailure($action, \Throwable $error)
    {
        if (function_exists('trace')) {
            trace('[vodops] ' . $action . '失败：' . $error->getMessage(), 'error');
        }
    }
}
