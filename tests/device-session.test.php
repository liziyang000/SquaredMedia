<?php

namespace think {
    class Db
    {
        public static $tables = [];
        public static $throwOnSelect = false;
        public static $failUpdate = false;
        private static $snapshot;

        public static function name($name)
        {
            return new DeviceSessionQuery($name);
        }

        public static function startTrans()
        {
            self::$snapshot = self::$tables;
        }

        public static function commit()
        {
            self::$snapshot = null;
        }

        public static function rollback()
        {
            if (self::$snapshot !== null) {
                self::$tables = self::$snapshot;
            }
            self::$snapshot = null;
        }
    }

    class DeviceSessionQuery
    {
        private $table;
        private $where = [];
        private $limit;

        public function __construct($table)
        {
            $this->table = $table;
        }

        public function where($field, $operator = null, $value = null)
        {
            if (is_array($field)) {
                foreach ($field as $key => $condition) {
                    $this->where[$key] = $condition;
                }
            } elseif (func_num_args() === 2) {
                $this->where[$field] = $operator;
            } else {
                $this->where[$field] = [$operator, $value];
            }
            return $this;
        }

        public function field($fields)
        {
            return $this;
        }

        public function order($order)
        {
            return $this;
        }

        public function limit($limit)
        {
            $this->limit = intval($limit);
            return $this;
        }

        public function lock($lock)
        {
            return $this;
        }

        public function find()
        {
            foreach ($this->rows() as $row) {
                return $row;
            }
            return null;
        }

        public function select()
        {
            if (Db::$throwOnSelect) {
                throw new \RuntimeException('select failed');
            }
            $rows = $this->rows();
            if ($this->limit > 0) {
                $rows = array_slice($rows, 0, $this->limit);
            }
            return $rows;
        }

        public function insertGetId(array $data)
        {
            $rows = Db::$tables[$this->table] ?? [];
            $ids = array_column($rows, 'session_id');
            $data['session_id'] = empty($ids) ? 1 : max($ids) + 1;
            Db::$tables[$this->table][] = $data;
            return $data['session_id'];
        }

        public function update(array $data)
        {
            if (Db::$failUpdate) {
                return false;
            }
            $updated = 0;
            foreach (Db::$tables[$this->table] ?? [] as $index => $row) {
                if (!$this->matches($row)) {
                    continue;
                }
                Db::$tables[$this->table][$index] = array_merge($row, $data);
                $updated++;
            }
            return $updated;
        }

        private function rows()
        {
            return array_values(array_filter(Db::$tables[$this->table] ?? [], function ($row) {
                return $this->matches($row);
            }));
        }

        private function matches(array $row)
        {
            foreach ($this->where as $field => $condition) {
                $actual = $row[$field] ?? null;
                if (is_array($condition)) {
                    [$operator, $expected] = $condition;
                    if ($operator === 'in' && !in_array($actual, $expected, true)) {
                        return false;
                    }
                    if ($operator === '<' && !($actual < $expected)) {
                        return false;
                    }
                    if ($operator === '>=' && !($actual >= $expected)) {
                        return false;
                    }
                } elseif ((string) $actual !== (string) $condition) {
                    return false;
                }
            }
            return true;
        }
    }
}

namespace {
    use addons\pingfangdevice\service\DeviceSession;
    use think\Db;

    $deviceCookies = [];
    $deviceConfig = [];
    $deviceModelRequests = [];
    $deviceRequest = new class {
        public function server($name)
        {
            return $name === 'HTTP_USER_AGENT' ? 'Test Browser' : '';
        }

        public function ip()
        {
            return '127.0.0.1';
        }

        public function isSsl()
        {
            return true;
        }
    };
    $deviceUserModel = new class {
        public $logoutCalls = 0;

        public function logout()
        {
            global $deviceCookies;
            $this->logoutCalls++;
            foreach (['user_id', 'user_name', 'group_id', 'group_name', 'user_check', 'user_portrait'] as $name) {
                unset($deviceCookies[$name]);
            }
            return ['code' => 1];
        }

        public function checkLogin()
        {
            global $deviceCookies;
            if (empty($deviceCookies['user_id']) || empty($deviceCookies['user_check'])) {
                return ['code' => 1001];
            }
            return ['code' => 1, 'info' => ['user_id' => intval($deviceCookies['user_id'])]];
        }
    };
    $deviceGroupModel = new class {
        public function getCache($name)
        {
            return [2 => ['group_id' => 2, 'group_name' => '会员']];
        }
    };

    function cookie($name, $value = '', $options = null)
    {
        global $deviceCookies;
        if (func_num_args() === 1) {
            return $deviceCookies[$name] ?? null;
        }
        if ($value === null) {
            unset($deviceCookies[$name]);
            return null;
        }
        $deviceCookies[$name] = $value;
        return null;
    }

    function request()
    {
        global $deviceRequest;
        return $deviceRequest;
    }

    function model($name)
    {
        global $deviceUserModel, $deviceGroupModel, $deviceModelRequests;
        $deviceModelRequests[] = $name;
        if ($name === 'User' || $name === 'Group') {
            throw new \RuntimeException('Relative model resolution is unavailable during app_begin.');
        }
        return stripos($name, 'Group') !== false ? $deviceGroupModel : $deviceUserModel;
    }

    function get_addon_config($name)
    {
        global $deviceConfig;
        return $deviceConfig;
    }

    function mac_get_user_portrait($userId)
    {
        return '/portrait/' . intval($userId);
    }

    require_once dirname(__DIR__) . '/addons/pingfangdevice/service/DeviceSession.php';

    $fail = static function ($message) {
        fwrite(STDERR, $message . "\n");
        exit(1);
    };
    $assertSame = static function ($expected, $actual, $message) use ($fail) {
        if ($expected !== $actual) {
            $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    };
    $assertTrue = static function ($actual, $message) use ($fail) {
        if (!$actual) {
            $fail($message);
        }
    };
    $reset = static function () use (&$deviceCookies, &$deviceConfig, &$deviceModelRequests, $deviceUserModel) {
        $deviceCookies = [];
        $deviceConfig = [];
        $deviceModelRequests = [];
        $deviceUserModel->logoutCalls = 0;
        Db::$tables = ['pingfang_device_session' => [], 'user' => []];
        Db::$throwOnSelect = false;
        Db::$failUpdate = false;
    };

    $reset();
    $deviceCookies = [
        'user_id' => '42',
        'user_name' => 'alice',
        'user_check' => 'native-check',
    ];
    DeviceSession::syncActiveCookie();
    $assertSame(false, in_array('User', $deviceModelRequests, true), 'Device session hooks must resolve the common User model explicitly.');
    $assertSame(0, $deviceUserModel->logoutCalls, 'A valid first-party native login should be adopted into device management.');
    $assertTrue(!empty($deviceCookies['pfv_device_token']), 'Adopting a native login must create a device token.');
    $assertSame(1, count(Db::$tables['pingfang_device_session']), 'Adopting a native login must create one server session.');

    $reset();
    $deviceCookies = [
        'user_id' => '42',
        'user_name' => 'alice',
        'user_check' => 'managed-check',
    ];
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 1,
        'user_id' => 42,
        'token_hash' => hash('sha256', 'missing-token'),
        'login_check_hash' => hash('sha256', 'managed-check'),
        'device_label' => 'Managed',
        'user_agent' => 'Test Browser',
        'ip_address' => '127.0.0.1',
        'login_time' => time(),
        'last_seen_time' => time(),
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    DeviceSession::syncActiveCookie();
    $reboundToken = $deviceCookies['pfv_device_token'] ?? '';
    $assertSame(0, $deviceUserModel->logoutCalls, 'A valid managed login must survive a missing device token.');
    $assertTrue($reboundToken !== '', 'A valid managed login must receive a replacement device token.');
    $assertSame(hash('sha256', $reboundToken), Db::$tables['pingfang_device_session'][0]['token_hash'], 'Rebinding must rotate the token on the existing session.');
    $assertSame(1, count(Db::$tables['pingfang_device_session']), 'Rebinding must not create a duplicate device session.');

    $reset();
    $deviceCookies = [
        'user_id' => '42',
        'user_name' => 'alice',
        'user_check' => 'revoked-check',
    ];
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 1,
        'user_id' => 42,
        'token_hash' => hash('sha256', 'revoked-token'),
        'login_check_hash' => hash('sha256', 'revoked-check'),
        'device_label' => 'Revoked',
        'user_agent' => 'Test Browser',
        'ip_address' => '127.0.0.1',
        'login_time' => time(),
        'last_seen_time' => time(),
        'revoked_time' => time(),
        'revoked_reason' => 'manual',
    ];
    DeviceSession::syncActiveCookie();
    $assertSame(1, $deviceUserModel->logoutCalls, 'A revoked managed login must remain logged out when its token is missing.');
    $assertSame(null, $deviceCookies['user_id'] ?? null, 'Revoked session validation must clear the native user cookie.');

    $reset();
    $deviceCookies = [
        'user_id' => '42',
        'user_name' => 'alice',
        'user_check' => 'new-check',
        'pfv_device_token' => 'stale-token',
    ];
    Db::$tables['pingfang_device_session'] = [
        [
            'session_id' => 1,
            'user_id' => 42,
            'token_hash' => hash('sha256', 'stale-token'),
            'login_check_hash' => hash('sha256', 'old-check'),
            'device_label' => 'Old',
            'user_agent' => 'Test Browser',
            'ip_address' => '127.0.0.1',
            'login_time' => time() - 60,
            'last_seen_time' => time() - 60,
            'revoked_time' => time(),
            'revoked_reason' => 'login_replaced',
        ],
        [
            'session_id' => 2,
            'user_id' => 42,
            'token_hash' => hash('sha256', 'missing-new-token'),
            'login_check_hash' => hash('sha256', 'new-check'),
            'device_label' => 'Current',
            'user_agent' => 'Test Browser',
            'ip_address' => '127.0.0.1',
            'login_time' => time(),
            'last_seen_time' => time(),
            'revoked_time' => 0,
            'revoked_reason' => '',
        ],
    ];
    DeviceSession::syncActiveCookie();
    $reboundToken = $deviceCookies['pfv_device_token'] ?? '';
    $assertSame(0, $deviceUserModel->logoutCalls, 'A stale token must not cancel a newer valid native login.');
    $assertTrue($reboundToken !== '' && $reboundToken !== 'stale-token', 'A stale token must be replaced when a newer managed login is active.');
    $assertSame(hash('sha256', $reboundToken), Db::$tables['pingfang_device_session'][1]['token_hash'], 'A stale token must rebind to the current managed session.');
    $assertSame(2, count(Db::$tables['pingfang_device_session']), 'Stale-token recovery must not create another device session.');

    $reset();
    $deviceCookies['pfv_device_token'] = 'stale-token';
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 1,
        'user_id' => 42,
        'token_hash' => hash('sha256', 'stale-token'),
        'login_check_hash' => hash('sha256', 'old-check'),
        'login_time' => time(),
        'last_seen_time' => time(),
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    DeviceSession::syncActiveCookie();
    $assertSame('logout', Db::$tables['pingfang_device_session'][0]['revoked_reason'], 'A native logout must revoke a stale server device session.');
    $assertSame(null, $deviceCookies['pfv_device_token'] ?? null, 'A native logout must clear the stale device token.');

    $reset();
    $deviceConfig = ['device_token_cookie' => 'custom_device_token'];
    $deviceCookies['custom_device_token'] = 'custom-token';
    $assertSame(hash('sha256', 'custom-token'), DeviceSession::currentTokenHash(), 'The configured device cookie name must be honored.');

    $reset();
    $token = 'valid-token';
    $now = time();
    $deviceCookies = [
        'user_id' => '42',
        'user_name' => 'alice',
        'pfv_device_token' => $token,
    ];
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 1,
        'user_id' => 42,
        'token_hash' => hash('sha256', $token),
        'device_label' => 'Test',
        'user_agent' => 'Test Browser',
        'ip_address' => '127.0.0.1',
        'login_time' => $now,
        'last_seen_time' => $now - 600,
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    Db::$tables['user'][] = [
        'user_id' => 42,
        'user_name' => 'alice',
        'user_status' => 1,
        'user_random' => 'random-value',
        'group_id' => '2',
    ];
    DeviceSession::syncActiveCookie();
    $assertTrue(in_array('common/Group', $deviceModelRequests, true), 'Restoring a managed login must resolve the common Group model explicitly.');
    $assertSame(md5('random-value-alice-42-'), $deviceCookies['user_check'] ?? null, 'A valid device session must restore the native login check.');
    $assertTrue(Db::$tables['pingfang_device_session'][0]['last_seen_time'] >= $now, 'Stale activity timestamps must be refreshed.');

    $reset();
    $token = 'expired-token';
    $deviceCookies = [
        'user_id' => '42',
        'user_name' => 'alice',
        'pfv_device_token' => $token,
    ];
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 2,
        'user_id' => 42,
        'token_hash' => hash('sha256', $token),
        'device_label' => 'Old',
        'user_agent' => 'Old Browser',
        'ip_address' => '127.0.0.1',
        'login_time' => time() - 31 * 86400,
        'last_seen_time' => time() - 60,
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    DeviceSession::syncActiveCookie();
    $assertSame('session_expired', Db::$tables['pingfang_device_session'][0]['revoked_reason'], 'Expired sessions must be revoked on the server.');
    $assertSame(1, $deviceUserModel->logoutCalls, 'Expired sessions must log out the native user.');

    $reset();
    $deviceConfig = ['max_devices' => '99'];
    $assertSame(20, DeviceSession::maxDeviceCount(), 'The maximum device setting must have a safe upper bound.');

    $reset();
    Db::$throwOnSelect = true;
    try {
        DeviceSession::registerLogin(['user_id' => 42]);
        $fail('A failed device-limit query should abort login registration.');
    } catch (\RuntimeException $e) {
        $assertSame(null, $deviceCookies['pfv_device_token'] ?? null, 'A failed registration must not leave a device cookie behind.');
        $assertSame([], Db::$tables['pingfang_device_session'], 'A failed registration must roll back the inserted session.');
    }

    $reset();
    $token = 'logout-failure-token';
    $deviceCookies['pfv_device_token'] = $token;
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 9,
        'user_id' => 42,
        'token_hash' => hash('sha256', $token),
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    Db::$failUpdate = true;
    try {
        DeviceSession::logoutCurrentDevice(42);
        $fail('A failed server-side device revocation must fail logout.');
    } catch (\RuntimeException $e) {
        $assertSame($token, $deviceCookies['pfv_device_token'] ?? null, 'A failed revocation must retain the device cookie so logout can be retried.');
        $assertSame(0, Db::$tables['pingfang_device_session'][0]['revoked_time'], 'A failed revocation must not claim the server session was revoked.');
    }

    $reset();
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 10,
        'user_id' => 42,
        'token_hash' => hash('sha256', 'other-device-token'),
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    Db::$failUpdate = true;
    $result = DeviceSession::revokeSession(42, 10);
    $assertSame(1004, $result['code'], 'A failed manual revocation must return an explicit failure.');
    $assertSame(0, Db::$tables['pingfang_device_session'][0]['revoked_time'], 'A failed manual revocation must not claim the device was revoked.');

    $reset();
    $token = 'display-token';
    $deviceCookies['pfv_device_token'] = $token;
    Db::$tables['pingfang_device_session'][] = [
        'session_id' => 3,
        'user_id' => 42,
        'token_hash' => hash('sha256', $token),
        'device_label' => '<b>Browser</b>',
        'user_agent' => '<img src=x onerror=alert(1)>',
        'ip_address' => '<script>alert(1)</script>',
        'login_time' => time(),
        'last_seen_time' => time(),
        'revoked_time' => 0,
        'revoked_reason' => '',
    ];
    $rows = DeviceSession::listSessions(42);
    $assertSame(false, array_key_exists('token_hash', $rows[0]), 'Session hashes must not be exposed to templates.');
    $assertSame(false, array_key_exists('login_check_hash', $rows[0]), 'Native login hashes must not be exposed to templates.');
    $assertTrue(strpos($rows[0]['user_agent_display'], '&lt;img') === 0, 'User-agent output must be HTML escaped.');

    echo "DeviceSession behavior tests passed.\n";
}
