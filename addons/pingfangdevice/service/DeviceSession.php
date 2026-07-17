<?php

namespace addons\pingfangdevice\service;

use think\Db;

class DeviceSession
{
    const DEFAULT_MAX_DEVICES = 3;
    const MAX_DEVICES_LIMIT = 20;
    const DEFAULT_SESSION_LIFETIME_DAYS = 30;
    const MAX_SESSION_LIFETIME_DAYS = 365;
    const ACTIVITY_UPDATE_INTERVAL = 300;
    const TOKEN_COOKIE = 'pfv_device_token';
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
            'login_check_hash' => self::loginCheckHash($meta),
            'device_label' => self::deviceLabel(),
            'user_agent' => self::userAgent(),
            'ip_address' => self::ipAddress(),
            'login_time' => $now,
            'last_seen_time' => $now,
            'revoked_time' => 0,
            'revoked_reason' => '',
        ];

        $previousTokenHash = self::currentTokenHash();
        Db::startTrans();
        try {
            Db::name('user')->where('user_id', $userId)->field('user_id')->lock(true)->find();

            if ($previousTokenHash !== '') {
                Db::name(self::TABLE)->where([
                    'token_hash' => $previousTokenHash,
                    'revoked_time' => 0,
                ])->update([
                    'revoked_time' => $now,
                    'revoked_reason' => 'login_replaced',
                ]);
            }

            $sessionId = Db::name(self::TABLE)->insertGetId($data);
            self::enforceDeviceLimit($userId, self::maxDeviceCount());
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollback();
            throw $e;
        }

        try {
            self::setDeviceCookie($token);
        } catch (\Throwable $e) {
            Db::name(self::TABLE)->where('session_id', intval($sessionId))->update([
                'revoked_time' => time(),
                'revoked_reason' => 'cookie_write_failed',
            ]);
            throw $e;
        }

        return $sessionId;
    }

    public static function syncActiveCookie()
    {
        try {
            $userId = intval(cookie('user_id'));
            $tokenHash = self::currentTokenHash();

            if ($userId < 1) {
                if ($tokenHash !== '') {
                    self::logoutCurrentDevice();
                }
                return;
            }
            if ($tokenHash === '') {
                self::adoptNativeLogin($userId);
                return;
            }

            $session = Db::name(self::TABLE)->where([
                'user_id' => $userId,
                'token_hash' => $tokenHash,
            ])->find();

            if (empty($session)) {
                self::adoptNativeLogin($userId);
                return;
            }
            if (!hash_equals((string) $session['token_hash'], $tokenHash)
                || intval($session['revoked_time']) > 0) {
                self::adoptNativeLogin($userId);
                return;
            }
            if (self::isExpired($session)) {
                Db::name(self::TABLE)->where([
                    'session_id' => intval($session['session_id']),
                    'revoked_time' => 0,
                ])->update([
                    'revoked_time' => time(),
                    'revoked_reason' => 'session_expired',
                ]);
                self::invalidateCurrentLogin();
                return;
            }

            $user = Db::name('user')->where([
                'user_id' => $userId,
                'user_status' => 1,
            ])->find();

            if (empty($user)) {
                self::invalidateCurrentLogin();
                return;
            }

            $now = time();
            $update = [];
            if (intval($session['last_seen_time']) <= $now - self::ACTIVITY_UPDATE_INTERVAL) {
                $update = [
                    'last_seen_time' => $now,
                    'ip_address' => self::ipAddress(),
                    'user_agent' => self::userAgent(),
                ];
            }
            $loginCheckHash = self::loginCheckHash($user);
            if ($loginCheckHash !== '' && !hash_equals((string) ($session['login_check_hash'] ?? ''), $loginCheckHash)) {
                $update['login_check_hash'] = $loginCheckHash;
            }
            if (!empty($update)) {
                Db::name(self::TABLE)->where('session_id', intval($session['session_id']))->update($update);
            }

            self::syncCoreUserCookies($user);
        } catch (\Throwable $e) {
            self::logFailure('sync active device session', $e);
            self::invalidateCurrentLogin();
        }
    }

    public static function enforceDeviceLimit($userId, $maxDevices = self::DEFAULT_MAX_DEVICES)
    {
        $userId = intval($userId);
        $maxDevices = max(1, min(self::MAX_DEVICES_LIMIT, intval($maxDevices)));
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
        $userId = intval($userId);
        self::expireOldSessions($userId);
        $tokenHash = self::currentTokenHash();
        $rows = Db::name(self::TABLE)->where([
            'user_id' => $userId,
        ])->order('revoked_time asc, last_seen_time desc, session_id desc')->limit(20)->select();

        foreach ($rows as &$row) {
            $row['is_current'] = $tokenHash !== '' && hash_equals((string) $row['token_hash'], $tokenHash);
            $row['status_label'] = self::statusLabel($row);
            $row['login_at'] = self::formatTime($row['login_time']);
            $row['last_seen_at'] = self::formatTime($row['last_seen_time']);
            $row['device_label_display'] = self::escapeHtml($row['device_label'] ?? '');
            $row['ip_address_display'] = self::escapeHtml($row['ip_address'] ?? '');
            $row['user_agent_display'] = self::escapeHtml(self::truncate($row['user_agent'] ?? '', 120));
            unset($row['token_hash'], $row['login_check_hash'], $row['device_label'], $row['ip_address'], $row['user_agent']);
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

    public static function logoutCurrentDevice($userId = 0)
    {
        $tokenHash = self::currentTokenHash();
        try {
            if ($tokenHash !== '') {
                $query = Db::name(self::TABLE)->where([
                    'token_hash' => $tokenHash,
                    'revoked_time' => 0,
                ]);
                if (intval($userId) > 0) {
                    $query->where('user_id', intval($userId));
                }
                $query->update([
                    'revoked_time' => time(),
                    'revoked_reason' => 'logout',
                ]);
            }
        } finally {
            self::clearDeviceCookie();
        }
    }

    public static function currentUser()
    {
        $res = model('common/User')->checkLogin();
        if (($res['code'] ?? 0) != 1) {
            return null;
        }

        return $res['info'];
    }

    public static function currentTokenHash()
    {
        $token = trim((string) cookie(self::tokenCookieName()));
        if ($token === '') {
            return '';
        }

        return self::hashToken($token);
    }

    private static function syncCoreUserCookies(array $user)
    {
        $group = self::firstGroup($user);
        self::syncCookie('user_id', $user['user_id']);
        self::syncCookie('user_name', $user['user_name']);
        self::syncCookie('group_id', $group['group_id']);
        self::syncCookie('group_name', $group['group_name']);
        self::syncCookie('user_check', md5($user['user_random'] . '-' . $user['user_name'] . '-' . $user['user_id'] . '-'));
        self::syncCookie('user_portrait', mac_get_user_portrait($user['user_id']));
    }

    private static function firstGroup(array $user)
    {
        $groupId = 2;
        $groupName = '';
        $groupIds = explode(',', (string) ($user['group_id'] ?? '2'));
        $groupList = model('common/Group')->getCache('group_list');

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

    public static function maxDeviceCount()
    {
        $config = self::addonConfig();
        return max(1, min(self::MAX_DEVICES_LIMIT, intval($config['max_devices'] ?? self::DEFAULT_MAX_DEVICES)));
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
        $request = request();
        $secure = method_exists($request, 'isSsl') && $request->isSsl();
        cookie(self::tokenCookieName(), $token, [
            'expire' => self::sessionLifetimeSeconds(),
            'httponly' => true,
            'secure' => $secure,
            'path' => '/',
        ]);
    }

    private static function clearDeviceCookie()
    {
        $cookieName = self::tokenCookieName();
        cookie($cookieName, null);
        if ($cookieName !== self::TOKEN_COOKIE) {
            cookie(self::TOKEN_COOKIE, null);
        }
    }

    private static function syncCookie($name, $value)
    {
        $current = cookie($name);
        if ($current === null || (string) $current !== (string) $value) {
            cookie($name, $value, ['expire' => self::COOKIE_EXPIRE]);
        }
    }

    private static function invalidateCurrentLogin()
    {
        self::clearDeviceCookie();
        try {
            model('common/User')->logout();
            return;
        } catch (\Throwable $e) {
            self::logFailure('clear native user session', $e);
        }

        foreach (['user_id', 'user_name', 'group_id', 'group_name', 'user_check', 'user_portrait'] as $name) {
            cookie($name, null);
        }
    }

    private static function adoptNativeLogin($userId)
    {
        $res = model('common/User')->checkLogin();
        $user = $res['info'] ?? [];
        if (($res['code'] ?? 0) != 1 || intval($user['user_id'] ?? 0) !== intval($userId)) {
            self::invalidateCurrentLogin();
            return;
        }

        $loginCheckHash = self::loginCheckHash($user);
        if ($loginCheckHash === '') {
            self::invalidateCurrentLogin();
            return;
        }

        $managed = Db::name(self::TABLE)->where([
            'user_id' => intval($userId),
            'login_check_hash' => $loginCheckHash,
            'revoked_time' => 0,
        ])->find();
        if (!empty($managed)) {
            if (self::isExpired($managed)) {
                Db::name(self::TABLE)->where([
                    'session_id' => intval($managed['session_id']),
                    'revoked_time' => 0,
                ])->update([
                    'revoked_time' => time(),
                    'revoked_reason' => 'session_expired',
                ]);
                self::invalidateCurrentLogin();
                return;
            }
            if (!self::rebindManagedLogin($managed)) {
                self::invalidateCurrentLogin();
            }
            return;
        }

        $managed = Db::name(self::TABLE)->where([
            'user_id' => intval($userId),
            'login_check_hash' => $loginCheckHash,
        ])->find();
        if (!empty($managed)) {
            self::invalidateCurrentLogin();
            return;
        }

        self::registerLogin($user);
    }

    private static function rebindManagedLogin(array $session)
    {
        $sessionId = intval($session['session_id'] ?? 0);
        $userId = intval($session['user_id'] ?? 0);
        if ($sessionId < 1 || $userId < 1) {
            return false;
        }

        $token = self::newToken();
        $tokenHash = self::hashToken($token);
        $updated = Db::name(self::TABLE)->where([
            'session_id' => $sessionId,
            'user_id' => $userId,
            'revoked_time' => 0,
        ])->update([
            'token_hash' => $tokenHash,
            'device_label' => self::deviceLabel(),
            'user_agent' => self::userAgent(),
            'ip_address' => self::ipAddress(),
            'last_seen_time' => time(),
        ]);
        if ($updated < 1) {
            return false;
        }

        try {
            self::setDeviceCookie($token);
        } catch (\Throwable $e) {
            Db::name(self::TABLE)->where([
                'session_id' => $sessionId,
                'user_id' => $userId,
                'token_hash' => $tokenHash,
                'revoked_time' => 0,
            ])->update([
                'revoked_time' => time(),
                'revoked_reason' => 'cookie_write_failed',
            ]);
            throw $e;
        }

        return true;
    }

    private static function expireOldSessions($userId)
    {
        if ($userId < 1) {
            return;
        }

        Db::name(self::TABLE)->where([
            'user_id' => $userId,
            'revoked_time' => 0,
        ])->where('login_time', '<', time() - self::sessionLifetimeSeconds())->update([
            'revoked_time' => time(),
            'revoked_reason' => 'session_expired',
        ]);
    }

    private static function isExpired(array $session)
    {
        return intval($session['login_time'] ?? 0) < time() - self::sessionLifetimeSeconds();
    }

    private static function statusLabel(array $session)
    {
        if (intval($session['revoked_time'] ?? 0) < 1) {
            return '在线';
        }

        $labels = [
            'device_limit' => '超限下线',
            'session_expired' => '已过期',
        ];
        return $labels[$session['revoked_reason'] ?? ''] ?? '已下线';
    }

    private static function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function truncate($value, $length)
    {
        $value = (string) $value;
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $length, 'UTF-8');
        }
        return substr($value, 0, $length);
    }

    private static function addonConfig()
    {
        $config = function_exists('get_addon_config') ? get_addon_config('pingfangdevice') : [];
        return is_array($config) ? $config : [];
    }

    private static function loginCheckHash(array $user = [])
    {
        if (!empty($user['user_id']) && isset($user['user_name'], $user['user_random'])) {
            $check = md5($user['user_random'] . '-' . $user['user_name'] . '-' . $user['user_id'] . '-');
        } else {
            $check = trim((string) cookie('user_check'));
        }
        return $check === '' ? '' : self::hashToken($check);
    }

    private static function tokenCookieName()
    {
        $config = self::addonConfig();
        $name = trim((string) ($config['device_token_cookie'] ?? self::TOKEN_COOKIE));
        if (!preg_match('/^[A-Za-z0-9_.-]{1,64}$/', $name)) {
            return self::TOKEN_COOKIE;
        }
        return $name;
    }

    private static function sessionLifetimeSeconds()
    {
        $config = self::addonConfig();
        $days = intval($config['session_lifetime_days'] ?? self::DEFAULT_SESSION_LIFETIME_DAYS);
        $days = max(1, min(self::MAX_SESSION_LIFETIME_DAYS, $days));
        return $days * 86400;
    }

    private static function logFailure($action, \Throwable $e)
    {
        $message = '[pingfangdevice] Failed to ' . $action . ': ' . $e->getMessage();
        if (function_exists('trace')) {
            trace($message, 'error');
            return;
        }
        error_log($message);
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
