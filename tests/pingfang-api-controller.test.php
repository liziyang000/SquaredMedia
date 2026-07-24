<?php
declare(strict_types=1);

namespace think {
    final class Db
    {
        public static function name($name)
        {
            return new PingfangApiControllerQuery();
        }
    }

    final class PingfangApiControllerQuery
    {
        public function where($where)
        {
            return $this;
        }

        public function field($fields)
        {
            return $this;
        }

        public function find()
        {
            if (!empty($GLOBALS['pingfang_test_detail_throws'])) {
                throw new \RuntimeException((string) $GLOBALS['pingfang_test_exception_message']);
            }
            return isset($GLOBALS['pingfang_test_vod_result']['info']) ? $GLOBALS['pingfang_test_vod_result']['info'] : [];
        }
    }
}

namespace addons\pingfangdevice\service {
    final class DeviceSession
    {
        public static function logoutCurrentDevice($userId)
        {
            if (!empty($GLOBALS['pingfang_test_device_logout_throws'])) {
                throw new \RuntimeException((string) $GLOBALS['pingfang_test_exception_message']);
            }
        }
    }
}

namespace app\common\controller {
    class All
    {
        public static $access = ['code' => 1, 'trysee' => 0];
        public static $calls = [];

        protected function label_maccms()
        {
            self::$calls[] = 'label_maccms';
        }

        protected function label_user()
        {
            self::$calls[] = 'label_user';
        }

        protected function check_user_popedom($typeId, $popedom, $param, $flag, $info, $trysee)
        {
            self::$calls[] = 'check_user_popedom';
            return self::$access;
        }

        protected function label_vod_play($flag, $info = [])
        {
            self::$calls[] = 'label_vod_play';
            return $info;
        }

        protected function label_fetch($template)
        {
            self::$calls[] = 'label_fetch:' . $template;
            return 'template:' . $template;
        }

        protected function assign($name, $value)
        {
            self::$calls[] = 'assign:' . $name;
        }
    }
}

namespace ip_limit {
    class IpLocationQuery
    {
        public static string $location = '中国大陆';

        public function queryProvince($ip)
        {
            return self::$location;
        }
    }
}

namespace {
    final class PingfangApiControllerRequest
    {
        private $method;
        private $query;
        private $body;
        private $headers;

        public function __construct($method, array $query, $body = '', array $headers = [])
        {
            $this->method = (string) $method;
            $this->query = $query;
            $this->body = (string) $body;
            $this->headers = $headers;
        }

        public function method()
        {
            return $this->method;
        }

        public function get()
        {
            return $this->query;
        }

        public function contentType()
        {
            return isset($this->headers['Content-Type']) ? $this->headers['Content-Type'] : '';
        }

        public function getInput()
        {
            return $this->body;
        }

        public function header($name)
        {
            return isset($this->headers[$name]) ? $this->headers[$name] : null;
        }

        public function isSsl()
        {
            return true;
        }
    }

    final class PingfangApiControllerUserModel
    {
        public function logout()
        {
            $GLOBALS['pingfang_test_user_logout_calls'] = intval(isset($GLOBALS['pingfang_test_user_logout_calls']) ? $GLOBALS['pingfang_test_user_logout_calls'] : 0) + 1;
        }
    }

    require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiException.php';
    require_once dirname(__DIR__) . '/addons/pingfangapi/service/ContentService.php';
    require_once dirname(__DIR__) . '/addons/pingfangapi/service/AccountService.php';
    require_once dirname(__DIR__) . '/addons/pingfangapi/service/ApiRequest.php';
    require_once dirname(__DIR__) . '/addons/pingfangapi/application/index/controller/Pingfangapi.php';

    function json($body, $status = 200, array $headers = [])
    {
        return ['body' => $body, 'status' => $status, 'headers' => $headers];
    }

    function response($body, $status = 200, array $headers = [])
    {
        return ['body' => $body, 'status' => $status, 'headers' => $headers];
    }

    function mac_get_client_ip()
    {
        return '127.0.0.1';
    }

    function request()
    {
        return $GLOBALS['pingfang_test_request'];
    }

    function mac_param_url()
    {
        return ['id' => 42, 'sid' => 1, 'nid' => 1];
    }

    function mac_play_list()
    {
        return [
            1 => [
                'sid' => 1,
                'from' => 'dyttm3u8',
                'player_info' => [
                    'ps' => (string) ($GLOBALS['pingfang_test_player_ps'] ?? '0'),
                    'parse' => 'https://ping2video.xyz/static/player/artplayer.html?url=',
                ],
                'urls' => [
                    1 => [
                        'nid' => 1,
                        'name' => 'HD国语',
                        'url' => 'https://media.example/video/index.m3u8?token=secret',
                    ],
                ],
            ],
        ];
    }

    final class PingfangApiControllerVodModel
    {
        public function infoData($where, $fields = '*', $cache = 0)
        {
            if (!empty($GLOBALS['pingfang_test_detail_throws'])) {
                throw new \RuntimeException((string) $GLOBALS['pingfang_test_exception_message']);
            }
            $GLOBALS['pingfang_test_vod_where'] = $where;
            return $GLOBALS['pingfang_test_vod_result'];
        }
    }

    function model($name)
    {
        if ((string) $name === 'Vod') {
            return new PingfangApiControllerVodModel();
        }
        return (string) $name === 'User' ? new PingfangApiControllerUserModel() : null;
    }

    function mac_tpl_fetch($mid, $template, $fallback)
    {
        return $mid . '/' . ($template !== '' ? $template : $fallback);
    }

    function session($key, $value = '__pingfang_read__')
    {
        if ($value !== '__pingfang_read__') {
            if ($value === null) {
                unset($GLOBALS['pingfang_test_sessions'][$key]);
            } else {
                $GLOBALS['pingfang_test_sessions'][$key] = $value;
            }
            return null;
        }
        return isset($GLOBALS['pingfang_test_sessions'][$key]) ? $GLOBALS['pingfang_test_sessions'][$key] : null;
    }

    function trace($message, $level)
    {
        $GLOBALS['pingfang_test_traces'][] = [
            'message' => (string) $message,
            'level' => (string) $level,
        ];
    }

    $fail = static function (string $message): never {
        fwrite(STDERR, $message . "\n");
        exit(1);
    };
    $assertSame = static function ($expected, $actual, string $message) use ($fail): void {
        if ($expected !== $actual) {
            $fail($message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true));
        }
    };
    $assertPrivatePlayer = static function (array $response, string $message) use ($assertSame): void {
        $assertSame('private, no-store', isset($response['headers']['Cache-Control']) ? $response['headers']['Cache-Control'] : null, $message);
        $assertSame('no-cache', isset($response['headers']['Pragma']) ? $response['headers']['Pragma'] : null, 'Player HTML responses must include the legacy no-cache directive.');
    };
    $assertRequestId = static function (array $response, string $message) use ($assertSame): string {
        $requestId = isset($response['headers']['X-Request-ID']) ? (string) $response['headers']['X-Request-ID'] : '';
        $assertSame(1, preg_match('/^[a-f0-9]{32}$/D', $requestId), $message);
        return $requestId;
    };
    $decodeLog = static function (array $entry) use ($fail, $assertSame): array {
        $assertSame('error', isset($entry['level']) ? $entry['level'] : null, 'API failures must use the error log level.');
        $decoded = json_decode(isset($entry['message']) ? (string) $entry['message'] : '', true);
        if (!is_array($decoded)) {
            $fail('API failure logs must be valid JSON.');
        }
        $assertSame(
            ['request_id', 'endpoint', 'action', 'status', 'exception_class'],
            array_keys($decoded),
            'API failure logs must contain only the approved fields.'
        );
        return $decoded;
    };

    $controller = new \app\index\controller\Pingfangapi();
    $clientRequestId = str_repeat('a', 32);
    $GLOBALS['pingfang_test_request'] = new PingfangApiControllerRequest('GET', ['action' => 'session'], '', [
        'X-Request-ID' => $clientRequestId,
    ]);
    $GLOBALS['pingfang_test_traces'] = [];
    $GLOBALS['pingfang_test_exception_message'] = 'query action=detail token=secret csrf=hidden Cookie=session https://media.example/video/index.m3u8?token=secret';

    $GLOBALS['config'] = ['site' => ['site_status' => 0, 'mainland_ip_limit' => '0']];
    $closed = $controller->index();
    $assertSame(503, $closed['status'], 'A closed site must return a JSON 503 before API services run.');
    $assertSame(503, $closed['body']['code'], 'A closed site must keep the standard API envelope.');
    $assertSame('private, no-store', $closed['headers']['Cache-Control'], 'Site policy errors must never be shared-cacheable.');
    $closedRequestId = $assertRequestId($closed, 'Index responses must include a server-generated request ID.');
    $assertSame(false, hash_equals($clientRequestId, $closedRequestId), 'The API must not reflect a client-provided request ID.');
    $assertSame(1, count($GLOBALS['pingfang_test_traces']), 'Converted 5xx responses must be logged once.');
    $closedLog = $decodeLog($GLOBALS['pingfang_test_traces'][0]);
    $assertSame($closedRequestId, $closedLog['request_id'], 'Converted 5xx logs must use the response request ID.');
    $assertSame('index', $closedLog['endpoint'], 'Index failures must use the fixed index endpoint.');
    $assertSame('unknown', $closedLog['action'], 'Failures before action parsing must use the safe unknown action.');
    $assertSame(503, $closedLog['status'], 'Converted 5xx logs must include the response status.');
    $assertSame(\addons\pingfangapi\service\ApiException::class, $closedLog['exception_class'], 'Converted 5xx logs must include only the exception class.');

    $GLOBALS['config'] = ['site' => ['site_status' => 1, 'mainland_ip_limit' => '1']];
    \ip_limit\IpLocationQuery::$location = '';
    $GLOBALS['pingfang_test_traces'] = [];
    $blocked = $controller->index();
    $assertSame(403, $blocked['status'], 'The API must preserve MacCMS mainland access policy as JSON.');
    $assertRequestId($blocked, 'Index 4xx responses must include a request ID.');
    $assertSame([], $GLOBALS['pingfang_test_traces'], 'Expected 4xx responses must not be logged by default.');

    $GLOBALS['config'] = [
        'site' => ['site_status' => 1, 'mainland_ip_limit' => '0'],
        'user' => ['login_verify' => 1],
    ];
    $GLOBALS['user'] = [];
    $GLOBALS['pingfang_test_sessions'] = [];
    $GLOBALS['pingfang_test_request'] = new PingfangApiControllerRequest('GET', ['action' => ['detail']]);
    $GLOBALS['pingfang_test_traces'] = [];
    set_error_handler(static function ($severity, $message, $file, $line): void {
        throw new \ErrorException($message, 0, $severity, $file, $line);
    });
    try {
        $invalidAction = $controller->index();
    } finally {
        restore_error_handler();
    }
    $assertSame(400, $invalidAction['status'], 'A structured action query must remain a client error.');
    $assertRequestId($invalidAction, 'Malformed action responses must include a request ID.');
    $assertSame([], $GLOBALS['pingfang_test_traces'], 'Malformed action queries must not create a false 5xx log.');

    $GLOBALS['pingfang_test_request'] = new PingfangApiControllerRequest('GET', ['action' => 'session']);
    $GLOBALS['pingfang_test_traces'] = [];
    $convertedFailure = $controller->index();
    $assertSame(503, $convertedFailure['status'], 'ApiRequest must preserve service-unavailable failures.');
    $convertedRequestId = $assertRequestId($convertedFailure, 'Converted API failures must include a request ID.');
    $assertSame(1, count($GLOBALS['pingfang_test_traces']), 'ApiRequest-converted 5xx responses must be logged once.');
    $convertedLog = $decodeLog($GLOBALS['pingfang_test_traces'][0]);
    $assertSame($convertedRequestId, $convertedLog['request_id'], 'ApiRequest-converted failures must log the response request ID.');
    $assertSame('index', $convertedLog['endpoint'], 'Converted API failures must use the fixed index endpoint.');
    $assertSame('session', $convertedLog['action'], 'Converted API failures must use the parsed whitelisted action.');
    $assertSame(503, $convertedLog['status'], 'Converted API failures must log their status.');
    $assertSame(\addons\pingfangapi\service\ApiException::class, $convertedLog['exception_class'], 'Converted API failures must identify the safe exception class.');

    $GLOBALS['config']['user']['login_verify'] = 0;
    $GLOBALS['pingfang_test_request'] = new PingfangApiControllerRequest('GET', [
        'action' => 'detail',
        'vod_id' => '42',
    ]);
    $GLOBALS['pingfang_test_detail_throws'] = true;
    $GLOBALS['pingfang_test_traces'] = [];
    $indexFailure = $controller->index();
    $assertSame(500, $indexFailure['status'], 'Unhandled index failures must return 500.');
    $indexFailureRequestId = $assertRequestId($indexFailure, 'Unhandled index failures must include a request ID.');
    $assertSame(1, count($GLOBALS['pingfang_test_traces']), 'Unhandled index failures must be logged once.');
    $indexFailureLog = $decodeLog($GLOBALS['pingfang_test_traces'][0]);
    $assertSame($indexFailureRequestId, $indexFailureLog['request_id'], 'Unhandled index logs must use the response request ID.');
    $assertSame('index', $indexFailureLog['endpoint'], 'Unhandled API failures must use the fixed index endpoint.');
    $assertSame('detail', $indexFailureLog['action'], 'Unhandled API failures must use a whitelisted action.');
    $assertSame(500, $indexFailureLog['status'], 'Unhandled API failures must log status 500.');
    $assertSame(\RuntimeException::class, $indexFailureLog['exception_class'], 'Unhandled API failures must log only the exception class.');
    $GLOBALS['pingfang_test_detail_throws'] = false;

    $GLOBALS['pingfang_test_traces'] = [];
    $missing = $controller->_empty();
    $assertSame(404, $missing['status'], 'Unknown controller actions must return a JSON 404.');
    $assertSame('application/json; charset=utf-8', $missing['headers']['Content-Type'], 'Unknown actions must not render HTML.');
    $assertRequestId($missing, 'Unknown-action responses must include a request ID.');
    $assertSame([], $GLOBALS['pingfang_test_traces'], 'Unknown-action 404 responses must not be logged.');

    $baseInfo = [
        'vod_id' => 42,
        'type_id' => 1,
        'vod_trysee' => 0,
        'vod_copyright' => 0,
        'vod_tpl_play' => 'play',
        'vod_pwd_play' => '',
        'vod_points' => 0,
        'vod_points_play' => 0,
        'vod_play_from' => 'dyttm3u8',
        'vod_play_server' => '',
        'vod_play_note' => '',
        'vod_play_url' => 'HD国语$https://media.example/video/index.m3u8?token=secret',
    ];
    $GLOBALS['config'] = [
        'site' => ['site_status' => 1, 'mainland_ip_limit' => '0'],
        'app' => ['copyright_status' => 0],
        'user' => ['trysee' => 5],
        'rewrite' => ['vod_id' => 1],
    ];
    $GLOBALS['pingfang_test_vod_result'] = ['code' => 1, 'info' => $baseInfo];
    $GLOBALS['pingfang_test_sessions'] = [];
    $GLOBALS['pingfang_test_detail_throws'] = false;
    $GLOBALS['pingfang_test_device_logout_throws'] = false;
    $GLOBALS['user'] = [];

    foreach ([
        ['code' => 1, 'trysee' => 0],
        ['code' => 3002, 'trysee' => 5],
        ['code' => 3001, 'trysee' => 0],
    ] as $access) {
        \app\common\controller\All::$access = $access;
        \app\common\controller\All::$calls = [];
        $GLOBALS['config']['app']['copyright_status'] = 3;
        $GLOBALS['pingfang_test_vod_result']['info'] = array_merge($baseInfo, ['vod_copyright' => 1]);

        $copyright = $controller->player();
        $assertSame('template:vod/copyright', $copyright['body'], 'Copyright mode 3 must block player rendering for every access outcome.');
        $assertPrivatePlayer($copyright, 'Copyright responses must never be shared-cacheable.');
        $assertSame(false, in_array('check_user_popedom', \app\common\controller\All::$calls, true), 'Copyright mode 3 must run before player access and trial branches.');
        $assertSame(false, in_array('label_vod_play', \app\common\controller\All::$calls, true), 'Copyright mode 3 must run before playback data is prepared.');
        $assertSame(true, in_array('assign:param', \app\common\controller\All::$calls, true), 'Copyright mode 3 must still provide the route parameters required by the shared page header.');
        $assertSame(true, in_array('assign:obj', \app\common\controller\All::$calls, true), 'Copyright mode 3 must still provide the video object required by the copyright template.');
    }

    $GLOBALS['config']['app']['copyright_status'] = 4;
    $GLOBALS['pingfang_test_vod_result']['info'] = array_merge($baseInfo, ['vod_copyright' => 1]);
    \app\common\controller\All::$access = ['code' => 1, 'trysee' => 0];
    \app\common\controller\All::$calls = [];
    $copyrightAfterAccess = $controller->player();
    $assertSame('template:vod/copyright', $copyrightAfterAccess['body'], 'Copyright mode 4 must remain enforced after playback data is prepared.');
    $assertSame(true, in_array('label_vod_play', \app\common\controller\All::$calls, true), 'Copyright mode 4 must retain the native post-access behavior.');
    $assertPrivatePlayer($copyrightAfterAccess, 'Copyright mode 4 responses must never be shared-cacheable.');

    $GLOBALS['config']['app']['copyright_status'] = 0;
    $GLOBALS['pingfang_test_vod_result']['info'] = $baseInfo;
    \app\common\controller\All::$access = ['code' => 1, 'trysee' => 0];
    $player = $controller->player();
    $assertSame(true, str_contains($player['body'], 'template:vod/player'), 'Authorized playback must render the native player template.');
    $assertSame(true, str_contains($player['body'], 'data-pingfang-player-embed'), 'The React player route must suppress the nested native page chrome.');
    $assertSame(
        ['vod_id' => ['eq', 42], 'vod_status' => ['eq', 1], 'vod_recycle_time' => 0],
        $GLOBALS['pingfang_test_vod_where'],
        'The API player must resolve its numeric Vod ID independently of the public rewrite mode.'
    );
    $assertPrivatePlayer($player, 'Authorized player HTML must never be shared-cacheable.');
    $playerRequestId = $assertRequestId($player, 'Player responses must include a request ID.');

    \app\common\controller\All::$calls = [];
    $GLOBALS['pingfang_test_player_ps'] = '0';
    $stream = $controller->stream();
    $assertSame(302, $stream['status'], 'Authorized direct playback must redirect through the protected media route.');
    $assertSame(
        'https://media.example/video/index.m3u8?token=secret',
        $stream['headers']['Location'],
        'The protected media route must preserve the exact MacCMS media URL.'
    );
    $assertPrivatePlayer($stream, 'Authorized media redirects must never be shared-cacheable.');
    $streamRequestId = $assertRequestId($stream, 'Stream responses must include a request ID.');
    $assertSame(false, hash_equals($playerRequestId, $streamRequestId), 'Each controller request must receive a new server-generated request ID.');
    $assertSame(true, in_array('check_user_popedom', \app\common\controller\All::$calls, true), 'Media redirects must repeat the native playback permission check.');

    \app\common\controller\All::$access = ['code' => 3002, 'trysee' => 5, 'msg' => '允许试看'];
    $trialStream = $controller->stream();
    $assertSame(403, $trialStream['status'], 'Trial media must fail closed when the redirect cannot enforce the viewing limit.');
    $assertSame(false, isset($trialStream['headers']['Location']), 'Trial media responses must not expose the full source URL.');
    $assertPrivatePlayer($trialStream, 'Trial media responses must never be shared-cacheable.');

    \app\common\controller\All::$access = ['code' => 1, 'trysee' => 0];
    $GLOBALS['pingfang_test_player_ps'] = '1';
    $GLOBALS['pingfang_test_traces'] = [];
    $parserStream = $controller->stream();
    $assertSame(503, $parserStream['status'], 'MacCMS parser pages must not be redirected into the direct media player.');
    $assertSame(false, isset($parserStream['headers']['Location']), 'Unsupported parser lines must not expose a redirect target.');
    $assertPrivatePlayer($parserStream, 'Unsupported parser responses must never be shared-cacheable.');
    $parserRequestId = $assertRequestId($parserStream, 'Unsupported parser responses must include a request ID.');
    $assertSame(1, count($GLOBALS['pingfang_test_traces']), 'Unsupported parser failures must be logged once.');
    $parserLog = $decodeLog($GLOBALS['pingfang_test_traces'][0]);
    $assertSame($parserRequestId, $parserLog['request_id'], 'Parser failure logs must use the response request ID.');
    $assertSame('stream', $parserLog['endpoint'], 'Parser failures must use the fixed stream endpoint.');
    $assertSame('stream', $parserLog['action'], 'Parser failures must use the whitelisted stream action.');
    $assertSame(503, $parserLog['status'], 'Parser failures must log status 503.');
    $GLOBALS['pingfang_test_player_ps'] = '0';

    \app\common\controller\All::$access = ['code' => 3001, 'trysee' => 0, 'msg' => '无权播放'];
    $deniedStream = $controller->stream();
    $assertSame(403, $deniedStream['status'], 'Denied media redirects must preserve the native playback gate.');
    $assertSame(false, isset($deniedStream['headers']['Location']), 'Denied media responses must not expose a redirect target.');
    $assertPrivatePlayer($deniedStream, 'Denied media responses must never be shared-cacheable.');

    \app\common\controller\All::$access = ['code' => 3001, 'trysee' => 0];
    $denied = $controller->player();
    $assertSame('template:vod/play', $denied['body'], 'Denied playback without trial must retain the native play paywall template.');
    $assertPrivatePlayer($denied, 'Denied player HTML must never be shared-cacheable.');

    \app\common\controller\All::$access = ['code' => 1, 'trysee' => 0];
    $GLOBALS['pingfang_test_vod_result']['info'] = array_merge($baseInfo, ['vod_pwd_play' => 'secret']);
    $password = $controller->player();
    $assertSame('template:vod/player_pwd', $password['body'], 'Password-protected playback must retain the native password template.');
    $assertPrivatePlayer($password, 'Password player HTML must never be shared-cacheable.');

    $GLOBALS['pingfang_test_vod_result'] = ['code' => 404, 'info' => []];
    $notFound = $controller->player();
    $assertSame(404, $notFound['status'], 'Missing playback data must return 404.');
    $assertPrivatePlayer($notFound, 'Missing player responses must never be shared-cacheable.');

    $GLOBALS['config']['site']['site_status'] = 0;
    $maintenance = $controller->player();
    $assertSame(503, $maintenance['status'], 'Player requests must preserve the site maintenance policy.');
    $assertPrivatePlayer($maintenance, 'Player policy errors must never be shared-cacheable.');

    $GLOBALS['config']['site']['site_status'] = 1;
    $GLOBALS['pingfang_test_detail_throws'] = true;
    $GLOBALS['pingfang_test_traces'] = [];
    $serverError = $controller->player();
    $assertSame(500, $serverError['status'], 'Unexpected player failures must return 500.');
    $assertPrivatePlayer($serverError, 'Unexpected player failures must never be shared-cacheable.');
    $serverErrorRequestId = $assertRequestId($serverError, 'Unexpected player failures must include a request ID.');
    $assertSame(1, count($GLOBALS['pingfang_test_traces']), 'Unexpected player failures must be logged once.');
    $serverErrorLog = $decodeLog($GLOBALS['pingfang_test_traces'][0]);
    $assertSame($serverErrorRequestId, $serverErrorLog['request_id'], 'Unhandled failure logs must use the response request ID.');
    $assertSame('player', $serverErrorLog['endpoint'], 'Unhandled player failures must use the fixed player endpoint.');
    $assertSame('player', $serverErrorLog['action'], 'Unhandled player failures must use the whitelisted player action.');
    $assertSame(500, $serverErrorLog['status'], 'Unhandled player logs must include status 500.');
    $assertSame(\RuntimeException::class, $serverErrorLog['exception_class'], 'Unhandled failure logs must include only the exception class.');
    foreach (['token=secret', 'csrf=hidden', 'Cookie=session', 'media.example', 'action=detail'] as $secret) {
        $assertSame(false, str_contains($GLOBALS['pingfang_test_traces'][0]['message'], $secret), 'Failure logs must not include request or exception secrets.');
    }

    $GLOBALS['pingfang_test_detail_throws'] = false;
    $GLOBALS['pingfang_test_device_logout_throws'] = true;
    $GLOBALS['pingfang_test_sessions'] = [
        \addons\pingfangapi\service\AccountService::CSRF_SESSION_KEY => str_repeat('b', 64),
    ];
    $GLOBALS['user'] = ['user_id' => 42, 'user_name' => 'alice'];
    $GLOBALS['pingfang_test_request'] = new PingfangApiControllerRequest('POST', ['action' => 'logout'], '{}', [
        'Content-Type' => 'application/json',
        'Host' => 'react.ping2.my',
        'Origin' => 'https://react.ping2.my',
        'Sec-Fetch-Site' => 'same-origin',
        'X-Requested-With' => 'XMLHttpRequest',
        'X-CSRF-Token' => str_repeat('b', 64),
        'X-Request-ID' => $clientRequestId,
    ]);
    $GLOBALS['pingfang_test_traces'] = [];
    $logout = $controller->index();
    $assertSame(200, $logout['status'], 'A device revocation logging failure must not prevent native logout.');
    $logoutRequestId = $assertRequestId($logout, 'Successful index responses must include a request ID.');
    $assertSame(false, hash_equals($clientRequestId, $logoutRequestId), 'Successful responses must ignore client-provided request IDs.');
    $assertSame(1, count($GLOBALS['pingfang_test_traces']), 'The AccountService failure must produce one safe log.');
    $accountLog = $decodeLog($GLOBALS['pingfang_test_traces'][0]);
    $assertSame($logoutRequestId, $accountLog['request_id'], 'The controller must pass its request ID into AccountService.');
    $assertSame('account', $accountLog['endpoint'], 'AccountService failures must use the fixed account endpoint.');
    $assertSame('revoke_logout_device', $accountLog['action'], 'AccountService failures must use a whitelisted action.');
    $assertSame(500, $accountLog['status'], 'AccountService failures must include their fixed status.');
    $assertSame(\RuntimeException::class, $accountLog['exception_class'], 'AccountService logs must include only the exception class.');
    foreach (['token=secret', 'csrf=hidden', 'Cookie=session', 'media.example', 'action=detail'] as $secret) {
        $assertSame(false, str_contains($GLOBALS['pingfang_test_traces'][0]['message'], $secret), 'AccountService logs must not include exception secrets.');
    }

    echo "Pingfang production API controller tests passed.\n";
}
