<?php
declare(strict_types=1);

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

    function mac_param_url()
    {
        return ['id' => 42, 'sid' => 1, 'nid' => 1];
    }

    final class PingfangApiControllerVodModel
    {
        public function infoData($where, $fields = '*', $cache = 0)
        {
            if (!empty($GLOBALS['pingfang_test_detail_throws'])) {
                throw new \RuntimeException('detail failed');
            }
            $GLOBALS['pingfang_test_vod_where'] = $where;
            return $GLOBALS['pingfang_test_vod_result'];
        }
    }

    function model($name)
    {
        return (string) $name === 'Vod' ? new PingfangApiControllerVodModel() : null;
    }

    function mac_tpl_fetch($mid, $template, $fallback)
    {
        return $mid . '/' . ($template !== '' ? $template : $fallback);
    }

    function session($key)
    {
        return isset($GLOBALS['pingfang_test_sessions'][$key]) ? $GLOBALS['pingfang_test_sessions'][$key] : null;
    }

    function trace($message, $level)
    {
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

    $controller = new \app\index\controller\Pingfangapi();

    $GLOBALS['config'] = ['site' => ['site_status' => 0, 'mainland_ip_limit' => '0']];
    $closed = $controller->index();
    $assertSame(503, $closed['status'], 'A closed site must return a JSON 503 before API services run.');
    $assertSame(503, $closed['body']['code'], 'A closed site must keep the standard API envelope.');
    $assertSame('private, no-store', $closed['headers']['Cache-Control'], 'Site policy errors must never be shared-cacheable.');

    $GLOBALS['config'] = ['site' => ['site_status' => 1, 'mainland_ip_limit' => '1']];
    \ip_limit\IpLocationQuery::$location = '';
    $blocked = $controller->index();
    $assertSame(403, $blocked['status'], 'The API must preserve MacCMS mainland access policy as JSON.');

    $missing = $controller->_empty();
    $assertSame(404, $missing['status'], 'Unknown controller actions must return a JSON 404.');
    $assertSame('application/json; charset=utf-8', $missing['headers']['Content-Type'], 'Unknown actions must not render HTML.');

    $baseInfo = [
        'vod_id' => 42,
        'type_id' => 1,
        'vod_trysee' => 0,
        'vod_copyright' => 0,
        'vod_tpl_play' => 'play',
        'vod_pwd_play' => '',
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
    $serverError = $controller->player();
    $assertSame(500, $serverError['status'], 'Unexpected player failures must return 500.');
    $assertPrivatePlayer($serverError, 'Unexpected player failures must never be shared-cacheable.');

    echo "Pingfang production API controller tests passed.\n";
}
