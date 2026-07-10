<?php

namespace addons\douban\controller;

use addons\douban\service\DoubanData;
use think\addons\Controller;

class Index extends Controller
{
    public function index()
    {
        if (!$this->isAdmin()) {
            return '请先使用管理员账号登录后台后访问该页面。';
        }

        $status = trim((string) input('status', 'review'));
        $q = trim((string) input('q', ''));
        $page = max(1, (int) input('page/d', 1));
        $limit = max(10, min(100, (int) input('limit/d', 20)));
        $dashboard = DoubanData::dashboard();
        $videos = DoubanData::listVideos($status, $page, $limit, $q);

        $this->assign('config', $dashboard['config']);
        $this->assign('stats', $dashboard['stats']);
        $this->assign('task_stats', $dashboard['task_stats']);
        $this->assign('logs', $dashboard['logs']);
        $this->assign('videos', $videos['data']);
        $this->assign('pagination', $videos);
        $this->assign('status', $status);
        $this->assign('q', $q);
        $this->assign('current_url', url('douban/index'));

        return $this->fetch();
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

    public function calibrate()
    {
        if (($error = $this->guardPost()) !== null) {
            return $error;
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

    private function guardPost()
    {
        if (!Request()->isPost()) {
            return json(['code' => 1001, 'msg' => '请求方式错误']);
        }
        if (!$this->isAdmin()) {
            return json(['code' => 1003, 'msg' => '请先登录管理员账号']);
        }

        return null;
    }

    private function errorJson(\Throwable $e)
    {
        return json([
            'code' => 1002,
            'msg' => $e->getMessage(),
            'data' => null,
        ]);
    }

    private function isAdmin()
    {
        return $this->adminId() > 0;
    }

    private function adminId()
    {
        try {
            $result = model('Admin')->checkLogin();
            if ((int) ($result['code'] ?? 0) === 1) {
                return (int) ($result['info']['admin_id'] ?? 0);
            }
        } catch (\Throwable $e) {
        }

        return 0;
    }
}
