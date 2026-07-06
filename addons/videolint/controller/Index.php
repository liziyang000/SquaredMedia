<?php

namespace addons\videolint\controller;

use addons\videolint\service\QualityScanner;
use think\addons\Controller;

class Index extends Controller
{
    public function index()
    {
        if ((int) session('admin_id') < 1) {
            return '请先使用管理员账号登录后台后访问该页面。';
        }

        $scanId = (int) input('scan_id/d', 0);
        $level = trim((string) input('level', ''));
        $q = trim((string) input('q', ''));
        $page = max(1, (int) input('page', 1));
        $limit = max(20, min(100, (int) input('limit', 20)));

        $latest = null;
        if ($scanId < 1) {
            $latest = QualityScanner::getLatestScan();
            if (is_array($latest) && !empty($latest['scan_id'])) {
                $scanId = (int) $latest['scan_id'];
            }
        }

        $scan = QualityScanner::getScan($scanId);
        $issues = ['data' => [], 'total' => 0, 'page' => $page, 'limit' => $limit];
        $issueStats = [ 'critical' => 0, 'warning' => 0, 'info' => 0 ];
        if (!empty($scan)) {
            $issues = QualityScanner::listIssues((int) $scan['scan_id'], $level, $page, $limit, $q);
            $issueStats = QualityScanner::getIssueStats((int) $scan['scan_id']);
        }

        $scans = QualityScanner::listScans(1, 20);
        $this->assign('latest', $latest);
        $this->assign('scan', $scan);
        $this->assign('scan_list', is_array($scans) ? $scans : []);
        $this->assign('issues', $issues['data']);
        $this->assign('issues_pagination', $issues);
        $this->assign('issue_stats', $issueStats);
        $this->assign('q', $q);
        $this->assign('level', $level);
        $this->assign('scan_id', $scanId);
        $this->assign('csrf_token', $this->csrfToken());

        return $this->fetch();
    }

    public function run()
    {
        if (!Request()->isPost()) {
            return json(['code' => 1001, 'msg' => '请求方式错误']);
        }
        $adminId = (int) session('admin_id');
        if ($adminId < 1) {
            return json(['code' => 1003, 'msg' => '请先登录管理员账号']);
        }
        if (!$this->validateCsrf()) {
            return json(['code' => 1004, 'msg' => '请求校验失败']);
        }

        $options = [
            'batch_size' => (int) input('batch_size/d', 200),
            'max_items_per_scan' => (int) input('max_items_per_scan/d', 0),
            'check_cover_head' => (int) input('check_cover_head/d', 0) === 1,
            'cover_head_timeout' => (int) input('cover_head_timeout/d', 3),
            'duplicate_group_limit' => (int) input('duplicate_group_limit/d', 200),
            'run_by' => $adminId,
        ];

        try {
            $result = QualityScanner::run($options);
            return json([
                'code' => 1,
                'msg' => '扫描完成',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return json([
                'code' => 1002,
                'msg' => $e->getMessage(),
                'data' => null,
            ]);
        }
    }

    public function resolve()
    {
        if (!Request()->isPost()) {
            return json(['code' => 1001, 'msg' => '请求方式错误']);
        }
        $adminId = (int) session('admin_id');
        if ($adminId < 1) {
            return json(['code' => 1003, 'msg' => '请先登录管理员账号']);
        }
        if (!$this->validateCsrf()) {
            return json(['code' => 1004, 'msg' => '请求校验失败']);
        }

        $issueId = (int) input('issue_id/d', 0);
        if ($issueId < 1) {
            return json(['code' => 1002, 'msg' => '参数错误']);
        }

        QualityScanner::markResolved($issueId, $adminId);
        return json(['code' => 1, 'msg' => '已标记为已处理']);
    }

    public function export()
    {
        if ((int) session('admin_id') < 1) {
            return '请先使用管理员账号登录后台后访问该页面。';
        }

        $scanId = (int) input('scan_id/d', 0);
        if ($scanId < 1) {
            return 'scan_id missing';
        }

        $level = trim((string) input('level', ''));
        $issues = QualityScanner::listIssuesExport($scanId, $level);
        if (is_object($issues) && method_exists($issues, 'toArray')) {
            $issues = $issues->toArray();
        }
        if (!is_array($issues)) {
            $issues = [];
        }

        $filename = sprintf('videolint_%d_%s.csv', $scanId, date('Ymd_His'));
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="'.$filename.'"');

        $fp = fopen('php://output', 'w');
        fwrite($fp, "\xEF\xBB\xBF");
        fputcsv($fp, ['scan_id', 'issue_id', 'vod_id', 'vod_name', 'issue_level', 'issue_code', 'field_name', 'message', 'resolved_at']);
        foreach ($issues as $issue) {
            if (!is_array($issue)) {
                continue;
            }
            fputcsv($fp, [
                (string) $scanId,
                (string) ($issue['issue_id'] ?? ''),
                (string) ($issue['vod_id'] ?? ''),
                (string) ($issue['vod_name'] ?? ''),
                (string) ($issue['issue_level'] ?? ''),
                (string) ($issue['issue_code'] ?? ''),
                (string) ($issue['field_name'] ?? ''),
                (string) ($issue['message'] ?? ''),
                (string) ($issue['resolved_at'] ?? 0),
            ]);
        }
        fclose($fp);

        return null;
    }

    private function csrfToken()
    {
        $token = (string) session('videolint_csrf_token');
        if (!preg_match('/\A[a-f0-9]{64}\z/i', $token)) {
            $token = bin2hex(random_bytes(32));
            session('videolint_csrf_token', $token);
        }

        return $token;
    }

    private function validateCsrf()
    {
        $expected = (string) session('videolint_csrf_token');
        $provided = trim((string) input('csrf_token', ''));
        if ($provided === '') {
            $request = request();
            if (is_object($request) && method_exists($request, 'header')) {
                $provided = trim((string) $request->header('X-PingFang-CSRF', ''));
            }
        }

        return preg_match('/\A[a-f0-9]{64}\z/i', $expected) === 1
            && preg_match('/\A[a-f0-9]{64}\z/i', $provided) === 1
            && hash_equals($expected, $provided);
    }
}
