<?php

namespace app\admin\controller;

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
        $this->assign('title', '视频数据质量中心');

        return $this->fetch('vodops/index');
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
                    $this->adminId()
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

    private function guardAjaxPost()
    {
        if (!request()->isPost() || !request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        return null;
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
