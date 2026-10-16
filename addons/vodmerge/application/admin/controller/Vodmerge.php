<?php

namespace app\admin\controller;

require_once dirname(__DIR__, 3) . '/addons/vodmerge/bootstrap.php';

use addons\vodmerge\service\Runtime;
use addons\vodmerge\service\Jev;

class Vodmerge extends Base
{
    public function __construct()
    {
        parent::__construct();
        if ((int) ($this->_admin['admin_id'] ?? 0) !== 1) {
            throw new \think\exception\HttpException(403, '仅超级管理员可以操作采集合并。');
        }
        $this->view->config('view_path', APP_PATH . 'admin/view_new/');
    }

    public function index()
    {
        if (!session('vodmerge_csrf')) {
            session('vodmerge_csrf', bin2hex(random_bytes(32)));
        }
        $this->assign('csrf', session('vodmerge_csrf'));
        $this->assign('native_token', (string) session('admin_csrf') ?: request()->token());
        $this->assign('auto_bound', Runtime::autoBound() ? '开启' : '关闭');
        $this->assign('auto_first', Runtime::autoFirst() ? '开启' : '关闭');
        $status = Runtime::jevStatus();
        $this->assign('jev_ready', $status['configured'] ? '已配置' : '未配置');
        $this->assign('jev_source', $status['source']);
        return $this->fetch('vodmerge/index');
    }

    public function settings()
    {
        if (!request()->isPost() || !request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        $csrf = (string) session('vodmerge_csrf');
        if ($csrf === '' || !hash_equals($csrf, (string) input('post.csrf/s', ''))) {
            return json(['code' => 1002, 'msg' => '页面已失效，请刷新。'], 403);
        }
        try {
            $key = input('post.api_token', '', 'trim');
            if (!is_string($key)) {
                throw new \InvalidArgumentException('Token 必须为文本。');
            }
            switch ((string) input('post.operation/s', '')) {
                case 'save':
                    $status = Runtime::saveJevKey($key);
                    $message = trim($key) === '' ? '未输入新 Token，保留原配置。' : 'Jev Token 已保存，后台与 Worker 将使用新配置。';
                    break;
                case 'clear':
                    $status = Runtime::saveJevKey($key, true);
                    $message = 'Jev Token 已清除。';
                    break;
                case 'test':
                    $result = Jev::testConnection($key);
                    if (($result['status'] ?? '') !== 'ok') {
                        $http = (int) ($result['http_status'] ?? 0);
                        if (($result['status'] ?? '') === 'unavailable') {
                            $message = '尚未配置 Jev Token，或服务器未启用 cURL。';
                        } elseif (($result['status'] ?? '') === 'invalid') {
                            $message = 'Jev 返回格式无效，连接测试未通过。';
                        } elseif ($http === 401 || $http === 403) {
                            $message = 'Jev Token 认证失败，请检查 Token。';
                        } elseif ($http === 429) {
                            $message = 'Jev 请求已限流，请稍后重试。';
                        } elseif ($http >= 500) {
                            $message = 'Jev 上游服务暂时不可用，请稍后重试。';
                        } elseif ($http === 0) {
                            $message = 'Jev 网络连接失败或超时，请检查服务器网络。';
                        } else {
                            $message = 'Jev 连接测试失败，请检查服务器配置后重试。';
                        }
                        throw new \RuntimeException($message);
                    }
                    $status = Runtime::jevStatus();
                    $message = 'Jev 连接测试通过。';
                    break;
                default:
                    throw new \InvalidArgumentException('未知配置操作。');
            }
            return json(['code' => 1, 'data' => array_merge($status, ['message' => $message])]);
        } catch (\InvalidArgumentException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 400);
        } catch (\RuntimeException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 409);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '配置操作失败，请检查服务器权限或网络后重试。'], 503);
        }
    }

    public function auditStatus()
    {
        try {
            return json(['code' => 1, 'data' => Runtime::audit()->summary()]);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '读取排查状态失败，请确认插件已升级并安装数据表。'], 503);
        }
    }

    public function auditIssues()
    {
        try {
            return json(['code' => 1, 'data' => Runtime::audit()->issues(
                max(0, (int) input('run_id/d', 0)),
                max(0, (int) input('before/d', 0)),
                (string) input('kind/s', ''),
                (string) input('quality/s', ''),
                (int) input('before_priority/d', -1)
            )]);
        } catch (\InvalidArgumentException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 400);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '读取排查结果失败，请刷新后重试。'], 503);
        }
    }

    private function libraryId(string $name): int
    {
        $id = input($name, 0);
        if ((!is_string($id) && !is_int($id)) || !preg_match('/^[1-9][0-9]{0,18}$/D', (string) $id)
            || (string) (int) $id !== (string) $id) {
            throw new \InvalidArgumentException('影片对或合并记录编号无效。');
        }
        return (int) $id;
    }

    private function libraryFlag(string $name): bool
    {
        $value = input($name, 0);
        if ((!is_string($value) && !is_int($value)) || !in_array((string) $value, ['0', '1'], true)) {
            throw new \InvalidArgumentException('人工审核选项无效。');
        }
        return (string) $value === '1';
    }

    public function libraryStatus()
    {
        try {
            $issueId = $this->libraryId('issue_id');
            return json(['code' => 1, 'data' => Runtime::service()->libraryStatus($issueId)]);
        } catch (\PDOException $error) {
            return json(['code' => 1004, 'msg' => '读取人工合并记录失败，请刷新后重试。'], 503);
        } catch (\InvalidArgumentException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 400);
        } catch (\RuntimeException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 409);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '读取人工合并记录失败，请刷新后重试。'], 503);
        }
    }

    public function auditAction()
    {
        if (!request()->isPost() || !request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        $csrf = (string) session('vodmerge_csrf');
        if ($csrf === '' || !hash_equals($csrf, (string) input('post.csrf/s', ''))) {
            return json(['code' => 1002, 'msg' => '页面已失效，请刷新。'], 403);
        }
        try {
            switch ((string) input('post.operation/s', '')) {
                case 'start':
                    $result = Runtime::audit()->start((int) input('post.weekly/d', 0) === 1);
                    break;
                case 'schedule':
                    $result = Runtime::audit()->schedule((int) input('post.enabled/d', 0) === 1);
                    break;
                case 'review':
                    $issueId = input('post.issue_id', 0);
                    $force = input('post.force', 0);
                    if ((!is_string($issueId) && !is_int($issueId)) || !preg_match('/^[1-9][0-9]{0,18}$/D', (string) $issueId)
                        || (string) (int) $issueId !== (string) $issueId || (!is_string($force) && !is_int($force)) || !in_array((string) $force, ['0', '1'], true)) {
                        throw new \InvalidArgumentException('排查影片对或复核参数无效。');
                    }
                    $result = Runtime::audit()->reviewIssue((int) $issueId, (string) $force === '1');
                    break;
                case 'merge_preview':
                    $issueId = $this->libraryId('post.issue_id');
                    $targetId = $this->libraryId('post.target_id');
                    $separate = $this->libraryFlag('post.separate');
                    if (!$this->libraryFlag('post.confirmed')) {
                        throw new \InvalidArgumentException('请先核对同一作品、同季、同版本，再生成预览。');
                    }
                    $result = Runtime::service()->libraryPreview($issueId, $targetId, $separate);
                    break;
                case 'merge_apply':
                    $issueId = $this->libraryId('post.issue_id');
                    $jobId = $this->libraryId('post.job_id');
                    $token = input('post.preview_token', '');
                    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
                        throw new \InvalidArgumentException('预览凭据无效，请重新预览。');
                    }
                    $result = Runtime::service()->libraryApply($issueId, $jobId, $token, (int) $this->_admin['admin_id']);
                    Runtime::invalidate();
                    break;
                case 'merge_rollback':
                    $issueId = $this->libraryId('post.issue_id');
                    $jobId = $this->libraryId('post.job_id');
                    $result = Runtime::service()->libraryRollback($issueId, $jobId, (int) $this->_admin['admin_id']);
                    Runtime::invalidate();
                    break;
                case 'merge_recover':
                    $issueId = $this->libraryId('post.issue_id');
                    $jobId = $this->libraryId('post.job_id');
                    $result = Runtime::service()->libraryRecover($issueId, $jobId);
                    Runtime::invalidate();
                    break;
                default:
                    throw new \InvalidArgumentException('未知排查操作。');
            }
            return json(['code' => 1, 'data' => $result]);
        } catch (\PDOException $error) {
            error_log('[vodmerge] Library audit database operation failed.');
            return json(['code' => 1004, 'msg' => '排查数据库操作未完成，请刷新查看状态并检查服务器日志。'], 503);
        } catch (\InvalidArgumentException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 400);
        } catch (\RuntimeException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 409);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '排查操作未完成，请刷新查看状态后重试。'], 503);
        }
    }

    public function jobs()
    {
        try {
            return json(['code' => 1, 'data' => Runtime::service()->jobs(max(0, (int) input('before/d', 0)))]);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '读取失败，请先安装插件数据表。'], 503);
        }
    }

    public function detail()
    {
        try {
            return json(['code' => 1, 'data' => Runtime::service()->detail((int) input('job_id/d', 0))]);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '任务不存在或插件未安装。'], 404);
        }
    }

    public function action()
    {
        if (!request()->isPost() || !request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }
        $csrf = (string) session('vodmerge_csrf');
        if ($csrf === '' || !hash_equals($csrf, (string) input('post.csrf/s', ''))) {
            return json(['code' => 1002, 'msg' => '页面已失效，请刷新。'], 403);
        }
        try {
            $service = Runtime::service();
            $id = (int) input('post.job_id/d', 0);
            $operator = (int) $this->_admin['admin_id'];
            switch ((string) input('post.operation/s', '')) {
                case 'review':
                    $result = $service->review($id, (int) input('post.force/d', 0) === 1);
                    break;
                case 'requeue':
                    $result = $service->requeue($id);
                    break;
                case 'preview':
                    $result = $service->preview($id, max(0, (int) input('post.target_id/d', 0)), (int) input('post.separate/d', 0) === 1);
                    break;
                case 'apply':
                    $result = $service->apply($id, (string) input('post.preview_token/s', ''), $operator);
                    Runtime::invalidate();
                    break;
                case 'rollback':
                    $result = $service->rollback($id, $operator);
                    Runtime::invalidate();
                    break;
                case 'recover':
                    $result = $service->recover($id);
                    Runtime::invalidate();
                    break;
                case 'reject':
                    $result = $service->reject($id);
                    break;
                default:
                    throw new \InvalidArgumentException('未知操作。');
            }
            return json(['code' => 1, 'data' => $result]);
        } catch (\PDOException $error) {
            error_log('[vodmerge] Database operation failed; inspect job snapshots.');
            return json(['code' => 1004, 'msg' => '数据库操作未完成，请刷新查看写入状态，勿重复新增。'], 503);
        } catch (\RuntimeException $error) {
            return json(['code' => 1003, 'msg' => $error->getMessage()], 409);
        } catch (\Throwable $error) {
            return json(['code' => 1004, 'msg' => '请求失败，请刷新后检查任务状态。'], 400);
        }
    }
}
