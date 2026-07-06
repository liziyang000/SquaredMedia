<?php

namespace addons\pingfangdevice\service;

use think\Db;

class DeviceSession
{
    const DEFAULT_MAX_DEVICES = 3;
    const TOKEN_COOKIE = 'pfv_device_token';
    const CSRF_COOKIE = 'pfv_csrf_token';
    const TABLE = 'pingfang_device_session';
    const COOKIE_EXPIRE = 2592000;

    public static function registerLogin(array $meta)
    {
        $userId = intval($meta['user_id'] ?? 0);
        if ($userId < 1) {
            return null;
        }

        $token = self::newToken();
        $now = time();
        $data = [
            'user_id' => $userId,
            'token_hash' => self::hashToken($token),
            'device_label' => self::deviceLabel(),
            'user_agent' => self::userAgent(),
            'ip_address' => self::ipAddress(),
            'login_time' => $now,
            'last_seen_time' => $now,
            'revoked_time' => 0,
            'revoked_reason' => '',
        ];

        $sessionId = Db::name(self::TABLE)->insertGetId($data);
        self::setDeviceCookie($token);
        self::enforceDeviceLimit($userId, self::maxDeviceCount());

        return $sessionId;
    }

    public static function syncActiveCookie()
    {
        try {
            self::csrfToken();

            $userId = intval(cookie('user_id'));
            $userName = trim((string) cookie('user_name'));
            $tokenHash = self::currentTokenHash();

            if ($userId < 1 || $userName === '' || $tokenHash === '') {
                return;
            }

            $session = Db::name(self::TABLE)->where([
                'user_id' => $userId,
                'token_hash' => $tokenHash,
                'revoked_time' => 0,
            ])->find();

            if (empty($session) || !hash_equals((string) $session['token_hash'], $tokenHash)) {
                self::clearDeviceCookie();
                model('User')->logout();
                return;
            }

            $user = Db::name('user')->where([
                'user_id' => $userId,
                'user_name' => $userName,
                'user_status' => 1,
            ])->find();

            if (empty($user)) {
                self::clearDeviceCookie();
                model('User')->logout();
                return;
            }

            Db::name(self::TABLE)->where('session_id', intval($session['session_id']))->update([
                'last_seen_time' => time(),
                'ip_address' => self::ipAddress(),
                'user_agent' => self::userAgent(),
            ]);

            self::syncCoreUserCookies($user);
        } catch (\Throwable $e) {
            return;
        }
    }

    public static function enforceDeviceLimit($userId, $maxDevices = self::DEFAULT_MAX_DEVICES)
    {
        $userId = intval($userId);
        $maxDevices = max(1, intval($maxDevices));
        if ($userId < 1) {
            return 0;
        }

        $sessions = Db::name(self::TABLE)->where([
            'user_id' => $userId,
            'revoked_time' => 0,
        ])->order('login_time desc, session_id desc')->select();

        if (count($sessions) <= $maxDevices) {
            return 0;
        }

        $revokeIds = array_column(array_slice($sessions, $maxDevices), 'session_id');
        if (empty($revokeIds)) {
            return 0;
        }

        return Db::name(self::TABLE)->where([
            'session_id' => ['in', $revokeIds],
        ])->update([
            'revoked_time' => time(),
            'revoked_reason' => 'device_limit',
        ]);
    }

    public static function listSessions($userId)
    {
        $tokenHash = self::currentTokenHash();
        $rows = Db::name(self::TABLE)->where([
            'user_id' => intval($userId),
        ])->order('revoked_time asc, last_seen_time desc, session_id desc')->limit(20)->select();

        foreach ($rows as &$row) {
            $row['is_current'] = $tokenHash !== '' && hash_equals((string) $row['token_hash'], $tokenHash);
            $row['status_label'] = intval($row['revoked_time']) > 0 ? '已下线' : '在线';
            $row['login_at'] = self::formatTime($row['login_time']);
            $row['last_seen_at'] = self::formatTime($row['last_seen_time']);
        }
        unset($row);

        return $rows;
    }

    public static function revokeSession($userId, $sessionId)
    {
        $userId = intval($userId);
        $sessionId = intval($sessionId);
        if ($userId < 1 || $sessionId < 1) {
            return ['code' => 1001, 'msg' => '参数错误'];
        }

        $tokenHash = self::currentTokenHash();
        $session = Db::name(self::TABLE)->where([
            'session_id' => $sessionId,
            'user_id' => $userId,
        ])->find();

        if (empty($session)) {
            return ['code' => 1002, 'msg' => '设备不存在'];
        }
        if ($tokenHash !== '' && hash_equals((string) $session['token_hash'], $tokenHash)) {
            return ['code' => 1003, 'msg' => '当前设备请使用退出登录'];
        }
        if (intval($session['revoked_time']) > 0) {
            return ['code' => 1, 'msg' => '设备已下线'];
        }

        Db::name(self::TABLE)->where([
            'session_id' => $sessionId,
            'user_id' => $userId,
        ])->update([
            'revoked_time' => time(),
            'revoked_reason' => 'manual',
        ]);

        return ['code' => 1, 'msg' => '设备已踢下线'];
    }

    public static function csrfToken()
    {
        $token = trim((string) cookie(self::CSRF_COOKIE));
        if (!self::isValidCsrfToken($token)) {
            $token = self::newToken();
            self::setCsrfCookie($token);
        }

        return $token;
    }

    public static function validateCsrf()
    {
        $cookieToken = trim((string) cookie(self::CSRF_COOKIE));
        $requestToken = trim((string) input('csrf_token', ''));

        if ($requestToken === '') {
            $request = request();
            if (is_object($request) && method_exists($request, 'header')) {
                $requestToken = trim((string) $request->header('X-PingFang-CSRF', ''));
                if ($requestToken === '') {
                    $requestToken = trim((string) $request->header('X-CSRF-Token', ''));
                }
            }
        }

        return self::isValidCsrfToken($cookieToken)
            && self::isValidCsrfToken($requestToken)
            && hash_equals($cookieToken, $requestToken);
    }

    public static function logoutCurrentDevice($userId)
    {
        $tokenHash = self::currentTokenHash();
        if (intval($userId) > 0 && $tokenHash !== '') {
            Db::name(self::TABLE)->where([
                'user_id' => intval($userId),
                'token_hash' => $tokenHash,
                'revoked_time' => 0,
            ])->update([
                'revoked_time' => time(),
                'revoked_reason' => 'logout',
            ]);
        }

        self::clearDeviceCookie();
    }

    public static function currentUser()
    {
        $res = model('User')->checkLogin();
        if (($res['code'] ?? 0) != 1) {
            return null;
        }

        return $res['info'];
    }

    public static function currentTokenHash()
    {
        $token = trim((string) cookie(self::TOKEN_COOKIE));
        if ($token === '') {
            return '';
        }

        return self::hashToken($token);
    }

    private static function syncCoreUserCookies(array $user)
    {
        $group = self::firstGroup($user);
        cookie('user_id', $user['user_id'], ['expire' => self::COOKIE_EXPIRE]);
        cookie('user_name', $user['user_name'], ['expire' => self::COOKIE_EXPIRE]);
        cookie('group_id', $group['group_id'], ['expire' => self::COOKIE_EXPIRE]);
        cookie('group_name', $group['group_name'], ['expire' => self::COOKIE_EXPIRE]);
        cookie('user_check', md5($user['user_random'] . '-' . $user['user_name'] . '-' . $user['user_id'] . '-'), ['expire' => self::COOKIE_EXPIRE]);
        cookie('user_portrait', mac_get_user_portrait($user['user_id']), ['expire' => self::COOKIE_EXPIRE]);
    }

    private static function firstGroup(array $user)
    {
        $groupId = 2;
        $groupName = '';
        $groupIds = explode(',', (string) ($user['group_id'] ?? '2'));
        $groupList = model('Group')->getCache('group_list');

        foreach ($groupIds as $id) {
            $id = intval($id);
            if (isset($groupList[$id])) {
                $groupId = $id;
                $groupName = $groupList[$id]['group_name'];
                break;
            }
        }

        return ['group_id' => $groupId, 'group_name' => $groupName];
    }

    private static function maxDeviceCount()
    {
        $config = function_exists('get_addon_config') ? get_addon_config('pingfangdevice') : [];
        return max(1, intval($config['max_devices'] ?? self::DEFAULT_MAX_DEVICES));
    }

    private static function newToken()
    {
        return bin2hex(random_bytes(32));
    }

    private static function hashToken($token)
    {
        return hash('sha256', $token);
    }

    private static function setDeviceCookie($token)
    {
        cookie(self::TOKEN_COOKIE, $token, [
            'expire' => self::COOKIE_EXPIRE,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function setCsrfCookie($token)
    {
        cookie(self::CSRF_COOKIE, $token, [
            'expire' => self::COOKIE_EXPIRE,
            'httponly' => false,
            'samesite' => 'Lax',
        ]);
    }

    private static function clearDeviceCookie()
    {
        cookie(self::TOKEN_COOKIE, null);
    }

    private static function isValidCsrfToken($token)
    {
        return is_string($token) && preg_match('/\A[a-f0-9]{64}\z/i', $token) === 1;
    }

    private static function userAgent()
    {
        return substr((string) request()->server('HTTP_USER_AGENT'), 0, 255);
    }

    private static function ipAddress()
    {
        if (function_exists('mac_get_client_ip')) {
            return (string) mac_get_client_ip();
        }

        return (string) request()->ip();
    }

    private static function deviceLabel()
    {
        $ua = self::userAgent();
        $os = '未知系统';
        $browser = '浏览器';

        if (stripos($ua, 'iPhone') !== false) {
            $os = 'iPhone';
        } elseif (stripos($ua, 'iPad') !== false) {
            $os = 'iPad';
        } elseif (stripos($ua, 'Android') !== false) {
            $os = 'Android';
        } elseif (stripos($ua, 'Macintosh') !== false || stripos($ua, 'Mac OS') !== false) {
            $os = 'Mac';
        } elseif (stripos($ua, 'Windows') !== false) {
            $os = 'Windows';
        }

        if (stripos($ua, 'Edg/') !== false) {
            $browser = 'Edge';
        } elseif (stripos($ua, 'Chrome/') !== false) {
            $browser = 'Chrome';
        } elseif (stripos($ua, 'Safari/') !== false) {
            $browser = 'Safari';
        } elseif (stripos($ua, 'Firefox/') !== false) {
            $browser = 'Firefox';
        }

        return $os . ' · ' . $browser;
    }

    private static function formatTime($timestamp)
    {
        $timestamp = intval($timestamp);
        if ($timestamp < 1) {
            return '-';
        }

        return date('Y-m-d H:i', $timestamp);
    }
}
