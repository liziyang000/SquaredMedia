<?php

namespace addons\squareddevice\controller;

use addons\squareddevice\service\DeviceSession;
use addons\squareddevice\service\VodFilterOptions;
use think\addons\Controller;

class Index extends Controller
{
    public function index()
    {
        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return redirect(url('user/login'));
        }

        $this->assign('user', $user);
        $this->assign('device_list', DeviceSession::listSessions($user['user_id']));
        $this->assign('current_url', addon_url('squareddevice/index/index'));
        return $this->fetch();
    }

    public function login()
    {
        if (!Request()->isPost()) {
            return redirect(url('user/login'));
        }

        $param = input();
        $res = model('User')->login($param, ['return_meta' => true]);
        if (($res['code'] ?? 0) == 1 && !empty($res['meta'])) {
            DeviceSession::registerLogin($res['meta']);
            unset($res['meta']);
        }

        return json($res);
    }

    public function revoke()
    {
        if (!Request()->isPost()) {
            return json(['code' => 1001, 'msg' => '请求方式错误']);
        }

        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return json(['code' => 1002, 'msg' => '请先登录']);
        }

        return json(DeviceSession::revokeSession($user['user_id'], input('session_id/d', 0)));
    }

    public function filters()
    {
        if (!request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误']);
        }

        try {
            return json(VodFilterOptions::filters(input()));
        } catch (\Throwable $e) {
            return json(['code' => 1002, 'msg' => '筛选项加载失败', 'data' => ['filters' => []]]);
        }
    }

    public function logout()
    {
        $user = DeviceSession::currentUser();
        if (!empty($user)) {
            DeviceSession::logoutCurrentDevice($user['user_id']);
        }

        model('User')->logout();

        if (request()->isAjax()) {
            return json(['code' => 1, 'msg' => '已退出登录']);
        }

        return redirect(url('user/login'));
    }
}
