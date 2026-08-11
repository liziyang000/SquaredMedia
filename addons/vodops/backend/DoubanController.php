<?php

namespace addons\vodops\backend;

use addons\vodops\service\DoubanActionException;
use addons\vodops\service\DoubanData;
use app\admin\controller\Base;

class DoubanController extends Base
{
    public function __construct()
    {
        parent::__construct();
        $this->view->config('view_path', dirname(__DIR__) . DIRECTORY_SEPARATOR . 'view' . DIRECTORY_SEPARATOR);
    }

    public function index()
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
            ? url('douban/index', array_merge($pageQuery, ['page' => $currentPage - 1]))
            : '';
        $videos['next_url'] = !empty($videos['has_next'])
            ? url('douban/index', array_merge($pageQuery, ['page' => $currentPage + 1]))
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
            ? url('douban/index', array_merge($auditQuery, ['audit_page' => $auditCurrentPage - 1]))
            : '';
        $auditPagination['next_url'] = !empty($auditPagination['has_next'])
            ? url('douban/index', array_merge($auditQuery, ['audit_page' => $auditCurrentPage + 1]))
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
        $this->assign('current_url', url('douban/index'));

        return $this->fetch('index/index');
    }

    public function saveConfig()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '配置已保存',
                'data' => DoubanData::saveConfig(input()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function enqueue()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            $limit = (int) input('limit/d', 100);
            return json([
                'code' => 1,
                'msg' => '任务已生成',
                'data' => DoubanData::enqueueDue($limit, $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function previewTargeted()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '定向任务预览完成',
                'data' => DoubanData::previewTargetedTasks(input()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function enqueueTargeted()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }
        if ((int) input('confirm/d', 0) !== 1) {
            return json(['code' => 1001, 'msg' => '请先预览并确认定向任务']);
        }

        try {
            return json([
                'code' => 1,
                'msg' => '定向任务已生成',
                'data' => DoubanData::enqueueTargeted(input(), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function run()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            $limit = (int) input('limit/d', 20);
            return json([
                'code' => 1,
                'msg' => 'Worker 执行完成',
                'data' => DoubanData::runPending($limit, $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function retryFailed()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            $limit = (int) input('limit/d', 100);
            return json([
                'code' => 1,
                'msg' => '失败任务已重新入队',
                'data' => DoubanData::retryFailed($limit, $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function fetchVod()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            $result = DoubanData::fetchVod((int) input('vod_id/d', 0), $this->adminId());
            return json([
                'code' => 1,
                'msg' => (string) ($result['msg'] ?? '豆瓣数据获取完成'),
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function sync()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '同步完成',
                'data' => DoubanData::syncVod((int) input('vod_id/d', 0), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function rollbackPic()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }
        if ((int) input('confirm/d', 0) !== 1) {
            return json(['code' => 1001, 'msg' => '请确认回退图片']);
        }

        try {
            return json([
                'code' => 1,
                'msg' => '图片已回退',
                'data' => DoubanData::rollbackPicture((int) input('vod_id/d', 0), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function calibrate()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }
        if ((int) input('confirm/d', 0) !== 1) {
            return json(['code' => 1001, 'msg' => '请确认执行全量评分校准']);
        }

        try {
            return json([
                'code' => 1,
                'msg' => '豆瓣评分校准完成',
                'data' => DoubanData::calibrateScores($this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function previewCalibration()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '分类校准预览完成',
                'data' => DoubanData::previewScoreCalibration(
                    (array) input('type_ids/a', []),
                    (int) input('include_children/d', 1)
                ),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function calibrateByType()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }
        if ((int) input('confirm/d', 0) !== 1) {
            return json(['code' => 1001, 'msg' => '请先预览并确认分类校准']);
        }

        try {
            return json([
                'code' => 1,
                'msg' => '所选分类的评分校准任务已生成',
                'data' => DoubanData::calibrateScoresByType(
                    (array) input('type_ids/a', []),
                    (int) input('include_children/d', 1),
                    $this->adminId()
                ),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function setDoubanId()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '豆瓣ID已保存',
                'data' => DoubanData::setDoubanId(
                    (int) input('vod_id/d', 0),
                    (string) input('douban_id', ''),
                    (int) input('lock/d', 0),
                    $this->adminId()
                ),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function lock()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '锁定状态已更新',
                'data' => DoubanData::setLock(
                    (int) input('vod_id/d', 0),
                    (string) input('field', 'id'),
                    (int) input('locked/d', 1),
                    $this->adminId()
                ),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function ignore()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '已忽略',
                'data' => DoubanData::ignore((int) input('vod_id/d', 0), (int) input('days/d', 30), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function startAudit()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }
        if ((int) input('confirm/d', 0) !== 1) {
            return json(['code' => 1001, 'msg' => '请确认开始全库体检']);
        }

        try {
            return json([
                'code' => 1,
                'msg' => '全库体检已开始',
                'data' => DoubanData::startAudit((int) input('batch_size/d', 100), $this->adminId()),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function runAuditBatch()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '本批体检完成',
                'data' => DoubanData::runAuditBatch((int) input('scan_id/d', 0)),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function pauseAudit()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '全库体检已暂停',
                'data' => DoubanData::pauseAudit((int) input('scan_id/d', 0)),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function resumeAudit()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
        }

        try {
            return json([
                'code' => 1,
                'msg' => '全库体检已恢复',
                'data' => DoubanData::resumeAudit((int) input('scan_id/d', 0)),
            ]);
        } catch (\Throwable $e) {
            return $this->errorJson($e);
        }
    }

    public function exportAudit()
    {
        $scanId = max(0, (int) input('scan_id/d', 0));
        if ($scanId < 1) {
            return '体检任务ID无效。';
        }
        $code = trim((string) input('code', ''));

        try {
            $afterId = 0;
            $rows = DoubanData::auditIssueExportBatch($scanId, $afterId, 1000, $code);
            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="douban-audit-' . $scanId . '-' . date('Ymd-His') . '.csv"');
            header('X-Content-Type-Options: nosniff');
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ['问题ID', '扫描ID', '视频ID', '分类ID', '视频名称', '级别', '问题代码', '字段', '说明', '记录时间']);
            while (true) {
                foreach ($rows as $row) {
                    $afterId = max($afterId, (int) ($row['issue_id'] ?? 0));
                    fputcsv($output, [
                        (int) ($row['issue_id'] ?? 0),
                        (int) ($row['scan_id'] ?? 0),
                        (int) ($row['vod_id'] ?? 0),
                        (int) ($row['type_id'] ?? 0),
                        $this->csvCell($row['vod_name'] ?? ''),
                        $this->csvCell($row['issue_level'] ?? ''),
                        $this->csvCell($row['issue_code'] ?? ''),
                        $this->csvCell($row['field_name'] ?? ''),
                        $this->csvCell($row['message'] ?? ''),
                        date('Y-m-d H:i:s', (int) ($row['created_at'] ?? 0)),
                    ]);
                }
                if (count($rows) < 1000) {
                    break;
                }
                $rows = DoubanData::auditIssueExportBatch($scanId, $afterId, 1000, $code);
            }
            fclose($output);

            return '';
        } catch (\Throwable $e) {
            $this->logFailure('导出体检报告', $e);
            return '导出失败，请查看服务端日志。';
        }
    }

    private function csvCell($value)
    {
        $value = (string) $value;
        return preg_match('/^[\s]*[=+\-@]/u', $value) ? ("'" . $value) : $value;
    }

    private function guardPost()
    {
        if (!Request()->isPost()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        if (!Request()->isAjax()) {
            return json(['code' => 1004, 'msg' => '请求来源校验失败'], 405);
        }

        return null;
    }

    private function errorJson(\Throwable $e)
    {
        if ($e instanceof DoubanActionException || $e instanceof \InvalidArgumentException) {
            return json([
                'code' => 1003,
                'msg' => $e->getMessage(),
                'data' => null,
            ], 409);
        }

        $this->logFailure('豆瓣操作', $e);
        return json([
            'code' => 1002,
            'msg' => '豆瓣操作失败，请查看服务端日志。',
            'data' => null,
        ], 500);
    }

    private function adminId()
    {
        return (int) ($this->_admin['admin_id'] ?? 0);
    }

    private function logFailure(string $action, \Throwable $error)
    {
        if (function_exists('trace')) {
            trace('[vodops] ' . $action . '失败：' . $error->getMessage(), 'error');
        }
    }
}
