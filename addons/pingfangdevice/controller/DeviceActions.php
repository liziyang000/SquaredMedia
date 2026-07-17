<?php

namespace addons\pingfangdevice\controller;

use addons\pingfangdevice\service\DeviceSession;
use addons\pingfangdevice\service\VodFilterOptions;

trait DeviceActions
{
    public function login()
    {
        if (!Request()->isPost()) {
            return redirect(url('user/login'));
        }
        if (!Request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }

        $param = input();
        $param += ['verify' => '', 'openid' => '', 'col' => ''];
        $res = model('User')->login($param, ['return_meta' => true]);
        if (($res['code'] ?? 0) == 1 && !empty($res['meta'])) {
            try {
                DeviceSession::registerLogin($res['meta']);
            } catch (\Throwable $e) {
                if (function_exists('trace')) {
                    trace('[pingfangdevice] Failed to register login: ' . $e->getMessage(), 'error');
                }
                try {
                    DeviceSession::logoutCurrentDevice(intval($res['meta']['user_id'] ?? 0));
                } catch (\Throwable $ignored) {
                }
                model('User')->logout();
                return json(['code' => 1004, 'msg' => '设备会话创建失败，请重试'], 500);
            }
        }
        unset($res['meta']);

        return json($res);
    }

    public function revoke()
    {
        if (!Request()->isPost() || !Request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }

        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return json(['code' => 1002, 'msg' => '请先登录'], 401);
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
        if (!Request()->isPost() || !Request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }

        $user = null;
        try {
            $user = DeviceSession::currentUser();
        } catch (\Throwable $e) {
            if (function_exists('trace')) {
                trace('[pingfangdevice] Failed to read logout user: ' . $e->getMessage(), 'error');
            }
        }
        try {
            DeviceSession::logoutCurrentDevice(intval($user['user_id'] ?? 0));
        } catch (\Throwable $e) {
            if (function_exists('trace')) {
                trace('[pingfangdevice] Failed to revoke logout session: ' . $e->getMessage(), 'error');
            }
        }

        model('User')->logout();
        return json(['code' => 1, 'msg' => '已退出登录']);
    }
}
