<?php

namespace app\index\controller;

use addons\pingfangdevice\service\DeviceSession;

class Pingfangdevice extends Base
{
    public function index()
    {
        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return redirect(url('user/login'));
        }

        $this->assign('obj', $user);
        $this->assign('user', $user);
        $this->assign('device_list', DeviceSession::listSessions($user['user_id']));
        $this->assign('csrf_token', DeviceSession::csrfToken());
        return $this->fetch('pingfangdevice/index');
    }

    public function login()
    {
        if (!Request()->isPost()) {
            return redirect(url('user/login'));
        }
        if (!DeviceSession::validateCsrf()) {
            return json(['code' => 1004, 'msg' => '请求校验失败']);
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
        if (!DeviceSession::validateCsrf()) {
            return json(['code' => 1004, 'msg' => '请求校验失败']);
        }

        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return json(['code' => 1002, 'msg' => '请先登录']);
        }

        return json(DeviceSession::revokeSession($user['user_id'], input('session_id/d', 0)));
    }

    public function logout()
    {
        if (!Request()->isPost()) {
            if (request()->isAjax()) {
                return json(['code' => 1001, 'msg' => '请求方式错误']);
            }

            return redirect(url('user/index'));
        }
        if (!DeviceSession::validateCsrf()) {
            return json(['code' => 1004, 'msg' => '请求校验失败']);
        }

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
