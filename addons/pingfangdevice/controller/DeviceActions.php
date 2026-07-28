<?php

namespace addons\pingfangdevice\controller;

use addons\pingfangdevice\service\DeviceSession;
use addons\pingfangdevice\service\GameAccessTicket;
use addons\pingfangdevice\service\VodFilterOptions;
use addons\pingfangdevice\service\VodSourceQuality;

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

    public function sourceQuality()
    {
        if (!Request()->isPost() || !Request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }

        try {
            return json(VodSourceQuality::check(input('vod_id/d', 0), input('nid/d', 1)));
        } catch (\Throwable $e) {
            if (function_exists('trace')) {
                trace('[pingfangdevice] Source quality check failed: ' . $e->getMessage(), 'error');
            }
            return json(['code' => 1003, 'msg' => '线路检测失败，请稍后重试'], 500);
        }
    }

    public function gameTicket()
    {
        if (!Request()->isPost() || !Request()->isAjax()) {
            return json(['code' => 1001, 'msg' => '请求方式错误'], 405);
        }

        $user = DeviceSession::currentUser();
        if (empty($user)) {
            return json(['code' => 1002, 'msg' => '请先登录'], 401);
        }

        $game = (string) input('game/s', '');
        if (!in_array($game, ['gomoku', 'drawguess'], true)) {
            return json(['code' => 1003, 'msg' => '不支持的游戏'], 400);
        }
        $clientId = (string) input('client_id/s', '');
        if (!preg_match('/^[A-Za-z0-9_-]{16,64}$/D', $clientId)) {
            return json(['code' => 1003, 'msg' => '客户端标识无效'], 400);
        }

        try {
            return json([
                'code' => 1,
                'msg' => 'ok',
                'data' => GameAccessTicket::issue($user, $game, $clientId),
            ]);
        } catch (\Throwable $e) {
            if (function_exists('trace')) {
                trace('[pingfangdevice] Failed to issue game ticket: ' . $e->getMessage(), 'error');
            }
            return json(['code' => 1004, 'msg' => '联机服务暂不可用，请稍后重试'], 503);
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
